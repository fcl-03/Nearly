import uuid
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.achievement import ACHIEVEMENTS, UserAchievement
from app.models.badge import UserBadge
from app.models.event import Event, EventParticipant
from app.models.friendship import Friendship


async def _award(db: AsyncSession, user_id: uuid.UUID, key: str) -> bool:
    """Attribue un succès si l'utilisateur ne l'a pas déjà. Retourne True si nouveau."""
    achievement = ACHIEVEMENTS.get(key)
    if not achievement:
        return False
    # Utiliser un savepoint (nested transaction) pour éviter de rollback toute la session
    try:
        async with db.begin_nested():
            db.add(UserAchievement(user_id=user_id, achievement_key=key))
            await db.flush()
        return True
    except IntegrityError:
        # Le savepoint est automatiquement rollback, la session reste saine
        return False


async def check_achievements(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    on_event_join: bool = False,
    on_event_create: bool = False,
    on_friend_accepted: bool = False,
    on_badge_received: bool = False,
    on_identity_verified: bool = False,
) -> list[str]:
    """
    Vérifie et attribue les succès automatiques selon le contexte.
    Retourne la liste des clés nouvellement attribuées.
    """
    awarded: list[str] = []

    if on_event_join:
        count = await db.scalar(
            select(func.count()).where(
                EventParticipant.user_id == user_id,
                EventParticipant.status == "joined",
            )
        ) or 0
        if count >= 1 and await _award(db, user_id, "first_event"):
            awarded.append("first_event")
        if count >= 10 and await _award(db, user_id, "veteran"):
            awarded.append("veteran")

    if on_event_create:
        count = await db.scalar(
            select(func.count()).where(Event.creator_id == user_id)
        ) or 0
        if count >= 1 and await _award(db, user_id, "organizer"):
            awarded.append("organizer")

    if on_friend_accepted:
        count = await db.scalar(
            select(func.count()).where(
                Friendship.status == "accepted",
                (Friendship.requester_id == user_id) | (Friendship.addressee_id == user_id),
            )
        ) or 0
        if count >= 1 and await _award(db, user_id, "social"):
            awarded.append("social")

    if on_badge_received:
        count = await db.scalar(
            select(func.count()).where(UserBadge.receiver_id == user_id)
        ) or 0
        if count >= 1 and await _award(db, user_id, "popular"):
            awarded.append("popular")

    if on_identity_verified:
        if await _award(db, user_id, "verified"):
            awarded.append("verified")

    # Notifier + email pour chaque nouveau succès
    if awarded:
        from app.models.user import User as UserModel
        from app.services.email import fire, send_achievement_email
        from app.services.notifications import create_notification

        user_obj = await db.get(UserModel, user_id)
        for key in awarded:
            meta = ACHIEVEMENTS[key]
            await create_notification(
                db,
                user_id=user_id,
                type="achievement_unlocked",
                content=f"Succès débloqué : {meta['emoji']} {meta['name']} — {meta['desc']}",
            )
            if user_obj:
                fire(send_achievement_email(
                    user_obj.email, user_obj.first_name,
                    meta["emoji"], meta["name"], meta["desc"],
                ))

    return awarded


async def get_user_achievements(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """Retourne les succès obtenus par un utilisateur."""
    result = await db.execute(
        select(UserAchievement)
        .where(UserAchievement.user_id == user_id)
        .order_by(UserAchievement.awarded_at)
    )
    rows = result.scalars().all()
    return [
        {
            "key": row.achievement_key,
            "awarded_at": row.awarded_at.isoformat(),
            **ACHIEVEMENTS.get(row.achievement_key, {"emoji": "🏅", "name": row.achievement_key, "desc": ""}),
        }
        for row in rows
    ]
