import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Destinataire
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Type : friend_request | friend_accepted | badge_received | event_joined | new_dm
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Texte affiché (ex: "Lucas t'a envoyé une demande d'ami")
    content: Mapped[str] = mapped_column(String(300), nullable=False)
    # Lue ou non
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Utilisateur à l'origine de la notif (pour afficher son avatar/nom)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # ID de ressource liée (event_id, badge_id…) — stocké en string pour flexibilité
    related_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relations
    user = relationship("User", foreign_keys=[user_id], lazy="select")
    actor = relationship("User", foreign_keys=[actor_id], lazy="select")
