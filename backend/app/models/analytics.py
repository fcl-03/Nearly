import uuid
from datetime import datetime, timezone

from sqlalchemy import Date, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AnalyticsSnapshot(Base):
    """Données agrégées anonymisées par ville/catégorie/jour pour revente B2B."""
    __tablename__ = "analytics_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Dimensions d'agrégation
    snapshot_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)

    # Métriques agrégées
    events_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_participants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_group_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Données temporelles
    peak_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-23

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
