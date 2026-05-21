import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.business import BusinessAccount, BusinessSponsoredEvent
from app.models.event import Event, EventParticipant
from app.models.user import User
from app.schemas.business import (
    BusinessCreateRequest,
    BusinessCreateSponsoredEvent,
    BusinessResponse,
    BusinessSponsoredEventResponse,
    BusinessStatsResponse,
    BusinessUpdateRequest,
)

# Limites de sorties sponsorisées par plan (par semaine)
PLAN_LIMITS = {
    "starter": 3,
    "pro": 10,
    "exclusif": None,  # illimité
}

PLAN_PRICES = {
    "starter": 49,
    "pro": 99,
    "exclusif": 199,
}


async def create_business_account(
    db: AsyncSession, owner: User, data: BusinessCreateRequest
) -> BusinessAccount:
    """Crée un compte entreprise pour un utilisateur existant."""
    # Vérifier que l'utilisateur n'a pas déjà un compte business
    existing = await db.execute(
        select(BusinessAccount).where(BusinessAccount.owner_id == owner.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tu as déjà un compte entreprise",
        )

    account = BusinessAccount(
        owner_id=owner.id,
        business_name=data.business_name.strip(),
        siren=data.siren,
        description=data.description,
        address=data.address,
        city=data.city or owner.city,
        phone=data.phone,
        website=data.website,
        plan="starter",
        sponsored_events_limit=PLAN_LIMITS["starter"],
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def get_business_account(db: AsyncSession, owner_id: uuid.UUID) -> BusinessAccount:
    """Récupère le compte business d'un utilisateur."""
    result = await db.execute(
        select(BusinessAccount).where(BusinessAccount.owner_id == owner_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun compte entreprise trouvé",
        )
    return account


async def update_business_account(
    db: AsyncSession, owner_id: uuid.UUID, data: BusinessUpdateRequest
) -> BusinessAccount:
    """Met à jour les infos de l'établissement."""
    account = await get_business_account(db, owner_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return account


async def get_business_stats(db: AsyncSession, owner_id: uuid.UUID) -> BusinessStatsResponse:
    """Statistiques du compte business (plan Pro et Exclusif)."""
    account = await get_business_account(db, owner_id)

    if account.plan == "starter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Les statistiques sont disponibles à partir du plan Pro",
        )

    # Récupérer les événements sponsorisés de ce compte
    result = await db.execute(
        select(BusinessSponsoredEvent).where(BusinessSponsoredEvent.business_id == account.id)
    )
    sponsored = result.scalars().all()
    event_ids = [s.event_id for s in sponsored]

    total_participants = 0
    if event_ids:
        count_result = await db.execute(
            select(func.count()).select_from(EventParticipant).where(
                EventParticipant.event_id.in_(event_ids),
                EventParticipant.status == "joined",
            )
        )
        total_participants = count_result.scalar() or 0

    # Sorties cette semaine
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    events_this_week = sum(1 for s in sponsored if s.created_at >= week_ago)

    return BusinessStatsResponse(
        total_sponsored_events=len(sponsored),
        total_participants=total_participants,
        total_impressions=0,  # TODO: implémenter le tracking d'impressions
        events_this_week=events_this_week,
    )


async def create_sponsored_event(
    db: AsyncSession, owner: User, data: BusinessCreateSponsoredEvent
) -> BusinessSponsoredEventResponse:
    """Crée une sortie sponsorisée via le compte business."""
    account = await get_business_account(db, owner.id)

    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ton compte entreprise est désactivé",
        )

    # Vérifier la limite de sorties sponsorisées
    if account.sponsored_events_limit is not None:
        if account.sponsored_events_used >= account.sponsored_events_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Limite de {account.sponsored_events_limit} sorties sponsorisées atteinte pour le plan {account.plan}. Passe au plan supérieur.",
            )

    # Créer l'événement
    event = Event(
        creator_id=owner.id,
        title=data.title,
        description=data.description,
        category=data.category,
        event_type=data.event_type,
        location_name=data.location_name,
        latitude=data.latitude,
        longitude=data.longitude,
        starts_at=data.starts_at,
        max_participants=data.max_participants,
        is_sponsored=True,
    )
    db.add(event)
    await db.flush()

    # Le créateur rejoint automatiquement
    participant = EventParticipant(event_id=event.id, user_id=owner.id, status="joined")
    db.add(participant)

    # Lier la sortie au compte business
    link = BusinessSponsoredEvent(business_id=account.id, event_id=event.id)
    db.add(link)

    # Incrémenter le compteur
    account.sponsored_events_used += 1
    await db.commit()

    # Compter les participants pour la réponse
    return BusinessSponsoredEventResponse(
        id=link.id,
        event_id=event.id,
        event_title=event.title,
        event_category=event.category,
        event_starts_at=event.starts_at,
        event_is_active=event.is_active,
        participants_count=1,
        created_at=link.created_at,
    )


async def list_sponsored_events(
    db: AsyncSession, owner_id: uuid.UUID
) -> list[BusinessSponsoredEventResponse]:
    """Liste les sorties sponsorisées du compte business."""
    account = await get_business_account(db, owner_id)

    result = await db.execute(
        select(BusinessSponsoredEvent)
        .where(BusinessSponsoredEvent.business_id == account.id)
        .options(selectinload(BusinessSponsoredEvent.event).selectinload(Event.participants))
        .order_by(BusinessSponsoredEvent.created_at.desc())
    )
    links = result.scalars().all()

    return [
        BusinessSponsoredEventResponse(
            id=link.id,
            event_id=link.event.id,
            event_title=link.event.title,
            event_category=link.event.category,
            event_starts_at=link.event.starts_at,
            event_is_active=link.event.is_active,
            participants_count=sum(1 for p in link.event.participants if p.status == "joined"),
            created_at=link.created_at,
        )
        for link in links
    ]


async def upgrade_plan(
    db: AsyncSession, owner_id: uuid.UUID, new_plan: str
) -> BusinessAccount:
    """Change le plan d'un compte business (appelé après paiement Stripe)."""
    if new_plan not in PLAN_LIMITS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plan invalide. Choix possibles : {', '.join(PLAN_LIMITS.keys())}",
        )

    account = await get_business_account(db, owner_id)
    account.plan = new_plan
    account.sponsored_events_limit = PLAN_LIMITS[new_plan]
    await db.commit()
    await db.refresh(account)
    return account
