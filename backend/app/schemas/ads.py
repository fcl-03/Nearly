import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AdResponse(BaseModel):
    """Publicité affichée dans le feed."""
    id: uuid.UUID
    title: str
    description: str | None = None
    image_url: str | None = None
    link_url: str
    cta_label: str = "En savoir plus"

    model_config = {"from_attributes": True}


class AdCreate(BaseModel):
    """Création d'une publicité (admin)."""
    title: str = Field(max_length=120)
    description: str | None = None
    image_url: str | None = Field(None, max_length=500)
    link_url: str = Field(max_length=500)
    cta_label: str = Field("En savoir plus", max_length=40)
    target_city: str | None = Field(None, max_length=100)
    expires_at: datetime | None = None


class AdAdmin(AdResponse):
    """Vue admin avec stats."""
    target_city: str | None = None
    impressions: int = 0
    clicks: int = 0
    is_active: bool = True
    created_at: datetime
    expires_at: datetime | None = None
