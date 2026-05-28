import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.friendship import Friendship
from app.models.user import Interest, User, UserInterest
from app.schemas.users import UpdateProfileRequest
from app.services.storage import (
    ALLOWED_AVATAR_TYPES,
    avatar_key,
    delete_public_file,
    process_avatar,
    upload_public_file,
)


async def get_user_with_interests(db: AsyncSession, user_id: uuid.UUID) -> User:
    """Charge un utilisateur avec ses intérêts (eager load)."""
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.interests).selectinload(UserInterest.interest))
    )
    user = result.scalar_one_or_none()
    if not user or user.is_banned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")
    return user


async def update_profile(db: AsyncSession, user: User, data: UpdateProfileRequest) -> tuple[User, bool]:
    """
    Met à jour les champs modifiables du profil. Seuls les champs fournis sont modifiés.
    Retourne (user, email_changed) — email_changed=True si l'email a été modifié.
    """
    update_data = data.model_dump(exclude_unset=True)
    email_changed = False

    if "email" in update_data:
        new_email = update_data.pop("email")
        if new_email.lower() != user.email.lower():
            existing = await db.scalar(select(User).where(User.email == new_email.lower()))
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet email est déjà utilisé.")
            user.email = new_email.lower()
            user.is_email_verified = False
            email_changed = True

    if "username" in update_data:
        new_username = update_data.pop("username")
        if new_username != user.username:
            existing = await db.scalar(select(User).where(User.username == new_username))
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce nom d'utilisateur est déjà pris.")
            user.username = new_username

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user, email_changed


async def upload_avatar(db: AsyncSession, user: User, file_bytes: bytes, content_type: str) -> str:
    """
    Traite et upload l'avatar de l'utilisateur sur S3.
    Retourne la nouvelle URL publique.
    """
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Type de fichier non supporté. Acceptés : {', '.join(ALLOWED_AVATAR_TYPES)}",
        )

    if len(file_bytes) > 5 * 1024 * 1024:  # 5 Mo max
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Fichier trop volumineux. Maximum 5 Mo.",
        )

    # Traitement Pillow : redimensionnement + conversion JPEG
    processed = await process_avatar(file_bytes)

    key = avatar_key(str(user.id))
    url = await upload_public_file(key, processed, "image/jpeg")

    user.avatar_url = url
    await db.commit()
    return url


async def remove_avatar(db: AsyncSession, user: User) -> None:
    """Supprime l'avatar de l'utilisateur sur S3 et efface l'URL en base."""
    if not user.avatar_url:
        return

    key = avatar_key(str(user.id))
    await delete_public_file(key)

    user.avatar_url = None
    await db.commit()


async def get_all_interests(db: AsyncSession) -> list[Interest]:
    """Retourne la liste de tous les intérêts disponibles, triés par catégorie et nom."""
    result = await db.execute(select(Interest).order_by(Interest.category, Interest.name))
    return list(result.scalars().all())


async def update_user_interests(
    db: AsyncSession, user: User, interest_ids: list[int]
) -> list[Interest]:
    """
    Remplace les intérêts de l'utilisateur par la liste fournie.
    Vérifie que tous les IDs existent avant de modifier.
    """
    if interest_ids:
        result = await db.execute(select(Interest).where(Interest.id.in_(interest_ids)))
        found = result.scalars().all()
        if len(found) != len(interest_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un ou plusieurs intérêts sont invalides",
            )

    # Supprimer les anciens intérêts puis insérer les nouveaux
    await db.execute(delete(UserInterest).where(UserInterest.user_id == user.id))

    for interest_id in interest_ids:
        db.add(UserInterest(user_id=user.id, interest_id=interest_id))

    await db.commit()

    # Recharger les intérêts mis à jour
    result = await db.execute(select(Interest).where(Interest.id.in_(interest_ids)))
    return list(result.scalars().all())


async def search_users(
    db: AsyncSession,
    query: str,
    current_user_id: uuid.UUID,
    limit: int = 20,
) -> list[User]:
    """Recherche des utilisateurs par username (exact ou préfixe)."""
    q = query.strip().lower().lstrip('@')
    if len(q) < 2:
        return []

    # On garde visibles les utilisateurs que J'AI bloqués (pour pouvoir les débloquer / signaler)
    # mais on cache ceux qui M'ONT bloqué (ne pas révéler le blocage)
    blocked_me = select(Friendship.requester_id).where(
        Friendship.addressee_id == current_user_id, Friendship.status == "blocked"
    )

    result = await db.execute(
        select(User)
        .where(
            User.username.ilike(f"{q}%"),
            User.is_banned == False,  # noqa: E712
            User.id != current_user_id,
            User.id.notin_(blocked_me),
        )
        .order_by(User.username)
        .limit(limit)
    )
    return list(result.scalars().all())
