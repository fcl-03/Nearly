from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db

limiter = Limiter(key_func=get_remote_address)
from app.models.event import Event
from app.models.report import Report
from app.models.user import User
from app.schemas.reports import ReportCreate, ReportResponse

router = APIRouter()


@router.post("/reports", response_model=ReportResponse, status_code=201, tags=["reports"])
@limiter.limit("5/minute")
async def create_report(
    request: Request,
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Signaler un utilisateur ou une sortie."""
    # Exactement une cible requise
    if not body.reported_user_id and not body.reported_event_id:
        raise HTTPException(status_code=422, detail="reported_user_id ou reported_event_id est requis.")
    if body.reported_user_id and body.reported_event_id:
        raise HTTPException(status_code=422, detail="Un seul des deux champs peut être renseigné.")

    # Impossible de se signaler soi-même
    if body.reported_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Tu ne peux pas te signaler toi-même.")

    # Vérifier que la cible existe
    if body.reported_user_id:
        if not await db.get(User, body.reported_user_id):
            raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    if body.reported_event_id:
        if not await db.get(Event, body.reported_event_id):
            raise HTTPException(status_code=404, detail="Sortie introuvable.")

    report = Report(
        reporter_id=current_user.id,
        reported_user_id=body.reported_user_id,
        reported_event_id=body.reported_event_id,
        reason=body.reason,
    )
    db.add(report)
    await db.commit()

    return ReportResponse(
        id=report.id,
        message="Signalement envoyé. Nous examinerons le contenu sous 24h.",
    )
