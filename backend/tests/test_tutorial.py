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


def test_tutorial_returns_additional_materials(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "99999999-aaaa-4aaa-8aaa-999999999999",
            "title": "Pot Gantung",
            "description": "Pot dari kaleng.",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "Cuci kaleng"}],
            "tools": [
                {
                    "name": "gunting",
                    "optional": False,
                    "description": "memotong kaleng sesuai pola",
                }
            ],
            "additional_materials": [
                {"name": "tali", "category": "tali", "est_cost_idr": 3000, "purpose": "gantungan"}
            ],
        }
    )
    r = client.get("/tutorial/99999999-aaaa-4aaa-8aaa-999999999999")
    assert r.status_code == 200
    body = r.json()
    assert body["additional_materials"][0]["name"] == "tali"
    assert body["tools"][0]["description"] == "memotong kaleng sesuai pola"
    assert "materials" not in body


def test_tutorial_enriches_legacy_tool_description_from_steps(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "88888888-aaaa-4aaa-8aaa-888888888888",
            "title": "Lampion Kaleng",
            "description": "Lampion sederhana dari kaleng bekas.",
            "difficulty": "pemula",
            "steps": [
                {
                    "order": 1,
                    "instruction": "Lubangi pola secara perlahan memakai paku dan palu kecil",
                }
            ],
            "tools": [{"name": "Palu kecil", "optional": False}],
            "additional_materials": [],
        }
    )

    response = client.get("/tutorial/88888888-aaaa-4aaa-8aaa-888888888888")

    assert response.status_code == 200
    assert response.json()["tools"][0]["description"] == (
        "Digunakan pada langkah 1: Lubangi pola secara perlahan memakai paku dan palu kecil"
    )
