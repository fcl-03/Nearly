"""Tests d'intégration — Publicités natives."""
import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth


class TestAdminCRUD:
    """Admin : créer, lister, activer/désactiver et supprimer des pubs."""

    def test_create_ad(self, client: TestClient, admin_token: str):
        r = client.post("/api/v1/ads/admin", headers=auth(admin_token), json={
            "title": "Pub test",
            "link_url": "https://example.com",
            "cta_label": "Voir l'offre",
            "target_city": "Troyes",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "Pub test"
        assert data["is_active"] is True
        assert data["impressions"] == 0
        assert data["clicks"] == 0

    def test_list_ads(self, client: TestClient, admin_token: str):
        r = client.get("/api/v1/ads/admin", headers=auth(admin_token))
        assert r.status_code == 200
        ads = r.json()
        assert len(ads) >= 1

    def test_toggle_ad(self, client: TestClient, admin_token: str):
        ads = client.get("/api/v1/ads/admin", headers=auth(admin_token)).json()
        ad_id = ads[0]["id"]

        # Désactiver
        r = client.patch(f"/api/v1/ads/admin/{ad_id}/toggle", headers=auth(admin_token))
        assert r.status_code == 200
        assert r.json()["is_active"] is False

        # Réactiver
        r = client.patch(f"/api/v1/ads/admin/{ad_id}/toggle", headers=auth(admin_token))
        assert r.status_code == 200
        assert r.json()["is_active"] is True

    def test_delete_ad(self, client: TestClient, admin_token: str):
        # Créer une pub dédiée à supprimer
        r = client.post("/api/v1/ads/admin", headers=auth(admin_token), json={
            "title": "A supprimer",
            "link_url": "https://example.com/delete",
        })
        ad_id = r.json()["id"]

        r = client.delete(f"/api/v1/ads/admin/{ad_id}", headers=auth(admin_token))
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_delete_nonexistent_ad(self, client: TestClient, admin_token: str):
        r = client.delete("/api/v1/ads/admin/00000000-0000-0000-0000-000000000000",
                          headers=auth(admin_token))
        assert r.status_code == 404


class TestAdFeed:
    def test_feed_returns_ads(self, client: TestClient, verified_token: str):
        r = client.get("/api/v1/ads/feed", headers=auth(verified_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_feed_unauthenticated_rejected(self, client: TestClient):
        r = client.get("/api/v1/ads/feed")
        assert r.status_code in (401, 403)


class TestAdClick:
    def test_click_tracking(self, client: TestClient, admin_token: str):
        # Récupérer une pub active
        ads = client.get("/api/v1/ads/admin", headers=auth(admin_token)).json()
        active_ads = [a for a in ads if a["is_active"]]
        if not active_ads:
            pytest.skip("Aucune pub active")
        ad_id = active_ads[0]["id"]

        # Cliquer (redirige vers l'URL)
        r = client.get(f"/api/v1/ads/{ad_id}/click", follow_redirects=False)
        assert r.status_code == 302

    def test_click_nonexistent_ad(self, client: TestClient):
        r = client.get("/api/v1/ads/00000000-0000-0000-0000-000000000000/click",
                       follow_redirects=False)
        assert r.status_code == 404


class TestAdSecurity:
    def test_non_admin_cannot_create_ad(self, client: TestClient, verified_token: str):
        r = client.post("/api/v1/ads/admin", headers=auth(verified_token), json={
            "title": "Hacked",
            "link_url": "https://evil.com",
        })
        assert r.status_code == 403

    def test_non_admin_cannot_delete_ad(self, client: TestClient, verified_token: str):
        r = client.delete("/api/v1/ads/admin/00000000-0000-0000-0000-000000000000",
                          headers=auth(verified_token))
        assert r.status_code == 403
