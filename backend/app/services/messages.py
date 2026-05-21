import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete as sa_delete
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event, EventParticipant
from app.models.message import EventReadReceipt, Message
from app.models.notification import Notification
from app.models.user import User


async def assert_participant(db: AsyncSession, event_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Vérifie que l'utilisateur est bien participant actif de la sortie."""
    result = await db.execute(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.user_id == user_id,
            EventParticipant.status == "joined",
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu n'es pas participant de cette sortie",
        )


async def save_message(
    db: AsyncSession, event_id: uuid.UUID, sender_id: uuid.UUID, content: str
) -> Message:
    """Persiste un message en base de données."""
    msg = Message(event_id=event_id, sender_id=sender_id, content=content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def get_history(
    db: AsyncSession,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    limit: int = 50,
    before_id: uuid.UUID | None = None,
) -> list[Message]:
    """
    Retourne les derniers messages d'une sortie (les plus récents en dernier).
    Vérifie que l'utilisateur est participant.
    Si before_id est fourni, retourne les messages antérieurs à ce message (pagination infinie).
    """
    await assert_participant(db, event_id, user_id)

    query = (
        select(Message)
        .where(Message.event_id == event_id)
        .options(selectinload(Message.sender))
        .order_by(Message.created_at.desc())
        .limit(limit)
    )

    if before_id is not None:
        # Récupérer la date du message de référence pour paginer
        ref = await db.execute(select(Message.created_at).where(Message.id == before_id))
        ref_date = ref.scalar_one_or_none()
        if ref_date:
            query = query.where(Message.created_at < ref_date)

    result = await db.execute(query)
    messages = result.scalars().all()
    # Remettre dans l'ordre chronologique (du plus ancien au plus récent)
    return list(reversed(messages))


async def cleanup_expired_event_chats(db: AsyncSession) -> int:
    """
    Supprime les messages des sorties terminées depuis plus de 7 jours.
    Exception : les sorties ayant au moins un participant premium sont préservées.
    Nettoie aussi les read receipts et notifications orphelines.
    Retourne le nombre de messages supprimés.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    # Sous-requête : sorties expirées SANS aucun participant premium
    expired_events = (
        select(Event.id)
        .where(Event.starts_at < cutoff)
        .where(
            ~exists(
                select(EventParticipant.user_id)
                .join(User, User.id == EventParticipant.user_id)
                .where(
                    EventParticipant.event_id == Event.id,
                    EventParticipant.status == "joined",
                    User.is_premium == True,  # noqa: E712
                )
            )
        )
    )

    # 1. Supprimer les messages
    result = await db.execute(
        sa_delete(Message).where(Message.event_id.in_(expired_events))
    )
    deleted_count = result.rowcount

    # 2. Nettoyer les read receipts orphelins (plus de messages → pastille fantôme)
    await db.execute(
        sa_delete(EventReadReceipt).where(
            EventReadReceipt.event_id.in_(expired_events)
        )
    )

    # 3. Nettoyer les notifications liées à ces sorties (related_id = event_id)
    expired_ids_result = await db.execute(expired_events)
    expired_ids = [str(eid) for eid in expired_ids_result.scalars().all()]
    if expired_ids:
        await db.execute(
            sa_delete(Notification).where(
                Notification.related_id.in_(expired_ids),
                Notification.type.in_(
                    ["event_join", "event_leave", "event_invite", "event_delete", "new_message"]
                ),
            )
        )

    # 4. Nettoyer les notifications orphelines : sorties expirées dont les messages
    #    ont déjà été supprimés (avant le fix premium). Concerne TOUTES les sorties
    #    expirées sans messages restants, y compris les sorties premium.
    all_expired_events = select(Event.id).where(Event.starts_at < cutoff)
    orphan_events = (
        all_expired_events.where(
            ~exists(
                select(Message.id).where(Message.event_id == Event.id)
            )
        )
    )
    orphan_ids_result = await db.execute(orphan_events)
    orphan_ids = [str(eid) for eid in orphan_ids_result.scalars().all()]
    if orphan_ids:
        await db.execute(
            sa_delete(Notification).where(
                Notification.related_id.in_(orphan_ids),
                Notification.type.in_(
                    ["event_join", "event_leave", "event_invite", "event_delete", "new_message"]
                ),
            )
        )
        # Nettoyer aussi les read receipts orphelins de ces sorties
        orphan_uuids = [uuid.UUID(eid) for eid in orphan_ids]
        await db.execute(
            sa_delete(EventReadReceipt).where(
                EventReadReceipt.event_id.in_(orphan_uuids)
            )
        )

    await db.commit()
    return deleted_count


def message_to_dict(msg: Message) -> dict:
    """Sérialise un Message en dict JSON-compatible pour le WebSocket ou la réponse REST."""
    sender = None
    if msg.sender:
        sender = {
            "id": str(msg.sender.id),
            "first_name": msg.sender.first_name,
            "avatar_url": msg.sender.avatar_url,
            "is_verified": msg.sender.is_verified,
        }

    return {
        "id": str(msg.id),
        "event_id": str(msg.event_id),
        "content": "[Message supprimé]" if msg.is_deleted else msg.content,
        "sender": sender,
        "created_at": (
            msg.created_at.replace(tzinfo=timezone.utc).isoformat()
            if msg.created_at and msg.created_at.tzinfo is None
            else (msg.created_at.isoformat() if msg.created_at else None)
        ),
        "is_deleted": msg.is_deleted,
    }
