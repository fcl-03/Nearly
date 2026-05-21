import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class SenderInfo(BaseModel):
    id: uuid.UUID
    first_name: str
    avatar_url: str | None
    is_verified: bool

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    content: str
    sender: SenderInfo | None  # None si l'utilisateur a été supprimé
    created_at: datetime
    is_deleted: bool


# ── Messages privés (DM) ──

class DMSendRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty_and_not_too_long(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Le message ne peut pas être vide")
        if len(v) > 1000:
            raise ValueError("Le message ne peut pas dépasser 1000 caractères")
        return v


class DMMessageResponse(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    created_at: datetime
    is_read: bool

    model_config = {"from_attributes": True}


class DMConversationPreview(BaseModel):
    partner: SenderInfo
    last_message: str
    last_message_at: datetime
    unread_count: int
