import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.models.event import Event
from app.models.message import Message
from app.models.report import Report
from app.models.user import User
from app.models.verification import IdentityVerification
from app.schemas.admin import (
    BanRequest,
    EventAdminResponse,
    ReportAdminResponse,
    ReviewRequest,
    StatsResponse,
    UserAdminResponse,
    VerificationAdminResponse,
)
from app.schemas.auth import MessageResponse
from app.services.storage import generate_presigned_url

router = APIRouter()


# ─────────────────────────────────────────────
# STATS
# ─────────────────────────────────────────────

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """KPIs globaux de la plateforme."""
    total_users = await db.scalar(select(func.count(User.id))) or 0
    email_verified = await db.scalar(select(func.count(User.id)).where(User.is_email_verified == True)) or 0  # noqa: E712
    identity_verified = await db.scalar(select(func.count(User.id)).where(User.is_verified == True)) or 0  # noqa: E712
    banned = await db.scalar(select(func.count(User.id)).where(User.is_banned == True)) or 0  # noqa: E712
    active_events = await db.scalar(select(func.count(Event.id)).where(Event.is_active == True)) or 0  # noqa: E712
    total_events = await db.scalar(select(func.count(Event.id))) or 0
    total_messages = await db.scalar(select(func.count(Message.id))) or 0
    pending_reports = await db.scalar(select(func.count(Report.id)).where(Report.is_resolved == False)) or 0  # noqa: E712
    pending_verifications = await db.scalar(
        select(func.count(IdentityVerification.id)).where(IdentityVerification.status == "pending")
    ) or 0

    return StatsResponse(
        total_users=total_users,
        email_verified_users=email_verified,
        identity_verified_users=identity_verified,
        banned_users=banned,
        active_events=active_events,
        total_events=total_events,
        total_messages=total_messages,
        pending_reports=pending_reports,
        pending_verifications=pending_verifications,
    )


# ─────────────────────────────────────────────
# GESTION DES UTILISATEURS
# ─────────────────────────────────────────────

@router.get("/users", response_model=list[UserAdminResponse])
async def list_users(
    search: Annotated[str | None, Query(description="Recherche par email ou prénom")] = None,
    is_banned: Annotated[bool | None, Query()] = None,
    is_email_verified: Annotated[bool | None, Query()] = None,
    is_verified: Annotated[bool | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Liste tous les utilisateurs avec filtres optionnels."""
    query = select(User).options(selectinload(User.identity_verification))
    filters = []

    if search:
        filters.append(
            or_(User.email.ilike(f"%{search}%"), User.first_name.ilike(f"%{search}%"))
        )
    if is_banned is not None:
        filters.append(User.is_banned == is_banned)
    if is_email_verified is not None:
        filters.append(User.is_email_verified == is_email_verified)
    if is_verified is not None:
        filters.append(User.is_verified == is_verified)

    if filters:
        query = query.where(*filters)

    query = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return [
        UserAdminResponse(
            **{c: getattr(u, c) for c in [
                "id", "email", "first_name", "avatar_url", "bio", "city",
                "is_email_verified", "is_verified", "is_premium", "is_admin",
                "is_banned", "data_consent", "created_at", "last_active_at",
            ]},
            identity_verification_status=u.identity_verification.status if u.identity_verification else None,
        )
        for u in users
    ]


@router.get("/users/{user_id}", response_model=UserAdminResponse)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Détail complet d'un utilisateur."""
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.identity_verification))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

    return UserAdminResponse(
        **{c: getattr(user, c) for c in [
            "id", "email", "first_name", "avatar_url", "bio", "city",
            "is_email_verified", "is_verified", "is_premium", "is_admin",
            "is_banned", "data_consent", "created_at", "last_active_at",
        ]},
        identity_verification_status=user.identity_verification.status if user.identity_verification else None,
    )


@router.post("/users/{user_id}/ban", response_model=MessageResponse)
async def ban_user(
    user_id: uuid.UUID,
    data: BanRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Bannit un utilisateur."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")
    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu ne peux pas bannir ton propre compte")
    if user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Impossible de bannir un admin")

    user.is_banned = True
    await db.commit()
    return MessageResponse(message=f"Utilisateur {user.email} banni.")


@router.post("/users/{user_id}/unban", response_model=MessageResponse)
async def unban_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Lève le bannissement d'un utilisateur."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

    user.is_banned = False
    await db.commit()
    return MessageResponse(message=f"Utilisateur {user.email} débanni.")


async def _get_original_admin_id(db: AsyncSession) -> uuid.UUID | None:
    """Retourne l'ID de l'admin originel (le premier admin créé).
    Seul lui peut promote / demote d'autres admins, pour empêcher un admin promu
    de retirer les droits de l'admin originel."""
    result = await db.execute(
        select(User.id).where(User.is_admin.is_(True)).order_by(User.created_at.asc()).limit(1)
    )
    return result.scalar_one_or_none()


@router.post("/users/{user_id}/promote", response_model=MessageResponse)
async def promote_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Passe un utilisateur en administrateur. Réservé à l'admin originel."""
    original_admin_id = await _get_original_admin_id(db)
    if admin.id != original_admin_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'administrateur originel peut promouvoir un utilisateur.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

    user.is_admin = True
    await db.commit()
    return MessageResponse(message=f"{user.email} est maintenant administrateur.")


@router.post("/users/{user_id}/demote", response_model=MessageResponse)
async def demote_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Retire les droits admin d'un utilisateur. Réservé à l'admin originel.
    L'admin originel ne peut pas être démote (par lui-même ni par personne)."""
    original_admin_id = await _get_original_admin_id(db)
    if admin.id != original_admin_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'administrateur originel peut retirer les droits admin.",
        )
    if user_id == original_admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'administrateur originel ne peut pas être démote.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

    user.is_admin = False
    await db.commit()
    return MessageResponse(message=f"{user.email} n'est plus administrateur.")


# ─────────────────────────────────────────────
# GESTION DES SORTIES
# ─────────────────────────────────────────────

@router.get("/events", response_model=list[EventAdminResponse])
async def list_events_admin(
    is_active: Annotated[bool | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Liste toutes les sorties (y compris désactivées)."""
    query = select(Event).options(selectinload(Event.creator), selectinload(Event.participants))

    if is_active is not None:
        query = query.where(Event.is_active == is_active)

    query = query.order_by(Event.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    events = result.scalars().all()

    return [
        EventAdminResponse(
            id=e.id,
            title=e.title,
            category=e.category,
            event_type=e.event_type,
            location_name=e.location_name,
            starts_at=e.starts_at,
            is_active=e.is_active,
            creator_id=e.creator_id,
            creator_name=e.creator.first_name if e.creator else "Supprimé",
            participants_count=sum(1 for p in e.participants if p.status == "joined"),
            created_at=e.created_at,
        )
        for e in events
    ]


@router.delete("/events/{event_id}", response_model=MessageResponse)
async def force_delete_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Désactive une sortie de force (sans vérification de propriété)."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")

    event.is_active = False
    await db.commit()
    return MessageResponse(message="Sortie désactivée.")


# ─────────────────────────────────────────────
# SIGNALEMENTS
# ─────────────────────────────────────────────

@router.get("/reports", response_model=list[ReportAdminResponse])
async def list_reports(
    is_resolved: Annotated[bool, Query()] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Liste les signalements (non résolus par défaut)."""
    query = (
        select(Report)
        .where(Report.is_resolved == is_resolved)
        .order_by(Report.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    reports = result.scalars().all()

    responses = []
    for r in reports:
        # Charger le reporter
        reporter = await db.get(User, r.reporter_id)
        reporter_name = reporter.first_name if reporter else "Supprimé"

        # Charger l'utilisateur signalé si applicable
        reported_user_name = None
        if r.reported_user_id:
            ru = await db.get(User, r.reported_user_id)
            reported_user_name = ru.first_name if ru else "Supprimé"

        # Charger la sortie signalée si applicable
        reported_event_title = None
        if r.reported_event_id:
            re_ = await db.get(Event, r.reported_event_id)
            reported_event_title = re_.title if re_ else "Supprimée"

        responses.append(ReportAdminResponse(
            id=r.id,
            reporter_id=r.reporter_id,
            reporter_name=reporter_name,
            reported_user_id=r.reported_user_id,
            reported_user_name=reported_user_name,
            reported_event_id=r.reported_event_id,
            reported_event_title=reported_event_title,
            reason=r.reason,
            is_resolved=r.is_resolved,
            created_at=r.created_at,
        ))

    return responses


@router.post("/reports/{report_id}/resolve", response_model=MessageResponse)
async def resolve_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Marque un signalement comme résolu."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signalement introuvable")

    report.is_resolved = True
    await db.commit()
    return MessageResponse(message="Signalement résolu.")


# ─────────────────────────────────────────────
# VÉRIFICATIONS D'IDENTITÉ
# ─────────────────────────────────────────────

@router.get("/verifications", response_model=list[VerificationAdminResponse])
async def list_verifications(
    status_filter: Annotated[str, Query(alias="status")] = "pending",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Liste les demandes de vérification d'identité."""
    query = (
        select(IdentityVerification)
        .where(IdentityVerification.status == status_filter)
        .options(selectinload(IdentityVerification.user))
        .order_by(IdentityVerification.created_at.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(query)
    verifications = result.scalars().all()

    # Générer les URLs signées en parallèle (valides 1 heure)
    import asyncio

    async def _none() -> None:
        return None

    async def _build_verification_response(v: IdentityVerification) -> VerificationAdminResponse:
        selfie_url, id_card_url = await asyncio.gather(
            generate_presigned_url(v.selfie_url) if v.selfie_url else _none(),
            generate_presigned_url(v.id_card_url) if v.id_card_url else _none(),
        )
        return VerificationAdminResponse(
            id=v.id,
            user_id=v.user_id,
            user_name=v.user.first_name if v.user else "Supprimé",
            user_email=v.user.email if v.user else "",
            user_avatar_url=v.user.avatar_url if v.user else None,
            status=v.status,
            selfie_url=selfie_url,
            id_card_url=id_card_url,
            created_at=v.created_at,
        )

    return await asyncio.gather(*[_build_verification_response(v) for v in verifications])


@router.post("/verifications/{verification_id}/review", response_model=MessageResponse)
async def review_verification(
    verification_id: uuid.UUID,
    data: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Approuve ou rejette une demande de vérification d'identité.
    Les URLs des documents sont supprimées après la revue (confidentialité).
    """
    if data.action not in ("approve", "reject"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Action invalide. Valeurs acceptées : approve, reject",
        )

    result = await db.execute(
        select(IdentityVerification)
        .where(IdentityVerification.id == verification_id)
        .options(selectinload(IdentityVerification.user))
    )
    verification = result.scalar_one_or_none()
    if not verification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vérification introuvable")

    if verification.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette demande a déjà été traitée",
        )

    verification.status = "approved" if data.action == "approve" else "rejected"
    verification.reviewed_by = admin.id
    verification.reviewed_at = datetime.now(timezone.utc)

    # Supprimer les fichiers S3 + les URLs en base (RGPD — ne pas garder les pièces d'identité)
    from app.services.storage import delete_private_file
    if verification.selfie_url:
        await delete_private_file(verification.selfie_url)
    if verification.id_card_url:
        await delete_private_file(verification.id_card_url)
    verification.selfie_url = None
    verification.id_card_url = None

    # Si approuvé, marquer l'utilisateur comme vérifié + succès
    if data.action == "approve" and verification.user:
        verification.user.is_verified = True
        from app.services.achievements import check_achievements
        await check_achievements(db, verification.user.id, on_identity_verified=True)

    await db.commit()

    action_label = "approuvée" if data.action == "approve" else "rejetée"
    return MessageResponse(message=f"Vérification {action_label}.")
