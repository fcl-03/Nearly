import uuid

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db

limiter = Limiter(key_func=get_remote_address)
from app.models.user import User
from app.schemas.users import PublicUserProfile
from app.services.friendships import (
    accept_friend_request,
    block_user,
    get_friends,
    get_pending_requests,
    reject_friend_request,
    remove_friend,
    send_friend_request,
    unblock_user,
)

router = APIRouter()


def _user_to_public(user: User) -> PublicUserProfile:
    """Convertit un User ORM en PublicUserProfile minimal (sans friendship_status)."""
    return PublicUserProfile(
        id=user.id,
        first_name=user.first_name,
        username=user.username,
        bio=user.bio,
        avatar_url=user.avatar_url,
        city=user.city,
        is_verified=user.is_verified,
        created_at=user.created_at,
        interests=[],
        friendship_status="friends",
    )


@router.post("/users/{user_id}/friend-request", response_model=dict)
@limiter.limit("10/minute")
async def send_request(
    request: Request,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Envoie une demande d'ami à un utilisateur."""
    return await send_friend_request(db, current_user, user_id)


@router.post("/users/{user_id}/friend-accept", response_model=dict)
async def accept_request(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accepte la demande d'ami envoyée par user_id."""
    result = await accept_friend_request(db, current_user, user_id)
    # Vérifier les succès pour les deux utilisateurs
    from app.services.achievements import check_achievements
    await check_achievements(db, current_user.id, on_friend_accepted=True)
    await check_achievements(db, user_id, on_friend_accepted=True)
    await db.commit()
    return result


@router.post("/users/{user_id}/friend-reject", response_model=dict)
async def reject_request(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Refuse ou annule une demande d'ami."""
    return await reject_friend_request(db, current_user, user_id)


@router.delete("/users/{user_id}/friend", response_model=dict)
async def delete_friend(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprime un ami."""
    return await remove_friend(db, current_user, user_id)


@router.get("/users/me/friends", response_model=list[PublicUserProfile])
async def list_friends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne la liste des amis de l'utilisateur connecté."""
    friends = await get_friends(db, current_user.id)
    return [_user_to_public(u) for u in friends]


@router.get("/users/me/friend-requests", response_model=list[PublicUserProfile])
async def list_friend_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne les demandes d'ami en attente reçues."""
    requesters = await get_pending_requests(db, current_user.id)
    return [_user_to_public(u) for u in requesters]


@router.post("/users/{user_id}/block", response_model=dict)
async def block_user_endpoint(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bloque un utilisateur."""
    return await block_user(db, current_user, user_id)


@router.delete("/users/{user_id}/block", response_model=dict)
async def unblock_user_endpoint(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Débloque un utilisateur."""
    return await unblock_user(db, current_user, user_id)


@router.get("/users/me/blocked", response_model=list[PublicUserProfile])
async def list_blocked_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne la liste des utilisateurs bloqués par l'utilisateur connecté."""
    from sqlalchemy import select as sel

    from app.models.friendship import Friendship as F
    result = await db.execute(
        sel(F).where(F.requester_id == current_user.id, F.status == "blocked")
    )
    friendships = result.scalars().all()
    blocked_ids = [f.addressee_id for f in friendships]
    if not blocked_ids:
        return []
    users_result = await db.execute(sel(User).where(User.id.in_(blocked_ids)))
    users = list(users_result.scalars().all())
    return [
        PublicUserProfile(
            id=u.id,
            first_name=u.first_name,
            username=u.username,
            bio=u.bio,
            avatar_url=None,  # Pas de photo visible pour un user bloqué
            city=u.city,
            is_verified=u.is_verified,
            created_at=u.created_at,
            interests=[],
            friendship_status="blocked",
        )
        for u in users
    ]


@router.get("/users/me/friend-requests/count", response_model=dict)
async def count_friend_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne le nombre de demandes d'ami en attente."""
    requesters = await get_pending_requests(db, current_user.id)
    return {"count": len(requesters)}
