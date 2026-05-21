"""Tests d'intégration — Profil utilisateur."""
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from tests.conftest import auth


def make_jpeg(size=(200, 200), color=(100, 150, 200)) -> bytes:
    """Génère une image JPEG en mémoire pour les tests."""
    buf = io.BytesIO()
    Image.new("RGB", size, color=color).save(buf, format="JPEG")
    return buf.getvalue()


class TestProfile:
    def test_get_my_profile(self, client: TestClient, verified_token: str):
        r = client.get("/api/v1/users/me", headers=auth(verified_token))
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "verified@nearly.app"
        assert data["first_name"] == "Verified"
        assert data["is_email_verified"] is True
        assert "interests" in data

    def test_update_profile_partial(self, client: TestClient, verified_token: str):
        r = client.put("/api/v1/users/me", headers=auth(verified_token), json={
            "bio": "Ma bio de test",
            "city": "Troyes",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["bio"] == "Ma bio de test"
        assert data["city"] == "Troyes"
        # first_name non envoyé → inchangé
        assert data["first_name"] == "Verified"

    def test_update_profile_empty_first_name_rejected(self, client: TestClient, verified_token: str):
        r = client.put("/api/v1/users/me", headers=auth(verified_token), json={"first_name": "   "})
        assert r.status_code == 422

    def test_update_profile_bio_too_long(self, client: TestClient, verified_token: str):
        r = client.put("/api/v1/users/me", headers=auth(verified_token), json={"bio": "x" * 501})
        assert r.status_code == 422


class TestAvatar:
    def test_upload_avatar(self, client: TestClient, verified_token: str):
        r = client.post(
            "/api/v1/users/me/avatar",
            headers=auth(verified_token),
            files={"avatar": ("avatar.jpg", make_jpeg(), "image/jpeg")},
        )
        assert r.status_code == 200
        assert "Avatar mis à jour" in r.json()["message"]

    def test_upload_invalid_type(self, client: TestClient, verified_token: str):
        r = client.post(
            "/api/v1/users/me/avatar",
            headers=auth(verified_token),
            files={"avatar": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
        )
        assert r.status_code == 422

    def test_delete_avatar(self, client: TestClient, verified_token: str):
        r = client.delete("/api/v1/users/me/avatar", headers=auth(verified_token))
        assert r.status_code == 200
        # Vérifier que l'avatar_url est bien None
        me = client.get("/api/v1/users/me", headers=auth(verified_token)).json()
        assert me["avatar_url"] is None


class TestInterests:
    def test_list_all_interests_empty(self, client: TestClient):
        """Sans intérêts en DB, retourne une liste vide."""
        r = client.get("/api/v1/users/interests")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_update_interests_empty_list(self, client: TestClient, verified_token: str):
        r = client.put("/api/v1/users/me/interests", headers=auth(verified_token), json={"interest_ids": []})
        assert r.status_code == 200
        assert r.json() == []

    def test_update_interests_invalid_id(self, client: TestClient, verified_token: str):
        r = client.put("/api/v1/users/me/interests", headers=auth(verified_token), json={"interest_ids": [9999]})
        assert r.status_code == 400

    def test_update_interests_too_many(self, client: TestClient, verified_token: str):
        r = client.put("/api/v1/users/me/interests", headers=auth(verified_token), json={"interest_ids": list(range(1, 12))})
        assert r.status_code == 422
