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


def test_submit_feedback(fake_sb):
    client = TestClient(app)
    r = client.post(
        "/feedback",
        json={"rating": 4, "flag_inaccurate": False, "comment": "Langkahnya jelas"},
    )
    assert r.status_code == 201
    inserted = fake_sb.table("feedback").inserted
    assert inserted[0]["rating"] == 4
    assert inserted[0]["flag_inaccurate"] is False


def test_feedback_rating_bounds(fake_sb):
    client = TestClient(app)
    assert client.post("/feedback", json={"rating": 0}).status_code == 422
    assert client.post("/feedback", json={"rating": 6}).status_code == 422


def test_feedback_flag_inaccurate_defaults_false(fake_sb):
    client = TestClient(app)
    r = client.post("/feedback", json={"rating": 5})
    assert r.status_code == 201
    assert fake_sb.table("feedback").inserted[0]["flag_inaccurate"] is False
