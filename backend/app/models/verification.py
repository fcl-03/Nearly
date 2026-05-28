import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class IdentityVerification(Base):
    """Demande de vérification d'identité d'un utilisateur.
    Une seule entrée par utilisateur (unique=True sur user_id).
    Les URLs selfie/pièce sont supprimées après validation ou refus.
    """
    __tablename__ = "identity_verifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # pending | approved | rejected
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)

    # URLs temporaires dans le bucket privé — supprimées après revue
    selfie_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    id_card_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Admin qui a effectué la revue (SET NULL si l'admin supprime son compte)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped["User"] = relationship(foreign_keys=[user_id], back_populates="identity_verification")
