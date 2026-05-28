import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Identifiant public unique choisi par l'utilisateur (ex: @marie_trs)
    username: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True, index=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Statuts de compte
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)       # identité vérifiée
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    premium_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)

    # Consentement données d'activité anonymisées (opt-in)
    data_consent: Mapped[bool] = mapped_column(Boolean, default=False)

    # Localisation
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relations
    interests: Mapped[list["UserInterest"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    events_created: Mapped[list["Event"]] = relationship(back_populates="creator", cascade="all, delete-orphan")
    event_participations: Mapped[list["EventParticipant"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    messages_sent: Mapped[list["Message"]] = relationship(back_populates="sender", cascade="all, delete-orphan")
    private_messages_sent: Mapped[list["PrivateMessage"]] = relationship(foreign_keys="PrivateMessage.sender_id", back_populates="sender", cascade="all, delete-orphan")
    private_messages_received: Mapped[list["PrivateMessage"]] = relationship(foreign_keys="PrivateMessage.receiver_id", back_populates="receiver", cascade="all, delete-orphan")
    identity_verification: Mapped["IdentityVerification | None"] = relationship(foreign_keys="IdentityVerification.user_id", back_populates="user", uselist=False, cascade="all, delete-orphan", single_parent=True)
    reports_made: Mapped[list["Report"]] = relationship(foreign_keys="Report.reporter_id", back_populates="reporter", cascade="all, delete-orphan")
    badges_received: Mapped[list["UserBadge"]] = relationship(foreign_keys="UserBadge.receiver_id", back_populates="receiver", cascade="all, delete-orphan")
    photos: Mapped[list["UserPhoto"]] = relationship(back_populates="user", cascade="all, delete-orphan", order_by="UserPhoto.created_at.desc()")


class Interest(Base):
    __tablename__ = "interests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    emoji: Mapped[str] = mapped_column(String(10), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)

    users: Mapped[list["UserInterest"]] = relationship(back_populates="interest")


class UserInterest(Base):
    __tablename__ = "user_interests"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    interest_id: Mapped[int] = mapped_column(ForeignKey("interests.id", ondelete="CASCADE"), primary_key=True)

    user: Mapped["User"] = relationship(back_populates="interests")
    interest: Mapped["Interest"] = relationship(back_populates="users")
