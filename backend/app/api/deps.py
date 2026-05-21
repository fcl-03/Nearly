import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis, is_token_banned
from app.core.security import decode_token
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def _extract_token(request: Request, credentials: HTTPAuthorizationCredentials | None) -> str | None:
    """Extrait le token JWT depuis le cookie httpOnly ou le header Authorization."""
    # Priorité au cookie httpOnly
    token = request.cookies.get("access_token")
    if token:
        return token
    # Fallback sur le header Authorization (utile pour les tests / clients API)
    if credentials:
        return credentials.credentials
    return None


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dépendance FastAPI — retourne l'utilisateur authentifié depuis le cookie httpOnly ou le JWT Bearer."""
    token = _extract_token(request, credentials)

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise credentials_exception

    # Vérifier que le token n'est pas blacklisté
    jti = payload.get("jti")
    if jti and await is_token_banned(jti):
        raise credentials_exception

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise credentials_exception

    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte suspendu",
        )

    # Mettre à jour last_active_at (max 1 fois par minute pour éviter les écritures inutiles)
    now = datetime.now(timezone.utc)
    if (now - user.last_active_at).total_seconds() > 60:
        user.last_active_at = now
        await db.commit()

    return user


async def get_current_verified_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dépendance — comme get_current_user mais exige que l'email soit vérifié.
    Les admins sont exemptés de cette vérification."""
    if not current_user.is_email_verified and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email non vérifié. Vérifie ta boîte mail.",
        )
    return current_user


async def get_current_user_optional(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Dépendance optionnelle — retourne l'utilisateur si token valide, None sinon."""
    token = _extract_token(request, credentials)
    if not token:
        return None
    try:
        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            return None
        jti = payload.get("jti")
        if jti and await is_token_banned(jti):
            return None
        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user or user.is_banned:
            return None
        return user
    except Exception:
        return None


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dépendance — réservée aux administrateurs."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )
    return current_user
