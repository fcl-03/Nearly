import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event, EventDeletionPoll, EventParticipant
from app.models.friendship import Friendship
from app.models.message import EventReadReceipt, Message
from app.models.user import User
from app.schemas.events import DeletionPollInfo, EventCreate, EventResponse, EventUpdate, ParticipantInfo


def _haversine_km(lat: float, lon: float):
    """
    Expression SQLAlchemy pour la distance Haversine en km
    entre un point fixe (lat, lon) et les colonnes latitude/longitude de Event.
    """
    dlat = func.radians(Event.latitude - lat)
    dlon = func.radians(Event.longitude - lon)
    a = (
        func.sin(dlat / 2) * func.sin(dlat / 2)
        + func.cos(func.radians(lat))
        * func.cos(func.radians(Event.latitude))
        * func.sin(dlon / 2)
        * func.sin(dlon / 2)
    )
    return 6371.0 * 2 * func.atan2(func.sqrt(a), func.sqrt(1 - a))


def _build_response(
    event: Event,
    current_user_id: uuid.UUID | None = None,
    distance_km: float | None = None,
) -> EventResponse:
    """Construit un EventResponse depuis un ORM Event chargé avec creator et participants."""
    active_participants = [p for p in event.participants if p.status == "joined"]
    participants_count = len(active_participants)
    is_full = (
        event.max_participants is not None
        and participants_count >= event.max_participants
    )
    is_joined = current_user_id is not None and any(
        p.user_id == current_user_id and p.status == "joined"
        for p in event.participants
    )
    # État précis du user courant (joined / pending / rejected / None)
    join_status = None
    if current_user_id is not None:
        for p in event.participants:
            if p.user_id == current_user_id and p.status in ("joined", "pending", "rejected"):
                join_status = p.status
                break
    # Construire la liste des participants avec leurs infos profil
    participants_info = [
        ParticipantInfo(
            id=p.user.id,
            first_name=p.user.first_name,
            avatar_url=p.user.avatar_url,
            is_verified=p.user.is_verified,
        )
        for p in active_participants
        if p.user is not None
    ]

    # Sérialiser le vote de suppression s'il existe et n'est pas résolu
    poll = event.deletion_poll
    deletion_poll_info = None
    if poll and not poll.is_resolved:
        deletion_poll_info = DeletionPollInfo(
            id=poll.id,
            votes_keep=poll.votes_keep or [],
            votes_delete=poll.votes_delete or [],
            is_resolved=poll.is_resolved,
        )

    return EventResponse(
        id=event.id,
        title=event.title,
        description=event.description,
        category=event.category,
        event_type=event.event_type,
        location_name=event.location_name,
        latitude=event.latitude,
        longitude=event.longitude,
        starts_at=event.starts_at,
        max_participants=event.max_participants,
        is_sponsored=event.is_sponsored,
        is_active=event.is_active,
        requires_approval=event.requires_approval,
        created_at=event.created_at,
        creator=event.creator,
        participants_count=participants_count,
        participants=participants_info,
        is_full=is_full,
        is_joined=is_joined,
        join_status=join_status,
        distance_km=round(distance_km, 2) if distance_km is not None else None,
        deletion_poll=deletion_poll_info,
    )


def _event_query():
    """Requête de base pour charger un Event avec ses relations."""
    return select(Event).options(
        selectinload(Event.creator),
        selectinload(Event.participants).selectinload(EventParticipant.user),
        selectinload(Event.deletion_poll),
    )


async def create_event(db: AsyncSession, user: User, data: EventCreate) -> EventResponse:
    """Crée une sortie et ajoute automatiquement le créateur comme participant."""
    # Vérifier que l'identité est validée (pas seulement l'email)
    if not user.is_verified and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu dois vérifier ton identité avant de créer une sortie.",
        )

    # Limites anti-spam (bypass admin) — à doubler pour premium quand activé
    if not user.is_admin:
        now = datetime.now(timezone.utc)

        # Max 2 sorties actives en même temps (futures, non supprimées)
        active_count = await db.execute(
            select(func.count(Event.id)).where(
                Event.creator_id == user.id,
                Event.starts_at > now,
            )
        )
        if (active_count.scalar() or 0) >= 2:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu as déjà 2 sorties à venir. Termine ou supprime l'une d'elles avant d'en créer une nouvelle.",
            )

        # Max 3 sorties créées dans les 7 derniers jours
        week_ago = now - timedelta(days=7)
        week_count = await db.execute(
            select(func.count(Event.id)).where(
                Event.creator_id == user.id,
                Event.created_at >= week_ago,
            )
        )
        if (week_count.scalar() or 0) >= 3:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu as déjà créé 3 sorties cette semaine. Réessaie dans quelques jours.",
            )

    event = Event(
        creator_id=user.id,
        title=data.title,
        description=data.description,
        category=data.category,
        event_type=data.event_type,
        location_name=data.location_name,
        latitude=data.latitude,
        longitude=data.longitude,
        starts_at=data.starts_at,
        max_participants=data.max_participants,
        requires_approval=data.requires_approval,
    )
    db.add(event)
    await db.flush()  # Obtenir l'ID avant d'ajouter le participant

    # Le créateur rejoint automatiquement sa propre sortie
    participant = EventParticipant(event_id=event.id, user_id=user.id, status="joined")
    db.add(participant)
    await db.commit()

    # Recharger avec les relations pour la réponse
    result = await db.execute(_event_query().where(Event.id == event.id))
    event = result.scalar_one()
    return _build_response(event, current_user_id=user.id)


async def list_events(
    db: AsyncSession,
    current_user_id: uuid.UUID | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float = 50.0,
    category: str | None = None,
    event_type: str | None = None,
    starts_after: datetime | None = None,
    page: int = 1,
    limit: int = 20,
) -> list[EventResponse]:
    """
    Liste les sorties actives avec filtres optionnels.
    Si lat/lon sont fournis, filtre par rayon et trie par distance.
    """
    limit = min(limit, 50)  # Sécurité : max 50 résultats par page
    offset = (page - 1) * limit

    # Filtre de base : sorties actives
    filters = [Event.is_active == True]  # noqa: E712

    # Filtre temporel : sorties non encore commencées (défaut : maintenant)
    if starts_after is None:
        starts_after = datetime.now(timezone.utc)
    filters.append(Event.starts_at >= starts_after)

    # Exclure les sorties des utilisateurs bloqués
    if current_user_id:
        blocked_by_me = select(Friendship.addressee_id).where(
            Friendship.requester_id == current_user_id, Friendship.status == "blocked"
        )
        blocked_me = select(Friendship.requester_id).where(
            Friendship.addressee_id == current_user_id, Friendship.status == "blocked"
        )
        filters.append(Event.creator_id.notin_(blocked_by_me))
        filters.append(Event.creator_id.notin_(blocked_me))

    if category:
        filters.append(Event.category == category)
    if event_type:
        filters.append(Event.event_type == event_type)

    query = _event_query().where(*filters)

    # Filtrage et tri géographique
    if lat is not None and lon is not None:
        distance_expr = _haversine_km(lat, lon)
        query = query.where(distance_expr <= radius_km)
        query = query.order_by(distance_expr.asc())
    else:
        query = query.order_by(Event.starts_at.asc())

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    events = result.scalars().all()

    responses = []
    for event in events:
        distance_km = None
        if lat is not None and lon is not None:
            # Recalcul approximatif côté Python pour la réponse
            import math
            dlat = math.radians(event.latitude - lat)
            dlon = math.radians(event.longitude - lon)
            a = (math.sin(dlat / 2) ** 2 +
                 math.cos(math.radians(lat)) * math.cos(math.radians(event.latitude)) *
                 math.sin(dlon / 2) ** 2)
            distance_km = 6371.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        responses.append(_build_response(event, current_user_id, distance_km))

    # Les sorties premium remontent en tête, triées entre elles par date de création décroissante
    # (le plus récent parmi les premium passe devant)
    responses.sort(key=lambda e: (0 if e.creator.is_premium else 1, -e.created_at.timestamp() if e.creator.is_premium else 0))

    return responses


async def get_event(
    db: AsyncSession, event_id: uuid.UUID, current_user_id: uuid.UUID | None = None
) -> EventResponse:
    """Récupère le détail d'une sortie."""
    result = await db.execute(_event_query().where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event or not event.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")

    # Masquer les sorties des utilisateurs bloqués
    if current_user_id:
        from app.services.friendships import is_blocked
        if await is_blocked(db, current_user_id, event.creator_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")

    return _build_response(event, current_user_id)


async def update_event(
    db: AsyncSession, user: User, event_id: uuid.UUID, data: EventUpdate
) -> EventResponse:
    """Modifie une sortie (réservé au créateur)."""
    result = await db.execute(_event_query().where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event or not event.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")

    if event.creator_id != user.id and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le créateur peut modifier cette sortie",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    await db.commit()
    await db.refresh(event)

    result = await db.execute(_event_query().where(Event.id == event.id))
    event = result.scalar_one()
    return _build_response(event, current_user_id=user.id)


async def delete_event(db: AsyncSession, user: User, event_id: uuid.UUID) -> None:
    """Désactive une sortie (soft delete — réservé au créateur ou admin)."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event or not event.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")

    if event.creator_id != user.id and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le créateur peut supprimer cette sortie",
        )

    event.is_active = False
    await db.commit()


async def join_event(
    db: AsyncSession, user: User, event_id: uuid.UUID
) -> EventResponse:
    """Rejoindre une sortie. Verrouillage de la ligne event pour éviter la sur-capacité concurrente."""
    # Verrouiller la ligne Event avant de vérifier la capacité (évite les race conditions)
    await db.execute(select(Event).where(Event.id == event_id).with_for_update())
    result = await db.execute(_event_query().where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event or not event.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")

    # Vérifier le blocage avec le créateur
    from app.services.friendships import is_blocked
    if await is_blocked(db, user.id, event.creator_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action impossible")

    if event.starts_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette sortie a déjà commencé",
        )

    # Vérifier si déjà participant actif
    existing = next(
        (p for p in event.participants if p.user_id == user.id and p.status == "joined"), None
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tu participes déjà à cette sortie",
        )

    # ── MODE VALIDATION MANUELLE ────────────────────────────────────
    # Si la sortie requiert validation et que ce n'est pas le créateur (ni un admin),
    # on crée la participation en "pending" et on notifie le créateur.
    needs_approval = event.requires_approval and user.id != event.creator_id and not user.is_admin
    if needs_approval:
        existing_pending = next(
            (p for p in event.participants if p.user_id == user.id and p.status == "pending"), None
        )
        if existing_pending:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ta demande est déjà en attente de validation",
            )
        existing_rejected = next(
            (p for p in event.participants if p.user_id == user.id and p.status == "rejected"), None
        )
        if existing_rejected:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Ta demande pour cette sortie a déjà été refusée",
            )

        # Réutiliser une ligne "left" existante, sinon créer
        left_p = next(
            (p for p in event.participants if p.user_id == user.id and p.status == "left"), None
        )
        if left_p:
            left_p.status = "pending"
            left_p.joined_at = datetime.now(timezone.utc)
        else:
            new_p = EventParticipant(event_id=event.id, user_id=user.id, status="pending")
            db.add(new_p)
            event.participants.append(new_p)

        # Notifier le créateur d'une nouvelle demande
        from app.services.notifications import create_notification
        await create_notification(
            db,
            user_id=event.creator_id,
            type="join_request",
            content=f"{user.first_name} veut rejoindre « {event.title} »",
            actor_id=user.id,
            related_id=str(event.id),
        )

        await db.commit()
        return _build_response(event, current_user_id=user.id)

    # ── MODE LIBRE (comportement par défaut) ────────────────────────
    # Vérifier la capacité avec un COUNT SQL (fiable sous le lock)
    count_result = await db.execute(
        select(func.count()).where(
            EventParticipant.event_id == event_id,
            EventParticipant.status == "joined",
        )
    )
    active_count = count_result.scalar()
    if event.max_participants is not None and active_count >= event.max_participants:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette sortie est complète",
        )

    # Réactiver si l'utilisateur avait quitté, sinon créer
    left_participant = next(
        (p for p in event.participants if p.user_id == user.id and p.status == "left"), None
    )
    if left_participant:
        left_participant.status = "joined"
        left_participant.joined_at = datetime.now(timezone.utc)
    else:
        new_p = EventParticipant(event_id=event.id, user_id=user.id, status="joined")
        db.add(new_p)
        # Mettre à jour la liste en mémoire pour que _build_response soit correct
        event.participants.append(new_p)

    # Notifier le créateur de l'event (sauf si c'est lui qui rejoint son propre event)
    if event.creator_id != user.id:
        from app.services.notifications import create_notification
        await create_notification(
            db,
            user_id=event.creator_id,
            type="event_joined",
            content=f"{user.first_name} a rejoint ton événement « {event.title} »",
            actor_id=user.id,
            related_id=str(event.id),
        )
        # Email fire-and-forget au créateur
        creator = await db.get(User, event.creator_id)
        if creator:
            from app.services.email import fire, send_event_joined_email
            fire(send_event_joined_email(
                creator.email, creator.first_name,
                user.first_name, event.title, str(event.id),
            ))

    await db.commit()
    return _build_response(event, current_user_id=user.id)


async def mark_event_read(db: AsyncSession, user: User, event_id: uuid.UUID) -> None:
    """Marque tous les messages d'une sortie comme lus pour l'utilisateur."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(EventReadReceipt).where(
            EventReadReceipt.user_id == user.id,
            EventReadReceipt.event_id == event_id,
        )
    )
    receipt = result.scalar_one_or_none()
    if receipt:
        receipt.last_read_at = now
    else:
        db.add(EventReadReceipt(user_id=user.id, event_id=event_id, last_read_at=now))
    await db.commit()


async def get_unread_counts(db: AsyncSession, user: User) -> dict[str, int]:
    """Retourne le nombre de messages non lus par event_id pour l'utilisateur."""
    # Récupérer les events rejoints ET actifs (cohérent avec /events/joined)
    joined = await db.execute(
        select(EventParticipant.event_id)
        .join(Event, Event.id == EventParticipant.event_id)
        .where(
            EventParticipant.user_id == user.id,
            EventParticipant.status == "joined",
            Event.is_active == True,  # noqa: E712
        )
    )
    event_ids = [row[0] for row in joined.all()]
    if not event_ids:
        return {}

    # Récupérer les receipts existants
    receipts_result = await db.execute(
        select(EventReadReceipt).where(
            EventReadReceipt.user_id == user.id,
            EventReadReceipt.event_id.in_(event_ids),
        )
    )
    receipts = {r.event_id: r.last_read_at for r in receipts_result.scalars().all()}

    counts = {}
    for event_id in event_ids:
        last_read = receipts.get(event_id)
        query = select(func.count(Message.id)).where(
            Message.event_id == event_id,
            Message.sender_id != user.id,   # ne pas compter ses propres messages
            Message.is_deleted == False,     # noqa: E712
        )
        if last_read:
            query = query.where(Message.created_at > last_read)
        result = await db.execute(query)
        count = result.scalar_one()
        if count > 0:
            counts[str(event_id)] = count

    return counts


async def request_deletion(
    db: AsyncSession, user: User, event_id: uuid.UUID
) -> dict:
    """
    Le créateur demande la suppression d'une sortie avec des participants.
    Crée un EventDeletionPoll et broadcast un message de vote dans le chat.
    Si aucun autre participant actif, supprime directement.
    """
    result = await db.execute(_event_query().where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event or not event.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")

    if event.creator_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Seul le créateur peut initier la suppression")

    # Participants actifs hors créateur
    other_participants = [p for p in event.participants if p.status == "joined" and p.user_id != user.id]

    if not other_participants:
        # Pas d'autres participants → suppression directe
        event.is_active = False
        await db.commit()
        return {"deleted": True}

    # Vérifier si un vote est déjà en cours
    existing_poll = await db.execute(
        select(EventDeletionPoll).where(
            EventDeletionPoll.event_id == event_id,
            EventDeletionPoll.is_resolved == False,  # noqa: E712
        )
    )
    if existing_poll.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Un vote est déjà en cours")

    # Créer le poll
    poll = EventDeletionPoll(event_id=event_id, votes_keep=[], votes_delete=[])
    db.add(poll)
    await db.flush()  # Récupérer l'ID

    # Sauvegarder le message système de vote en DB (sender_id=None = message système)
    from app.models.message import Message
    system_msg = Message(
        event_id=event_id,
        sender_id=None,
        content=f"__VOTE__:{poll.id}:{user.first_name}",
    )
    db.add(system_msg)
    await db.commit()

    # Broadcast du message de vote à tous les connectés
    from app.websockets.connection_manager import manager
    await manager.broadcast(
        str(event_id),
        {
            "type": "vote",
            "poll_id": str(poll.id),
            "creator_name": user.first_name,
            "content": f"__VOTE__:{poll.id}:{user.first_name}",
        },
    )

    return {"deleted": False, "poll_id": str(poll.id)}


async def vote_deletion(
    db: AsyncSession, user: User, event_id: uuid.UUID, vote: str
) -> dict:
    """
    Un participant vote pour garder (keep) ou supprimer (delete) la sortie.
    Si majorité atteinte : résoudre le poll et appliquer la décision.
    """
    if vote not in ("keep", "delete"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Vote invalide (keep ou delete)")

    # Vérifier participation
    participant_check = await db.execute(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.user_id == user.id,
            EventParticipant.status == "joined",
        )
    )
    if not participant_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu n'es pas participant de cette sortie")

    # Récupérer l'événement et le poll
    result = await db.execute(_event_query().where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event or not event.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")

    poll = event.deletion_poll
    if not poll or poll.is_resolved:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aucun vote en cours pour cette sortie")

    # Le créateur ne vote pas
    if user.id == event.creator_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le créateur ne peut pas voter")

    user_id_str = str(user.id)

    # Vérifier si déjà voté
    if user_id_str in (poll.votes_keep or []) or user_id_str in (poll.votes_delete or []):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tu as déjà voté")

    # Enregistrer le vote (copier la liste pour déclencher la mise à jour SQLAlchemy)
    votes_keep = list(poll.votes_keep or [])
    votes_delete = list(poll.votes_delete or [])

    if vote == "keep":
        votes_keep.append(user_id_str)
    else:
        votes_delete.append(user_id_str)

    poll.votes_keep = votes_keep
    poll.votes_delete = votes_delete

    # Nombre de votants eligibles (participants hors créateur)
    eligible = [p for p in event.participants if p.status == "joined" and p.user_id != event.creator_id]
    total = len(eligible)
    majority = total / 2  # strict majority : > majority

    outcome = None

    if len(votes_delete) > majority:
        # Majorité pour supprimer → tout supprimer
        poll.is_resolved = True
        event.is_active = False
        outcome = "deleted"
    elif len(votes_keep) > majority:
        # Majorité pour garder → créateur quitte seulement
        poll.is_resolved = True
        outcome = "kept"
        # Retirer le créateur comme participant
        creator_participant = next(
            (p for p in event.participants if p.user_id == event.creator_id and p.status == "joined"),
            None,
        )
        if creator_participant:
            creator_participant.status = "left"
    elif len(votes_keep) + len(votes_delete) == total:
        # Tout le monde a voté — départager par majorité absolue
        poll.is_resolved = True
        if len(votes_delete) >= len(votes_keep):
            event.is_active = False
            outcome = "deleted"
        else:
            creator_participant = next(
                (p for p in event.participants if p.user_id == event.creator_id and p.status == "joined"),
                None,
            )
            if creator_participant:
                creator_participant.status = "left"
            outcome = "kept"

    await db.commit()

    # Broadcast du résultat si résolu
    if outcome:
        from app.websockets.connection_manager import manager
        if outcome == "deleted":
            await manager.broadcast(str(event_id), {"type": "system", "content": "La sortie a été supprimée suite au vote."})
        else:
            await manager.broadcast(str(event_id), {"type": "system", "content": f"La sortie est conservée. {event.creator.first_name} a quitté le groupe."})

    return {"vote": vote, "outcome": outcome}


async def leave_event(
    db: AsyncSession, user: User, event_id: uuid.UUID
) -> EventResponse:
    """Quitter une sortie."""
    result = await db.execute(_event_query().where(Event.id == event_id))
    event = result.scalar_one_or_none()

    if not event or not event.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")

    if event.creator_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le créateur ne peut pas quitter sa propre sortie",
        )

    participant = next(
        (p for p in event.participants if p.user_id == user.id and p.status == "joined"), None
    )
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu ne participes pas à cette sortie",
        )

    # La modification de participant.status est reflétée en mémoire dans event.participants
    participant.status = "left"
    await db.commit()
    return _build_response(event, current_user_id=user.id)


# ── VALIDATION MANUELLE DES PARTICIPANTS ─────────────────────────

async def list_pending_requests(
    db: AsyncSession, current_user: User, event_id: uuid.UUID
) -> list[dict]:
    """Liste les demandes en attente pour une sortie. Réservé au créateur (et admin)."""
    event = await db.get(Event, event_id)
    if not event or not event.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")
    if event.creator_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action réservée au créateur")

    result = await db.execute(
        select(EventParticipant)
        .options(selectinload(EventParticipant.user))
        .where(
            EventParticipant.event_id == event_id,
            EventParticipant.status == "pending",
        )
        .order_by(EventParticipant.joined_at.asc())
    )
    pendings = result.scalars().all()
    return [
        {
            "id": str(p.user.id),
            "first_name": p.user.first_name,
            "username": p.user.username,
            "avatar_url": p.user.avatar_url,
            "is_verified": p.user.is_verified,
            "requested_at": p.joined_at.isoformat(),
        }
        for p in pendings
        if p.user is not None
    ]


async def approve_join_request(
    db: AsyncSession, current_user: User, event_id: uuid.UUID, target_user_id: uuid.UUID
) -> None:
    """Le créateur accepte la demande de target_user_id pour event_id."""
    event = await db.get(Event, event_id)
    if not event or not event.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")
    if event.creator_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action réservée au créateur")

    # Récupérer la demande pending
    result = await db.execute(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.user_id == target_user_id,
            EventParticipant.status == "pending",
        )
    )
    pending = result.scalar_one_or_none()
    if not pending:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande introuvable")

    # Vérifier la capacité avant d'accepter
    count_result = await db.execute(
        select(func.count()).where(
            EventParticipant.event_id == event_id,
            EventParticipant.status == "joined",
        )
    )
    if event.max_participants is not None and (count_result.scalar() or 0) >= event.max_participants:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sortie complète : impossible d'accepter plus de participants",
        )

    pending.status = "joined"
    pending.joined_at = datetime.now(timezone.utc)

    # Notifier le demandeur de l'acceptation
    from app.services.notifications import create_notification
    await create_notification(
        db,
        user_id=target_user_id,
        type="join_approved",
        content=f"Ta demande pour rejoindre « {event.title} » a été acceptée",
        actor_id=current_user.id,
        related_id=str(event.id),
    )
    await db.commit()


async def reject_join_request(
    db: AsyncSession, current_user: User, event_id: uuid.UUID, target_user_id: uuid.UUID
) -> None:
    """Le créateur refuse la demande de target_user_id pour event_id."""
    event = await db.get(Event, event_id)
    if not event or not event.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sortie introuvable")
    if event.creator_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action réservée au créateur")

    result = await db.execute(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.user_id == target_user_id,
            EventParticipant.status == "pending",
        )
    )
    pending = result.scalar_one_or_none()
    if not pending:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande introuvable")

    pending.status = "rejected"

    # Notifier discrètement le demandeur
    from app.services.notifications import create_notification
    await create_notification(
        db,
        user_id=target_user_id,
        type="join_rejected",
        content=f"Ta demande pour « {event.title} » n'a pas été retenue",
        actor_id=current_user.id,
        related_id=str(event.id),
    )
    await db.commit()
