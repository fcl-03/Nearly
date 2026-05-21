import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ad import Ad


async def get_active_ads(
    db: AsyncSession, city: str | None = None, limit: int = 5
) -> list[Ad]:
    """Retourne les publicités actives, filtrées par ville si fourni."""
    now = datetime.now(timezone.utc)
    query = select(Ad).where(
        Ad.is_active.is_(True),
        (Ad.expires_at.is_(None)) | (Ad.expires_at > now),
    )
    if city:
        # Annonces ciblées sur cette ville + annonces sans ciblage (nationales)
        query = query.where((Ad.target_city.is_(None)) | (Ad.target_city == city))

    query = query.order_by(Ad.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def record_impression(db: AsyncSession, ad_id: uuid.UUID) -> None:
    """Incrémente le compteur d'impressions."""
    await db.execute(update(Ad).where(Ad.id == ad_id).values(impressions=Ad.impressions + 1))
    await db.commit()


async def record_click(db: AsyncSession, ad_id: uuid.UUID) -> Ad | None:
    """Incrémente le compteur de clics et retourne l'annonce pour la redirection."""
    result = await db.execute(select(Ad).where(Ad.id == ad_id))
    ad = result.scalar_one_or_none()
    if ad:
        ad.clicks += 1
        await db.commit()
    return ad
