import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

USERNAME_RE = re.compile(r'^[a-z0-9_]{3,30}$')


class PhotoTaggedUser(BaseModel):
    id: uuid.UUID
    first_name: str
    avatar_url: str | None = None


class PhotoOut(BaseModel):
    id: uuid.UUID
    url: str
    description: str | None = None
    created_at: datetime
    likes_count: int = 0
    liked_by_me: bool = False
    tags: list[PhotoTaggedUser] = []


class BadgeOut(BaseModel):
    id: int
    name: str
    emoji: str

    model_config = {"from_attributes": True}


class BadgeSummaryOut(BaseModel):
    id: int
    name: str
    emoji: str
    count: int


class InterestOut(BaseModel):
    id: int
    name: str
    emoji: str
    category: str

    model_config = {"from_attributes": True}


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    username: str | None
    bio: str | None
    avatar_url: str | None
    city: str | None
    latitude: float | None
    longitude: float | None
    is_verified: bool
    is_email_verified: bool
    is_premium: bool
    is_admin: bool
    data_consent: bool
    created_at: datetime
    interests: list[InterestOut]

    model_config = {"from_attributes": True}


class PublicUserProfile(BaseModel):
    id: uuid.UUID
    first_name: str
    username: str | None = None
    bio: str | None
    avatar_url: str | None
    city: str | None
    is_verified: bool
    is_premium: bool = False
    created_at: datetime
    interests: list[InterestOut]
    # none | request_sent | request_received | friends
    friendship_status: str = "none"
    friends_count: int = 0
    events_count: int = 0

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    first_name: str | None = None
    username: str | None = None
    email: EmailStr | None = None
    bio: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    data_consent: bool | None = None

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip().lower()
            if not USERNAME_RE.match(v):
                raise ValueError("Le nom d'utilisateur doit faire 3-30 caractères (lettres minuscules, chiffres, _)")
        return v

    @field_validator("first_name")
    @classmethod
    def first_name_not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Le prénom ne peut pas être vide")
        return v

    @field_validator("bio")
    @classmethod
    def bio_max_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("La bio ne peut pas dépasser 500 caractères")
        return v


class UpdateInterestsRequest(BaseModel):
    interest_ids: list[int]

    @field_validator("interest_ids")
    @classmethod
    def max_interests(cls, v: list[int]) -> list[int]:
        if len(v) > 10:
            raise ValueError("Maximum 10 intérêts autorisés")
        return list(set(v))  # Dédoublonnage
