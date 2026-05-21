"""Seed data — badges par défaut."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.badge import Badge

# Badges disponibles dans l'application
DEFAULT_BADGES = [
    {"name": "Solaire", "emoji": "☀️"},
    {"name": "Ponctuel", "emoji": "⏰"},
    {"name": "Culture", "emoji": "🎭"},
    {"name": "Drôle", "emoji": "😂"},
    {"name": "Fiable", "emoji": "💪"},
    {"name": "Énergie", "emoji": "⚡"},
]


async def seed_badges(db: AsyncSession) -> int:
    """Insère les badges par défaut s'ils n'existent pas déjà. Retourne le nombre créé."""
    result = await db.execute(select(Badge))
    existing = {b.name for b in result.scalars().all()}

    created = 0
    for badge_data in DEFAULT_BADGES:
        if badge_data["name"] not in existing:
            db.add(Badge(**badge_data))
            created += 1

    if created > 0:
        await db.commit()
    return created
