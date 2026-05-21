import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.friendship import Friendship
from app.models.message import PrivateMessage
from app.models.notification import Notification
from app.models.user import User


async def send_dm(
    db: AsyncSession, sender: User, receiver_id: uuid.UUID, content: str
) -> PrivateMessage:
    """Envoie un message privé (premium requis). Seuls les amis peuvent s'écrire."""
    if not sender.is_premium and not sender.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Fonctionnalité réservée aux membres Premium",
        )

    from app.services.friendships import get_friendship_status_for

    if sender.id == receiver_id:
        raise HTTPException(status_code=400, detail="Tu ne peux pas t'écrire à toi-même")

    # Vérifier que le destinataire existe
    receiver = await db.get(User, receiver_id)
    if not receiver or receiver.is_banned:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    # Vérifier que les deux utilisateurs sont amis
    friendship_status = await get_friendship_status_for(db, sender.id, receiver_id)
    if friendship_status != "friends":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous devez être amis pour échanger des messages privés",
        )

    # Valider la longueur du message
    content = content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Le message ne peut pas être vide")
    if len(content) > 2000:
        raise HTTPException(status_code=400, detail="Le message ne peut pas dépasser 2000 caractères")

    msg = PrivateMessage(sender_id=sender.id, receiver_id=receiver_id, content=content)
    db.add(msg)

    # Notifier le destinataire — une seule notif par conversation toutes les 5 min
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
        recent = await db.execute(
            select(Notification).where(
                Notification.user_id == receiver_id,
                Notification.type == "new_dm",
                Notification.actor_id == sender.id,
                Notification.created_at >= cutoff,
            ).limit(1)
        )
        if not recent.scalar_one_or_none():
            from app.services.notifications import create_notification
            await create_notification(
                db,
                user_id=receiver_id,
                type="new_dm",
                content=f"{sender.first_name} t'a envoyé un message",
                actor_id=sender.id,
                related_id=str(sender.id),
            )
    except Exception:
        pass  # Ne pas bloquer l'envoi si la table notifications n'est pas encore disponible

    await db.commit()
    await db.refresh(msg)
    return msg


async def get_dm_history(
    db: AsyncSession,
    user_a: uuid.UUID,
    user_b: uuid.UUID,
    limit: int = 50,
    before_id: uuid.UUID | None = None,
) -> list[PrivateMessage]:
    """Historique paginé des messages entre deux utilisateurs."""
    query = (
        select(PrivateMessage)
        .where(
            or_(
                (PrivateMessage.sender_id == user_a) & (PrivateMessage.receiver_id == user_b),
                (PrivateMessage.sender_id == user_b) & (PrivateMessage.receiver_id == user_a),
            )
        )
        .order_by(PrivateMessage.created_at.desc())
        .limit(limit)
    )

    if before_id is not None:
        ref = await db.execute(
            select(PrivateMessage.created_at).where(PrivateMessage.id == before_id)
        )
        ref_date = ref.scalar_one_or_none()
        if ref_date:
            query = query.where(PrivateMessage.created_at < ref_date)

    result = await db.execute(query)
    messages = result.scalars().all()
    # Du plus ancien au plus récent
    return list(reversed(messages))


async def mark_dm_read(
    db: AsyncSession, reader_id: uuid.UUID, partner_id: uuid.UUID
) -> None:
    """Marque tous les messages reçus depuis partner_id comme lus."""
    result = await db.execute(
        select(PrivateMessage).where(
            PrivateMessage.sender_id == partner_id,
            PrivateMessage.receiver_id == reader_id,
            PrivateMessage.is_read.is_(False),
        )
    )
    for msg in result.scalars().all():
        msg.is_read = True
    await db.commit()


async def get_dm_conversations(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """
    Retourne la liste des conversations DM avec le dernier message
    et le nombre de messages non lus, triée par activité décroissante.
    """
    # Récupérer tous les messages impliquant l'utilisateur, triés par date desc
    result = await db.execute(
        select(PrivateMessage)
        .where(
            or_(
                PrivateMessage.sender_id == user_id,
                PrivateMessage.receiver_id == user_id,
            )
        )
        .order_by(PrivateMessage.created_at.desc())
    )
    all_messages = result.scalars().all()

    # Un seul message le plus récent par partenaire
    seen: dict[uuid.UUID, PrivateMessage] = {}
    for msg in all_messages:
        partner_id = msg.receiver_id if msg.sender_id == user_id else msg.sender_id
        if partner_id not in seen:
            seen[partner_id] = msg

    # Batch-load tous les partenaires en une seule requête
    partner_ids = list(seen.keys())
    if not partner_ids:
        return []

    partners_result = await db.execute(
        select(User).where(User.id.in_(partner_ids))
    )
    partners_map: dict[uuid.UUID, User] = {
        u.id: u for u in partners_result.scalars().all()
    }

    # Compter les messages non lus groupés par expéditeur en une seule requête
    unread_result = await db.execute(
        select(PrivateMessage.sender_id, func.count()).where(
            PrivateMessage.receiver_id == user_id,
            PrivateMessage.is_read.is_(False),
            PrivateMessage.sender_id.in_(partner_ids),
        ).group_by(PrivateMessage.sender_id)
    )
    unread_map: dict[uuid.UUID, int] = dict(unread_result.all())

    conversations = []
    # Récupérer les blocages pour cet utilisateur
    blocked_result = await db.execute(
        select(Friendship).where(
            or_(
                (Friendship.requester_id == user_id) & (Friendship.status == "blocked"),
                (Friendship.addressee_id == user_id) & (Friendship.status == "blocked"),
            )
        )
    )
    blocked_partner_ids = set()
    for f in blocked_result.scalars().all():
        other = f.addressee_id if f.requester_id == user_id else f.requester_id
        blocked_partner_ids.add(other)

    for partner_id, last_msg in seen.items():
        partner = partners_map.get(partner_id)
        if not partner or partner.is_banned or partner_id in blocked_partner_ids:
            continue

        conversations.append({
            "partner": partner,
            "last_message": last_msg.content,
            "last_message_at": last_msg.created_at,
            "unread_count": unread_map.get(partner_id, 0),
        })

    # Trier par dernier message décroissant
    conversations.sort(key=lambda c: c["last_message_at"], reverse=True)
    return conversations


async def get_dm_unread_total(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Retourne le nombre total de DMs non lus."""
    result = await db.execute(
        select(func.count()).select_from(PrivateMessage).where(
            PrivateMessage.receiver_id == user_id,
            PrivateMessage.is_read.is_(False),
        )
    )
    return result.scalar() or 0
