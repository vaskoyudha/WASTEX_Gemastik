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


def test_get_products_empty(fake_sb):
    """Products endpoint should return empty list when no skills exist."""
    response = client.get("/products")
    assert response.status_code == 200
    assert response.json() == []


def test_get_product_by_id(fake_sb):
    """Should return 404 for non-existent product."""
    response = client.get("/products/nonexistent-id")
    assert response.status_code == 404
