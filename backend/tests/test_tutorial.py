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
            "id": "t1",
            "title": "Pot Gantung",
            "description": "Pot dari kaleng.",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "Cuci kaleng"}],
            "tools": [{"name": "gunting"}],
            "additional_materials": [
                {"name": "tali", "category": "tali", "est_cost_idr": 3000, "purpose": "gantungan"}
            ],
        }
    )
    r = client.get("/tutorial/t1")
    assert r.status_code == 200
    body = r.json()
    assert body["additional_materials"][0]["name"] == "tali"
    assert "materials" not in body
