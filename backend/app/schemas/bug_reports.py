from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BugReportCreate(BaseModel):
    message: str = Field(min_length=10, max_length=2000)
    page_url: str | None = Field(default=None, max_length=500)
    user_agent: str | None = Field(default=None, max_length=500)


class BugReportUpdate(BaseModel):
    """Action admin : changer le statut ou ajouter des notes."""
    status: Literal["open", "in_progress", "resolved", "rejected"] | None = None
    admin_notes: str | None = Field(default=None, max_length=2000)


class BugReportReporter(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    first_name: str
    email: str


class BugReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    message: str
    page_url: str | None
    user_agent: str | None
    status: str
    admin_notes: str | None
    created_at: datetime
    reporter: BugReportReporter | None = None
