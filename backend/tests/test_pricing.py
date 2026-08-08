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
    # heuristic: material 800, labor 2 steps * 0.15h * 15000 = 4500
    assert body["material_cost"] == 800
    assert body["labor_cost"] == 4500
    assert body["suggested_price"] % 1000 == 0
    assert body["suggested_price"] >= body["total_cost"]


def test_pricing_unknown_skill_404(fake_sb):
    client = TestClient(app)
    r = client.get("/pricing/nope")
    assert r.status_code == 404


def test_pricing_never_returns_negative_margin(fake_sb):
    # est_price rendah (10000) < total_cost (material 500 + labor 5*0.15*10000=7500)
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
    # est_price 10000 > total_cost 8000 -> tidak kena floor, harga tetap 10000
    assert body["profit_margin"] >= 0
    assert body["suggested_price"] == 10000
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
    assert body["labor_cost"] == 9000
    assert body["total_cost"] == 30800
    # est_price 45000 di atas plafon kaleng pemula (40000) -> dipatok ke plafon
    assert body["suggested_price"] == 40000
    assert body["profit_margin"] == 0.3


def test_pricing_floor_is_break_even_not_forced_margin(fake_sb):
    # Regresi: est_price LLM (15000) < total_cost (mahir 7 step x 0.15h x 20000
    # = 21000 + material 500 = 21500). Dulu floor memaksa harga = biaya * 1.4
    # = 30100, yang terlihat "kemahalan" untuk kerajinan botol PET. Sekarang
    # floor hanya menaikkan ke titik impas (break-even) 22000.
    fake_sb.table("skills").insert(
        {
            "id": "77777777-aaaa-4aaa-8aaa-777777777777",
            "title": "Organizer Modular Botol PET",
            "material": "plastik_pet",
            "difficulty": "mahir",
            "steps": [{"order": i, "instruction": "x"} for i in range(1, 8)],
            "est_cost_idr": 0,
            "est_price_idr": 15000,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/77777777-aaaa-4aaa-8aaa-777777777777")
    assert r.status_code == 200
    body = r.json()
    assert body["labor_cost"] == 21000
    assert body["total_cost"] == 21500
    assert body["suggested_price"] == 22000
    assert body["profit_margin"] == 0


def test_pricing_ceiling_clamps_margin_at_break_even(fake_sb):
    # Regresi: ceiling (plafon) menekan harga jual di bawah biaya untuk
    # kerajinan padat tenaga kerja. Mahir kaca 20 langkah: labor 20 x 0.15h x
    # 20000 = 60000 + material 800 = 60800, plafon kaca mahir = 50000 + 10000
    # = 60000. Margin harus dipatok ke 0 (break-even), bukan negatif.
    fake_sb.table("skills").insert(
        {
            "id": "99999999-aaaa-4aaa-8aaa-999999999999",
            "title": "Lampu Kaca Bekas",
            "material": "kaca",
            "difficulty": "mahir",
            "steps": [{"order": i, "instruction": "x"} for i in range(1, 21)],
            "est_cost_idr": 0,
            "est_price_idr": 100000,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/99999999-aaaa-4aaa-8aaa-999999999999")
    assert r.status_code == 200
    body = r.json()
    assert body["labor_cost"] == 60000
    assert body["total_cost"] == 60800
    # est_price 100000 di atas plafon kaca mahir (60000) -> dipatok ke plafon
    assert body["suggested_price"] == 60000
    assert body["profit_margin"] == 0


def test_compute_pricing_pure_function():
    from app.api.pricing import compute_pricing

    skill = {
        "id": "88888888-aaaa-4aaa-8aaa-888888888888",
        "title": "Organizer PET",
        "material": "plastik_pet",
        "difficulty": "mahir",
        "steps": [{"order": i, "instruction": "x"} for i in range(1, 8)],
        "est_cost_idr": 0,
        "est_price_idr": 15000,
        "additional_materials": [],
        "additional_materials_cost_idr": 0,
    }
    out = compute_pricing(skill)
    assert out["skill_id"] == "88888888-aaaa-4aaa-8aaa-888888888888"
    assert out["labor_cost"] == 21000
    assert out["total_cost"] == 21500
    assert out["suggested_price"] == 22000
    assert out["profit_margin"] == 0
    assert out["currency"] == "IDR"
