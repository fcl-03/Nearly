import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

# ── Requêtes ──

class BusinessCreateRequest(BaseModel):
    """Création d'un compte entreprise."""
    business_name: str
    siren: str | None = None
    description: str | None = None
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    website: str | None = None

    @field_validator("business_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Le nom de l'établissement doit contenir au moins 2 caractères")
        if len(v) > 150:
            raise ValueError("Le nom de l'établissement ne peut pas dépasser 150 caractères")
        return v


class BusinessUpdateRequest(BaseModel):
    """Mise à jour des infos de l'établissement."""
    business_name: str | None = None
    description: str | None = None
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    website: str | None = None


class BusinessCreateSponsoredEvent(BaseModel):
    """Créer une sortie sponsorisée via le compte business."""
    title: str
    description: str
    category: str
    event_type: str = "open"
    location_name: str
    latitude: float
    longitude: float
    starts_at: datetime
    max_participants: int | None = None


# ── Réponses ──

class BusinessResponse(BaseModel):
    """Profil complet du compte entreprise (visible par le propriétaire)."""
    id: uuid.UUID
    business_name: str
    siren: str | None
    description: str | None
    logo_url: str | None
    address: str | None
    city: str | None
    phone: str | None
    website: str | None
    plan: str
    sponsored_events_limit: int | None
    sponsored_events_used: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BusinessStatsResponse(BaseModel):
    """Statistiques du compte business (plan Pro et Exclusif)."""
    total_sponsored_events: int
    total_participants: int
    total_impressions: int  # Nombre de fois que les sorties sponsorisées sont apparues
    events_this_week: int


class BusinessSponsoredEventResponse(BaseModel):
    """Une sortie sponsorisée avec ses stats."""
    id: uuid.UUID
    event_id: uuid.UUID
    event_title: str
    event_category: str
    event_starts_at: datetime
    event_is_active: bool
    participants_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class BusinessAdminResponse(BaseModel):
    """Vue admin d'un compte business."""
    id: uuid.UUID
    owner_id: uuid.UUID
    owner_email: str | None = None
    business_name: str
    plan: str
    city: str | None
    is_active: bool
    sponsored_events_used: int
    created_at: datetime

    model_config = {"from_attributes": True}
