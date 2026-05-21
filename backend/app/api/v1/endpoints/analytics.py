from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.models.user import User
from app.services.analytics import generate_daily_snapshot, get_snapshots, snapshots_to_csv

router = APIRouter()


@router.get("/snapshots")
async def list_snapshots(
    city: str | None = None,
    category: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Retourne les snapshots analytiques (admin uniquement)."""
    snapshots = await get_snapshots(db, city=city, category=category, date_from=date_from, date_to=date_to, limit=limit)
    return [
        {
            "date": s.snapshot_date.isoformat(),
            "city": s.city,
            "category": s.category,
            "events_created": s.events_created,
            "total_participants": s.total_participants,
            "avg_group_size": s.avg_group_size,
            "peak_hour": s.peak_hour,
        }
        for s in snapshots
    ]


@router.get("/snapshots/csv")
async def export_snapshots_csv(
    city: str | None = None,
    category: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(5000, ge=1, le=50000),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Export CSV des snapshots analytiques (admin uniquement)."""
    snapshots = await get_snapshots(db, city=city, category=category, date_from=date_from, date_to=date_to, limit=limit)
    csv_data = snapshots_to_csv(snapshots)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=nearly_analytics.csv"},
    )


@router.post("/generate")
async def trigger_snapshot_generation(
    target_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Déclenche manuellement la génération des snapshots pour une date (admin)."""
    count = await generate_daily_snapshot(db, target_date=target_date)
    return {"snapshots_created": count, "date": (target_date or "yesterday")}
