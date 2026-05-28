import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class BugReport(Base):
    """Signalement de bug remonté par un utilisateur (différent de Report, qui sert
    à signaler un contenu / utilisateur). Sert au suivi qualité produit."""

    __tablename__ = "bug_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Description du bug par l'utilisateur
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Contexte technique (capturé automatiquement côté front)
    page_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Suivi admin
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)  # open | in_progress | resolved | rejected
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    reporter: Mapped["User | None"] = relationship(foreign_keys=[reporter_id])
