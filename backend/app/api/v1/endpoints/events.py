import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional, get_current_verified_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.events import (
    DeletionRequestResponse,
    EventCreate,
    EventResponse,
    EventUpdate,
    VoteRequest,
    VoteResponse,
)
from app.services.events import (
    create_event,
    delete_event,
    get_event,
    get_unread_counts,
    join_event,
    leave_event,
    list_events,
    mark_event_read,
    request_deletion,
    update_event,
    vote_deletion,
)

router = APIRouter()


@router.post("", response_model=EventResponse, status_code=201)
async def create(
    data: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_verified_user),
):
    """Crée une nouvelle sortie (email vérifié requis)."""
    result = await create_event(db, current_user, data)
    from app.services.achievements import check_achievements
    await check_achievements(db, current_user.id, on_event_create=True)
    await db.commit()
    return result


@router.get("", response_model=list[EventResponse])
async def list_all(
    lat: Annotated[float | None, Query(description="Latitude centre de recherche")] = None,
    lon: Annotated[float | None, Query(description="Longitude centre de recherche")] = None,
    radius_km: Annotated[float, Query(ge=1, le=100, description="Rayon en km")] = 25.0,
    category: Annotated[str | None, Query(description="Filtre par catégorie")] = None,
    event_type: Annotated[str | None, Query(description="small_group ou open")] = None,
    starts_after: Annotated[datetime | None, Query(description="Sorties après cette date")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Liste les sorties actives. Filtrage géographique si lat/lon fournis."""
    return await list_events(
        db,
        current_user_id=current_user.id if current_user else None,
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        category=category,
        event_type=event_type,
        starts_after=starts_after,
        page=page,
        limit=limit,
    )


@router.get("/me", response_model=list[EventResponse])
async def list_my_events(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne les sorties créées par l'utilisateur connecté."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.event import Event, EventParticipant

    result = await db.execute(
        select(Event)
        .where(Event.creator_id == current_user.id, Event.is_active == True)  # noqa: E712
        .options(selectinload(Event.creator), selectinload(Event.participants).selectinload(EventParticipant.user), selectinload(Event.deletion_poll))
        .order_by(Event.starts_at.asc())
    )
    events = result.scalars().all()

    from app.services.events import _build_response
    return [_build_response(e, current_user_id=current_user.id) for e in events]


@router.get("/joined", response_model=list[EventResponse])
async def list_joined_events(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne les sorties rejointes, triées par dernier message (le plus récent en premier)."""
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    from app.models.event import Event, EventParticipant
    from app.models.message import Message
    from app.services.events import _build_response

    result = await db.execute(
        select(Event)
        .join(EventParticipant, (EventParticipant.event_id == Event.id) &
              (EventParticipant.user_id == current_user.id) &
              (EventParticipant.status == "joined"))
        .where(Event.is_active == True)  # noqa: E712
        .options(selectinload(Event.creator), selectinload(Event.participants).selectinload(EventParticipant.user), selectinload(Event.deletion_poll))
    )
    events = result.scalars().all()

    # Récupérer la date du dernier message par event en une seule requête
    event_ids = [e.id for e in events]
    last_msg_rows = await db.execute(
        select(Message.event_id, func.max(Message.created_at).label("last_at"))
        .where(Message.event_id.in_(event_ids), Message.is_deleted == False)  # noqa: E712
        .group_by(Message.event_id)
    )
    last_message_at = {row.event_id: row.last_at for row in last_msg_rows.all()}

    # Construire les réponses avec last_message_at
    responses = []
    for e in events:
        resp = _build_response(e, current_user_id=current_user.id)
        resp.last_message_at = last_message_at.get(e.id)
        responses.append(resp)

    # Trier par dernier message desc, fallback sur starts_at
    # On normalise en timestamp float pour éviter les erreurs naive vs aware
    def sort_key(r):
        dt = r.last_message_at or r.starts_at
        return dt.timestamp() if hasattr(dt, 'timestamp') else 0

    responses.sort(key=sort_key, reverse=True)
    return responses


@router.get("/unread-counts", response_model=dict[str, int])
async def unread_counts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne le nombre de messages non lus par event_id pour l'utilisateur connecté."""
    return await get_unread_counts(db, current_user)


@router.post("/{event_id}/mark-read", status_code=204)
async def mark_read(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marque le chat d'une sortie comme lu."""
    await mark_event_read(db, current_user, event_id)


@router.get("/{event_id}", response_model=EventResponse)
async def get_one(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Détail d'une sortie (public)."""
    return await get_event(db, event_id, current_user_id=current_user.id if current_user else None)


@router.put("/{event_id}", response_model=EventResponse)
async def update(
    event_id: uuid.UUID,
    data: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Modifie une sortie (réservé au créateur)."""
    return await update_event(db, current_user, event_id, data)


@router.delete("/{event_id}", response_model=MessageResponse)
async def delete(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprime (désactive) une sortie (réservé au créateur ou admin)."""
    await delete_event(db, current_user, event_id)
    return MessageResponse(message="Sortie supprimée.")


@router.post("/{event_id}/join", response_model=EventResponse)
async def join(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rejoindre une sortie (identité vérifiée requise)."""
    if not current_user.is_verified:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Tu dois vérifier ton identité avant de rejoindre une sortie")
    result = await join_event(db, current_user, event_id)
    from app.services.achievements import check_achievements
    await check_achievements(db, current_user.id, on_event_join=True)
    await db.commit()
    return result


@router.post("/{event_id}/leave", response_model=EventResponse)
async def leave(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quitter une sortie — notifie le groupe via le chat."""
    from app.websockets.connection_manager import manager
    result = await leave_event(db, current_user, event_id)
    # Notifier le groupe que quelqu'un a quitté l'événement (pas juste le chat)
    places_left = (result.max_participants - result.participants_count) if result.max_participants else None
    places_msg = f" · {places_left} place{'s' if places_left and places_left > 1 else ''} disponible{'s' if places_left and places_left > 1 else ''}" if places_left is not None else ""
    await manager.broadcast(
        str(event_id),
        {"type": "system", "content": f"{current_user.first_name} a quitté le groupe{places_msg}"},
    )
    # Notifier le créateur de la sortie
    if result.creator and result.creator.id != current_user.id:
        from app.services.notifications import create_notification
        await create_notification(
            db,
            user_id=result.creator.id,
            type="event_leave",
            content=f"{current_user.first_name} a quitté ta sortie « {result.title} »",
            actor_id=current_user.id,
            related_id=str(event_id),
        )
        await db.commit()
    return result


@router.post("/{event_id}/request-deletion", response_model=DeletionRequestResponse)
async def request_deletion_endpoint(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Créateur initie la suppression — vote si participants présents, suppression directe sinon."""
    return await request_deletion(db, current_user, event_id)


@router.post("/{event_id}/vote", response_model=VoteResponse)
async def vote_endpoint(
    event_id: uuid.UUID,
    body: VoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Participant vote pour garder (keep) ou supprimer (delete) la sortie."""
    return await vote_deletion(db, current_user, event_id, body.vote)


@router.post("/{event_id}/invite", response_model=dict)
async def invite_friends(
    event_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invite des amis à rejoindre une sortie. Seul le créateur peut inviter."""
    from sqlalchemy import select
    from app.models.event import Event, EventParticipant
    from app.models.friendship import Friendship
    from app.services.notifications import create_notification

    user_ids: list[str] = body.get("user_ids", [])
    if not user_ids:
        return {"invited": 0}

    # Vérifier que l'event existe et que current_user en est le créateur
    event = await db.get(Event, event_id)
    if not event or event.creator_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Tu dois être le créateur de cette sortie pour inviter des amis")

    # Récupérer les IDs d'amis valides (relation accepted dans les deux sens)
    friends_result = await db.execute(
        select(Friendship).where(
            ((Friendship.requester_id == current_user.id) | (Friendship.addressee_id == current_user.id)),
            Friendship.status == "accepted",
        )
    )
    friend_ids = set()
    for f in friends_result.scalars().all():
        other = f.addressee_id if f.requester_id == current_user.id else f.requester_id
        friend_ids.add(str(other))

    # Récupérer les IDs déjà participants
    participants_result = await db.execute(
        select(EventParticipant.user_id).where(
            EventParticipant.event_id == event_id,
            EventParticipant.status == "joined",
        )
    )
    already_in = {str(uid) for uid in participants_result.scalars().all()}

    invited = 0
    for uid_str in user_ids:
        # Seulement les amis qui ne participent pas déjà
        if uid_str not in friend_ids or uid_str in already_in:
            continue
        try:
            target_id = uuid.UUID(uid_str)
        except ValueError:
            continue
        await create_notification(
            db,
            user_id=target_id,
            type="event_invite",
            content=f"{current_user.first_name} t'invite à rejoindre « {event.title} »",
            actor_id=current_user.id,
            related_id=str(event_id),
        )
        invited += 1

    if invited > 0:
        await db.commit()

    return {"invited": invited}
