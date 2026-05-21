from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.verification import VerificationStatusResponse
from app.services.verification import get_verification_status, submit_verification

router = APIRouter()


@router.get("/verification/status", response_model=VerificationStatusResponse)
async def get_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne le statut de la demande de vérification d'identité de l'utilisateur connecté."""
    return await get_verification_status(db, current_user)


@router.post("/verification/submit", response_model=VerificationStatusResponse, status_code=202)
async def submit(
    selfie: UploadFile = File(..., description="Photo selfie (JPEG ou PNG, max 10 Mo)"),
    id_card: UploadFile = File(..., description="Pièce d'identité recto (JPEG ou PNG, max 10 Mo)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soumet une demande de vérification d'identité.
    Envoie deux fichiers image : un selfie et ta pièce d'identité.
    Les documents sont stockés de façon sécurisée et supprimés après la revue.
    """
    return await submit_verification(db, current_user, selfie, id_card)
