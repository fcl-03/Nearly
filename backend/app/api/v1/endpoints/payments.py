import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


def _stripe_client() -> stripe.StripeClient:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Paiements non configurés.")
    return stripe.StripeClient(settings.STRIPE_SECRET_KEY)


# ── Créer une session Checkout ─────────────────────────────────

@router.post("/payments/create-checkout", response_model=dict, tags=["payments"])
async def create_checkout(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crée une session Stripe Checkout pour l'abonnement Premium."""
    if current_user.is_premium:
        raise HTTPException(status_code=400, detail="Tu es déjà Premium !")

    client = _stripe_client()

    # Créer ou récupérer le customer Stripe
    if not current_user.stripe_customer_id:
        customer = client.customers.create(params={
            "email": current_user.email,
            "name": current_user.first_name,
            "metadata": {"user_id": str(current_user.id)},
        })
        current_user.stripe_customer_id = customer.id
        await db.commit()

    session = client.checkout.sessions.create(params={
        "customer": current_user.stripe_customer_id,
        "mode": "subscription",
        "line_items": [{"price": settings.STRIPE_PRICE_ID, "quantity": 1}],
        "success_url": f"{settings.FRONTEND_URL}/premium/success?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{settings.FRONTEND_URL}/settings",
        "metadata": {"user_id": str(current_user.id)},
    })

    return {"url": session.url}


# ── Vérification post-paiement (fallback webhook) ─────────────

@router.post("/payments/verify-session", response_model=dict, tags=["payments"])
async def verify_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Vérifie une session Checkout Stripe et active le premium si le paiement est confirmé.
    Appelé par la page de succès en fallback (les webhooks ne fonctionnent pas en local).
    """
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id manquant.")

    client = _stripe_client()
    try:
        session = client.checkout.sessions.retrieve(session_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Session Stripe invalide : {exc}")

    if session.payment_status != "paid":
        raise HTTPException(status_code=402, detail="Paiement non confirmé.")

    # Vérifier que la session appartient bien à ce user
    user_id_meta = (session.metadata or {}).get("user_id", "")
    if str(current_user.id) != user_id_meta:
        raise HTTPException(status_code=403, detail="Session non autorisée.")

    current_user.is_premium = True
    if not current_user.stripe_customer_id:
        current_user.stripe_customer_id = session.customer
    await db.commit()
    logger.info("Premium activé via verify-session pour user %s", current_user.id)
    return {"status": "ok"}


# ── Portail client (gérer / annuler l'abonnement) ─────────────

@router.post("/payments/portal", response_model=dict, tags=["payments"])
async def customer_portal(
    current_user: User = Depends(get_current_user),
):
    """Crée un lien vers le portail Stripe pour gérer l'abonnement."""
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="Aucun abonnement actif.")

    client = _stripe_client()
    session = client.billing_portal.sessions.create(params={
        "customer": current_user.stripe_customer_id,
        "return_url": f"{settings.FRONTEND_URL}/settings",
    })
    return {"url": session.url}


# ── Webhook Stripe ─────────────────────────────────────────────

@router.post("/payments/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Reçoit les événements Stripe et met à jour le statut premium.
    Doit être appelé sans authentification JWT (Stripe signe la requête).
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.warning("STRIPE_WEBHOOK_SECRET non configuré — webhook ignoré")
        return {"status": "ignored"}

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Signature webhook invalide.")
    except ValueError:
        raise HTTPException(status_code=400, detail="Payload invalide.")

    await _handle_event(db, event)
    return {"status": "ok"}


async def _handle_event(db: AsyncSession, event: dict) -> None:
    """Traite les événements Stripe pertinents."""
    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        # Abonnement activé après paiement
        customer_id = data.get("customer")
        if customer_id:
            await _set_premium(db, customer_id, active=True, period_end=None)

    elif event_type in ("customer.subscription.updated", "invoice.payment_succeeded"):
        # Renouvellement — mettre à jour premium_until
        customer_id = data.get("customer")
        period_end = data.get("current_period_end")
        if customer_id:
            end_dt = datetime.fromtimestamp(period_end, tz=timezone.utc) if period_end else None
            await _set_premium(db, customer_id, active=True, period_end=end_dt)

    elif event_type in ("customer.subscription.deleted", "customer.subscription.paused"):
        # Résiliation ou pause
        customer_id = data.get("customer")
        if customer_id:
            await _set_premium(db, customer_id, active=False, period_end=None)

    elif event_type == "invoice.payment_failed":
        logger.warning("Paiement échoué pour customer %s", data.get("customer"))


async def _set_premium(
    db: AsyncSession,
    stripe_customer_id: str,
    *,
    active: bool,
    period_end: datetime | None,
) -> None:
    result = await db.execute(
        select(User).where(User.stripe_customer_id == stripe_customer_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        logger.warning("Webhook : customer Stripe %s introuvable en base", stripe_customer_id)
        return

    user.is_premium = active
    user.premium_until = period_end if active else None
    await db.commit()
    logger.info("Premium %s → %s (user %s)", "activé" if active else "désactivé", stripe_customer_id, user.id)
