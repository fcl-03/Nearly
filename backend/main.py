import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import router as v1_router
from app.core.config import settings

# Initialisation Sentry (monitoring d'erreurs en production)
if settings.SENTRY_DSN:
    sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.1)
from datetime import datetime, timezone

from app.core.database import AsyncSessionLocal
from app.core.redis import close_redis, init_redis
from app.websockets.chat import router as ws_router

logger = logging.getLogger(__name__)


async def _cleanup_loop() -> None:
    """Tâche de fond — désactive les sorties passées + supprime les chats expirés toutes les heures."""
    while True:
        await asyncio.sleep(3600)
        async with AsyncSessionLocal() as db:
            try:
                # 1. Désactiver les sorties dont la date est passée
                from sqlalchemy import update

                from app.models.event import Event
                result = await db.execute(
                    update(Event)
                    .where(Event.is_active == True, Event.starts_at < datetime.now(timezone.utc))  # noqa: E712
                    .values(is_active=False)
                )
                if result.rowcount > 0:
                    logger.info("Auto-désactivation : %d sorties passées", result.rowcount)
                await db.commit()

                # 2. Supprimer les messages des chats expirés (7 jours après la sortie)
                from app.services.messages import cleanup_expired_event_chats
                count = await cleanup_expired_event_chats(db)
                if count > 0:
                    logger.info("Nettoyage des chats : %d messages supprimés", count)

                # 3. Générer les snapshots analytiques quotidiens (données anonymisées)
                from app.services.analytics import generate_daily_snapshot
                snap_count = await generate_daily_snapshot(db)
                if snap_count > 0:
                    logger.info("Analytics : %d snapshots générés", snap_count)
            except Exception as exc:
                logger.error("Erreur lors du nettoyage : %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Vérifications de sécurité au démarrage
    # On considère faible : valeurs par défaut connues, < 32 caractères, ou contenant "change"/"default"/"secret-key"
    weak_secrets = {"change-this-in-production", "change-this-secret-key-in-production", "secret", "changeme"}
    secret = settings.SECRET_KEY or ""
    is_weak = (
        secret in weak_secrets
        or len(secret) < 32
        or "change" in secret.lower()
        or "default" in secret.lower()
    )
    if is_weak:
        msg = (
            "SECRET_KEY faible ou par défaut détectée ! "
            "Génère une vraie clé : python -c \"import secrets; print(secrets.token_hex(32))\""
        )
        if not settings.DEBUG:
            raise RuntimeError(msg)
        logger.critical("⚠ %s (toléré uniquement en DEBUG)", msg)

    # Initialisation au démarrage
    await init_redis()

    # Seed des données de base (badges)
    async with AsyncSessionLocal() as db:
        try:
            from app.services.seed import seed_badges
            created = await seed_badges(db)
            if created > 0:
                logger.info("Seed : %d badges créés", created)
        except Exception as exc:
            logger.error("Erreur seed badges : %s", exc)

    # Tâche de nettoyage : sorties passées + chats expirés (toutes les heures)
    cleanup_task = asyncio.create_task(_cleanup_loop())
    yield
    # Nettoyage à l'arrêt
    cleanup_task.cancel()
    await close_redis()


# Rate limiter global — clé = IP du client
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(
    title="Nearly API",
    description="Backend de l'application Nearly — sorties informelles en petits groupes.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")
# Routes WebSocket — sans préfixe /api/v1 (les WS n'ont pas de versioning dans l'URL)
app.include_router(ws_router, tags=["websocket"])

# Fichiers statiques locaux en dev (quand S3 n'est pas configuré)
_DEV_UPLOADS = Path(__file__).parent / "dev_uploads"
_DEV_UPLOADS.mkdir(exist_ok=True)
app.mount("/dev-static", StaticFiles(directory=str(_DEV_UPLOADS)), name="dev-static")


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
