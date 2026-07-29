import pytest
from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def test_log_impact_anonymous(fake_sb):
    client = TestClient(app)
    r = client.post(
        "/impact",
        json={"material": "plastik_pet", "waste_kg": 0.5, "est_value_idr": 15000},
    )
    assert r.status_code == 201
    inserted = fake_sb.table("impact_events").inserted
    assert len(inserted) == 1
    assert inserted[0]["material"] == "plastik_pet"
    assert inserted[0]["user_id"] is None


def test_log_impact_rejects_bad_material(fake_sb):
    client = TestClient(app)
    r = client.post("/impact", json={"material": "styrofoam", "waste_kg": 1, "est_value_idr": 0})
    assert r.status_code == 422


def test_summary_requires_auth(fake_sb):
    client = TestClient(app)
    r = client.get("/impact/summary")
    assert r.status_code == 401


def test_summary_aggregates_user_rows(fake_sb):
    fake_sb.table("impact_events").insert(
        [
            {"user_id": "u1", "material": "kaca", "waste_kg": 1.5, "est_value_idr": 20000},
            {"user_id": "u1", "material": "kardus", "waste_kg": 0.5, "est_value_idr": 5000},
        ]
    )
    token = create_test_token({"sub": "u1"})
    client = TestClient(app)
    r = client.get("/impact/summary", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["total_projects"] == 2
    assert body["total_waste_kg"] == 2.0
    assert body["total_value_idr"] == 25000
