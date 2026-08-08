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


def test_get_products_includes_suggested_price(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "99999999-aaaa-4aaa-8aaa-999999999999",
            "title": "Vas PET",
            "material": "plastik_pet",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "x"}],
            "est_cost_idr": 8000,
            "est_price_idr": 25000,
            "status": "approved",
        }
    )
    response = client.get("/products")
    assert response.status_code == 200
    rows = response.json()
    assert rows
    row = rows[0]
    assert row["suggested_price"] == 25000
    assert row["total_cost"] > 0
