import uuid

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import is_token_banned
from app.core.security import decode_token
from app.models.event import Event, EventParticipant
from app.models.user import User
from app.services.messages import get_history, message_to_dict, save_message
from app.websockets.connection_manager import manager

router = APIRouter()

# Longueur maximale d'un message chat
MAX_MESSAGE_LENGTH = 500


async def _authenticate_ws(
    token: str, db: AsyncSession
) -> User | None:
    """
    Authentifie un utilisateur depuis un JWT passé en query param.
    Retourne l'utilisateur ou None si le token est invalide.
    """
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


async def _assert_ws_participant(
    db: AsyncSession, event_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    """Vérifie que l'utilisateur est participant actif de la sortie."""
    result = await db.execute(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.user_id == user_id,
            EventParticipant.status == "joined",
        )
    )
    return result.scalar_one_or_none() is not None


@router.websocket("/ws/events/{event_id}/chat")
async def chat_endpoint(
    event_id: uuid.UUID,
    websocket: WebSocket,
    token: str = Query(None, description="JWT access token (fallback si pas de cookie)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint WebSocket pour le chat de groupe d'une sortie.
    Connexion : ws://host/ws/events/{event_id}/chat
    Auth : cookie httpOnly (access_token) ou query param ?token=<access_token>
    """
    # --- Authentification via cookie ou query param ---
    ws_token = websocket.cookies.get("access_token") or token
    if not ws_token:
        await websocket.close(code=4001, reason="Token invalide ou expiré")
        return
    user = await _authenticate_ws(ws_token, db)
    if not user:
        await websocket.close(code=4001, reason="Token invalide ou expiré")
        return

    # --- Vérification participation ---
    if not await _assert_ws_participant(db, event_id, user.id):
        await websocket.close(code=4003, reason="Tu n'es pas participant de cette sortie")
        return

    # --- Connexion à la salle ---
    event_id_str = str(event_id)
    user_id_str = str(user.id)

    await manager.connect(event_id_str, user_id_str, websocket)

    try:
        # Envoyer l'historique des 50 derniers messages
        history = await get_history(db, event_id, user.id, limit=50)
        await websocket.send_json({
            "type": "history",
            "messages": [message_to_dict(m) for m in history],
        })

        # Pas de message système à la connexion — trop de bruit inutile

        # --- Boucle principale de réception ---
        while True:
            try:
                data = await websocket.receive_json()
            except Exception:
                break

            msg_type = data.get("type")

            if msg_type == "message":
                content = (data.get("content") or "").strip()

                if not content:
                    continue

                if len(content) > MAX_MESSAGE_LENGTH:
                    await websocket.send_json({
                        "type": "error",
                        "content": f"Message trop long (max {MAX_MESSAGE_LENGTH} caractères)",
                    })
                    continue

                # Sauvegarder en DB
                msg = await save_message(db, event_id, user.id, content)
                msg.sender = user  # Charger le sender en mémoire pour la sérialisation

                # Broadcast à tous les connectés (y compris l'expéditeur pour confirmation)
                await manager.broadcast(event_id_str, {
                    "type": "message",
                    **message_to_dict(msg),
                })

            elif msg_type == "ping":
                # Re-valider le token à chaque ping (toutes les ~25s)
                jti = decode_token(ws_token).get("jti") if decode_token(ws_token) else None
                if not jti or await is_token_banned(jti):
                    await websocket.close(code=4001, reason="Session expirée")
                    break
                # Vérifier que l'utilisateur n'est pas banni
                refreshed = await db.get(User, user.id)
                if refreshed and refreshed.is_banned:
                    await websocket.close(code=4001, reason="Compte suspendu")
                    break
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass

    finally:
        manager.disconnect(event_id_str, user_id_str)
        # Pas de message système à la déconnexion — naviguer = quitter le chat sans quitter l'événement
