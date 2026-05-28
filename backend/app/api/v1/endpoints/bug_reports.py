"""Endpoints pour les signalements de bugs.
- POST /bug-reports : user envoie un bug (rate-limited)
- GET /admin/bug-reports : admin liste les bugs
- PATCH /admin/bug-reports/{id} : admin met à jour statut / notes
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_admin, get_current_user
from app.core.database import get_db
from app.models.bug_report import BugReport
from app.models.user import User
from app.schemas.bug_reports import BugReportCreate, BugReportResponse, BugReportUpdate

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


@router.post("/bug-reports", response_model=dict, status_code=201, tags=["bug-reports"])
@limiter.limit("5/minute")
async def create_bug_report(
    request: Request,
    body: BugReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Envoie un signalement de bug. L'utilisateur connecté en est l'auteur.
    Capture aussi le User-Agent du navigateur pour aider au debug."""
    user_agent = request.headers.get("user-agent", "")[:500]
    bug = BugReport(
        reporter_id=current_user.id,
        message=body.message.strip(),
        page_url=body.page_url,
        user_agent=body.user_agent or user_agent,
    )
    db.add(bug)
    await db.commit()
    return {"id": str(bug.id), "message": "Merci ! Ton signalement a bien été enregistré."}


@router.get("/admin/bug-reports", response_model=list[BugReportResponse], tags=["admin"])
async def list_bug_reports(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Liste les bugs reports, triés du plus récent au plus ancien.
    Filtre optionnel sur le statut."""
    query = select(BugReport).options(selectinload(BugReport.reporter)).order_by(BugReport.created_at.desc())
    if status_filter:
        query = query.where(BugReport.status == status_filter)
    result = await db.execute(query)
    bugs = result.scalars().all()

    return [
        BugReportResponse(
            id=b.id,
            message=b.message,
            page_url=b.page_url,
            user_agent=b.user_agent,
            status=b.status,
            admin_notes=b.admin_notes,
            created_at=b.created_at,
            reporter=b.reporter,
        )
        for b in bugs
    ]


@router.patch("/admin/bug-reports/{bug_id}", response_model=dict, tags=["admin"])
async def update_bug_report(
    bug_id: uuid.UUID,
    body: BugReportUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Met à jour le statut ou les notes admin d'un bug report."""
    bug = await db.get(BugReport, bug_id)
    if not bug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug report introuvable")

    if body.status is not None:
        bug.status = body.status
    if body.admin_notes is not None:
        bug.admin_notes = body.admin_notes

    await db.commit()
    return {"message": "Bug report mis à jour."}


@router.delete("/admin/bug-reports/{bug_id}", response_model=dict, tags=["admin"])
async def delete_bug_report(
    bug_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Supprime un bug report (purge)."""
    bug = await db.get(BugReport, bug_id)
    if not bug:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bug report introuvable")
    await db.delete(bug)
    await db.commit()
    return {"message": "Bug report supprimé."}
