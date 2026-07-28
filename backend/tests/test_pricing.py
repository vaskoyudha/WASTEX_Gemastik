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


def test_calculate_pricing(fake_sb):
    """Pricing endpoint should 404 for unknown skill."""
    response = client.get("/pricing/some-skill-id")
    assert response.status_code == 404
