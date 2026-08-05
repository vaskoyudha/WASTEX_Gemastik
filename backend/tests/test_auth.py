import jwt
from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.main import app
from tests.fakes import FakeSupabase


def test_get_current_user_valid_token():
    """Valid JWT should return user dict."""
    client = TestClient(app)
    token = create_test_token({"sub": "user-123"})
    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["user_id"] == "user-123"


def test_get_current_user_invalid_token():
    """Invalid JWT should return 401."""
    client = TestClient(app)
    response = client.get("/me", headers={"Authorization": "Bearer invalid-token"})
    assert response.status_code == 401


def test_get_current_user_no_token():
    """Missing token should return 401."""
    client = TestClient(app)
    response = client.get("/me")
    assert response.status_code == 401


def test_get_current_user_falls_back_to_supabase(monkeypatch):
    """Token not decodable with the local HS256 secret verifies via Supabase.

    Real Supabase access tokens are ES256; they cannot be decoded with the
    local HS256 secret, so get_current_user must fall back to Supabase's
    auth.get_user (which validates against Supabase's own keys).
    """
    fake = FakeSupabase()
    monkeypatch.setattr("app.deps.get_supabase", lambda: fake)

    user_id = "supabase-user-456"
    token = jwt.encode(
        {"sub": user_id, "email": "es256@example.com"},
        "a-different-secret",
        algorithm="HS256",
    )
    client = TestClient(app)
    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["user_id"] == user_id
