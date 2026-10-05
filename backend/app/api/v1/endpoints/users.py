import uuid

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from redis.asyncio import Redis
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
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
    """Supprime définitivement le compte de l'utilisateur connecté.
    RGPD : efface aussi tous les fichiers S3 (avatar, photos, souvenirs, documents
    d'identité en attente) et résilie l'abonnement Stripe — la suppression DB seule
    laisserait des données personnelles orphelines et une facturation active."""
    import logging

    from app.core.config import settings
    from app.models.photo import UserPhoto
    from app.models.verification import IdentityVerification
    from app.services.auth import logout_user
    from app.services.storage import (
        avatar_key,
        cover_key,
        delete_private_file,
        delete_public_file,
        photo_key,
    )

    logger = logging.getLogger(__name__)
    user_id_str = str(current_user.id)

    # ── Fichiers S3 publics : avatar, photos de galerie, photos souvenir ──
    if current_user.avatar_url:
        await delete_public_file(avatar_key(user_id_str))

    photos_result = await db.execute(
        select(UserPhoto.id).where(UserPhoto.user_id == current_user.id)
    )
    for (photo_id,) in photos_result.all():
        await delete_public_file(photo_key(user_id_str, str(photo_id)))

    covers_result = await db.execute(
        select(EventParticipant.event_id).where(
            EventParticipant.user_id == current_user.id,
            EventParticipant.cover_url.isnot(None),
        )
    )
    for (event_id,) in covers_result.all():
        await delete_public_file(cover_key(user_id_str, str(event_id)))

    # ── Bucket privé : selfie + pièce d'identité d'une vérification en attente ──
    verif_result = await db.execute(
        select(IdentityVerification).where(IdentityVerification.user_id == current_user.id)
    )
    verification = verif_result.scalar_one_or_none()
    if verification:
        if verification.selfie_url:
            await delete_private_file(verification.selfie_url)
        if verification.id_card_url:
            await delete_private_file(verification.id_card_url)

    # ── Stripe : résilier les abonnements actifs (sinon la carte reste débitée
    #    alors que le webhook ne retrouvera plus le user). Best effort. ──
    if current_user.stripe_customer_id and settings.STRIPE_SECRET_KEY:
        try:
            import stripe
            client = stripe.StripeClient(settings.STRIPE_SECRET_KEY)
            subs = client.subscriptions.list(
                params={"customer": current_user.stripe_customer_id, "status": "active"}
            )
            for sub in subs.data:
                client.subscriptions.cancel(sub.id)
        except Exception as exc:
            # Ne jamais bloquer la suppression du compte pour un échec Stripe
            logger.error("Échec résiliation Stripe pour %s : %s", user_id_str, exc)

    # ── Sessions : révoquer le refresh courant + tous les autres ──
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    if access_token or refresh_token:
        await logout_user(redis, access_token, refresh_token)
    from app.core.redis import revoke_user_refresh_tokens
    await revoke_user_refresh_tokens(user_id_str)

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


def _user_card(u: User, friendship_status: str) -> dict:
    """Sérialise un User en carte légère pour les listes (recherche, suggestions)."""
    return {
        "id": str(u.id),
        "first_name": u.first_name,
        "username": u.username,
        "avatar_url": u.avatar_url,
        "city": u.city,
        "is_verified": u.is_verified,
        "last_active_at": u.last_active_at.isoformat() if u.last_active_at else None,
        "friendship_status": friendship_status,
    }


@router.get("/search", response_model=list[dict])
async def search_users_endpoint(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recherche d'utilisateurs par @username ou prénom (min 2 caractères).
    Renvoie aussi `friendship_status` pour pouvoir afficher l'état "blocked"
    et proposer le débloquage côté UI."""
    from app.services.friendships import get_friendship_status_for
    users = await search_users(db, q, current_user.id)
    results = []
    for u in users:
        status = await get_friendship_status_for(db, current_user.id, u.id)
        results.append(_user_card(u, status))
    return results


@router.get("/me/suggestions", response_model=list[dict])
async def suggestions_endpoint(
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Suggestions d'amis : utilisateurs vérifiés de la même ville, hors relations existantes."""
    from app.services.users import get_friend_suggestions
    users = await get_friend_suggestions(db, current_user, limit=min(limit, 50))
    return [_user_card(u, "none") for u in users]


@router.get("/{user_id}/events-history", response_model=list[dict])
async def user_events_history(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Historique public des sorties rejointes par un utilisateur (souvenirs, avec sa photo).
    Sécurité : ne renvoie QUE les sorties passées — jamais où la personne sera."""
    from app.services.friendships import is_blocked
    if await is_blocked(db, current_user.id, user_id):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    from app.services.events import get_my_events_history
    return await get_my_events_history(db, user_id, only_past=True)


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
