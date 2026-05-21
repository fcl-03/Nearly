"""Tests d'intégration — Dashboard admin."""
import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth


class TestAdminAccess:
    def test_non_admin_cannot_access_stats(self, client: TestClient, verified_token: str):
        r = client.get("/api/v1/admin/stats", headers=auth(verified_token))
        assert r.status_code == 403

    def test_unauthenticated_cannot_access_stats(self, client: TestClient):
        r = client.get("/api/v1/admin/stats")
        assert r.status_code in (401, 403)

    def test_admin_can_access_stats(self, client: TestClient, admin_token: str):
        r = client.get("/api/v1/admin/stats", headers=auth(admin_token))
        assert r.status_code == 200


class TestAdminStats:
    def test_stats_shape(self, client: TestClient, admin_token: str):
        r = client.get("/api/v1/admin/stats", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        for key in ("total_users", "email_verified_users", "identity_verified_users", "banned_users", "active_events", "total_events", "total_messages", "pending_reports", "pending_verifications"):
            assert key in data, f"Clé manquante : {key}"

    def test_stats_values_are_positive(self, client: TestClient, admin_token: str):
        r = client.get("/api/v1/admin/stats", headers=auth(admin_token))
        data = r.json()
        for key, val in data.items():
            assert val >= 0, f"{key} ne doit pas être négatif"


class TestAdminUsers:
    def test_list_users(self, client: TestClient, admin_token: str):
        r = client.get("/api/v1/admin/users", headers=auth(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 4  # les 4 users seed

    def test_search_users(self, client: TestClient, admin_token: str):
        r = client.get("/api/v1/admin/users?search=verified", headers=auth(admin_token))
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 1
        assert any("verified" in u["email"] for u in users)

    def test_get_user_detail(self, client: TestClient, admin_token: str):
        users = client.get("/api/v1/admin/users?search=regular", headers=auth(admin_token)).json()
        user_id = users[0]["id"]
        r = client.get(f"/api/v1/admin/users/{user_id}", headers=auth(admin_token))
        assert r.status_code == 200
        assert r.json()["id"] == user_id

    def test_get_nonexistent_user(self, client: TestClient, admin_token: str):
        r = client.get("/api/v1/admin/users/00000000-0000-0000-0000-000000000000", headers=auth(admin_token))
        assert r.status_code == 404


class TestAdminBanUnban:
    @pytest.fixture(autouse=True)
    def create_bannable_user(self, client, admin_token):
        """Crée un user temporaire pour les tests ban/unban."""
        client.post("/api/v1/auth/register", json={
            "email": "bannable@nearly.app",
            "password": "password123",
            "first_name": "Bannable",
            "is_adult": True,
            "accepts_terms": True,
        })
        users = client.get("/api/v1/admin/users?search=bannable", headers=auth(admin_token)).json()
        self.user_id = users[0]["id"]
        yield
        # S'assurer qu'il est unban en fin de test (idempotent)
        client.post(f"/api/v1/admin/users/{self.user_id}/unban", headers=auth(admin_token), json={})

    def test_ban_user(self, client: TestClient, admin_token: str):
        r = client.post(f"/api/v1/admin/users/{self.user_id}/ban", headers=auth(admin_token), json={})
        assert r.status_code == 200

        # Login doit échouer
        r = client.post("/api/v1/auth/login", json={"email": "bannable@nearly.app", "password": "password123"})
        assert r.status_code in (401, 403)

    def test_unban_user(self, client: TestClient, admin_token: str):
        # Bannir d'abord
        client.post(f"/api/v1/admin/users/{self.user_id}/ban", headers=auth(admin_token), json={})

        # Puis débannir
        r = client.post(f"/api/v1/admin/users/{self.user_id}/unban", headers=auth(admin_token), json={})
        assert r.status_code == 200

        # Login doit réussir à nouveau
        r = client.post("/api/v1/auth/login", json={"email": "bannable@nearly.app", "password": "password123"})
        assert r.status_code == 200

    def test_admin_cannot_ban_self(self, client: TestClient, admin_token: str):
        """Un admin ne peut pas se bannir lui-même."""
        users = client.get("/api/v1/admin/users?search=admin@nearly", headers=auth(admin_token)).json()
        admin_id = users[0]["id"]
        r = client.post(f"/api/v1/admin/users/{admin_id}/ban", headers=auth(admin_token), json={})
        assert r.status_code in (400, 403)


class TestAdminPromoteDemote:
    @pytest.fixture(autouse=True)
    def create_promotable_user(self, client, admin_token):
        """Crée un user temporaire pour les tests promote/demote."""
        client.post("/api/v1/auth/register", json={
            "email": "promotable@nearly.app",
            "password": "password123",
            "first_name": "Promotable",
            "is_adult": True,
            "accepts_terms": True,
        })
        users = client.get("/api/v1/admin/users?search=promotable", headers=auth(admin_token)).json()
        self.user_id = users[0]["id"]
        yield

    def test_promote_user(self, client: TestClient, admin_token: str):
        r = client.post(f"/api/v1/admin/users/{self.user_id}/promote", headers=auth(admin_token), json={})
        assert r.status_code == 200
        # Vérifier que l'user est bien admin
        user = client.get(f"/api/v1/admin/users/{self.user_id}", headers=auth(admin_token)).json()
        assert user["is_admin"] is True

    def test_demote_user(self, client: TestClient, admin_token: str):
        # Promouvoir d'abord
        client.post(f"/api/v1/admin/users/{self.user_id}/promote", headers=auth(admin_token), json={})

        r = client.post(f"/api/v1/admin/users/{self.user_id}/demote", headers=auth(admin_token), json={})
        assert r.status_code == 200
        user = client.get(f"/api/v1/admin/users/{self.user_id}", headers=auth(admin_token)).json()
        assert user["is_admin"] is False


class TestAdminEvents:
    @pytest.fixture(autouse=True)
    def create_event(self, client, verified_token, future_event_payload):
        r = client.post("/api/v1/events", headers=auth(verified_token), json=future_event_payload)
        self.event_id = r.json()["id"]
        yield
        # Cleanup si pas encore supprimé
        client.delete(f"/api/v1/events/{self.event_id}", headers=auth(verified_token))

    def test_list_events(self, client: TestClient, admin_token: str):
        r = client.get("/api/v1/admin/events", headers=auth(admin_token))
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert self.event_id in ids

    def test_force_delete_event(self, client: TestClient, admin_token: str, verified_token: str):
        r = client.delete(f"/api/v1/admin/events/{self.event_id}", headers=auth(admin_token))
        assert r.status_code == 200

        # L'event ne doit plus être visible
        r = client.get(f"/api/v1/events/{self.event_id}")
        assert r.status_code == 404


class TestAdminReports:
    def test_list_reports_empty(self, client: TestClient, admin_token: str):
        r = client.get("/api/v1/admin/reports", headers=auth(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
