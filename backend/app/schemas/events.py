import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, field_validator, model_validator

VALID_EVENT_TYPES = {"small_group", "open"}


class CreatorInfo(BaseModel):
    id: uuid.UUID
    first_name: str
    avatar_url: str | None
    is_verified: bool
    is_premium: bool = False

    model_config = {"from_attributes": True}


class ParticipantInfo(BaseModel):
    id: uuid.UUID
    first_name: str
    avatar_url: str | None
    is_verified: bool

    model_config = {"from_attributes": True}


class EventCreate(BaseModel):
    title: str
    description: str
    category: str
    event_type: str = "small_group"
    location_name: str
    latitude: float
    longitude: float
    starts_at: datetime
    max_participants: int | None = None
    requires_approval: bool = False

    @field_validator("title")
    @classmethod
    def title_length(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Le titre est requis")
        if len(v) > 60:
            raise ValueError("Le titre ne peut pas dépasser 60 caractères")
        return v

    @field_validator("description")
    @classmethod
    def description_length(cls, v: str) -> str:
        if len(v.strip()) < 20:
            raise ValueError("La description doit contenir au moins 20 caractères")
        if len(v) > 2000:
            raise ValueError("La description ne peut pas dépasser 2000 caractères")
        return v

    @field_validator("event_type")
    @classmethod
    def valid_event_type(cls, v: str) -> str:
        if v not in VALID_EVENT_TYPES:
            raise ValueError(f"Type invalide. Valeurs acceptées : {', '.join(VALID_EVENT_TYPES)}")
        return v

    @field_validator("latitude")
    @classmethod
    def valid_latitude(cls, v: float) -> float:
        if not (-90 <= v <= 90):
            raise ValueError("Latitude invalide (doit être entre -90 et 90)")
        return v

    @field_validator("longitude")
    @classmethod
    def valid_longitude(cls, v: float) -> float:
        if not (-180 <= v <= 180):
            raise ValueError("Longitude invalide (doit être entre -180 et 180)")
        return v

    @field_validator("starts_at")
    @classmethod
    def starts_at_future(cls, v: datetime) -> datetime:
        # Normaliser en UTC si pas de timezone
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v <= datetime.now(timezone.utc):
            raise ValueError("La sortie doit être planifiée dans le futur")
        return v

    @model_validator(mode="after")
    def validate_max_participants(self) -> "EventCreate":
        if self.event_type == "small_group":
            if self.max_participants is None:
                raise ValueError("max_participants est requis pour une sortie en petit groupe")
            if not (3 <= self.max_participants <= 6):
                raise ValueError("Une sortie en petit groupe doit avoir entre 3 et 6 participants")
        return self


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    starts_at: datetime | None = None
    max_participants: int | None = None

    @field_validator("title")
    @classmethod
    def title_length(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Le titre est requis")
            if len(v) > 60:
                raise ValueError("Le titre ne peut pas dépasser 60 caractères")
        return v

    @field_validator("starts_at")
    @classmethod
    def starts_at_future(cls, v: datetime | None) -> datetime | None:
        if v is not None:
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            if v <= datetime.now(timezone.utc):
                raise ValueError("La sortie doit être planifiée dans le futur")
        return v


class DeletionPollInfo(BaseModel):
    id: uuid.UUID
    votes_keep: list[str] = []
    votes_delete: list[str] = []
    is_resolved: bool


VALID_VOTES = {"keep", "delete"}


class VoteRequest(BaseModel):
    vote: str

    @field_validator("vote")
    @classmethod
    def valid_vote(cls, v: str) -> str:
        if v not in VALID_VOTES:
            raise ValueError(f"Vote invalide. Valeurs acceptées : {', '.join(VALID_VOTES)}")
        return v


class DeletionRequestResponse(BaseModel):
    deleted: bool
    poll_id: str | None = None


class VoteResponse(BaseModel):
    vote: str
    outcome: str | None = None


class EventResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    category: str
    event_type: str
    location_name: str
    latitude: float
    longitude: float
    starts_at: datetime
    max_participants: int | None
    is_sponsored: bool
    is_active: bool
    requires_approval: bool = False
    created_at: datetime
    creator: CreatorInfo
    participants_count: int
    participants: list[ParticipantInfo] = []
    is_full: bool
    is_joined: bool  # True si l'utilisateur courant a rejoint (status="joined")
    join_status: str | None = None  # "joined" | "pending" | "rejected" | None — état précis du user courant
    distance_km: float | None = None  # Rempli si lat/lon fournis dans la recherche
    last_message_at: datetime | None = None  # Date du dernier message dans le chat
    deletion_poll: DeletionPollInfo | None = None  # Vote de suppression en cours
