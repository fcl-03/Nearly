import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.friendship import Friendship
from app.models.user import User


def _get_friendship_status(
    friendship: Friendship | None,
    current_user_id: uuid.UUID,
) -> str:
    """Retourne le statut de la relation du point de vue de l'utilisateur courant."""
    if not friendship:
        return "none"
    if friendship.status == "blocked":
        # Celui qui a bloqué voit "blocked", l'autre voit "none" (on ne révèle pas le blocage)
        if friendship.requester_id == current_user_id:
            return "blocked"
        return "none"
    if friendship.status == "accepted":
        return "friends"
    if friendship.status == "pending":
        if friendship.requester_id == current_user_id:
            return "request_sent"       # J'ai envoyé la demande
        return "request_received"       # J'ai reçu la demande
    return "none"


async def _get_friendship(
    db: AsyncSession,
    user_a: uuid.UUID,
    user_b: uuid.UUID,
) -> Friendship | None:
    """Récupère la relation entre deux utilisateurs (dans les deux sens)."""
    result = await db.execute(
        select(Friendship).where(
            or_(
                (Friendship.requester_id == user_a) & (Friendship.addressee_id == user_b),
                (Friendship.requester_id == user_b) & (Friendship.addressee_id == user_a),
            )
        )
    )
    return result.scalar_one_or_none()


async def send_friend_request(
    db: AsyncSession, current_user: User, target_id: uuid.UUID
) -> dict:
    """Envoie une demande d'ami."""

    if current_user.id == target_id:
        raise HTTPException(status_code=400, detail="Tu ne peux pas t'ajouter toi-même")

    # Vérifier que la cible existe
    target = await db.get(User, target_id)
    if not target or target.is_banned:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    existing = await _get_friendship(db, current_user.id, target_id)
    if existing:
        if existing.status == "blocked":
            raise HTTPException(status_code=403, detail="Action impossible")
        if existing.status == "accepted":
            raise HTTPException(status_code=409, detail="Vous êtes déjà amis")
        if existing.status == "pending":
            raise HTTPException(status_code=409, detail="Une demande est déjà en attente")

    db.add(Friendship(requester_id=current_user.id, addressee_id=target_id))

    # Notifier le destinataire
    from app.services.notifications import create_notification
    await create_notification(
        db,
        user_id=target_id,
        type="friend_request",
        content=f"{current_user.first_name} t'a envoyé une demande d'ami",
        actor_id=current_user.id,
    )

    await db.commit()

    # Email fire-and-forget
    from app.services.email import fire, send_friend_request_email
    fire(send_friend_request_email(target.email, target.first_name, current_user.first_name))

    return {"friendship_status": "request_sent"}


async def accept_friend_request(
    db: AsyncSession, current_user: User, requester_id: uuid.UUID
) -> dict:
    """Accepte une demande d'ami reçue."""
    friendship = await _get_friendship(db, current_user.id, requester_id)

    if not friendship or friendship.status != "pending":
        raise HTTPException(status_code=404, detail="Demande introuvable")

    if friendship.addressee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Ce n'est pas ta demande à accepter")

    friendship.status = "accepted"

    # Notifier celui qui avait envoyé la demande
    from app.services.notifications import create_notification
    await create_notification(
        db,
        user_id=friendship.requester_id,
        type="friend_accepted",
        content=f"{current_user.first_name} a accepté ta demande d'ami",
        actor_id=current_user.id,
    )

    await db.commit()

    # Email fire-and-forget — notifier celui qui avait envoyé la demande
    requester = await db.get(User, friendship.requester_id)
    if requester:
        from app.services.email import fire, send_friend_accepted_email
        fire(send_friend_accepted_email(requester.email, requester.first_name, current_user.first_name))

    return {"friendship_status": "friends"}


async def reject_friend_request(
    db: AsyncSession, current_user: User, requester_id: uuid.UUID
) -> dict:
    """Refuse ou annule une demande d'ami."""
    friendship = await _get_friendship(db, current_user.id, requester_id)

    if not friendship or friendship.status != "pending":
        raise HTTPException(status_code=404, detail="Demande introuvable")

    # L'addressee refuse, ou le requester annule sa propre demande
    if friendship.addressee_id != current_user.id and friendship.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Action non autorisée")

    await db.delete(friendship)
    await db.commit()
    return {"friendship_status": "none"}


async def remove_friend(
    db: AsyncSession, current_user: User, other_id: uuid.UUID
) -> dict:
    """Supprime une amitié existante."""
    friendship = await _get_friendship(db, current_user.id, other_id)

    if not friendship or friendship.status != "accepted":
        raise HTTPException(status_code=404, detail="Vous n'êtes pas amis")

    await db.delete(friendship)
    await db.commit()
    return {"friendship_status": "none"}


async def get_friends(db: AsyncSession, user_id: uuid.UUID) -> list[User]:
    """Retourne la liste des amis d'un utilisateur."""
    result = await db.execute(
        select(Friendship).where(
            or_(
                Friendship.requester_id == user_id,
                Friendship.addressee_id == user_id,
            ),
            Friendship.status == "accepted",
        )
    )
    friendships = result.scalars().all()

    friend_ids = [
        f.addressee_id if f.requester_id == user_id else f.requester_id
        for f in friendships
    ]
    if not friend_ids:
        return []

    users_result = await db.execute(select(User).where(User.id.in_(friend_ids)))
    return list(users_result.scalars().all())


async def get_pending_requests(db: AsyncSession, user_id: uuid.UUID) -> list[User]:
    """Retourne les utilisateurs qui ont envoyé une demande en attente."""
    result = await db.execute(
        select(Friendship).where(
            Friendship.addressee_id == user_id,
            Friendship.status == "pending",
        )
    )
    friendships = result.scalars().all()
    requester_ids = [f.requester_id for f in friendships]
    if not requester_ids:
        return []

    users_result = await db.execute(select(User).where(User.id.in_(requester_ids)))
    return list(users_result.scalars().all())


async def block_user(
    db: AsyncSession, current_user: User, target_id: uuid.UUID
) -> dict:
    """Bloque un utilisateur. Supprime toute relation existante et crée un blocage."""
    if current_user.id == target_id:
        raise HTTPException(status_code=400, detail="Tu ne peux pas te bloquer toi-même")

    target = await db.get(User, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    existing = await _get_friendship(db, current_user.id, target_id)
    if existing:
        if existing.status == "blocked" and existing.requester_id == current_user.id:
            raise HTTPException(status_code=409, detail="Utilisateur déjà bloqué")
        # Supprimer la relation existante (amitié, demande en attente, ou blocage par l'autre)
        await db.delete(existing)
        await db.flush()

    # Créer le blocage — requester_id = celui qui bloque
    db.add(Friendship(requester_id=current_user.id, addressee_id=target_id, status="blocked"))
    await db.commit()
    return {"friendship_status": "blocked"}


async def unblock_user(
    db: AsyncSession, current_user: User, target_id: uuid.UUID
) -> dict:
    """Débloque un utilisateur."""
    existing = await _get_friendship(db, current_user.id, target_id)

    if not existing or existing.status != "blocked" or existing.requester_id != current_user.id:
        raise HTTPException(status_code=404, detail="Cet utilisateur n'est pas bloqué")

    await db.delete(existing)
    await db.commit()
    return {"friendship_status": "none"}


async def is_blocked(
    db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID
) -> bool:
    """Vérifie si l'un des deux utilisateurs a bloqué l'autre."""
    friendship = await _get_friendship(db, user_a, user_b)
    return friendship is not None and friendship.status == "blocked"


async def get_friendship_status_for(
    db: AsyncSession, current_user_id: uuid.UUID, target_id: uuid.UUID
) -> str:
    """Retourne le statut de la relation entre current_user et target."""
    friendship = await _get_friendship(db, current_user_id, target_id)
    return _get_friendship_status(friendship, current_user_id)
