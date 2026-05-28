import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)

    # "small_group" (3-6 personnes) ou "open" (illimité)
    event_type: Mapped[str] = mapped_column(String(20), nullable=False, default="small_group")

    location_name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Nombre max de participants — None pour les sorties "open"
    max_participants: Mapped[int | None] = mapped_column(Integer, nullable=True)

    is_sponsored: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Si True : les demandes "Rejoindre" doivent être validées par le créateur.
    # Sinon : join direct (comportement par défaut).
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relations
    creator: Mapped["User"] = relationship(back_populates="events_created")
    participants: Mapped[list["EventParticipant"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    messages: Mapped[list["Message"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(foreign_keys="Report.reported_event_id", back_populates="reported_event")
    deletion_poll: Mapped["EventDeletionPoll | None"] = relationship(back_populates="event", uselist=False, cascade="all, delete-orphan")


class EventParticipant(Base):
    __tablename__ = "event_participants"

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status: Mapped[str] = mapped_column(String(20), default="joined")  # joined | left | pending | rejected

    event: Mapped["Event"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship(back_populates="event_participations")


class EventDeletionPoll(Base):
    """Vote de suppression d'une sortie initié par le créateur."""
    __tablename__ = "event_deletion_polls"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Listes d'UUIDs (str) des participants ayant voté
    votes_keep: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    votes_delete: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    event: Mapped["Event"] = relationship(back_populates="deletion_poll")
