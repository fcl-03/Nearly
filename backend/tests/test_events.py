"""Tests d'intégration — CRUD Sorties."""
import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth


class TestCreateEvent:
    def test_requires_verified_email(self, client: TestClient, regular_token: str, future_event_payload: dict):
        """Un utilisateur sans email vérifié ne peut pas créer de sortie."""
        r = client.post("/api/v1/events", headers=auth(regular_token), json=future_event_payload)
        assert r.status_code == 403

    def test_success(self, client: TestClient, verified_token: str, future_event_payload: dict):
        r = client.post("/api/v1/events", headers=auth(verified_token), json=future_event_payload)
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "Sortie test"
        assert data["participants_count"] == 1   # créateur auto-rejoint
        assert data["is_joined"] is True
        assert data["is_full"] is False
        # Cleanup
        client.delete(f"/api/v1/events/{data['id']}", headers=auth(verified_token))

    def test_past_date_rejected(self, client: TestClient, verified_token: str, future_event_payload: dict):
        payload = {**future_event_payload, "starts_at": "2020-01-01T00:00:00Z"}
        r = client.post("/api/v1/events", headers=auth(verified_token), json=payload)
        assert r.status_code == 422

    def test_small_group_invalid_max_participants(self, client: TestClient, verified_token: str, future_event_payload: dict):
        """small_group avec max_participants=10 (hors 3-6) doit être rejeté."""
        payload = {**future_event_payload, "max_participants": 10}
        r = client.post("/api/v1/events", headers=auth(verified_token), json=payload)
        assert r.status_code == 422

    def test_small_group_requires_max_participants(self, client: TestClient, verified_token: str, future_event_payload: dict):
        payload = {**future_event_payload, "max_participants": None}
        r = client.post("/api/v1/events", headers=auth(verified_token), json=payload)
        assert r.status_code == 422

    def test_invalid_coordinates(self, client: TestClient, verified_token: str, future_event_payload: dict):
        payload = {**future_event_payload, "latitude": 200.0}
        r = client.post("/api/v1/events", headers=auth(verified_token), json=payload)
        assert r.status_code == 422


class TestListEvents:
    @pytest.fixture(autouse=True)
    def create_event(self, client, verified_token, future_event_payload):
        """Crée un event pour chaque test de cette classe, puis le supprime."""
        r = client.post("/api/v1/events", headers=auth(verified_token), json=future_event_payload)
        self.event_id = r.json()["id"]
        yield
        client.delete(f"/api/v1/events/{self.event_id}", headers=auth(verified_token))

    def test_list_returns_active_events(self, client: TestClient):
        r = client.get("/api/v1/events")
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert self.event_id in ids

    def test_geo_filter_within_radius(self, client: TestClient):
        """Filtre géo centré sur Troyes — l'event à Troyes doit apparaître."""
        r = client.get("/api/v1/events?lat=48.2973&lon=4.0744&radius_km=5")
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert self.event_id in ids

    def test_geo_filter_outside_radius(self, client: TestClient):
        """Filtre géo centré sur Paris — l'event à Troyes ne doit pas apparaître."""
        r = client.get("/api/v1/events?lat=48.8566&lon=2.3522&radius_km=10")
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert self.event_id not in ids

    def test_distance_returned_when_geo_provided(self, client: TestClient):
        r = client.get("/api/v1/events?lat=48.2973&lon=4.0744&radius_km=5")
        events = r.json()
        assert events[0]["distance_km"] is not None

    def test_category_filter(self, client: TestClient):
        r = client.get("/api/v1/events?category=test")
        assert r.status_code == 200
        assert all(e["category"] == "test" for e in r.json())

    def test_deleted_event_not_listed(self, client: TestClient, verified_token: str, future_event_payload: dict):
        r = client.post("/api/v1/events", headers=auth(verified_token), json=future_event_payload)
        eid = r.json()["id"]
        client.delete(f"/api/v1/events/{eid}", headers=auth(verified_token))

        ids = [e["id"] for e in client.get("/api/v1/events").json()]
        assert eid not in ids


class TestGetEvent:
    @pytest.fixture(autouse=True)
    def create_event(self, client, verified_token, future_event_payload):
        r = client.post("/api/v1/events", headers=auth(verified_token), json=future_event_payload)
        self.event_id = r.json()["id"]
        yield
        client.delete(f"/api/v1/events/{self.event_id}", headers=auth(verified_token))

    def test_get_existing_event(self, client: TestClient):
        r = client.get(f"/api/v1/events/{self.event_id}")
        assert r.status_code == 200
        assert r.json()["id"] == self.event_id

    def test_get_nonexistent_event(self, client: TestClient):
        r = client.get("/api/v1/events/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404


class TestUpdateEvent:
    @pytest.fixture(autouse=True)
    def create_event(self, client, verified_token, future_event_payload):
        r = client.post("/api/v1/events", headers=auth(verified_token), json=future_event_payload)
        self.event_id = r.json()["id"]
        yield
        client.delete(f"/api/v1/events/{self.event_id}", headers=auth(verified_token))

    def test_creator_can_update(self, client: TestClient, verified_token: str):
        r = client.put(f"/api/v1/events/{self.event_id}", headers=auth(verified_token), json={"title": "Titre modifié"})
        assert r.status_code == 200
        assert r.json()["title"] == "Titre modifié"

    def test_other_user_cannot_update(self, client: TestClient, other_token: str):
        r = client.put(f"/api/v1/events/{self.event_id}", headers=auth(other_token), json={"title": "Hacked"})
        assert r.status_code == 403


class TestJoinLeaveEvent:
    @pytest.fixture(autouse=True)
    def create_event(self, client, verified_token, future_event_payload):
        r = client.post("/api/v1/events", headers=auth(verified_token), json=future_event_payload)
        self.event_id = r.json()["id"]
        yield
        client.delete(f"/api/v1/events/{self.event_id}", headers=auth(verified_token))

    def test_join_success(self, client: TestClient, other_token: str):
        r = client.post(f"/api/v1/events/{self.event_id}/join", headers=auth(other_token))
        assert r.status_code == 200
        assert r.json()["participants_count"] == 2
        assert r.json()["is_joined"] is True

    def test_join_twice_returns_conflict(self, client: TestClient, other_token: str):
        client.post(f"/api/v1/events/{self.event_id}/join", headers=auth(other_token))
        r = client.post(f"/api/v1/events/{self.event_id}/join", headers=auth(other_token))
        assert r.status_code == 409

    def test_leave_success(self, client: TestClient, other_token: str):
        client.post(f"/api/v1/events/{self.event_id}/join", headers=auth(other_token))
        r = client.post(f"/api/v1/events/{self.event_id}/leave", headers=auth(other_token))
        assert r.status_code == 200
        assert r.json()["participants_count"] == 1

    def test_creator_cannot_leave(self, client: TestClient, verified_token: str):
        r = client.post(f"/api/v1/events/{self.event_id}/leave", headers=auth(verified_token))
        assert r.status_code == 400

    def test_event_full(self, client: TestClient, verified_token: str, other_token: str, admin_token: str, future_event_payload: dict):
        """Crée un event à 3 max, le remplit, vérifie que le 4e est rejeté."""
        # Event avec max 3, le créateur (verified) = 1
        payload = {**future_event_payload, "max_participants": 3}
        r = client.post("/api/v1/events", headers=auth(verified_token), json=payload)
        eid = r.json()["id"]

        # user "other" rejoint → 2/3
        r = client.post(f"/api/v1/events/{eid}/join", headers=auth(other_token))
        assert r.status_code == 200
        # user "admin" rejoint → 3/3
        r = client.post(f"/api/v1/events/{eid}/join", headers=auth(admin_token))
        assert r.status_code == 200

        # Vérifier que l'event est plein
        data = client.get(f"/api/v1/events/{eid}").json()
        assert data["is_full"] is True

        # Cleanup
        client.delete(f"/api/v1/events/{eid}", headers=auth(verified_token))
