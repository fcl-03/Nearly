from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    """
    Gestionnaire des connexions WebSocket actives.
    Structure : {event_id: {user_id: WebSocket}}
    Singleton partagé par toute l'application.
    """

    def __init__(self):
        # Clé : event_id (str), Valeur : {user_id (str): WebSocket}
        self._rooms: dict[str, dict[str, WebSocket]] = defaultdict(dict)

    async def connect(self, event_id: str, user_id: str, ws: WebSocket) -> None:
        """Accepte la connexion et enregistre le socket dans la salle."""
        await ws.accept()
        self._rooms[event_id][user_id] = ws

    def disconnect(self, event_id: str, user_id: str) -> None:
        """Retire la connexion de la salle (sans fermer le socket)."""
        room = self._rooms.get(event_id, {})
        room.pop(user_id, None)
        if not room:
            self._rooms.pop(event_id, None)

    async def broadcast(
        self,
        event_id: str,
        payload: dict,
        exclude_user_id: str | None = None,
    ) -> None:
        """Envoie un message JSON à tous les participants connectés dans la salle."""
        room = self._rooms.get(event_id, {})
        dead: list[str] = []

        for uid, ws in list(room.items()):
            if uid == exclude_user_id:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                # Connexion morte — à nettoyer
                dead.append(uid)

        for uid in dead:
            room.pop(uid, None)

    async def send_to_user(self, event_id: str, user_id: str, payload: dict) -> None:
        """Envoie un message JSON à un utilisateur spécifique dans la salle."""
        ws = self._rooms.get(event_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(event_id, user_id)

    def get_connected_count(self, event_id: str) -> int:
        """Retourne le nombre d'utilisateurs connectés dans la salle."""
        return len(self._rooms.get(event_id, {}))


# Singleton — importé par les endpoints WebSocket
manager = ConnectionManager()
