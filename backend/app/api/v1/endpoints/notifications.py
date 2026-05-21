from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.services.notifications import get_notifications, get_unread_count, mark_all_read

router = APIRouter()


@router.get("/notifications", response_model=list[dict])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Notifications de l'utilisateur connecté (50 dernières)."""
    return await get_notifications(db, current_user.id)


@router.get("/notifications/unread-count", response_model=dict)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Nombre de notifications non lues (pour le badge cloche)."""
    count = await get_unread_count(db, current_user.id)
    return {"count": count}


@router.patch("/notifications/read-all", response_model=dict)
async def read_all(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marque toutes les notifications comme lues."""
    await mark_all_read(db, current_user.id)
    return {"ok": True}
