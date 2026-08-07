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
            "id": "11111111-aaaa-4aaa-8aaa-111111111111",
            "title": "Vas Botol",
            "material": "plastik_pet",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "x"}],
            "est_cost_idr": 8000,
            "est_price_idr": 25000,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/11111111-aaaa-4aaa-8aaa-111111111111")
    assert r.status_code == 200
    body = r.json()
    assert body["material_cost"] == 500
    assert body["suggested_price"] == 25000
    assert body["total_cost"] == body["material_cost"] + body["labor_cost"]
    assert body["currency"] == "IDR"


def test_pricing_heuristic_fallback(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "22222222-aaaa-4aaa-8aaa-222222222222",
            "title": "Celengan Kaleng",
            "material": "kaleng",
            "difficulty": "menengah",
            "steps": [{"order": 1, "instruction": "a"}, {"order": 2, "instruction": "b"}],
            "est_cost_idr": None,
            "est_price_idr": None,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/22222222-aaaa-4aaa-8aaa-222222222222")
    assert r.status_code == 200
    body = r.json()
    # heuristic: material 800, labor 2 steps * 0.25h * 25000 = 12500
    assert body["material_cost"] == 800
    assert body["labor_cost"] == 12500
    assert body["suggested_price"] % 1000 == 0
    assert body["suggested_price"] >= body["total_cost"]


def test_pricing_unknown_skill_404(fake_sb):
    client = TestClient(app)
    r = client.get("/pricing/nope")
    assert r.status_code == 404


def test_pricing_never_returns_negative_margin(fake_sb):
    # est_price rendah (10000) < total_cost (material 500 + labor 5*0.25*15000=18750)
    fake_sb.table("skills").insert(
        {
            "id": "33333333-aaaa-4aaa-8aaa-333333333333",
            "title": "Hidropot",
            "material": "plastik_pet",
            "difficulty": "pemula",
            "steps": [{"order": i, "instruction": "x"} for i in range(1, 6)],
            "est_cost_idr": 8000,
            "est_price_idr": 10000,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/33333333-aaaa-4aaa-8aaa-333333333333")
    assert r.status_code == 200
    body = r.json()
    assert body["profit_margin"] >= 0
    assert body["suggested_price"] >= body["total_cost"]


def test_pricing_includes_additional_materials(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "44444444-aaaa-4aaa-8aaa-444444444444",
            "title": "Pot Gantung",
            "material": "kaleng",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "x"}],
            "est_cost_idr": 800,
            "est_price_idr": None,
            "additional_materials": [
                {"name": "tali", "category": "tali", "est_cost_idr": 3000, "purpose": "gantungan"}
            ],
            "additional_materials_cost_idr": 3000,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/44444444-aaaa-4aaa-8aaa-444444444444")
    assert r.status_code == 200
    body = r.json()
    assert body["additional_materials_cost"] == 3000
    assert body["additional_materials"][0]["name"] == "tali"
    assert body["total_cost"] == body["material_cost"] + body["labor_cost"] + 3000


def test_pricing_falls_back_to_item_sum_when_stored_zero(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "55555555-aaaa-4aaa-8aaa-555555555555",
            "title": "Pot Gantung Legacy",
            "material": "kaleng",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "x"}],
            "est_cost_idr": 800,
            "est_price_idr": None,
            "additional_materials": [
                {"name": "tali", "category": "tali", "est_cost_idr": 3000, "purpose": "gantungan"},
                {"name": "cat", "category": "cat", "est_cost_idr": 2000, "purpose": "finishing"},
            ],
            "additional_materials_cost_idr": 0,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/55555555-aaaa-4aaa-8aaa-555555555555")
    assert r.status_code == 200
    body = r.json()
    assert body["additional_materials_cost"] == 5000


def test_pricing_does_not_double_count_llm_material_estimate(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "66666666-aaaa-4aaa-8aaa-666666666666",
            "title": "Pot Bunga Kaleng Bekas",
            "material": "kaleng",
            "difficulty": "pemula",
            "steps": [{"order": i, "instruction": "x"} for i in range(1, 7)],
            # Aggregate LLM estimate: cat + tanah + paku + bibit. This must not
            # also become the cost of the recycled can.
            "est_cost_idr": 21000,
            "est_price_idr": 45000,
            "additional_materials": [
                {"name": "cat", "est_cost_idr": 10000},
                {"name": "tanah", "est_cost_idr": 5000},
                {"name": "paku", "est_cost_idr": 1000},
                {"name": "bibit", "est_cost_idr": 5000},
            ],
            "additional_materials_cost_idr": 21000,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/66666666-aaaa-4aaa-8aaa-666666666666")
    assert r.status_code == 200
    body = r.json()
    assert body["material_cost"] == 800
    assert body["additional_materials_cost"] == 21000
    assert body["labor_cost"] == 22500
    assert body["total_cost"] == 44300
    assert body["suggested_price"] == 45000
    assert body["profit_margin"] == 0.02
