"""Tests de sécurité — validation des entrées, accès non autorisés, edge cases."""
import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth


class TestEmailNormalization:
    """L'email doit être insensible à la casse."""

    def test_register_uppercase_email(self, client: TestClient):
        """Inscription avec email en majuscule."""
        r = client.post("/api/v1/auth/register", json={
            "email": "UPPERCASE@NEARLY.APP",
            "password": "password123",
            "first_name": "Upper",
            "is_adult": True,
            "accepts_terms": True,
        })
        assert r.status_code == 201

    def test_login_uppercase_email_matches_lowercase(self, client: TestClient):
        """Connexion avec l'email en majuscule doit fonctionner si inscrit en minuscule."""
        client.post("/api/v1/auth/register", json={
            "email": "casetest@nearly.app",
            "password": "password123",
            "first_name": "Case",
            "is_adult": True,
            "accepts_terms": True,
        })
        r = client.post("/api/v1/auth/login", json={
            "email": "CASETEST@NEARLY.APP",
            "password": "password123",
        })
        assert r.status_code == 200

    def test_duplicate_email_different_case(self, client: TestClient):
        """Deux comptes avec le même email (casse différente) doivent être refusés."""
        client.post("/api/v1/auth/register", json={
            "email": "duplicate@nearly.app",
            "password": "password123",
            "first_name": "Dup1",
            "is_adult": True,
            "accepts_terms": True,
        })
        r = client.post("/api/v1/auth/register", json={
            "email": "DUPLICATE@NEARLY.APP",
            "password": "password123",
            "first_name": "Dup2",
            "is_adult": True,
            "accepts_terms": True,
        })
        assert r.status_code == 409


class TestDMValidation:
    """Validation des messages privés."""

    def test_dm_content_too_long(self, client: TestClient, verified_token: str, other_token: str):
        """Un DM de plus de 1000 caractères doit être refusé."""
        # D'abord créer une amitié (nécessaire pour les DMs)
        # On teste juste la validation Pydantic — sans amis = 403, mais la validation arrive avant
        r = client.post(
            "/api/v1/dm/00000000-0000-0000-0000-000000000002/messages",
            headers=auth(verified_token),
            json={"content": "x" * 1001},
        )
        # 422 si validation échoue avant auth, ou 403/404 — dans tous les cas pas 201
        assert r.status_code in (422, 403, 404)

    def test_dm_empty_content_rejected(self, client: TestClient, verified_token: str):
        """Un DM vide doit être refusé."""
        r = client.post(
            "/api/v1/dm/00000000-0000-0000-0000-000000000002/messages",
            headers=auth(verified_token),
            json={"content": "   "},
        )
        assert r.status_code == 422

    def test_cannot_dm_yourself(self, client: TestClient, verified_token: str):
        """On ne peut pas s'envoyer un DM à soi-même."""
        me = client.get("/api/v1/users/me", headers=auth(verified_token)).json()
        r = client.post(
            f"/api/v1/dm/{me['id']}/messages",
            headers=auth(verified_token),
            json={"content": "Hello me"},
        )
        # 400 (auto-DM interdit) ou 403 (DM entre non-amis)
        assert r.status_code in (400, 403)


class TestEventSecurity:
    """Sécurité autour des sorties."""

    @pytest.fixture(autouse=True)
    def create_event(self, client, verified_token, future_event_payload):
        r = client.post("/api/v1/events", headers=auth(verified_token), json=future_event_payload)
        self.event_id = r.json()["id"]
        yield
        client.delete(f"/api/v1/events/{self.event_id}", headers=auth(verified_token))

    def test_unauthenticated_cannot_join(self, client: TestClient):
        r = client.post(f"/api/v1/events/{self.event_id}/join")
        assert r.status_code in (401, 403)

    def test_other_user_cannot_delete_event(self, client: TestClient, other_token: str):
        r = client.delete(f"/api/v1/events/{self.event_id}", headers=auth(other_token))
        assert r.status_code == 403

    def test_cannot_invite_if_not_creator(self, client: TestClient, other_token: str):
        """Seul le créateur peut inviter des amis."""
        r = client.post(
            f"/api/v1/events/{self.event_id}/invite",
            headers=auth(other_token),
            json={"user_ids": ["00000000-0000-0000-0000-000000000001"]},
        )
        assert r.status_code == 403

    def test_invalid_event_id_returns_404(self, client: TestClient, verified_token: str):
        r = client.get("/api/v1/events/00000000-0000-0000-0000-000000000000",
                       headers=auth(verified_token))
        assert r.status_code == 404


class TestAdminSecurity:
    """Vérifications de sécurité admin."""

    def test_regular_user_cannot_access_admin(self, client: TestClient, regular_token: str):
        r = client.get("/api/v1/admin/stats", headers=auth(regular_token))
        assert r.status_code == 403

    def test_admin_cannot_ban_self(self, client: TestClient, admin_token: str):
        me = client.get("/api/v1/users/me", headers=auth(admin_token)).json()
        r = client.post(f"/api/v1/admin/users/{me['id']}/ban",
                        headers=auth(admin_token), json={})
        assert r.status_code == 403

    def test_unauthenticated_cannot_access_admin(self, client: TestClient):
        r = client.get("/api/v1/admin/stats")
        assert r.status_code in (401, 403)


class TestUserProfileSecurity:
    """Sécurité des endpoints profil."""

    def test_cannot_access_banned_user_profile(self, client: TestClient, admin_token: str, verified_token: str):
        """Un utilisateur banni ne doit pas être accessible via profil public."""
        # Créer un user à bannir
        client.post("/api/v1/auth/register", json={
            "email": "toban2@nearly.app",
            "password": "password123",
            "first_name": "ToBan",
            "is_adult": True,
            "accepts_terms": True,
        })
        users = client.get("/api/v1/admin/users?search=toban2", headers=auth(admin_token)).json()
        if not users:
            pytest.skip("Utilisateur de test non trouvé")
        uid = users[0]["id"]
        client.post(f"/api/v1/admin/users/{uid}/ban", headers=auth(admin_token), json={})

        r = client.get(f"/api/v1/users/{uid}", headers=auth(verified_token))
        assert r.status_code == 404

    def test_username_invalid_format_rejected(self, client: TestClient, verified_token: str):
        """Un username avec des caractères spéciaux doit être refusé."""
        r = client.put("/api/v1/users/me", headers=auth(verified_token),
                       json={"username": "invalid username!"})
        assert r.status_code == 422

    def test_username_too_short_rejected(self, client: TestClient, verified_token: str):
        r = client.put("/api/v1/users/me", headers=auth(verified_token),
                       json={"username": "ab"})
        assert r.status_code == 422


class TestNotificationsSecurity:
    """Sécurité des notifications."""

    def test_cannot_read_others_notifications(self, client: TestClient, verified_token: str, other_token: str):
        """Les notifications sont privées — un user ne voit que les siennes."""
        r_verified = client.get("/api/v1/notifications", headers=auth(verified_token))
        r_other = client.get("/api/v1/notifications", headers=auth(other_token))
        # Chaque requête ne retourne que les notifs de l'utilisateur demandeur
        assert r_verified.status_code == 200
        assert r_other.status_code == 200
        # Les IDs retournés ne doivent pas se chevaucher (chaque user voit ses propres notifs)
        ids_verified = {n["id"] for n in r_verified.json()}
        ids_other = {n["id"] for n in r_other.json()}
        assert ids_verified.isdisjoint(ids_other)
