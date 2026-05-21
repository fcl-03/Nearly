import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class BusinessAccount(Base):
    """Compte entreprise B2B — établissements locaux partenaires de Nearly."""
    __tablename__ = "business_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Propriétaire — un utilisateur Nearly existant qui gère ce compte business
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Infos de l'établissement
    business_name: Mapped[str] = mapped_column(String(150), nullable=False)
    siren: Mapped[str | None] = mapped_column(String(14), nullable=True)  # SIREN/SIRET (optionnel au début)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    website: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Abonnement : starter / pro / exclusif
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="starter")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)

    # Limites liées au plan
    # starter=3, pro=10, exclusif=illimité (None)
    sponsored_events_limit: Mapped[int | None] = mapped_column(Integer, nullable=True, default=3)
    sponsored_events_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Statut
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relations
    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])
    sponsored_events: Mapped[list["BusinessSponsoredEvent"]] = relationship(back_populates="business", cascade="all, delete-orphan")


class BusinessSponsoredEvent(Base):
    """Liaison entre un compte business et une sortie sponsorisée qu'il a créée."""
    __tablename__ = "business_sponsored_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_accounts.id", ondelete="CASCADE"), nullable=False)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    business: Mapped["BusinessAccount"] = relationship(back_populates="sponsored_events")
    event: Mapped["Event"] = relationship()
