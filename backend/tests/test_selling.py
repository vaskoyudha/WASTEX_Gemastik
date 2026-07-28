import pytest
from fastapi.testclient import TestClient

from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase

client = TestClient(app)


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def test_list_marketplace(fake_sb):
    """Marketplace should return available items."""
    response = client.get("/selling")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_listing_requires_auth(fake_sb):
    """Creating a listing requires authentication."""
    response = client.post("/selling", json={"skill_id": "some-id", "price": 50000})
    assert response.status_code == 401  # No auth header
