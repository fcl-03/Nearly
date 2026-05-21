"""Tests d'intégration — Authentification."""
import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth


class TestRegister:
    def test_success(self, client: TestClient):
        r = client.post("/api/v1/auth/register", json={
            "email": "newuser@nearly.app",
            "password": "password123",
            "first_name": "Nouveau",
            "is_adult": True,
            "accepts_terms": True,
        })
        assert r.status_code == 201
        assert "Inscription réussie" in r.json()["message"]

    def test_duplicate_email(self, client: TestClient):
        r = client.post("/api/v1/auth/register", json={
            "email": "regular@nearly.app",  # déjà existant
            "password": "password123",
            "first_name": "Doublon",
            "is_adult": True,
            "accepts_terms": True,
        })
        assert r.status_code == 409

    def test_invalid_email(self, client: TestClient):
        r = client.post("/api/v1/auth/register", json={
            "email": "pas-un-email",
            "password": "password123",
            "first_name": "Test",
            "is_adult": True,
            "accepts_terms": True,
        })
        assert r.status_code == 422

    def test_password_too_short(self, client: TestClient):
        r = client.post("/api/v1/auth/register", json={
            "email": "short@nearly.app",
            "password": "abc",
            "first_name": "Test",
            "is_adult": True,
            "accepts_terms": True,
        })
        assert r.status_code == 422

    def test_empty_first_name(self, client: TestClient):
        r = client.post("/api/v1/auth/register", json={
            "email": "empty@nearly.app",
            "password": "password123",
            "first_name": "   ",
            "is_adult": True,
            "accepts_terms": True,
        })
        assert r.status_code == 422


class TestLogin:
    def test_success(self, client: TestClient):
        r = client.post("/api/v1/auth/login", json={
            "email": "verified@nearly.app",
            "password": "password123",
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_wrong_password(self, client: TestClient):
        r = client.post("/api/v1/auth/login", json={
            "email": "verified@nearly.app",
            "password": "mauvais",
        })
        assert r.status_code == 401

    def test_unknown_email(self, client: TestClient):
        r = client.post("/api/v1/auth/login", json={
            "email": "inconnu@nearly.app",
            "password": "password123",
        })
        assert r.status_code == 401

    def test_banned_user_cannot_login(self, client: TestClient, admin_token: str):
        client.post("/api/v1/auth/register", json={
            "email": "tobebanned@nearly.app",
            "password": "password123",
            "first_name": "Banni",
            "is_adult": True,
            "accepts_terms": True,
        })
        users = client.get("/api/v1/admin/users?search=tobebanned", headers=auth(admin_token)).json()
        user_id = users[0]["id"]
        client.post(f"/api/v1/admin/users/{user_id}/ban", headers=auth(admin_token), json={})

        r = client.post("/api/v1/auth/login", json={
            "email": "tobebanned@nearly.app",
            "password": "password123",
        })
        assert r.status_code in (401, 403)


class TestRefresh:
    def test_success(self, client: TestClient):
        r = client.post("/api/v1/auth/login", json={
            "email": "other@nearly.app",
            "password": "password123",
        })
        refresh_token = r.json()["refresh_token"]
        # Effacer les cookies pour forcer l'utilisation du body
        client.cookies.clear()
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert "refresh_token" in r.json()

    def test_invalid_token(self, client: TestClient):
        # Cookies déjà effacés par la fixture autouse clear_cookies
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": "invalid.token.here"})
        assert r.status_code == 401

    def test_old_token_revoked_after_rotation(self, client: TestClient):
        """Vérifie que l'ancien refresh token n'est plus utilisable après rotation."""
        r = client.post("/api/v1/auth/login", json={
            "email": "other@nearly.app",
            "password": "password123",
        })
        old_refresh = r.json()["refresh_token"]

        # Premier refresh → invalide l'ancien token
        client.cookies.clear()
        client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})

        # Deuxième refresh avec l'ancien token → doit échouer
        client.cookies.clear()
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
        assert r.status_code == 401


class TestLogout:
    def test_success(self, client: TestClient):
        r = client.post("/api/v1/auth/login", json={
            "email": "other@nearly.app",
            "password": "password123",
        })
        tokens = r.json()
        access = tokens["access_token"]
        refresh = tokens["refresh_token"]

        r = client.post(
            "/api/v1/auth/logout",
            headers=auth(access),
            json={"refresh_token": refresh},
        )
        assert r.status_code == 200

        # L'access token blacklisté ne doit plus fonctionner
        client.cookies.clear()
        r = client.get("/api/v1/users/me", headers=auth(access))
        assert r.status_code == 401

    def test_without_token(self, client: TestClient):
        """Logout sans token — doit répondre OK sans planter."""
        r = client.post("/api/v1/auth/logout")
        assert r.status_code == 200


class TestRegisterValidation:
    def test_missing_is_adult(self, client: TestClient):
        r = client.post("/api/v1/auth/register", json={
            "email": "noadult@nearly.app",
            "password": "password123",
            "first_name": "Test",
            "accepts_terms": True,
        })
        assert r.status_code == 422

    def test_is_adult_false_rejected(self, client: TestClient):
        r = client.post("/api/v1/auth/register", json={
            "email": "minor@nearly.app",
            "password": "password123",
            "first_name": "Test",
            "is_adult": False,
            "accepts_terms": True,
        })
        assert r.status_code == 422

    def test_accepts_terms_false_rejected(self, client: TestClient):
        r = client.post("/api/v1/auth/register", json={
            "email": "noterms@nearly.app",
            "password": "password123",
            "first_name": "Test",
            "is_adult": True,
            "accepts_terms": False,
        })
        assert r.status_code == 422


class TestForgotResetPassword:
    def test_forgot_password_existing_email(self, client: TestClient):
        r = client.post("/api/v1/auth/forgot-password", json={
            "email": "verified@nearly.app",
        })
        assert r.status_code == 200
        assert "Si cette adresse existe" in r.json()["message"]

    def test_forgot_password_unknown_email(self, client: TestClient):
        r = client.post("/api/v1/auth/forgot-password", json={
            "email": "nexistepas@nearly.app",
        })
        assert r.status_code == 200
        assert "Si cette adresse existe" in r.json()["message"]

    def test_reset_password_invalid_token(self, client: TestClient):
        r = client.post("/api/v1/auth/reset-password", json={
            "token": "invalid-token-xxx",
            "new_password": "newpassword123",
        })
        assert r.status_code == 400

    def test_reset_password_too_short(self, client: TestClient):
        r = client.post("/api/v1/auth/reset-password", json={
            "token": "some-token",
            "new_password": "abc",
        })
        assert r.status_code == 422


class TestChangePassword:
    def test_change_password_success(self, client: TestClient):
        client.post("/api/v1/auth/register", json={
            "email": "changepw@nearly.app",
            "password": "oldpassword1",
            "first_name": "ChangePW",
            "is_adult": True,
            "accepts_terms": True,
        })
        r = client.post("/api/v1/auth/login", json={
            "email": "changepw@nearly.app", "password": "oldpassword1",
        })
        token = r.json()["access_token"]

        r = client.post("/api/v1/auth/change-password",
                        headers=auth(token),
                        json={"current_password": "oldpassword1", "new_password": "newpassword1"})
        assert r.status_code == 200

        # Relogin avec le nouveau mot de passe
        r = client.post("/api/v1/auth/login", json={
            "email": "changepw@nearly.app", "password": "newpassword1",
        })
        assert r.status_code == 200

    def test_change_password_wrong_current(self, client: TestClient, verified_token: str):
        r = client.post("/api/v1/auth/change-password",
                        headers=auth(verified_token),
                        json={"current_password": "wrongpassword", "new_password": "newpassword1"})
        assert r.status_code == 401

    def test_change_password_too_short(self, client: TestClient, verified_token: str):
        r = client.post("/api/v1/auth/change-password",
                        headers=auth(verified_token),
                        json={"current_password": "password123", "new_password": "ab"})
        assert r.status_code == 422


class TestProtectedRoute:
    def test_no_token_returns_401(self, client: TestClient):
        # Cookies déjà effacés par clear_cookies fixture
        r = client.get("/api/v1/users/me")
        assert r.status_code in (401, 403)

    def test_invalid_token_returns_401(self, client: TestClient):
        r = client.get("/api/v1/users/me", headers=auth("invalid.token"))
        assert r.status_code == 401
