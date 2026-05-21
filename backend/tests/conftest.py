"""
Configuration pytest pour Nearly.
Les variables d'environnement DOIVENT être définies avant tout import de l'app.
"""
import asyncio
import os

# ─── Override de config AVANT l'import de l'app ────────────────────────────
os.environ["DATABASE_URL"] = "postgresql+asyncpg://nearly:nearly_dev@localhost:5432/nearly_test"
os.environ["REDIS_URL"] = "redis://:nearly_dev@localhost:6379/1"  # DB Redis 1 = tests
os.environ["RESEND_API_KEY"] = ""
os.environ["S3_ENDPOINT_URL"] = ""
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["DEBUG"] = "true"

# Note : on utilise @nearly.app car .test est un TLD réservé rejeté par email-validator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.user import User
from main import app

# Désactiver TOUS les rate limiters pour les tests
app.state.limiter.enabled = False
from app.api.v1.endpoints import auth as _auth_mod

_auth_mod.limiter.enabled = False
try:
    from app.api.v1.endpoints import friendships as _fr_mod
    _fr_mod.limiter.enabled = False
except Exception:
    pass
try:
    from app.api.v1.endpoints import reports as _rp_mod
    _rp_mod.limiter.enabled = False
except Exception:
    pass
try:
    from app.api.v1.endpoints import messages as _msg_mod
    _msg_mod.limiter.enabled = False
except Exception:
    pass

TEST_DATABASE_URL = os.environ["DATABASE_URL"]


# ─── Setup de la base de données de test ────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """
    Applique les migrations sur la DB de test et crée les utilisateurs de base.
    S'exécute UNE FOIS avant tous les tests de la session.
    """
    from alembic.config import Config

    from alembic import command

    # Appliquer les migrations (synchrone)
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    command.upgrade(cfg, "head")

    # Créer les utilisateurs de test via async (avant le TestClient)
    asyncio.run(_seed_test_users())
    yield
    # Nettoyage final : vider toutes les tables
    asyncio.run(_truncate_all())


async def _seed_test_users():
    """Crée les utilisateurs de test : regular, verified, admin."""
    import bcrypt
    engine = create_async_engine(TEST_DATABASE_URL)
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        # Vider d'abord
        await db.execute(text(
            "TRUNCATE users, events, messages, identity_verifications, reports, "
            "interests, user_interests, event_participants, notifications, "
            "private_messages, friendships, ads, analytics_snapshots, badges, "
            "user_badges, user_photos, photo_likes, photo_tags, "
            "event_deletion_polls, event_read_receipts, user_achievements, "
            "business_accounts, business_sponsored_events "
            "RESTART IDENTITY CASCADE"
        ))

        password_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode()

        import uuid
        users = [
            User(id=uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001"), email="regular@nearly.app",   password_hash=password_hash, first_name="Regular"),
            User(id=uuid.UUID("aaaaaaaa-0000-0000-0000-000000000002"), email="verified@nearly.app",  password_hash=password_hash, first_name="Verified",  is_email_verified=True, is_verified=True),
            User(id=uuid.UUID("aaaaaaaa-0000-0000-0000-000000000003"), email="admin@nearly.app",     password_hash=password_hash, first_name="Admin",     is_email_verified=True, is_verified=True, is_admin=True),
            User(id=uuid.UUID("aaaaaaaa-0000-0000-0000-000000000004"), email="other@nearly.app",     password_hash=password_hash, first_name="Other",     is_email_verified=True, is_verified=True),
        ]
        for u in users:
            db.add(u)
        await db.commit()
    await engine.dispose()


async def _truncate_all():
    """Vide toutes les tables après la session."""
    engine = create_async_engine(TEST_DATABASE_URL)
    async with async_sessionmaker(engine)() as db:
        await db.execute(text(
            "TRUNCATE users, events, messages, identity_verifications, reports, "
            "interests, user_interests, event_participants, notifications, "
            "private_messages, friendships, ads, analytics_snapshots, badges, "
            "user_badges, user_photos, photo_likes, photo_tags, "
            "event_deletion_polls, event_read_receipts, user_achievements, "
            "business_accounts, business_sponsored_events "
            "RESTART IDENTITY CASCADE"
        ))
        await db.commit()
    await engine.dispose()


# ─── Client HTTP ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client(setup_test_db):
    """TestClient partagé sur toute la session."""
    with TestClient(app) as c:
        yield c


# ─── Tokens des utilisateurs de test ─────────────────────────────────────────

@pytest.fixture(scope="session")
def regular_token(client) -> str:
    """Token JWT d'un utilisateur sans email vérifié."""
    r = client.post("/api/v1/auth/login", json={"email": "regular@nearly.app", "password": "password123"})
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def verified_token(client) -> str:
    """Token JWT d'un utilisateur avec email vérifié."""
    r = client.post("/api/v1/auth/login", json={"email": "verified@nearly.app", "password": "password123"})
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token(client) -> str:
    """Token JWT d'un administrateur."""
    r = client.post("/api/v1/auth/login", json={"email": "admin@nearly.app", "password": "password123"})
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def other_token(client) -> str:
    """Token JWT d'un autre utilisateur (pour tester les accès non-autorisés)."""
    r = client.post("/api/v1/auth/login", json={"email": "other@nearly.app", "password": "password123"})
    return r.json()["access_token"]


# ─── Nettoyage des cookies avant chaque test ──────────────────────────────────

@pytest.fixture(autouse=True)
def clear_cookies(client):
    """Efface les cookies du client avant chaque test pour éviter les interférences."""
    client.cookies.clear()
    yield
    client.cookies.clear()


# ─── Headers helpers ──────────────────────────────────────────────────────────

def auth(token: str) -> dict:
    """Raccourci pour créer les headers Authorization."""
    return {"Authorization": f"Bearer {token}"}


# ─── Fixture event réutilisable ───────────────────────────────────────────────

@pytest.fixture
def future_event_payload() -> dict:
    """Payload valide pour créer une sortie dans le futur."""
    from datetime import datetime, timedelta, timezone
    return {
        "title": "Sortie test",
        "description": "Une sortie pour les tests automatisés.",
        "category": "test",
        "event_type": "small_group",
        "location_name": "Troyes Centre",
        "latitude": 48.2973,
        "longitude": 4.0744,
        "starts_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "max_participants": 4,
    }
