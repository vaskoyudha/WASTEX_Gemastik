# backend/tests/test_gates.py
import pytest
from fastapi.testclient import TestClient

import app.agent.tools.discovery as discovery_module
import app.api.recommend as recommend_module
import app.api.scan as scan_module
import app.api.skills as skills_module
from app.agent.tools.retrieval import RetrievedChunk
from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from app.schemas import (
    Material,
    MaterialIdentification,
    SafetyVerdict,
    SkillDraft,
    SolutionPackage,
)
from tests.fakes import FakeSupabase, FakeTable

client = TestClient(app)
SKILL_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
SERVICE_AUTH = {"Authorization": "Bearer test-service-key"}


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


class FakeAgentResult:
    def __init__(self, output):
        self.output = output


class FakeAgent:
    def __init__(self, output):
        self._output = output

    async def run(self, prompt):
        return FakeAgentResult(self._output)


def _vision(confidence: float):
    async def fake_scan(image_bytes, content_type="image/jpeg"):
        return MaterialIdentification(
            material=Material.kaca, condition="utuh", confidence=confidence
        )

    return fake_scan


# ---- Gate 1: vision confidence ----------------------------------------


def test_gate1_low_confidence_asks_manual_verification(fake_sb, monkeypatch):
    monkeypatch.setattr(scan_module, "scan_material", _vision(0.42))
    r = client.post("/scan", files={"file": ("a.jpg", b"x", "image/jpeg")})
    body = r.json()
    assert r.status_code == 200
    assert body["status"] == "needs_manual_verification"
    assert len(body["material_options"]) == 6


def test_gate1_high_confidence_identified(fake_sb, monkeypatch):
    monkeypatch.setattr(scan_module, "scan_material", _vision(0.91))
    r = client.post("/scan", files={"file": ("a.jpg", b"x", "image/jpeg")})
    body = r.json()
    assert body["status"] == "identified"
    assert body["identification"]["confidence"] == 0.91


def test_vision_total_failure_returns_503(fake_sb, monkeypatch):
    # Spec §5: total provider failure -> explicit error, never a degraded answer.
    async def broken(image_bytes, content_type="image/jpeg"):
        raise scan_module.VisionUnavailable("all providers failed")

    monkeypatch.setattr(scan_module, "scan_material", broken)
    r = client.post("/scan", files={"file": ("a.jpg", b"x", "image/jpeg")})
    assert r.status_code == 503
    assert fake_sb.table("scans").inserted == []


# ---- Gate 2: knowledge gap ---------------------------------------------


def test_gate2_no_results_fires_discovery_and_falls_back(fake_sb, monkeypatch):
    calls = []

    async def no_chunks(sb, query, material=None):
        return []

    async def record_discover(material, user_intent):
        calls.append((material, user_intent))

    monkeypatch.setattr(recommend_module, "search_skills", no_chunks)
    monkeypatch.setattr(recommend_module, "discover_skill", record_discover)
    r = client.post("/recommend", json={"material": "sachet", "user_intent": "dompet"})
    body = r.json()
    assert body["status"] == "generic_safe_procedure"
    assert "gap_detected" in body["gate_path"] and "fallback" in body["gate_path"]
    assert calls == [(Material.sachet, "dompet")]
    assert fake_sb.table("agent_runs").inserted  # gap runs are logged too


def test_gate2_low_rerank_score_falls_back(fake_sb, monkeypatch):
    weak = RetrievedChunk(
        chunk_id="c1", skill_id="s1", content="x", metadata={}, rrf_score=0.03, rerank_score=0.10
    )

    async def weak_chunks(sb, query, material=None):
        return [weak]

    async def record_discover(material, user_intent):
        pass

    monkeypatch.setattr(recommend_module, "search_skills", weak_chunks)
    monkeypatch.setattr(recommend_module, "discover_skill", record_discover)
    r = client.post("/recommend", json={"material": "kaca", "user_intent": "vas"})
    assert r.json()["status"] == "generic_safe_procedure"


def test_gate2_pass_returns_grounded(fake_sb, monkeypatch):
    strong = RetrievedChunk(
        chunk_id="c1",
        skill_id="s1",
        content="langkah",
        metadata={},
        rrf_score=0.03,
        rerank_score=0.92,
    )

    async def strong_chunks(sb, query, material=None):
        return [strong]

    async def fake_generate(query, chunks):
        return SolutionPackage(recommendation="Buat pot dari botol.", sources=["s1"])

    monkeypatch.setattr(recommend_module, "search_skills", strong_chunks)
    monkeypatch.setattr(recommend_module, "generate_solution", fake_generate)
    r = client.post("/recommend", json={"material": "plastik_pet", "user_intent": "pot"})
    body = r.json()
    assert body["status"] == "grounded"
    assert body["gate_path"] == ["vision_ok", "retrieval_ok", "generation_ok"]
    run = fake_sb.table("agent_runs").inserted[0]
    assert run["retrieved_chunk_ids"] == ["c1"]


# ---- Gate 3: discovery safety check ------------------------------------


async def test_gate3_unsafe_draft_rejected(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(discovery_module, "get_supabase", lambda: fake)
    monkeypatch.setattr(discovery_module, "load_sources", lambda: [{"id": "src-1"}])
    draft = SkillDraft(title="Lelehkan PVC", material=Material.plastik_pet, difficulty="pemula")
    monkeypatch.setattr(discovery_module, "_drafter", lambda: FakeAgent(draft))
    monkeypatch.setattr(
        discovery_module,
        "_safety_checker",
        lambda: FakeAgent(SafetyVerdict(safe=False, violations=["melting PVC"])),
    )
    await discovery_module.discover_skill(Material.plastik_pet, "vas bunga")
    inserted = fake.table("skills").inserted
    assert inserted[0]["status"] == "rejected"
    assert inserted[0]["origin"] == "discovered"


async def test_gate3_safe_draft_stored_as_draft(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(discovery_module, "get_supabase", lambda: fake)
    monkeypatch.setattr(discovery_module, "load_sources", lambda: [{"id": "src-1"}])
    draft = SkillDraft(title="Pot PET", material=Material.plastik_pet, difficulty="pemula")
    monkeypatch.setattr(discovery_module, "_drafter", lambda: FakeAgent(draft))
    monkeypatch.setattr(
        discovery_module, "_safety_checker", lambda: FakeAgent(SafetyVerdict(safe=True))
    )
    await discovery_module.discover_skill(Material.plastik_pet, "pot")
    assert fake.table("skills").inserted[0]["status"] == "draft"


async def test_gate3_empty_sources_skips_discovery(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(discovery_module, "get_supabase", lambda: fake)
    monkeypatch.setattr(discovery_module, "load_sources", list)
    await discovery_module.discover_skill(Material.kardus, "rak")
    assert fake.table("skills").inserted == []


# ---- Gate 4: approval unlocks retrieval ----------------------------------


def test_gate4_approve_triggers_ingest(fake_sb, monkeypatch):
    fake_sb.tables["skills"] = FakeTable([{"id": SKILL_ID, "status": "draft"}])
    ingested = []

    async def fake_ingest(sb, skill_id):
        ingested.append(str(skill_id))

    monkeypatch.setattr(skills_module, "ingest_skill", fake_ingest)
    r = client.patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=SERVICE_AUTH
    )
    assert r.status_code == 200
    assert ingested == [SKILL_ID]


def test_gate4_approve_triggers_eager_visual_generation(fake_sb, monkeypatch):
    fake_sb.tables["skills"] = FakeTable(
        [{"id": SKILL_ID, "status": "draft", "steps": [{"order": 1}]}]
    )
    ingested = []
    generated = []

    async def fake_ingest(sb, skill_id):
        ingested.append(str(skill_id))

    async def fake_visuals(sb, skill_id):
        generated.append(str(skill_id))

    monkeypatch.setattr(skills_module, "ingest_skill", fake_ingest)
    monkeypatch.setattr(skills_module, "generate_all_visuals", fake_visuals)
    r = client.patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=SERVICE_AUTH
    )
    assert r.status_code == 200
    assert generated == [SKILL_ID]


def test_gate4_rejection_does_not_ingest(fake_sb, monkeypatch):
    fake_sb.tables["skills"] = FakeTable([{"id": SKILL_ID, "status": "draft"}])
    ingested = []

    async def fake_ingest(sb, skill_id):
        ingested.append(str(skill_id))

    monkeypatch.setattr(skills_module, "ingest_skill", fake_ingest)
    r = client.patch(
        f"/skills/{SKILL_ID}/status", json={"status": "rejected"}, headers=SERVICE_AUTH
    )
    assert r.status_code == 200
    assert ingested == []


def test_gate4_requires_service_role(fake_sb):
    r = client.patch(
        f"/skills/{SKILL_ID}/status",
        json={"status": "approved"},
        headers={"Authorization": "Bearer wrong-key"},
    )
    assert r.status_code == 403


# ---- Gate 5: expert authorization gate ----------------------------------


def _token(sub):
    return {"Authorization": f"Bearer {create_test_token({'sub': sub})}"}


def _seed_skill(fake_sb, status="draft"):
    fake_sb.table("skills").insert({"id": SKILL_ID, "status": status, "title": "Vas"})
    fake_sb.table("profiles").insert(
        {"auth_user_id": "expert1", "display_name": "E", "role": "expert"}
    )


def test_gate5_patch_accepts_expert_jwt(fake_sb, monkeypatch):
    _seed_skill(fake_sb)
    ingested = []

    async def fake_ingest(sb, skill_id):
        ingested.append(str(skill_id))

    monkeypatch.setattr(skills_module, "ingest_skill", fake_ingest)
    r = client.patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=_token("expert1")
    )
    assert r.status_code == 200
    assert ingested == [SKILL_ID]


def test_gate5_patch_accepts_admin_jwt(fake_sb, monkeypatch):
    fake_sb.table("skills").insert({"id": SKILL_ID, "status": "draft", "title": "Vas"})
    fake_sb.table("profiles").insert(
        {"auth_user_id": "admin1", "display_name": "A", "role": "admin"}
    )
    ingested = []

    async def fake_ingest(sb, skill_id):
        ingested.append(str(skill_id))

    monkeypatch.setattr(skills_module, "ingest_skill", fake_ingest)
    r = client.patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=_token("admin1")
    )
    assert r.status_code == 200
    assert ingested == [SKILL_ID]


def test_gate5_patch_rejects_normal_user(fake_sb):
    _seed_skill(fake_sb)
    fake_sb.table("profiles").insert({"auth_user_id": "user1", "display_name": "U", "role": "user"})
    r = client.patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=_token("user1")
    )
    assert r.status_code == 403


def test_gate5_patch_rejects_user_without_profile(fake_sb):
    _seed_skill(fake_sb)
    r = client.patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=_token("nobody")
    )
    assert r.status_code == 403


def test_gate5_patch_service_key_still_works(fake_sb, monkeypatch):
    _seed_skill(fake_sb)

    async def fake_ingest(sb, skill_id):
        pass

    monkeypatch.setattr(skills_module, "ingest_skill", fake_ingest)
    r = client.patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=SERVICE_AUTH
    )
    assert r.status_code == 200


def test_gate5_patch_wrong_key_rejected(fake_sb):
    r = client.patch(
        f"/skills/{SKILL_ID}/status",
        json={"status": "approved"},
        headers={"Authorization": "Bearer wrong-key"},
    )
    assert r.status_code == 403
