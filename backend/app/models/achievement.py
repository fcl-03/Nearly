import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

# Succès automatiques — attribués par le système selon l'activité de l'utilisateur
ACHIEVEMENTS = {
    "first_event":   {"emoji": "🎉", "name": "Première sortie",   "desc": "Tu as rejoint ta première sortie"},
    "veteran":       {"emoji": "🏆", "name": "Vétéran",           "desc": "10 sorties rejointes"},
    "organizer":     {"emoji": "📋", "name": "Organisateur",      "desc": "Tu as créé ta première sortie"},
    "social":        {"emoji": "🤝", "name": "Social",            "desc": "Tu as ton premier ami"},
    "popular":       {"emoji": "⭐", "name": "Populaire",         "desc": "Tu as reçu ton premier badge"},
    "verified":      {"emoji": "✅", "name": "Identité vérifiée", "desc": "Ton identité a été confirmée"},
}


class UserAchievement(Base):
    """Succès automatique attribué par le système."""
    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "achievement_key", name="uq_user_achievement"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    achievement_key: Mapped[str] = mapped_column(String(50), nullable=False)
    awarded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
