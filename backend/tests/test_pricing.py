import pytest
from fastapi.testclient import TestClient

from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def test_pricing_prefers_curated_values(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "s1",
            "title": "Vas Botol",
            "material": "plastik_pet",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "x"}],
            "est_cost_idr": 8000,
            "est_price_idr": 25000,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/s1")
    assert r.status_code == 200
    body = r.json()
    assert body["material_cost"] == 8000
    assert body["suggested_price"] == 25000
    assert body["total_cost"] == body["material_cost"] + body["labor_cost"]
    assert body["currency"] == "IDR"


def test_pricing_heuristic_fallback(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "s2",
            "title": "Celengan Kaleng",
            "material": "kaleng",
            "difficulty": "menengah",
            "steps": [{"order": 1, "instruction": "a"}, {"order": 2, "instruction": "b"}],
            "est_cost_idr": None,
            "est_price_idr": None,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/s2")
    assert r.status_code == 200
    body = r.json()
    # heuristic: material 800, labor 2 steps * 0.5h * 25000 = 25000
    assert body["material_cost"] == 800
    assert body["labor_cost"] == 25000
    assert body["suggested_price"] % 1000 == 0
    assert body["suggested_price"] >= body["total_cost"]


def test_pricing_unknown_skill_404(fake_sb):
    client = TestClient(app)
    r = client.get("/pricing/nope")
    assert r.status_code == 404
