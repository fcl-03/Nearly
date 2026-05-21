import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

# Badges disponibles — seront insérés via migration de données
# ☀️ Solaire · ⏰ Ponctuel · 🎭 Culture · 😂 Drôle · 💪 Fiable · ⚡ Énergie


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    emoji: Mapped[str] = mapped_column(String(10), nullable=False)

    given_to: Mapped[list["UserBadge"]] = relationship(back_populates="badge")


class UserBadge(Base):
    """Badge attribué anonymement après une sortie (uniquement positif)."""
    __tablename__ = "user_badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    giver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id"), nullable=False)
    given_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    badge: Mapped["Badge"] = relationship(back_populates="given_to")
    receiver: Mapped["User"] = relationship(foreign_keys=[receiver_id], back_populates="badges_received")
    giver: Mapped["User"] = relationship(foreign_keys=[giver_id])
