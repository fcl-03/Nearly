import logging
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)

# Types de notification valides
VALID_NOTIFICATION_TYPES = {
    "event_join",
    "event_leave",
    "event_invite",
    "event_delete",
    "friend_request",
    "friend_accept",
    "friend_accepted",
    "new_dm",
    "new_message",
    "report_resolved",
    "achievement",
    "system",
}


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    content: str,
    actor_id: uuid.UUID | None = None,
    related_id: str | None = None,
) -> Notification:
    """Crée une notification en base."""
    if type not in VALID_NOTIFICATION_TYPES:
        logger.warning("Type de notification inconnu : %s", type)
    notif = Notification(
        user_id=user_id,
        type=type,
        content=content,
        actor_id=actor_id,
        related_id=related_id,
    )
    db.add(notif)
    # Pas de commit ici — appelé depuis les services qui commitent eux-mêmes
    return notif


async def get_notifications(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 50
) -> list[dict]:
    """Retourne les notifications d'un utilisateur, les plus récentes en premier."""
    result = await db.execute(
        select(Notification, User)
        .outerjoin(User, User.id == Notification.actor_id)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "id": str(notif.id),
            "type": notif.type,
            "content": notif.content,
            "is_read": notif.is_read,
            "created_at": notif.created_at.isoformat(),
            "related_id": notif.related_id,
            "actor": {
                "id": str(actor.id),
                "first_name": actor.first_name,
                "avatar_url": actor.avatar_url,
            } if actor else None,
        }
        for notif, actor in rows
    ]


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Nombre de notifications non lues."""
    from sqlalchemy import func, select
    result = await db.execute(
        select(func.count()).where(
            Notification.user_id == user_id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    return result.scalar_one()


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Marque toutes les notifications comme lues."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.commit()
