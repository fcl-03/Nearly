import uuid

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from redis.asyncio import Redis
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_verified_user
from app.core.database import get_db
from app.core.redis import get_redis
from app.models.event import EventParticipant
from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.users import (
    InterestOut,
    PublicUserProfile,
    UpdateInterestsRequest,
    UpdateProfileRequest,
    UserProfileResponse,
)
from app.services.auth import resend_verification
from app.services.email import send_verification_email
from app.services.users import (
    get_all_interests,
    get_user_with_interests,
    remove_avatar,
    search_users,
    update_profile,
    update_user_interests,
    upload_avatar,
)

router = APIRouter()


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne le profil complet de l'utilisateur connecté, avec ses intérêts."""
    user = await get_user_with_interests(db, current_user.id)
    # Transformer les UserInterest en Interest pour le serializer
    user.interests = [ui.interest for ui in user.interests]
    return user


@router.put("/me", response_model=UserProfileResponse)
async def update_my_profile(
    data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
):
    """Modifie les informations du profil (seuls les champs fournis sont mis à jour)."""
    user, email_changed = await update_profile(db, current_user, data)

    # Si l'email a changé, envoyer un nouveau lien de vérification
    if email_changed:
        verify_token = await resend_verification(db, redis, user)
        await send_verification_email(user.email, user.first_name, verify_token)

    # Recharger avec les intérêts pour la réponse
    user = await get_user_with_interests(db, user.id)
    user.interests = [ui.interest for ui in user.interests]
    return user


@router.post("/me/avatar", response_model=MessageResponse)
async def upload_my_avatar(
    avatar: UploadFile = File(..., description="Image de profil (JPEG, PNG ou WebP, max 5 Mo)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload ou remplace la photo de profil."""
    file_bytes = await avatar.read()
    url = await upload_avatar(db, current_user, file_bytes, avatar.content_type or "")
    return MessageResponse(message=f"Avatar mis à jour. URL : {url}")


@router.delete("/me/avatar", response_model=MessageResponse)
async def delete_my_avatar(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprime la photo de profil."""
    await remove_avatar(db, current_user)
    return MessageResponse(message="Avatar supprimé.")


@router.delete("/me", response_model=MessageResponse, status_code=200)
async def delete_my_account(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
):
    """Supprime définitivement le compte de l'utilisateur connecté."""
    from app.services.auth import logout_user
    # Extraire le token depuis le cookie httpOnly (même source que get_current_user)
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    if access_token:
        await logout_user(redis, access_token, refresh_token)
    await db.delete(current_user)
    await db.commit()
    # Effacer les cookies d'authentification
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    response.delete_cookie("logged_in", path="/")
    return MessageResponse(message="Ton compte a été supprimé définitivement.")


@router.get("/me/interests", response_model=list[InterestOut])
async def get_my_interests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne les intérêts de l'utilisateur connecté."""
    user = await get_user_with_interests(db, current_user.id)
    return [ui.interest for ui in user.interests]


@router.put("/me/interests", response_model=list[InterestOut])
async def update_my_interests(
    data: UpdateInterestsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remplace les intérêts de l'utilisateur par la liste fournie (max 10)."""
    return await update_user_interests(db, current_user, data.interest_ids)


@router.get("/interests", response_model=list[InterestOut])
async def list_all_interests(db: AsyncSession = Depends(get_db)):
    """Retourne tous les intérêts disponibles dans l'application (pas d'auth requise)."""
    return await get_all_interests(db)


@router.get("/search", response_model=list[dict])
async def search_users_endpoint(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recherche d'utilisateurs par @username (min 2 caractères)."""
    users = await search_users(db, q, current_user.id)
    return [
        {
            "id": str(u.id),
            "first_name": u.first_name,
            "username": u.username,
            "avatar_url": u.avatar_url,
            "is_verified": u.is_verified,
        }
        for u in users
    ]


@router.get("/{user_id}", response_model=PublicUserProfile)
async def get_public_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne le profil public d'un utilisateur avec le statut d'amitié et les stats."""
    from app.services.friendships import get_friendship_status_for, is_blocked
    # Si l'un des deux a bloqué l'autre, masquer le profil
    if await is_blocked(db, current_user.id, user_id):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user = await get_user_with_interests(db, user_id)
    user.interests = [ui.interest for ui in user.interests]

    # Compter le nombre d'amis
    friends_result = await db.execute(
        select(func.count()).select_from(Friendship).where(
            or_(
                (Friendship.requester_id == user_id) & (Friendship.status == "accepted"),
                (Friendship.addressee_id == user_id) & (Friendship.status == "accepted"),
            )
        )
    )
    friends_count = friends_result.scalar() or 0

    # Compter les sorties rejointes
    events_result = await db.execute(
        select(func.count()).select_from(EventParticipant).where(
            EventParticipant.user_id == user_id,
            EventParticipant.status == "joined",
        )
    )
    events_count = events_result.scalar() or 0

    friendship_status = await get_friendship_status_for(db, current_user.id, user_id)
    profile = PublicUserProfile.model_validate(user)
    profile.friendship_status = friendship_status
    profile.friends_count = friends_count
    profile.events_count = events_count
    return profile
