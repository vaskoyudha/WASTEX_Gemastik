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

IDEA = {
    "title": "Pot Tanaman dari Botol PET",
    "description": "Mengubah botol PET bekas menjadi pot gantung sederhana.",
    "material": "plastik_pet",
    "difficulty": "pemula",
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


def test_proposals_returns_ai_ideas(monkeypatch):
    async def fake_ideas(material, condition, client_factory=None):
        return [IDEA]

    monkeypatch.setattr("app.api.skills.generate_ideas", fake_ideas)
    r = TestClient(app).post(
        "/skills/proposals",
        json={"material": "plastik_pet", "condition": "bersih"},
        headers=_auth(),
    )
    assert r.status_code == 200
    body = r.json()[0]
    assert body["title"] == IDEA["title"]
    assert "steps" not in body  # fase 1: ide ringkas tanpa langkah detail


def test_proposals_503_when_ai_unavailable(monkeypatch):
    from app.agent.tools.skill_proposals import SkillGenUnavailable

    async def fake_ideas(material, condition, client_factory=None):
        raise SkillGenUnavailable("down")

    monkeypatch.setattr("app.api.skills.generate_ideas", fake_ideas)
    r = TestClient(app).post("/skills/proposals", json={"material": "kaca"}, headers=_auth())
    assert r.status_code == 503


def test_proposals_expand_requires_auth(fake_sb):
    r = TestClient(app).post("/skills/proposals/expand", json={"material": "kardus", "idea": IDEA})
    assert r.status_code == 401


def test_proposals_expand_returns_full_proposal(monkeypatch):
    async def fake_expand(material, condition, idea, client_factory=None):
        return PROPOSAL

    monkeypatch.setattr("app.api.skills.expand_proposal", fake_expand)
    r = TestClient(app).post(
        "/skills/proposals/expand",
        json={"material": "plastik_pet", "condition": "bersih", "idea": IDEA},
        headers=_auth(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == PROPOSAL["title"]
    assert "steps" in body  # fase 2: detail lengkap


def test_proposals_expand_503_when_ai_unavailable(monkeypatch):
    from app.agent.tools.skill_proposals import SkillGenUnavailable

    async def fake_expand(material, condition, idea, client_factory=None):
        raise SkillGenUnavailable("down")

    monkeypatch.setattr("app.api.skills.expand_proposal", fake_expand)
    r = TestClient(app).post(
        "/skills/proposals/expand",
        json={"material": "kardus", "condition": "bersih", "idea": IDEA},
        headers=_auth(),
    )
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


def test_verify_returns_auto_repaired_draft(monkeypatch):
    async def fake_verify(draft, chat_history, client_factory=None):
        from app.schemas import SkillProposal

        repaired = SkillProposal.model_validate(
            {
                **draft.model_dump(mode="json"),
                "steps": [
                    *draft.model_dump(mode="json")["steps"],
                    {"order": 2, "instruction": "Keringkan botol", "warning": None},
                ],
            }
        )
        return {
            "verdict": "layak",
            "feedback": [],
            "suggestions": [],
            "draft": repaired,
            "auto_repaired": True,
        }

    monkeypatch.setattr("app.api.skills.verify_draft", fake_verify)
    r = TestClient(app).post(
        "/skills/verify", json={"draft": PROPOSAL, "chat_history": []}, headers=_auth()
    )

    assert r.status_code == 200
    assert r.json()["auto_repaired"] is True
    assert len(r.json()["draft"]["steps"]) == 2


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


def test_create_skill_layak_auto_approves_and_schedules_background(monkeypatch, fake_sb):
    calls = []

    async def fake_ingest(sb, skill_id):
        calls.append(("ingest", skill_id))

    async def fake_visuals(sb, skill_id):
        calls.append(("visuals", skill_id))

    monkeypatch.setattr("app.api.skills.ingest_skill", fake_ingest)
    monkeypatch.setattr("app.api.skills.generate_all_visuals", fake_visuals)

    r = TestClient(app).post(
        "/skills", json={**PROPOSAL, "ai_verdict": "layak"}, headers=_auth("u1")
    )
    assert r.status_code == 201
    row = fake_sb.table("skills").inserted[0]
    assert row["status"] == "approved"
    assert row["reviewed_by"] == "ai-auto"
    skill_id = row["id"]
    assert ("ingest", skill_id) in calls
    assert ("visuals", skill_id) in calls


def test_create_skill_perbaiki_stays_pending(monkeypatch, fake_sb):
    async def fail_if_called(*a, **k):
        raise AssertionError("background task tidak boleh dijadwalkan untuk perbaiki")

    monkeypatch.setattr("app.api.skills.ingest_skill", fail_if_called)
    monkeypatch.setattr("app.api.skills.generate_all_visuals", fail_if_called)

    r = TestClient(app).post(
        "/skills", json={**PROPOSAL, "ai_verdict": "perbaiki"}, headers=_auth("u1")
    )
    assert r.status_code == 201
    row = fake_sb.table("skills").inserted[0]
    assert row["status"] == "pending"
    assert "reviewed_by" not in row


def test_create_skill_invalid_verdict_422(fake_sb):
    r = TestClient(app).post(
        "/skills", json={**PROPOSAL, "ai_verdict": "maybe"}, headers=_auth("u1")
    )
    assert r.status_code == 422
