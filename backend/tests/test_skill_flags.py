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


def _auth(user="u1"):
    return {"Authorization": f"Bearer {create_test_token({'sub': user})}"}


def test_flag_requires_auth(fake_sb):
    client = TestClient(app)
    r = client.post(
        "/skills/66666666-aaaa-4aaa-8aaa-666666666666/flag", json={"reason": "langkah berbahaya"}
    )
    assert r.status_code == 401


def test_flag_inserts_and_reports_count(fake_sb):
    fake_sb.table("skills").insert(
        {"id": "66666666-aaaa-4aaa-8aaa-666666666666", "title": "Vas", "status": "approved"}
    )
    client = TestClient(app)
    r = client.post(
        "/skills/66666666-aaaa-4aaa-8aaa-666666666666/flag",
        json={"reason": "langkah berbahaya"},
        headers=_auth(),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["flag_count"] == 1
    assert body["status"] == "approved"
    assert fake_sb.table("skill_flags").inserted[0]["reason"] == "langkah berbahaya"


def test_third_flag_triggers_needs_revision(fake_sb):
    fake_sb.table("skills").insert(
        {"id": "66666666-aaaa-4aaa-8aaa-666666666666", "title": "Vas", "status": "approved"}
    )
    fake_sb.table("skill_flags").insert(
        [
            {"skill_id": "66666666-aaaa-4aaa-8aaa-666666666666", "user_id": "u1", "reason": "aaaa"},
            {"skill_id": "66666666-aaaa-4aaa-8aaa-666666666666", "user_id": "u2", "reason": "bbbb"},
        ]
    )
    client = TestClient(app)
    r = client.post(
        "/skills/66666666-aaaa-4aaa-8aaa-666666666666/flag",
        json={"reason": "cccc"},
        headers=_auth("u3"),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["flag_count"] == 3
    assert body["status"] == "needs_revision"
    assert {"status": "needs_revision"} in fake_sb.table("skills").updated


def test_flag_unknown_skill_404(fake_sb):
    client = TestClient(app)
    r = client.post("/skills/nope/flag", json={"reason": "xxx"}, headers=_auth())
    assert r.status_code == 404
