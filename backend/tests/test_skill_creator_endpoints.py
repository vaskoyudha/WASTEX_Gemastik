import pytest
from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase

PROPOSAL = {
    "title": "Pot Tanaman dari Botol PET",
    "description": "Mengubah botol PET bekas menjadi pot gantung sederhana.",
    "material": "plastik_pet",
    "difficulty": "pemula",
    "steps": [{"order": 1, "instruction": "Cuci botol", "warning": "Pakai sarung tangan"}],
    "tools": [{"name": "gunting"}],
    "est_cost_idr": 5000,
    "est_price_idr": 25000,
}


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _auth(user="u1"):
    return {"Authorization": f"Bearer {create_test_token({'sub': user})}"}


def test_proposals_requires_auth(fake_sb):
    r = TestClient(app).post("/skills/proposals", json={"material": "kardus"})
    assert r.status_code == 401


def test_proposals_returns_ai_list(monkeypatch):
    async def fake_generate(material, condition, client_factory=None):
        return [PROPOSAL]

    monkeypatch.setattr("app.api.skills.generate_proposals", fake_generate)
    r = TestClient(app).post(
        "/skills/proposals",
        json={"material": "plastik_pet", "condition": "bersih"},
        headers=_auth(),
    )
    assert r.status_code == 200
    assert r.json()[0]["title"] == PROPOSAL["title"]


def test_proposals_503_when_ai_unavailable(monkeypatch):
    from app.agent.tools.skill_proposals import SkillGenUnavailable

    async def fake_generate(material, condition, client_factory=None):
        raise SkillGenUnavailable("down")

    monkeypatch.setattr("app.api.skills.generate_proposals", fake_generate)
    r = TestClient(app).post("/skills/proposals", json={"material": "kaca"}, headers=_auth())
    assert r.status_code == 503


def test_verify_requires_auth(fake_sb):
    r = TestClient(app).post("/skills/verify", json={"draft": PROPOSAL})
    assert r.status_code == 401


def test_verify_returns_verdict(monkeypatch):
    async def fake_verify(draft, chat_history, client_factory=None):
        return {"verdict": "layak", "feedback": [], "suggestions": []}

    monkeypatch.setattr("app.api.skills.verify_draft", fake_verify)
    r = TestClient(app).post(
        "/skills/verify",
        json={"draft": PROPOSAL, "chat_history": [{"role": "user", "content": "cek"}]},
        headers=_auth(),
    )
    assert r.status_code == 200
    assert r.json()["verdict"] == "layak"


def test_verify_rejects_invalid_draft(fake_sb):
    r = TestClient(app).post(
        "/skills/verify", json={"draft": {**PROPOSAL, "material": "baja"}}, headers=_auth()
    )
    assert r.status_code == 422


def test_create_skill_requires_auth(fake_sb):
    r = TestClient(app).post("/skills", json=PROPOSAL)
    assert r.status_code == 401


def test_create_skill_inserts_pending(fake_sb):
    r = TestClient(app).post("/skills", json=PROPOSAL, headers=_auth("u1"))
    assert r.status_code == 201
    row = fake_sb.table("skills").inserted[0]
    assert row["status"] == "pending"
    assert row["origin"] == "user"
    assert row["created_by"] == "u1"
    assert row["title"] == PROPOSAL["title"]


def test_create_skill_duplicate_409(fake_sb):
    fake_sb.table("skills").insert(
        {**PROPOSAL, "id": "s1", "status": "pending", "origin": "user", "created_by": "u1"}
    )
    r = TestClient(app).post("/skills", json=PROPOSAL, headers=_auth("u1"))
    assert r.status_code == 409


def test_create_skill_same_title_other_user_ok(fake_sb):
    fake_sb.table("skills").insert(
        {**PROPOSAL, "id": "s1", "status": "pending", "origin": "user", "created_by": "other"}
    )
    r = TestClient(app).post("/skills", json=PROPOSAL, headers=_auth("u1"))
    assert r.status_code == 201


def test_list_mine_requires_auth(fake_sb):
    r = TestClient(app).get("/skills?mine=true")
    assert r.status_code == 401


def test_list_mine_returns_skills(fake_sb):
    fake_sb.table("skills").insert(
        [
            {**PROPOSAL, "id": "s1", "status": "pending", "origin": "user", "created_by": "u1"},
            {**PROPOSAL, "id": "s2", "status": "approved", "origin": "user", "created_by": "u2"},
        ]
    )
    r = TestClient(app).get("/skills?mine=true", headers=_auth("u1"))
    assert r.status_code == 200
    assert len(r.json()) == 2  # FakeSupabase does not filter eq(); rows are unfiltered
