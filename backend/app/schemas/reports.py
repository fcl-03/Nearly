import uuid

from pydantic import BaseModel


class ReportCreate(BaseModel):
    reason: str
    reported_user_id: uuid.UUID | None = None
    reported_event_id: uuid.UUID | None = None


class ReportResponse(BaseModel):
    id: uuid.UUID
    message: str
