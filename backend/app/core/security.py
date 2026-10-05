import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# bcrypt ignore tout au-delà de 72 octets ; bcrypt >= 4.1 lève une ValueError au lieu
# de tronquer silencieusement → sans cette troncature, un mot de passe long = 500.
_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    """Hash un mot de passe avec bcrypt (tronqué à 72 octets, limite bcrypt)."""
    return bcrypt.hashpw(password.encode()[:_BCRYPT_MAX_BYTES], bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie un mot de passe contre son hash bcrypt."""
    return bcrypt.checkpw(plain_password.encode()[:_BCRYPT_MAX_BYTES], hashed_password.encode())


def create_access_token(subject: str) -> tuple[str, str]:
    """Retourne (token, jti) — le jti permet de révoquer le token."""
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "jti": jti,
        "exp": expire,
        "type": "access",
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti


def create_refresh_token(subject: str) -> tuple[str, str]:
    """Retourne (token, jti)."""
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": subject,
        "jti": jti,
        "exp": expire,
        "type": "refresh",
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti


def decode_token(token: str) -> dict[str, Any] | None:
    """Décode un token JWT. Retourne None si invalide ou expiré."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
