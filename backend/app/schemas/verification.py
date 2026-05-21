from datetime import datetime

from pydantic import BaseModel


class VerificationStatusResponse(BaseModel):
    """Statut de la demande de vérification d'identité de l'utilisateur connecté."""
    status: str | None  # None si aucune demande, sinon pending | approved | rejected
    created_at: datetime | None
    reviewed_at: datetime | None
    # Message explicatif selon le statut
    message: str
