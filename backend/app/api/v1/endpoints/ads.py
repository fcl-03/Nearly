import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user
from app.core.database import get_db
from app.models.ad import Ad
from app.models.user import User
from app.schemas.ads import AdAdmin, AdCreate, AdResponse
from app.services.ads import get_active_ads, record_click

router = APIRouter()


@router.get("/feed", response_model=list[AdResponse])
async def get_feed_ads(
    city: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne les publicités à injecter dans le feed. Les utilisateurs Premium n'en reçoivent pas."""
    if current_user.is_premium:
        return []
    ads = await get_active_ads(db, city=city or current_user.city, limit=5)
    return ads


@router.get("/{ad_id}/click")
async def click_ad(
    ad_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Enregistre un clic et redirige vers l'URL de la pub."""
    ad = await record_click(db, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Annonce introuvable")
    return RedirectResponse(url=ad.link_url, status_code=302)


# ── Admin ──

@router.get("/admin", response_model=list[AdAdmin])
async def list_all_ads(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Liste toutes les annonces (admin)."""
    result = await db.execute(select(Ad).order_by(Ad.created_at.desc()))
    return list(result.scalars().all())


@router.post("/admin", response_model=AdAdmin, status_code=201)
async def create_ad(
    data: AdCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Crée une nouvelle annonce (admin)."""
    ad = Ad(**data.model_dump())
    db.add(ad)
    await db.commit()
    await db.refresh(ad)
    return ad


@router.delete("/admin/{ad_id}", response_model=dict)
async def delete_ad(
    ad_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Supprime une annonce (admin)."""
    ad = await db.get(Ad, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Annonce introuvable")
    await db.delete(ad)
    await db.commit()
    return {"ok": True}


@router.patch("/admin/{ad_id}/toggle", response_model=AdAdmin)
async def toggle_ad(
    ad_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Active/désactive une annonce (admin)."""
    ad = await db.get(Ad, ad_id)
    if not ad:
        raise HTTPException(status_code=404, detail="Annonce introuvable")
    ad.is_active = not ad.is_active
    await db.commit()
    await db.refresh(ad)
    return ad
