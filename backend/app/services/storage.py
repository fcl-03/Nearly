import asyncio
import io
import logging
from functools import partial
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

# Dossier local pour les uploads en dev (quand S3 n'est pas configuré)
_DEV_UPLOADS = Path(__file__).parent.parent.parent / "dev_uploads"

# Dimensions maximales pour les avatars
AVATAR_MAX_SIZE = (400, 400)
AVATAR_QUALITY = 85

# Types MIME acceptés pour les avatars
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _process_avatar_sync(file_bytes: bytes) -> bytes:
    """Redimensionne l'image à max 400x400 et convertit en JPEG (synchrone)."""
    img = Image.open(io.BytesIO(file_bytes))
    img = img.convert("RGB")  # Convertit RGBA/palette en RGB pour JPEG
    img.thumbnail(AVATAR_MAX_SIZE, Image.LANCZOS)
    output = io.BytesIO()
    img.save(output, format="JPEG", quality=AVATAR_QUALITY, optimize=True)
    return output.getvalue()


async def process_avatar(file_bytes: bytes) -> bytes:
    """Version async du traitement d'image (exécuté dans un thread)."""
    return await asyncio.to_thread(_process_avatar_sync, file_bytes)


def _get_s3_client():
    """Crée un client boto3 S3 configuré pour Hetzner Object Storage."""
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )


def _upload_sync(key: str, data: bytes, content_type: str) -> None:
    """Upload un fichier dans le bucket public S3 (synchrone)."""
    client = _get_s3_client()
    client.put_object(
        Bucket=settings.S3_BUCKET_PUBLIC,
        Key=key,
        Body=data,
        ContentType=content_type,
        ACL="public-read",
    )


def _delete_sync(key: str) -> None:
    """Supprime un fichier du bucket public S3 (synchrone)."""
    client = _get_s3_client()
    try:
        client.delete_object(Bucket=settings.S3_BUCKET_PUBLIC, Key=key)
    except ClientError:
        pass  # Fichier déjà supprimé ou inexistant — on ignore


async def upload_public_file(key: str, data: bytes, content_type: str) -> str:
    """
    Upload un fichier dans le bucket public et retourne son URL publique.
    En mode dev (S3 non configuré), sauvegarde localement dans dev_uploads/.
    """
    if not settings.S3_ENDPOINT_URL:
        path = _DEV_UPLOADS / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"/dev-static/{key}"

    await asyncio.to_thread(_upload_sync, key, data, content_type)
    return f"{settings.S3_ENDPOINT_URL.rstrip('/')}/{settings.S3_BUCKET_PUBLIC}/{key}"


async def delete_public_file(key: str) -> None:
    """Supprime un fichier du bucket public. Silencieux si S3 non configuré."""
    if not settings.S3_ENDPOINT_URL:
        logger.debug("Suppression S3 ignorée (dev) — clé : %s", key)
        return

    await asyncio.to_thread(_delete_sync, key)


def avatar_key(user_id: str) -> str:
    """Retourne la clé S3 pour l'avatar d'un utilisateur."""
    return f"avatars/{user_id}.jpg"


# Dimensions maximales pour les photos de profil
PHOTO_MAX_SIZE = (1080, 1080)
PHOTO_QUALITY = 82


def _process_photo_sync(file_bytes: bytes) -> bytes:
    """Redimensionne une photo à max 1080x1080 et convertit en JPEG (synchrone)."""
    img = Image.open(io.BytesIO(file_bytes))
    img = img.convert("RGB")
    img.thumbnail(PHOTO_MAX_SIZE, Image.LANCZOS)
    output = io.BytesIO()
    img.save(output, format="JPEG", quality=PHOTO_QUALITY, optimize=True)
    return output.getvalue()


async def process_photo(file_bytes: bytes) -> bytes:
    """Version async du traitement d'une photo de profil."""
    return await asyncio.to_thread(_process_photo_sync, file_bytes)


def photo_key(user_id: str, photo_id: str) -> str:
    """Retourne la clé S3 pour une photo de profil."""
    return f"photos/{user_id}/{photo_id}.jpg"


# ─── Bucket privé (documents sensibles) ───────────────────────────────────────

# Types MIME acceptés pour les documents d'identité
ALLOWED_DOCUMENT_TYPES = {"image/jpeg", "image/png"}
# Taille maximale d'un document (10 Mo)
DOCUMENT_MAX_BYTES = 10 * 1024 * 1024


def _upload_private_sync(key: str, data: bytes, content_type: str) -> None:
    """Upload dans le bucket privé S3 sans ACL public (synchrone)."""
    client = _get_s3_client()
    client.put_object(
        Bucket=settings.S3_BUCKET_PRIVATE,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


def _delete_private_sync(key: str) -> None:
    """Supprime un fichier du bucket privé S3 (synchrone)."""
    client = _get_s3_client()
    try:
        client.delete_object(Bucket=settings.S3_BUCKET_PRIVATE, Key=key)
    except ClientError:
        pass


def _presign_sync(key: str, expires_in: int) -> str:
    """Génère une URL signée temporaire pour un fichier privé (synchrone)."""
    client = _get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_PRIVATE, "Key": key},
        ExpiresIn=expires_in,
    )


async def upload_private_file(key: str, data: bytes, content_type: str) -> str:
    """
    Upload dans le bucket privé.
    Retourne la clé S3 (pas d'URL publique — accès via URL signée uniquement).
    En mode dev, sauvegarde localement dans dev_uploads/.
    """
    if not settings.S3_ENDPOINT_URL:
        path = _DEV_UPLOADS / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    await asyncio.to_thread(_upload_private_sync, key, data, content_type)
    return key


async def delete_private_file(key: str) -> None:
    """Supprime un fichier du bucket privé. Silencieux si S3 non configuré."""
    if not settings.S3_ENDPOINT_URL:
        logger.debug("Suppression privée S3 ignorée (dev) — clé : %s", key)
        return

    await asyncio.to_thread(_delete_private_sync, key)


async def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    """
    Génère une URL signée valable `expires_in` secondes pour un document privé.
    En mode dev, retourne l'URL locale du fichier sauvegardé.
    """
    if not settings.S3_ENDPOINT_URL:
        return f"/dev-static/{key}"

    return await asyncio.to_thread(_presign_sync, key, expires_in)


def verification_key(user_id: str, document: str) -> str:
    """
    Retourne la clé S3 pour un document de vérification.
    document : "selfie" | "id_card"
    """
    return f"verifications/{user_id}/{document}.jpg"
