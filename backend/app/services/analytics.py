"""
Pipeline de données anonymisées pour revente B2B.
Agrège les données des utilisateurs ayant donné leur consentement (data_consent=True).
"""
import csv
import io
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import Date, Integer, cast, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsSnapshot
from app.models.event import Event, EventParticipant
from app.models.user import User


async def generate_daily_snapshot(db: AsyncSession, target_date: date | None = None) -> int:
    """
    Génère les snapshots agrégés pour une journée donnée.
    Ne prend en compte que les événements créés par des utilisateurs
    ayant donné leur consentement (data_consent=True).
    Retourne le nombre de snapshots créés.
    """
    if target_date is None:
        target_date = (datetime.now(timezone.utc) - timedelta(days=1)).date()

    # Sous-requête : IDs des utilisateurs consentants
    consenting_users = select(User.id).where(User.data_consent.is_(True)).scalar_subquery()

    # On utilise la ville du créateur de l'événement (Event n'a pas de champ city)
    # Événements du jour créés par des utilisateurs consentants
    events_query = (
        select(
            User.city.label("city"),
            Event.category,
            func.count(Event.id).label("events_created"),
        )
        .join(User, Event.creator_id == User.id)
        .where(
            cast(Event.created_at, Date) == target_date,
            Event.creator_id.in_(consenting_users),
            User.city.isnot(None),
        )
        .group_by(User.city, Event.category)
    )
    events_result = await db.execute(events_query)
    events_data = {(row.city, row.category): row.events_created for row in events_result}

    # Participants par ville/catégorie (join events du jour)
    participants_query = (
        select(
            User.city.label("city"),
            Event.category,
            func.count(EventParticipant.user_id).label("total_participants"),
        )
        .join(Event, EventParticipant.event_id == Event.id)
        .join(User, Event.creator_id == User.id)
        .where(
            cast(Event.created_at, Date) == target_date,
            Event.creator_id.in_(consenting_users),
            User.city.isnot(None),
            EventParticipant.status == "joined",
        )
        .group_by(User.city, Event.category)
    )
    participants_result = await db.execute(participants_query)
    participants_data = {(row.city, row.category): row.total_participants for row in participants_result}

    # Heure de pointe par ville/catégorie
    peak_query = (
        select(
            User.city.label("city"),
            Event.category,
            extract("hour", Event.starts_at).cast(Integer).label("hour"),
            func.count(Event.id).label("cnt"),
        )
        .join(User, Event.creator_id == User.id)
        .where(
            cast(Event.created_at, Date) == target_date,
            Event.creator_id.in_(consenting_users),
            User.city.isnot(None),
        )
        .group_by(User.city, Event.category, extract("hour", Event.starts_at))
        .order_by(func.count(Event.id).desc())
    )
    peak_result = await db.execute(peak_query)
    peak_hours: dict[tuple, int] = {}
    for row in peak_result:
        key = (row.city, row.category)
        if key not in peak_hours:
            peak_hours[key] = row.hour

    # Créer les snapshots
    all_keys = set(events_data.keys()) | set(participants_data.keys())
    count = 0
    for city, category in all_keys:
        ev_count = events_data.get((city, category), 0)
        part_count = participants_data.get((city, category), 0)
        avg_size = round(part_count / ev_count) if ev_count > 0 else 0

        snapshot = AnalyticsSnapshot(
            snapshot_date=target_date,
            city=city,
            category=category,
            events_created=ev_count,
            total_participants=part_count,
            avg_group_size=avg_size,
            peak_hour=peak_hours.get((city, category)),
        )
        db.add(snapshot)
        count += 1

    await db.commit()
    return count


async def get_snapshots(
    db: AsyncSession,
    city: str | None = None,
    category: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 500,
) -> list[AnalyticsSnapshot]:
    """Requête filtrée des snapshots pour l'API d'export."""
    query = select(AnalyticsSnapshot).order_by(AnalyticsSnapshot.snapshot_date.desc())

    if city:
        query = query.where(AnalyticsSnapshot.city == city)
    if category:
        query = query.where(AnalyticsSnapshot.category == category)
    if date_from:
        query = query.where(AnalyticsSnapshot.snapshot_date >= date_from)
    if date_to:
        query = query.where(AnalyticsSnapshot.snapshot_date <= date_to)

    query = query.limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


def snapshots_to_csv(snapshots: list[AnalyticsSnapshot]) -> str:
    """Convertit les snapshots en CSV pour export."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "city", "category", "events_created", "total_participants", "avg_group_size", "peak_hour"])
    for s in snapshots:
        writer.writerow([
            s.snapshot_date.isoformat(),
            s.city,
            s.category,
            s.events_created,
            s.total_participants,
            s.avg_group_size,
            s.peak_hour,
        ])
    return output.getvalue()
