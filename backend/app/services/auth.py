import secrets
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import RegisterRequest, TokenResponse

# Durée de vie du refresh token et du token de vérification email (en secondes)
REFRESH_TTL_SECONDS = 30 * 24 * 3600
EMAIL_VERIFY_TTL_SECONDS = 24 * 3600


async def register_user(
    db: AsyncSession, redis, data: RegisterRequest
) -> tuple[User, str]:
    """
    Inscrit un nouvel utilisateur.
    Retourne (user, verify_token) — le token est à envoyer par email.
    """
    # Vérifier si l'email est déjà utilisé
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cet email est déjà utilisé",
        )

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name.strip(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Générer et stocker le token de vérification email dans Redis
    verify_token = secrets.token_urlsafe(32)
    await redis.setex(f"email_verify:{verify_token}", EMAIL_VERIFY_TTL_SECONDS, str(user.id))

    return user, verify_token


async def login_user(
    db: AsyncSession, redis, email: str, password: str
) -> tuple[TokenResponse, User]:
    """
    Authentifie un utilisateur.
    Retourne (TokenResponse, user).
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte suspendu",
        )

    access_token, _ = create_access_token(str(user.id))
    refresh_token, refresh_jti = create_refresh_token(str(user.id))

    # Stocker le refresh JTI en Redis pour pouvoir le révoquer
    await redis.setex(f"refresh:{refresh_jti}", REFRESH_TTL_SECONDS, str(user.id))

    return TokenResponse(access_token=access_token, refresh_token=refresh_token), user


async def refresh_tokens(redis, refresh_token_str: str) -> TokenResponse:
    """
    Rafraîchit les tokens via un refresh token valide.
    Rotation du refresh token : l'ancien est révoqué, un nouveau est émis.
    """
    payload = decode_token(refresh_token_str)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide",
        )

    jti = payload["jti"]
    user_id = payload["sub"]

    # Vérifier que le refresh token est encore actif en Redis
    stored = await redis.get(f"refresh:{jti}")
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expiré ou révoqué",
        )

    # Révoquer l'ancien refresh token (rotation)
    await redis.delete(f"refresh:{jti}")

    # Émettre de nouveaux tokens
    new_access, _ = create_access_token(user_id)
    new_refresh, new_refresh_jti = create_refresh_token(user_id)
    await redis.setex(f"refresh:{new_refresh_jti}", REFRESH_TTL_SECONDS, user_id)

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


async def logout_user(redis, access_token_str: str, refresh_token_str: str | None) -> None:
    """Révoque l'access token (blacklist) et le refresh token (suppression Redis)."""
    # Blacklister l'access token jusqu'à son expiration
    payload = decode_token(access_token_str)
    if payload:
        exp = payload.get("exp", 0)
        ttl = max(1, int(exp - datetime.now(timezone.utc).timestamp()))
        from app.core.redis import ban_token
        await ban_token(payload["jti"], ttl)

    # Révoquer le refresh token s'il est fourni
    if refresh_token_str:
        r_payload = decode_token(refresh_token_str)
        if r_payload:
            await redis.delete(f"refresh:{r_payload['jti']}")


async def verify_email(db: AsyncSession, redis, token: str) -> None:
    """Vérifie l'email d'un utilisateur via le token reçu par email."""
    user_id_str = await redis.get(f"email_verify:{token}")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalide ou expiré",
        )

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id_str)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable",
        )

    user.is_email_verified = True
    await db.commit()

    # Supprimer le token de Redis
    await redis.delete(f"email_verify:{token}")


PASSWORD_RESET_TTL_SECONDS = 3600  # 1 heure


async def forgot_password(db: AsyncSession, redis, email: str) -> str | None:
    """
    Génère un token de réinitialisation si l'email existe.
    Retourne le token ou None si l'email n'existe pas (ne pas révéler cette info au client).
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return None

    reset_token = secrets.token_urlsafe(32)
    await redis.setex(f"password_reset:{reset_token}", PASSWORD_RESET_TTL_SECONDS, str(user.id))
    return reset_token


async def reset_password(db: AsyncSession, redis, token: str, new_password: str) -> None:
    """Réinitialise le mot de passe via le token reçu par email."""
    user_id_str = await redis.get(f"password_reset:{token}")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalide ou expiré",
        )

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id_str)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable",
        )

    user.password_hash = hash_password(new_password)
    await db.commit()

    # Supprimer le token utilisé
    await redis.delete(f"password_reset:{token}")


async def change_password(
    db: AsyncSession, user: User, current_password: str, new_password: str
) -> None:
    """Change le mot de passe de l'utilisateur connecté (vérifie l'ancien mot de passe)."""
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe actuel incorrect",
        )

    user.password_hash = hash_password(new_password)
    await db.commit()


async def resend_verification(db: AsyncSession, redis, user: User) -> str:
    """
    Regénère un token de vérification email pour l'utilisateur courant.
    Retourne le nouveau token.
    """
    if user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email déjà vérifié",
        )

    verify_token = secrets.token_urlsafe(32)
    await redis.setex(f"email_verify:{verify_token}", EMAIL_VERIFY_TTL_SECONDS, str(user.id))
    return verify_token
