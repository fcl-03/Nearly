import asyncio
import time

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.verification import IdentityVerification
from app.schemas.verification import VerificationStatusResponse
from app.services.storage import (
    ALLOWED_DOCUMENT_TYPES,
    DOCUMENT_MAX_BYTES,
    delete_private_file,
    upload_private_file,
    verification_key,
)


async def _validate_document(file: UploadFile, label: str) -> bytes:
    """Valide et lit un fichier document (type MIME + taille)."""
    if file.content_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} : type non supporté. Acceptés : JPEG, PNG",
        )

    data = await file.read()
    if len(data) > DOCUMENT_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{label} : fichier trop volumineux (max 10 Mo)",
        )
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} : fichier vide",
        )
    return data


async def submit_verification(
    db: AsyncSession,
    user: User,
    selfie_file: UploadFile,
    id_card_file: UploadFile,
) -> VerificationStatusResponse:
    """
    Soumet une demande de vérification d'identité.
    - Upload selfie + pièce dans le bucket privé S3
    - Crée ou remplace l'entrée IdentityVerification (uniquement si pas pending/approved)
    """
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ton identité est déjà vérifiée",
        )

    # Charger la demande existante si elle existe
    result = await db.execute(
        select(IdentityVerification).where(IdentityVerification.user_id == user.id)
    )
    existing = result.scalar_one_or_none()

    if existing and existing.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une demande est déjà en cours de traitement. Patiente le temps de la revue.",
        )

    # Valider les fichiers (en parallèle)
    selfie_data, id_card_data = await asyncio.gather(
        _validate_document(selfie_file, "Selfie"),
        _validate_document(id_card_file, "Pièce d'identité"),
    )

    user_id_str = str(user.id)
    # Suffixe unique pour éviter le cache navigateur lors d'une re-soumission
    ts = str(int(time.time()))
    selfie_s3_key = verification_key(user_id_str, f"selfie_{ts}")
    id_card_s3_key = verification_key(user_id_str, f"id_card_{ts}")

    # Upload en parallèle dans le bucket privé
    await asyncio.gather(
        upload_private_file(selfie_s3_key, selfie_data, selfie_file.content_type or "image/jpeg"),
        upload_private_file(id_card_s3_key, id_card_data, id_card_file.content_type or "image/jpeg"),
    )

    if existing:
        # Re-soumission après refus — supprimer les anciennes photos S3 si elles existent encore
        if existing.selfie_url:
            try:
                await delete_private_file(existing.selfie_url)
            except Exception:
                pass
        if existing.id_card_url:
            try:
                await delete_private_file(existing.id_card_url)
            except Exception:
                pass
        # Réinitialiser la demande avec les nouvelles photos
        existing.status = "pending"
        existing.selfie_url = selfie_s3_key
        existing.id_card_url = id_card_s3_key
        existing.reviewed_by = None
        existing.reviewed_at = None
    else:
        db.add(IdentityVerification(
            user_id=user.id,
            selfie_url=selfie_s3_key,
            id_card_url=id_card_s3_key,
            status="pending",
        ))

    await db.commit()

    return VerificationStatusResponse(
        status="pending",
        created_at=existing.created_at if existing else None,
        reviewed_at=None,
        message="Demande soumise avec succès. Tu seras notifié(e) une fois la revue effectuée.",
    )


async def get_verification_status(
    db: AsyncSession,
    user: User,
) -> VerificationStatusResponse:
    """Retourne le statut actuel de la demande de vérification de l'utilisateur."""
    if user.is_verified:
        return VerificationStatusResponse(
            status="approved",
            created_at=None,
            reviewed_at=None,
            message="Ton identité est vérifiée. Badge actif sur ton profil.",
        )

    result = await db.execute(
        select(IdentityVerification).where(IdentityVerification.user_id == user.id)
    )
    verification = result.scalar_one_or_none()

    if not verification:
        return VerificationStatusResponse(
            status=None,
            created_at=None,
            reviewed_at=None,
            message="Aucune demande soumise. Envoie ton selfie et ta pièce d'identité pour obtenir le badge vérifié.",
        )

    messages = {
        "pending": "Ta demande est en cours d'examen. Généralement traité sous 48h.",
        "approved": "Identité vérifiée.",
        "rejected": "Ta demande a été refusée. Tu peux en soumettre une nouvelle avec des documents plus lisibles.",
    }

    return VerificationStatusResponse(
        status=verification.status,
        created_at=verification.created_at,
        reviewed_at=verification.reviewed_at,
        message=messages.get(verification.status, ""),
    )
