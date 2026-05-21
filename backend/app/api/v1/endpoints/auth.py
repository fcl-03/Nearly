import logging

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.redis import get_redis
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.services.auth import (
    change_password,
    forgot_password,
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
    resend_verification,
    reset_password,
    verify_email,
)
from app.services.email import send_password_reset_email, send_verification_email

router = APIRouter()

# Schéma Bearer optionnel — utilisé pour le logout (token peut être absent)
bearer_optional = HTTPBearer(auto_error=False)


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Place les tokens JWT dans des cookies httpOnly sécurisés."""
    is_prod = not settings.DEBUG
    # Access token — courte durée (15 min par défaut, géré par le JWT lui-même)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=60 * 60,  # 1h — le JWT expire avant, mais le cookie reste disponible pour le refresh
        path="/",
    )
    # Refresh token — longue durée
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,  # 30 jours
        path="/api/v1/auth",  # Restreint aux endpoints d'auth uniquement
    )
    # Cookie non-httpOnly pour indiquer au frontend que l'utilisateur est connecté
    response.set_cookie(
        key="logged_in",
        value="1",
        httponly=False,
        secure=is_prod,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
        path="/",
    )


def _clear_auth_cookies(response: Response):
    """Supprime les cookies d'authentification."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    response.delete_cookie("logged_in", path="/")


@router.post("/register", response_model=MessageResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Inscription d'un nouvel utilisateur. Un email de vérification est envoyé."""
    redis = get_redis()
    user, verify_token = await register_user(db, redis, data)
    # L'envoi d'email ne doit jamais bloquer l'inscription — le compte est déjà créé
    try:
        await send_verification_email(user.email, user.first_name, verify_token)
    except Exception as e:
        logger.error("Échec envoi email de vérification pour %s : %s", user.email, e)
    return MessageResponse(message="Inscription réussie. Vérifie ton email pour activer ton compte.")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Connexion — retourne les tokens et les place dans des cookies httpOnly."""
    redis = get_redis()
    tokens, _ = await login_user(db, redis, data.email, data.password)
    _set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh(
    request: Request,
    response: Response,
    data: RefreshRequest | None = None,
):
    """Rafraîchit l'access token. Lit le refresh token depuis le cookie ou le body."""
    redis = get_redis()
    # Priorité au cookie, fallback sur le body
    token = request.cookies.get("refresh_token")
    if not token and data:
        token = data.refresh_token
    if not token:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Refresh token manquant")
    result = await refresh_tokens(redis, token)
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return result


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    data: LogoutRequest | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_optional),
):
    """Révoque les tokens de l'utilisateur (déconnexion) et efface les cookies."""
    redis = get_redis()
    # Récupérer l'access token depuis le cookie ou le header
    access_token = request.cookies.get("access_token")
    if not access_token and credentials:
        access_token = credentials.credentials

    # Récupérer le refresh token depuis le cookie ou le body
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token and data:
        refresh_token = data.refresh_token

    if access_token:
        await logout_user(redis, access_token, refresh_token)

    _clear_auth_cookies(response)
    return MessageResponse(message="Déconnexion réussie")


@router.get("/verify-email", response_model=MessageResponse)
async def verify_email_endpoint(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Vérifie l'email via le token reçu par mail."""
    redis = get_redis()
    await verify_email(db, redis, token)
    return MessageResponse(message="Email vérifié avec succès !")


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute")
async def forgot_password_endpoint(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Envoie un email de réinitialisation du mot de passe (si l'email existe)."""
    redis = get_redis()
    reset_token = await forgot_password(db, redis, data.email)
    # Toujours retourner le même message (ne pas révéler si l'email existe)
    if reset_token:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()
        if user:
            try:
                await send_password_reset_email(user.email, user.first_name, reset_token)
            except Exception as e:
                logger.error("Échec envoi email reset pour %s : %s", data.email, e)
    return MessageResponse(message="Si cette adresse existe, un email de réinitialisation a été envoyé.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password_endpoint(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Réinitialise le mot de passe via le token reçu par email."""
    redis = get_redis()
    await reset_password(db, redis, data.token, data.new_password)
    return MessageResponse(message="Mot de passe modifié avec succès. Tu peux te connecter.")


@router.post("/change-password", response_model=MessageResponse)
async def change_password_endpoint(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change le mot de passe de l'utilisateur connecté (mot de passe actuel requis)."""
    await change_password(db, current_user, data.current_password, data.new_password)
    return MessageResponse(message="Mot de passe modifié avec succès.")


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Renvoie l'email de vérification (authentification requise)."""
    redis = get_redis()
    verify_token = await resend_verification(db, redis, current_user)
    try:
        await send_verification_email(current_user.email, current_user.first_name, verify_token)
    except Exception as e:
        logger.error("Échec renvoi email de vérification pour %s : %s", current_user.email, e)
    return MessageResponse(message="Email de vérification renvoyé.")
