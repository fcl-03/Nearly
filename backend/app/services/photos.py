import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.photo import PhotoLike, PhotoTag, UserPhoto
from app.models.user import User
from app.services.storage import (
    ALLOWED_AVATAR_TYPES,
    delete_public_file,
    photo_key,
    process_photo,
    upload_public_file,
)

PHOTO_MAX_COUNT = 9  # Comme Instagram
PHOTO_MAX_BYTES = 8 * 1024 * 1024  # 8 Mo


async def get_user_photos(
    db: AsyncSession, user_id: uuid.UUID, viewer_id: uuid.UUID | None = None
) -> list[dict]:
    """Retourne les photos avec likes_count, liked_by_me et tags."""
    result = await db.execute(
        select(UserPhoto)
        .where(UserPhoto.user_id == user_id)
        .options(
            selectinload(UserPhoto.likes),
            selectinload(UserPhoto.tags).selectinload(PhotoTag.tagged_user),
        )
        .order_by(UserPhoto.created_at.desc())
    )
    photos = result.scalars().all()
    return [
        {
            "id": p.id,
            "url": p.url,
            "description": p.description,
            "created_at": p.created_at,
            "likes_count": len(p.likes),
            "liked_by_me": any(like.user_id == viewer_id for like in p.likes) if viewer_id else False,
            "tags": [
                {
                    "id": t.tagged_user.id,
                    "first_name": t.tagged_user.first_name,
                    "avatar_url": t.tagged_user.avatar_url,
                }
                for t in p.tags
            ],
        }
        for p in photos
    ]


async def upload_photo(
    db: AsyncSession,
    user: User,
    file_bytes: bytes,
    content_type: str,
    description: str | None = None,
    tag_ids: list[uuid.UUID] | None = None,
) -> UserPhoto:
    """Upload une photo de profil. Max 9 photos par utilisateur."""
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Type de fichier non supporté. Acceptés : JPEG, PNG, WebP",
        )
    if len(file_bytes) > PHOTO_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Fichier trop volumineux. Maximum 8 Mo.",
        )

    # Vérifier la limite de photos
    count_result = await db.execute(
        select(func.count()).select_from(UserPhoto).where(UserPhoto.user_id == user.id)
    )
    current_count = count_result.scalar_one()
    if current_count >= PHOTO_MAX_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {PHOTO_MAX_COUNT} photos autorisées.",
        )

    # Traitement et upload S3
    photo_id = str(uuid.uuid4())
    processed = await process_photo(file_bytes)
    key = photo_key(str(user.id), photo_id)
    url = await upload_public_file(key, processed, "image/jpeg")

    photo = UserPhoto(id=uuid.UUID(photo_id), user_id=user.id, url=url, description=description)
    db.add(photo)

    # Ajouter les tags et envoyer les notifications
    if tag_ids:
        from app.services.notifications import create_notification
        for tagged_id in tag_ids:
            # Ne pas se taguer soi-même
            if tagged_id == user.id:
                continue
            db.add(PhotoTag(photo_id=uuid.UUID(photo_id), tagged_user_id=tagged_id))
            await create_notification(
                db,
                user_id=tagged_id,
                type="photo_tag",
                content=f"{user.first_name} t'a tagué(e) dans une photo",
                actor_id=user.id,
                related_id=photo_id,
            )

    await db.commit()
    await db.refresh(photo)
    return photo


async def delete_photo(
    db: AsyncSession, user: User, photo_id: uuid.UUID
) -> None:
    """Supprime une photo de profil."""
    photo = await db.get(UserPhoto, photo_id)
    if not photo or photo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo introuvable")

    key = photo_key(str(user.id), str(photo_id))
    await delete_public_file(key)
    await db.delete(photo)
    await db.commit()


async def update_photo_description(
    db: AsyncSession, user: User, photo_id: uuid.UUID, description: str | None
) -> None:
    """Met à jour la description d'une photo."""
    photo = await db.get(UserPhoto, photo_id)
    if not photo or photo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo introuvable")
    photo.description = description
    await db.commit()


async def toggle_photo_like(
    db: AsyncSession, user_id: uuid.UUID, photo_id: uuid.UUID
) -> dict:
    """Like ou unlike une photo. Retourne {liked_by_me, likes_count}."""
    # Vérifier que la photo existe
    photo_result = await db.execute(
        select(UserPhoto).where(UserPhoto.id == photo_id).options(selectinload(UserPhoto.likes))
    )
    photo = photo_result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo introuvable")

    existing = await db.execute(
        select(PhotoLike).where(PhotoLike.user_id == user_id, PhotoLike.photo_id == photo_id)
    )
    like = existing.scalar_one_or_none()

    if like:
        await db.delete(like)
        await db.commit()
        return {"liked_by_me": False, "likes_count": len(photo.likes) - 1}
    else:
        db.add(PhotoLike(user_id=user_id, photo_id=photo_id))
        await db.commit()
        return {"liked_by_me": True, "likes_count": len(photo.likes) + 1}
