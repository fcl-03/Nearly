import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.badge import Badge, UserBadge
from app.models.event import EventParticipant
from app.models.user import User


async def get_all_badges(db: AsyncSession) -> list[Badge]:
    """Retourne les 6 badges disponibles."""
    result = await db.execute(select(Badge).order_by(Badge.id))
    return list(result.scalars().all())


async def get_user_badges_summary(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """
    Retourne un résumé des badges reçus par un utilisateur :
    [{badge_id, name, emoji, count}] triés par count décroissant.
    """
    result = await db.execute(
        select(Badge, func.count(UserBadge.id).label("count"))
        .join(UserBadge, UserBadge.badge_id == Badge.id)
        .where(UserBadge.receiver_id == user_id)
        .group_by(Badge.id)
        .order_by(func.count(UserBadge.id).desc())
    )
    return [
        {"id": badge.id, "name": badge.name, "emoji": badge.emoji, "count": count}
        for badge, count in result.all()
    ]


async def get_badges_given_to(
    db: AsyncSession, giver_id: uuid.UUID, receiver_id: uuid.UUID
) -> list[int]:
    """Retourne les badge_ids déjà donnés par giver à receiver."""
    result = await db.execute(
        select(UserBadge.badge_id).where(
            UserBadge.giver_id == giver_id,
            UserBadge.receiver_id == receiver_id,
        )
    )
    return list(result.scalars().all())


async def give_badge(
    db: AsyncSession,
    giver: User,
    receiver_id: uuid.UUID,
    badge_id: int,
) -> dict:
    """
    Donne un badge à un utilisateur.
    Conditions :
    - Avoir participé à au moins une sortie ensemble (passée)
    - Ne pas avoir déjà donné ce badge à cette personne
    """
    if giver.id == receiver_id:
        raise HTTPException(status_code=400, detail="Tu ne peux pas te donner un badge à toi-même")

    # Vérifier que le badge existe
    badge = await db.get(Badge, badge_id)
    if not badge:
        raise HTTPException(status_code=404, detail="Badge introuvable")

    # Vérifier que receiver existe
    receiver = await db.get(User, receiver_id)
    if not receiver or receiver.is_banned:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    # Vérifier une sortie commune (event_id pour la contrainte)
    shared_event_result = await db.execute(
        select(EventParticipant.event_id)
        .where(
            EventParticipant.user_id == giver.id,
            EventParticipant.status == "joined",
            EventParticipant.event_id.in_(
                select(EventParticipant.event_id).where(
                    EventParticipant.user_id == receiver_id,
                    EventParticipant.status == "joined",
                )
            ),
        )
        .limit(1)
    )
    shared_event_id = shared_event_result.scalar_one_or_none()
    if not shared_event_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous devez avoir participé à une sortie ensemble pour donner un badge",
        )

    # Vérifier que ce badge n'a pas déjà été donné (contrainte UNIQUE)
    existing = await db.execute(
        select(UserBadge).where(
            UserBadge.giver_id == giver.id,
            UserBadge.receiver_id == receiver_id,
            UserBadge.badge_id == badge_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tu as déjà donné ce badge à cette personne",
        )

    user_badge = UserBadge(
        giver_id=giver.id,
        receiver_id=receiver_id,
        event_id=shared_event_id,
        badge_id=badge_id,
    )
    db.add(user_badge)

    # Notifier le destinataire du badge
    from app.services.notifications import create_notification
    await create_notification(
        db,
        user_id=receiver_id,
        type="badge_received",
        content=f"{giver.first_name} t'a donné le badge {badge.emoji} {badge.name}",
        actor_id=giver.id,
        related_id=str(badge_id),
    )

    # Succès "Populaire" si c'est le premier badge reçu
    from app.services.achievements import check_achievements
    await check_achievements(db, receiver_id, on_badge_received=True)

    await db.commit()

    # Email fire-and-forget
    from app.services.email import fire, send_badge_received_email
    fire(send_badge_received_email(receiver.email, receiver.first_name, giver.first_name, badge.emoji, badge.name))

    return {"badge_id": badge_id, "name": badge.name, "emoji": badge.emoji}


async def remove_badge(
    db: AsyncSession,
    giver: User,
    receiver_id: uuid.UUID,
    badge_id: int,
) -> dict:
    """Retire un badge que l'utilisateur avait donné."""
    existing = await db.execute(
        select(UserBadge).where(
            UserBadge.giver_id == giver.id,
            UserBadge.receiver_id == receiver_id,
            UserBadge.badge_id == badge_id,
        )
    )
    user_badge = existing.scalar_one_or_none()
    if not user_badge:
        raise HTTPException(status_code=404, detail="Badge introuvable")
    await db.delete(user_badge)
    await db.commit()
    return {"badge_id": badge_id, "removed": True}
