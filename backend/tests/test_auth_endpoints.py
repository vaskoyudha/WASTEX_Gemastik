from uuid import uuid4

from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase


def test_register_success():
    """Valid register should create user + profile and return JWT."""
    from app.api.auth import get_auth_supabase

    # Clear cache AND set up dependency override for our wrapper
    get_supabase.cache_clear()

    client = TestClient(app)
    fake = FakeSupabase()
    # Access tables to ensure they're initialized
    _ = fake.table("profiles")
    _ = fake.table("auth.users")

    # We don't pre-populate - the register endpoint will call insert
    app.dependency_overrides[get_auth_supabase] = lambda: fake

    response = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "password": "password123",
            "display_name": "Test User",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user_id"] is not None
    assert data["profile"]["display_name"] == "Test User"


def test_login_success():
    """Valid login should return JWT + profile."""
    from app.api.auth import get_auth_supabase

    get_supabase.cache_clear()

    client = TestClient(app)
    fake = FakeSupabase()
    _ = fake.table("profiles")

    user_id = str(uuid4())
    profile_id = str(uuid4())

    fake.tables["profiles"].rows.append(
        {
            "id": profile_id,
            "auth_user_id": user_id,
            "display_name": "Test User",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
    )
    app.dependency_overrides[get_auth_supabase] = lambda: fake

    response = client.post(
        "/auth/login",
        json={
            "email": "test@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["profile"]["display_name"] == "Test User"


def test_me_requires_auth(client):
    """Unauthenticated /me should return 401."""
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_returns_profile(client):
    """Authenticated /me should return profile."""
    from app.api.auth import get_auth_supabase

    get_supabase.cache_clear()

    token = create_test_token({"sub": str(uuid4()), "email": "test@example.com"})
    fake = FakeSupabase()
    _ = fake.table("profiles")

    user_id = str(uuid4())
    profile_id = str(uuid4())

    fake.tables["profiles"].rows.append(
        {
            "id": profile_id,
            "auth_user_id": user_id,
            "display_name": "Test User",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
    )
    app.dependency_overrides[get_auth_supabase] = lambda: fake

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["display_name"] == "Test User"
