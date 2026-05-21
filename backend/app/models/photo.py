import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserPhoto(Base):
    """Photo de profil uploadée par l'utilisateur (galerie Instagram-style)."""
    __tablename__ = "user_photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="photos")
    likes: Mapped[list["PhotoLike"]] = relationship(back_populates="photo", cascade="all, delete-orphan")
    tags: Mapped[list["PhotoTag"]] = relationship(back_populates="photo", cascade="all, delete-orphan")


class PhotoLike(Base):
    """Like sur une photo de profil."""
    __tablename__ = "photo_likes"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    photo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_photos.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    photo: Mapped["UserPhoto"] = relationship(back_populates="likes")


class PhotoTag(Base):
    """Tag d'un utilisateur sur une photo (clé composite photo+user = unicité garantie)."""
    __tablename__ = "photo_tags"

    photo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_photos.id", ondelete="CASCADE"), primary_key=True)
    tagged_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    photo: Mapped["UserPhoto"] = relationship(back_populates="tags")
    tagged_user: Mapped["User"] = relationship(foreign_keys=[tagged_user_id])
