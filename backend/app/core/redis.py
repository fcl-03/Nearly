import redis.asyncio as redis

from app.core.config import settings

_redis_client: redis.Redis | None = None


async def init_redis() -> None:
    global _redis_client
    _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


async def close_redis() -> None:
    if _redis_client:
        await _redis_client.aclose()


def get_redis() -> redis.Redis:
    return _redis_client


async def ban_token(jti: str, expires_in_seconds: int) -> None:
    """Blackliste un JTI — utilisé pour le bannissement et la déconnexion forcée."""
    await _redis_client.setex(f"banned_token:{jti}", expires_in_seconds, "1")


async def is_token_banned(jti: str) -> bool:
    """Vérifie si un token a été révoqué."""
    result = await _redis_client.get(f"banned_token:{jti}")
    return result is not None


# ── Index des refresh tokens par utilisateur ──────────────────────────────────
# Permet de révoquer TOUTES les sessions d'un user (reset/changement de mot de
# passe, bannissement) sans scanner Redis.

async def track_refresh_token(user_id: str, jti: str, ttl_seconds: int) -> None:
    """Associe un refresh jti à son utilisateur pour pouvoir le révoquer en masse."""
    key = f"user_refresh:{user_id}"
    await _redis_client.sadd(key, jti)
    # Le set vit aussi longtemps que le refresh le plus récent
    await _redis_client.expire(key, ttl_seconds)


async def revoke_user_refresh_tokens(user_id: str) -> None:
    """Révoque tous les refresh tokens actifs d'un utilisateur."""
    key = f"user_refresh:{user_id}"
    jtis = await _redis_client.smembers(key)
    if jtis:
        await _redis_client.delete(*[f"refresh:{jti}" for jti in jtis])
    await _redis_client.delete(key)
