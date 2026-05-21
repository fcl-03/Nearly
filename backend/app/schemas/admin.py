import uuid
from datetime import datetime

from pydantic import BaseModel


class StatsResponse(BaseModel):
    total_users: int
    email_verified_users: int
    identity_verified_users: int
    banned_users: int
    active_events: int
    total_events: int
    total_messages: int
    pending_reports: int
    pending_verifications: int


class UserAdminResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    avatar_url: str | None
    bio: str | None
    city: str | None
    is_email_verified: bool
    is_verified: bool
    is_premium: bool
    is_admin: bool
    is_banned: bool
    data_consent: bool
    created_at: datetime
    last_active_at: datetime
    identity_verification_status: str | None  # pending | approved | rejected | None

    model_config = {"from_attributes": True}


class BanRequest(BaseModel):
    reason: str | None = None


class ReportAdminResponse(BaseModel):
    id: uuid.UUID
    reporter_id: uuid.UUID
    reporter_name: str
    reported_user_id: uuid.UUID | None
    reported_user_name: str | None
    reported_event_id: uuid.UUID | None
    reported_event_title: str | None
    reason: str
    is_resolved: bool
    created_at: datetime


class EventAdminResponse(BaseModel):
    id: uuid.UUID
    title: str
    category: str
    event_type: str
    location_name: str
    starts_at: datetime
    is_active: bool
    creator_id: uuid.UUID
    creator_name: str
    participants_count: int
    created_at: datetime


class VerificationAdminResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_email: str
    user_avatar_url: str | None
    status: str
    selfie_url: str | None
    id_card_url: str | None
    created_at: datetime


class ReviewRequest(BaseModel):
    action: str  # "approve" | "reject"
