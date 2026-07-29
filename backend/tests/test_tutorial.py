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


def test_get_tutorial_not_found(fake_sb):
    """Tutorial endpoint should return 404 when skill has no tutorial."""
    response = client.get("/tutorial/nonexistent-id")
    assert response.status_code == 404
