import asyncio
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Styles communs ────────────────────────────────────────────
_BASE_STYLE = """
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  max-width: 480px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
"""
_HEADER_STYLE = "background: #0B0D11; padding: 28px 32px; text-align: center;"
_BODY_STYLE = "padding: 28px 32px;"
_LOGO_STYLE = "font-size: 26px; font-weight: 900; color: #E8FF47; letter-spacing: -0.5px; margin: 0;"
_TEXT_STYLE = "font-size: 15px; color: #2C2F3A; line-height: 1.6; margin: 16px 0 0;"
_MUTED_STYLE = "font-size: 12px; color: #858AA8; margin-top: 24px; line-height: 1.5;"
_BTN_STYLE = """
  display: inline-block;
  margin-top: 20px;
  padding: 13px 28px;
  background: #E8FF47;
  color: #0B0D11;
  text-decoration: none;
  border-radius: 11px;
  font-weight: 700;
  font-size: 14px;
"""


def _wrap(content: str) -> str:
    """Enveloppe le contenu dans le layout email Nearly."""
    return f"""
    <!DOCTYPE html><html><body style="background:#F4F5F9; padding: 32px 16px;">
    <div style="{_BASE_STYLE}">
      <div style="{_HEADER_STYLE}">
        <p style="{_LOGO_STYLE}">Nearly.</p>
      </div>
      <div style="{_BODY_STYLE}">{content}</div>
    </div>
    </body></html>
    """


async def _send(to: str, subject: str, html: str) -> None:
    """Envoi bas niveau via l'API Resend. Log en dev si clé absente."""
    if not settings.RESEND_API_KEY:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={"from": settings.EMAIL_FROM, "to": [to], "subject": subject, "html": html},
            )
            r.raise_for_status()
    except Exception as exc:
        logger.error("Erreur envoi email (%s) : %s", to, exc)


def fire(coro) -> None:
    """Lance un coroutine email en arrière-plan sans bloquer la réponse API."""
    asyncio.create_task(coro)


# ── Emails transactionnels ─────────────────────────────────────

async def send_verification_email(email: str, first_name: str, token: str) -> None:
    """Email de vérification d'adresse à l'inscription."""
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    if not settings.RESEND_API_KEY:
        print(f"\n{'='*60}\n✅  VERIFY EMAIL — {email}\n🔗  {verify_url}\n{'='*60}\n", flush=True)
    html = _wrap(f"""
        <p style="font-size:20px; font-weight:800; color:#0B0D11; margin:0;">
            Bienvenue, {first_name} ! 👋
        </p>
        <p style="{_TEXT_STYLE}">
            Clique sur le bouton ci-dessous pour vérifier ton adresse email et accéder à Nearly.
        </p>
        <a href="{verify_url}" style="{_BTN_STYLE}">Vérifier mon email</a>
        <p style="{_MUTED_STYLE}">
            Ce lien expire dans 24 heures.<br>
            Si tu n'as pas créé de compte, ignore cet email.
        </p>
    """)
    await _send(email, "Vérifie ton email — Nearly", html)


async def send_password_reset_email(email: str, first_name: str, token: str) -> None:
    """Email de réinitialisation du mot de passe."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    if not settings.RESEND_API_KEY:
        print(f"\n{'='*60}\n🔑  RESET PASSWORD — {email}\n🔗  {reset_url}\n{'='*60}\n", flush=True)
    html = _wrap(f"""
        <p style="font-size:20px; font-weight:800; color:#0B0D11; margin:0;">
            Réinitialisation du mot de passe 🔑
        </p>
        <p style="{_TEXT_STYLE}">
            Salut {first_name},<br><br>
            Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous pour en choisir un nouveau.
        </p>
        <a href="{reset_url}" style="{_BTN_STYLE}">Réinitialiser mon mot de passe</a>
        <p style="{_MUTED_STYLE}">
            Ce lien expire dans 1 heure.<br>
            Si tu n'as pas fait cette demande, ignore cet email — ton mot de passe reste inchangé.
        </p>
    """)
    await _send(email, "Réinitialise ton mot de passe — Nearly", html)


async def send_friend_request_email(to_email: str, to_name: str, from_name: str) -> None:
    """Notification de demande d'ami reçue."""
    url = f"{settings.FRONTEND_URL}/friends"
    html = _wrap(f"""
        <p style="font-size:20px; font-weight:800; color:#0B0D11; margin:0;">
            Nouvelle demande d'ami 🤝
        </p>
        <p style="{_TEXT_STYLE}">
            Salut {to_name},<br><br>
            <strong>{from_name}</strong> t'a envoyé une demande d'ami sur Nearly.
        </p>
        <a href="{url}" style="{_BTN_STYLE}">Voir la demande</a>
        <p style="{_MUTED_STYLE}">Tu reçois cet email car quelqu'un t'a ajouté sur Nearly.</p>
    """)
    await _send(to_email, f"{from_name} veut être ton ami sur Nearly", html)


async def send_friend_accepted_email(to_email: str, to_name: str, from_name: str) -> None:
    """Notification quand une demande d'ami est acceptée."""
    url = f"{settings.FRONTEND_URL}/friends"
    html = _wrap(f"""
        <p style="font-size:20px; font-weight:800; color:#0B0D11; margin:0;">
            Demande acceptée ! 🎉
        </p>
        <p style="{_TEXT_STYLE}">
            Salut {to_name},<br><br>
            <strong>{from_name}</strong> a accepté ta demande d'ami.
            Vous êtes maintenant amis sur Nearly !
        </p>
        <a href="{url}" style="{_BTN_STYLE}">Voir mes amis</a>
        <p style="{_MUTED_STYLE}">Tu reçois cet email car ta demande d'ami a été acceptée.</p>
    """)
    await _send(to_email, f"{from_name} a accepté ta demande d'ami", html)


async def send_badge_received_email(
    to_email: str, to_name: str, from_name: str, badge_emoji: str, badge_name: str
) -> None:
    """Notification de badge pair reçu."""
    url = f"{settings.FRONTEND_URL}/profile"
    html = _wrap(f"""
        <p style="font-size:20px; font-weight:800; color:#0B0D11; margin:0;">
            Tu as reçu un badge ! {badge_emoji}
        </p>
        <p style="{_TEXT_STYLE}">
            Salut {to_name},<br><br>
            <strong>{from_name}</strong> t'a donné le badge
            <strong>{badge_emoji} {badge_name}</strong>. Bien joué !
        </p>
        <a href="{url}" style="{_BTN_STYLE}">Voir mon profil</a>
        <p style="{_MUTED_STYLE}">Tu reçois cet email car un autre membre t'a attribué un badge.</p>
    """)
    await _send(to_email, f"Tu as reçu le badge {badge_emoji} {badge_name} sur Nearly", html)


async def send_achievement_email(
    to_email: str, to_name: str, emoji: str, name: str, desc: str
) -> None:
    """Notification de succès automatique débloqué."""
    url = f"{settings.FRONTEND_URL}/profile"
    html = _wrap(f"""
        <p style="font-size:20px; font-weight:800; color:#0B0D11; margin:0;">
            Succès débloqué ! {emoji}
        </p>
        <p style="{_TEXT_STYLE}">
            Salut {to_name},<br><br>
            Tu viens de débloquer le succès <strong>{emoji} {name}</strong>.<br>
            <em style="color:#858AA8;">{desc}</em>
        </p>
        <a href="{url}" style="{_BTN_STYLE}">Voir mon profil</a>
        <p style="{_MUTED_STYLE}">Tu reçois cet email car tu as accompli un objectif sur Nearly.</p>
    """)
    await _send(to_email, f"Succès débloqué : {emoji} {name}", html)


async def send_event_joined_email(
    to_email: str, to_name: str, joiner_name: str, event_title: str, event_id: str
) -> None:
    """Notification au créateur quand quelqu'un rejoint sa sortie."""
    url = f"{settings.FRONTEND_URL}/events/{event_id}"
    html = _wrap(f"""
        <p style="font-size:20px; font-weight:800; color:#0B0D11; margin:0;">
            Quelqu'un rejoint ta sortie ! 🙌
        </p>
        <p style="{_TEXT_STYLE}">
            Salut {to_name},<br><br>
            <strong>{joiner_name}</strong> vient de rejoindre ta sortie
            <strong>« {event_title} »</strong>.
        </p>
        <a href="{url}" style="{_BTN_STYLE}">Voir la sortie</a>
        <p style="{_MUTED_STYLE}">Tu reçois cet email car tu es l'organisateur de cette sortie.</p>
    """)
    await _send(to_email, f"{joiner_name} a rejoint « {event_title} »", html)
