from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.main import app


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
