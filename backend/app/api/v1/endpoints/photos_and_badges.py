import json
import uuid

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.users import BadgeOut, BadgeSummaryOut, PhotoOut
from app.services.achievements import get_user_achievements
from app.services.badges import (
    get_all_badges,
    get_badges_given_to,
    get_user_badges_summary,
    give_badge,
    remove_badge,
)
from app.services.photos import (
    delete_photo,
    get_user_photos,
    toggle_photo_like,
    update_photo_description,
    upload_photo,
)

router = APIRouter()


# ── Photos ──

@router.get("/users/{user_id}/photos", response_model=list[PhotoOut])
async def list_user_photos(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Photos de profil publiques d'un utilisateur avec likes."""
    photos = await get_user_photos(db, user_id, viewer_id=current_user.id)
    return [PhotoOut(**p) for p in photos]


@router.post("/users/me/photos", response_model=PhotoOut, status_code=201)
async def upload_my_photo(
    photo: UploadFile = File(..., description="Photo (JPEG, PNG ou WebP, max 8 Mo)"),
    description: str | None = Form(None),
    # JSON array de UUIDs : '["uuid1", "uuid2"]'
    tags: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ajoute une photo à la galerie (max 9) avec description et tags optionnels."""
    file_bytes = await photo.read()

    # Désérialiser les tags depuis le form field JSON
    tag_ids: list[uuid.UUID] = []
    if tags:
        try:
            raw = json.loads(tags)
            tag_ids = [uuid.UUID(t) for t in raw]
        except Exception:
            raise HTTPException(status_code=422, detail="Format de tags invalide. Attendu : JSON array de UUIDs.")

    result = await upload_photo(db, current_user, file_bytes, photo.content_type or "", description=description, tag_ids=tag_ids)
    photos = await get_user_photos(db, current_user.id, viewer_id=current_user.id)
    photo_data = next((p for p in photos if p["id"] == result.id), None)
    return PhotoOut(**photo_data) if photo_data else PhotoOut(id=result.id, url=result.url, created_at=result.created_at)


@router.patch("/photos/{photo_id}/description", response_model=MessageResponse)
async def update_description(
    photo_id: uuid.UUID,
    description: str | None = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour la description d'une photo."""
    await update_photo_description(db, current_user, photo_id, description)
    return MessageResponse(message="Description mise à jour.")


@router.delete("/users/me/photos/{photo_id}", response_model=MessageResponse)
async def delete_my_photo(
    photo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprime une photo de profil."""
    await delete_photo(db, current_user, photo_id)
    return MessageResponse(message="Photo supprimée.")


@router.post("/photos/{photo_id}/like", response_model=dict)
async def like_photo(
    photo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Like ou unlike une photo (toggle)."""
    return await toggle_photo_like(db, current_user.id, photo_id)


# ── Badges ──

@router.get("/badges", response_model=list[BadgeOut])
async def list_badges(db: AsyncSession = Depends(get_db)):
    """Retourne les 6 badges disponibles."""
    badges = await get_all_badges(db)
    return [BadgeOut.model_validate(b) for b in badges]


@router.get("/users/{user_id}/badges", response_model=list[BadgeSummaryOut])
async def get_badges(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Résumé des badges reçus par un utilisateur."""
    return await get_user_badges_summary(db, user_id)


@router.get("/users/{user_id}/badges-given-by-me", response_model=list[int])
async def badges_given_by_me(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Badge IDs déjà donnés par l'utilisateur connecté à user_id."""
    return await get_badges_given_to(db, current_user.id, user_id)


@router.post("/users/{user_id}/badges", response_model=dict, status_code=201)
async def give_badge_to_user(
    user_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Donne un badge à un utilisateur avec qui on a fait une sortie."""
    badge_id = body.get("badge_id")
    if not isinstance(badge_id, int):
        raise HTTPException(status_code=422, detail="badge_id requis (entier)")
    return await give_badge(db, current_user, user_id, badge_id)


@router.get("/users/{user_id}/achievements", response_model=list[dict])
async def get_achievements(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Succès automatiques obtenus par un utilisateur."""
    return await get_user_achievements(db, user_id)


@router.delete("/users/{user_id}/badges/{badge_id}", response_model=dict)
async def remove_badge_from_user(
    user_id: uuid.UUID,
    badge_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retire un badge que j'avais donné à cet utilisateur."""
    return await remove_badge(db, current_user, user_id, badge_id)
