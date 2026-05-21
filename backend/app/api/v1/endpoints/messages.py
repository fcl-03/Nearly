import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.messages import (
    DMConversationPreview,
    DMMessageResponse,
    DMSendRequest,
    MessageResponse,
    SenderInfo,
)
from app.services.messages import get_history
from app.services.private_messages import (
    get_dm_conversations,
    get_dm_history,
    get_dm_unread_total,
    mark_dm_read,
    send_dm,
)

router = APIRouter()


@router.get("/events/{event_id}/messages", response_model=list[MessageResponse])
async def get_chat_history(
    event_id: uuid.UUID,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    before_id: Annotated[uuid.UUID | None, Query(description="Pagination — messages avant cet ID")] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Historique des messages d'une sortie (accès réservé aux participants).
    Pagination infinie : fournir before_id pour charger les messages plus anciens.
    """
    messages = await get_history(db, event_id, current_user.id, limit=limit, before_id=before_id)

    return [
        MessageResponse(
            id=m.id,
            event_id=m.event_id,
            content="[Message supprimé]" if m.is_deleted else m.content,
            sender=SenderInfo.model_validate(m.sender) if m.sender else None,
            created_at=m.created_at,
            is_deleted=m.is_deleted,
        )
        for m in messages
    ]


# ── Messages privés (DM) ──

@router.get("/dm/conversations", response_model=list[DMConversationPreview])
async def list_dm_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne toutes les conversations DM avec preview du dernier message."""
    convos = await get_dm_conversations(db, current_user.id)
    return [
        DMConversationPreview(
            partner=SenderInfo.model_validate(c["partner"]),
            last_message=c["last_message"],
            last_message_at=c["last_message_at"],
            unread_count=c["unread_count"],
        )
        for c in convos
    ]


@router.get("/dm/unread-count", response_model=dict)
async def dm_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Nombre total de DMs non lus."""
    count = await get_dm_unread_total(db, current_user.id)
    return {"count": count}


@router.get("/dm/{user_id}/messages", response_model=list[DMMessageResponse])
async def get_dm_messages(
    user_id: uuid.UUID,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    before_id: Annotated[uuid.UUID | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Historique paginé des messages privés avec un utilisateur."""
    messages = await get_dm_history(db, current_user.id, user_id, limit=limit, before_id=before_id)
    return [DMMessageResponse.model_validate(m) for m in messages]


@router.post("/dm/{user_id}/messages", response_model=DMMessageResponse, status_code=201)
@limiter.limit("30/minute")
async def send_dm_message(
    request: Request,
    user_id: uuid.UUID,
    body: DMSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Envoie un message privé à un ami."""
    msg = await send_dm(db, current_user, user_id, body.content)
    return DMMessageResponse.model_validate(msg)


@router.post("/dm/{user_id}/mark-read", response_model=dict)
async def mark_dm_messages_read(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marque tous les messages reçus de user_id comme lus."""
    await mark_dm_read(db, current_user.id, user_id)
    return {"ok": True}
