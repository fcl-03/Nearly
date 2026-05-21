"""Tests d'intégration — Comptes business et sorties sponsorisées."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth


class TestBusinessAccount:
    """Tests du cycle de vie complet d'un compte business."""

    def test_no_account_returns_404(self, client: TestClient, regular_token: str):
        """Un utilisateur sans compte business reçoit 404."""
        r = client.get("/api/v1/business/me", headers=auth(regular_token))
        assert r.status_code == 404

    def test_create_account(self, client: TestClient, other_token: str):
        """Création d'un compte business pour 'other'."""
        r = client.post("/api/v1/business", headers=auth(other_token), json={
            "business_name": "Le Petit Troyen",
            "city": "Troyes",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["business_name"] == "Le Petit Troyen"
        assert data["plan"] == "starter"
        assert data["sponsored_events_limit"] == 3
        assert data["sponsored_events_used"] == 0
        assert data["is_active"] is True

    def test_duplicate_account_rejected(self, client: TestClient, other_token: str):
        """Un utilisateur ne peut avoir qu'un seul compte business."""
        r = client.post("/api/v1/business", headers=auth(other_token), json={
            "business_name": "Deuxième Compte",
        })
        assert r.status_code == 409

    def test_name_too_short(self, client: TestClient, verified_token: str):
        r = client.post("/api/v1/business", headers=auth(verified_token), json={
            "business_name": "A",
        })
        assert r.status_code == 422

    def test_get_my_account(self, client: TestClient, other_token: str):
        r = client.get("/api/v1/business/me", headers=auth(other_token))
        assert r.status_code == 200
        assert r.json()["business_name"] == "Le Petit Troyen"

    def test_update_description(self, client: TestClient, other_token: str):
        r = client.put("/api/v1/business/me", headers=auth(other_token), json={
            "description": "Un super bar à Troyes",
        })
        assert r.status_code == 200
        assert r.json()["description"] == "Un super bar à Troyes"

    def test_starter_cannot_access_stats(self, client: TestClient, other_token: str):
        """Le plan Starter n'a pas accès aux stats."""
        r = client.get("/api/v1/business/me/stats", headers=auth(other_token))
        assert r.status_code == 403


class TestSponsoredEvents:
    """Tests des sorties sponsorisées (dépend de TestBusinessAccount)."""

    def test_create_sponsored_event(self, client: TestClient, other_token: str):
        # S'assurer qu'un compte business existe (idempotent)
        client.post("/api/v1/business", headers=auth(other_token), json={
            "business_name": "Le Petit Troyen",
            "city": "Troyes",
        })

        starts_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        r = client.post("/api/v1/business/me/events", headers=auth(other_token), json={
            "title": "Soirée tapas sponsorisée",
            "description": "Venez découvrir nos tapas maison !",
            "category": "food",
            "event_type": "open",
            "location_name": "Le Petit Troyen",
            "latitude": 48.2973,
            "longitude": 4.0744,
            "starts_at": starts_at,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["event_title"] == "Soirée tapas sponsorisée"

    def test_list_sponsored_events(self, client: TestClient, other_token: str):
        r = client.get("/api/v1/business/me/events", headers=auth(other_token))
        assert r.status_code == 200
        events = r.json()
        assert len(events) >= 1


class TestBusinessAdmin:
    def test_admin_list_accounts(self, client: TestClient, admin_token: str):
        r = client.get("/api/v1/business/admin", headers=auth(admin_token))
        assert r.status_code == 200
        accounts = r.json()
        assert len(accounts) >= 1

    def test_non_admin_cannot_list(self, client: TestClient, verified_token: str):
        r = client.get("/api/v1/business/admin", headers=auth(verified_token))
        assert r.status_code == 403

    def test_admin_toggle_account(self, client: TestClient, admin_token: str):
        accounts = client.get("/api/v1/business/admin", headers=auth(admin_token)).json()
        account_id = accounts[0]["id"]

        # Désactiver
        r = client.patch(f"/api/v1/business/admin/{account_id}/toggle", headers=auth(admin_token))
        assert r.status_code == 200
        assert "désactivé" in r.json()["message"]

        # Réactiver
        r = client.patch(f"/api/v1/business/admin/{account_id}/toggle", headers=auth(admin_token))
        assert r.status_code == 200
        assert "activé" in r.json()["message"]

    def test_admin_change_plan(self, client: TestClient, admin_token: str):
        accounts = client.get("/api/v1/business/admin", headers=auth(admin_token)).json()
        account_id = accounts[0]["id"]

        r = client.patch(f"/api/v1/business/admin/{account_id}/plan",
                         headers=auth(admin_token), json={"plan": "pro"})
        assert r.status_code == 200
        assert "pro" in r.json()["message"]

    def test_admin_change_invalid_plan(self, client: TestClient, admin_token: str):
        accounts = client.get("/api/v1/business/admin", headers=auth(admin_token)).json()
        account_id = accounts[0]["id"]

        r = client.patch(f"/api/v1/business/admin/{account_id}/plan",
                         headers=auth(admin_token), json={"plan": "mega_ultra"})
        assert r.status_code == 400
