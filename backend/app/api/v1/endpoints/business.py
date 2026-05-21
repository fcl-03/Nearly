import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user
from app.core.database import get_db
from app.models.business import BusinessAccount
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.business import (
    BusinessAdminResponse,
    BusinessCreateRequest,
    BusinessCreateSponsoredEvent,
    BusinessResponse,
    BusinessSponsoredEventResponse,
    BusinessStatsResponse,
    BusinessUpdateRequest,
)
from app.services.business import (
    create_business_account,
    create_sponsored_event,
    get_business_account,
    get_business_stats,
    list_sponsored_events,
    update_business_account,
)

router = APIRouter()


# ── Compte business (propriétaire) ──

@router.post("", response_model=BusinessResponse, status_code=201)
async def create_account(
    data: BusinessCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crée un compte entreprise pour l'utilisateur connecté."""
    account = await create_business_account(db, current_user, data)
    return account


@router.get("/me", response_model=BusinessResponse)
async def get_my_account(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne le compte entreprise de l'utilisateur connecté."""
    return await get_business_account(db, current_user.id)


@router.put("/me", response_model=BusinessResponse)
async def update_my_account(
    data: BusinessUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour les informations de l'établissement."""
    return await update_business_account(db, current_user.id, data)


@router.get("/me/stats", response_model=BusinessStatsResponse)
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Statistiques du compte business (plan Pro et Exclusif uniquement)."""
    return await get_business_stats(db, current_user.id)


# ── Sorties sponsorisées ──

@router.post("/me/events", response_model=BusinessSponsoredEventResponse, status_code=201)
async def create_my_sponsored_event(
    data: BusinessCreateSponsoredEvent,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crée une sortie sponsorisée liée au compte business."""
    return await create_sponsored_event(db, current_user, data)


@router.get("/me/events", response_model=list[BusinessSponsoredEventResponse])
async def list_my_sponsored_events(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste les sorties sponsorisées du compte business."""
    return await list_sponsored_events(db, current_user.id)


# ── Logo ──

@router.post("/me/logo", response_model=MessageResponse)
async def upload_logo(
    logo: UploadFile = File(..., description="Logo de l'établissement (JPEG, PNG ou WebP, max 5 Mo)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload ou remplace le logo de l'établissement."""
    from app.services.storage import upload_public_file

    account = await get_business_account(db, current_user.id)

    file_bytes = await logo.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        from fastapi import HTTPException
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 5 Mo)")

    # Upload dans le bucket public
    key = f"business/{account.id}/logo"
    url = await upload_public_file(key, file_bytes, logo.content_type or "image/jpeg")

    account.logo_url = url
    await db.commit()
    return MessageResponse(message="Logo mis à jour")


# ── Admin : gestion des comptes business ──

@router.get("/admin", response_model=list[BusinessAdminResponse])
async def admin_list_accounts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Liste tous les comptes business (admin)."""
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(BusinessAccount)
        .options(selectinload(BusinessAccount.owner))
        .order_by(BusinessAccount.created_at.desc())
    )
    accounts = result.scalars().all()
    return [
        BusinessAdminResponse(
            id=a.id,
            owner_id=a.owner_id,
            owner_email=a.owner.email if a.owner else None,
            business_name=a.business_name,
            plan=a.plan,
            city=a.city,
            is_active=a.is_active,
            sponsored_events_used=a.sponsored_events_used,
            created_at=a.created_at,
        )
        for a in accounts
    ]


@router.patch("/admin/{account_id}/toggle", response_model=MessageResponse)
async def admin_toggle_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Active/désactive un compte business (admin)."""
    from fastapi import HTTPException

    account = await db.get(BusinessAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Compte business introuvable")
    account.is_active = not account.is_active
    await db.commit()
    state = "activé" if account.is_active else "désactivé"
    return MessageResponse(message=f"Compte {account.business_name} {state}")


@router.patch("/admin/{account_id}/plan", response_model=MessageResponse)
async def admin_change_plan(
    account_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Change le plan d'un compte business (admin)."""
    from fastapi import HTTPException

    new_plan = body.get("plan", "")
    account = await db.get(BusinessAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Compte business introuvable")

    from app.services.business import PLAN_LIMITS
    if new_plan not in PLAN_LIMITS:
        raise HTTPException(status_code=400, detail=f"Plan invalide. Choix : {', '.join(PLAN_LIMITS.keys())}")

    account.plan = new_plan
    account.sponsored_events_limit = PLAN_LIMITS[new_plan]
    await db.commit()
    return MessageResponse(message=f"Plan de {account.business_name} mis à jour : {new_plan}")
