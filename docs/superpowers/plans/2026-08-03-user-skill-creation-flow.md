# User Skill Creation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the skill lifecycle — logged-in users create upcycling skills from scan results via AI-generated proposals + chatbot-style AI verification, experts approve them in-app, and approved skills become retrievable and visualizable.

**Architecture:** Backend FastAPI gets a new AI tool module (`skill_proposals.py`, same pattern as `vision.py`: OpenRouter chat + `response_format: json_object` + retry/fallback model) and 3 new `/skills` endpoints. The `skills` table gains `pending` status, `origin='user'`, and `created_by`; `profiles` gains `role` for the new `require_expert_or_service` admin gate. Frontend gets a 3-stage skill creator screen with a chatbot-style verify popup, a verified-skills section on the scan result screen, and a real-API expert dashboard.

**Tech Stack:** FastAPI, pydantic v2, supabase-py (service role), OpenRouter (deepseek/gemini chat), Expo Router + React Native (TypeScript strict, NativeWind), jest-expo + pytest.

## Global Constraints

- Python 3.12, managed with `uv`; all backend commands run via `uv run` from `backend/` unless noted
- Ruff: line-length 100, `B008`/`BLE001` ignored — do not "fix" existing `Depends()` defaults or broad excepts
- pytest `asyncio_mode = "auto"` — async test functions need no decorator
- Backend tests must never hit real providers: use `FakeSupabase` (`backend/tests/fakes.py`), `create_test_token` (`app.auth`), `app.dependency_overrides`, and `monkeypatch` (see `backend/tests/test_skill_flags.py`, `test_gates.py:196`)
- `backend/tests/conftest.py` sets dummy env vars automatically; never require a real `.env`
- Frontend: `npm test` (jest-expo), `npx jest <path>` for one file; screens import `../../src/...` (relative, not `@/`)
- `metro.config.js` excludes `*.test.*` from bundling — never import test files from app code
- UI copy is Indonesian; statuses map: `pending`→"Menunggu", `approved`→"Disetujui", `rejected`→"Ditolak", `needs_revision`→"Perlu Revisi"
- Backend skills table `material` values: `plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet`; `difficulty`: `pemula|menengah|mahir`
- Service role key must NEVER appear in frontend code

---

## File Structure

**Backend (new):**
- `backend/supabase/migrations/20260803000001_user_skills.sql` — schema additions (Task 1)
- `backend/app/agent/tools/skill_proposals.py` — AI prompts + generation/verification (Tasks 3-4)
- `backend/tests/test_migrations_user_skills.py` (Task 1)
- `backend/tests/test_skill_creator_schemas.py` (Task 2)
- `backend/tests/test_skill_proposals.py` (Tasks 3-4)
- `backend/tests/test_expert_approval.py` (Task 5)
- `backend/tests/test_skill_creator_endpoints.py` (Tasks 6-7)

**Backend (modified):**
- `backend/app/schemas.py` — `SkillStatus.pending` + skill creator schemas (Tasks 1-2)
- `backend/app/config.py` — add `chat_fallback_model` (Task 4)
- `backend/app/deps.py` — add `require_expert_or_service` (Task 5)
- `backend/app/api/skills.py` — 3 new endpoints, `mine` param, PATCH gate (Tasks 5-7)
- `backend/eval/smoke_e2e.py` — new-endpoint smoke asserts (Task 14)

**Frontend (new):**
- `app/scan/skill-creator.tsx` — 3-stage skill creation screen (Tasks 9-10)
- `app/scan/skill-creator.test.tsx` (Tasks 9-10)
- `app/scan/hasil.test.tsx` (Task 11)
- `app/expert-dashboard.test.tsx` (Task 12)

**Frontend (modified):**
- `src/services/api.ts` — token-aware request + 4 new methods (Task 8)
- `src/services/types.ts` — `SkillProposal`, `ChatMessage`, `SkillVerifyResponse`, `SkillStatus` + `pending` (Task 8)
- `src/services/__tests__/api.test.ts` (Task 8)
- `app/scan/hasil.tsx` — "Buat Skill Baru" button + verified skills section (Task 11)
- `app/expert-dashboard.tsx` — real API wiring (Task 12)
- `app/(tabs)/profil.tsx` — "Skill Saya" list (Task 13)
- `app/(tabs)/profil.test.tsx` (Task 13)

---

### Task 1: Migration + `pending` status

**Files:**
- Create: `backend/supabase/migrations/20260803000001_user_skills.sql`
- Modify: `backend/app/schemas.py:24-28` (`SkillStatus`)
- Test: `backend/tests/test_migrations_user_skills.py`

**Interfaces:**
- Consumes: nothing
- Produces: `SkillStatus.pending` enum member (value `"pending"`); migration file content that Tasks 2+ rely on (columns `description`, `created_by` on `skills`; `role` on `profiles`)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_migrations_user_skills.py`:

```python
from pathlib import Path

from app.schemas import SkillStatus

SQL = (
    Path(__file__).parents[2]
    / "supabase"
    / "migrations"
    / "20260803000001_user_skills.sql"
)


def test_skill_status_has_pending():
    assert SkillStatus.pending.value == "pending"


def test_migration_adds_user_skill_columns():
    text = SQL.read_text()
    assert "created_by" in text
    assert "'pending'" in text
    assert "origin" in text
    assert "'user'" in text
    assert "description" in text
    assert "profiles" in text
    assert "role" in text
    assert "skills_created_by_idx" in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_migrations_user_skills.py -v` (from `backend/`)
Expected: FAIL — `SkillStatus` has no `pending`; migration file missing

- [ ] **Step 3: Implement**

In `backend/app/schemas.py`, replace the `SkillStatus` class (lines 24-28) with:

```python
class SkillStatus(str, Enum):
    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    needs_revision = "needs_revision"
```

Create `backend/supabase/migrations/20260803000001_user_skills.sql`:

```sql
-- User-submitted skill lifecycle (spec 2026-08-03)
alter table skills add column if not exists description text not null default '';
alter table skills add column if not exists created_by uuid references auth.users(id);

alter table skills drop constraint if exists skills_status_check;
alter table skills add constraint skills_status_check
  check (status in ('draft','pending','approved','rejected','needs_revision'));

alter table skills drop constraint if exists skills_origin_check;
alter table skills add constraint skills_origin_check
  check (origin in ('seed','discovered','user'));

create index if not exists skills_created_by_idx on skills (created_by);

alter table profiles add column if not exists role text not null default 'user';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_migrations_user_skills.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Run existing test suite**

Run: `uv run pytest tests/ -q`
Expected: all pass (no existing test asserts the old 4-value status enum)

- [ ] **Step 6: Commit**

```bash
git add backend/supabase/migrations/20260803000001_user_skills.sql backend/app/schemas.py backend/tests/test_migrations_user_skills.py
git commit -m "feat(db): add pending status and user skill columns"
```

---

### Task 2: Skill creator schemas

**Files:**
- Modify: `backend/app/schemas.py`
- Test: `backend/tests/test_skill_creator_schemas.py`

**Interfaces:**
- Consumes: existing `Material`, `Difficulty`, `Step`, `ToolItem` (already in `schemas.py`)
- Produces: `SkillProposal` (title, description, material, difficulty, steps, tools, est_cost_idr, est_price_idr), `SkillProposalRequest` (material, condition), `SkillVerifyRequest` (draft, chat_history), `SkillVerifyResponse` (verdict, feedback, suggestions), `SkillCreateRequest(SkillProposal)` — used by Tasks 3-7

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_skill_creator_schemas.py`:

```python
import pytest
from pydantic import ValidationError

from app.schemas import (
    Material,
    SkillCreateRequest,
    SkillProposal,
    SkillVerifyRequest,
    SkillVerifyResponse,
)

VALID = {
    "title": "Pot Tanaman dari Botol PET",
    "description": "Mengubah botol PET bekas menjadi pot gantung sederhana.",
    "material": "plastik_pet",
    "difficulty": "pemula",
    "steps": [{"order": 1, "instruction": "Cuci botol", "warning": "Gunakan sarung tangan"}],
    "tools": [{"name": "gunting", "optional": False}],
    "est_cost_idr": 5000,
    "est_price_idr": 25000,
}


def test_skill_proposal_accepts_valid_draft():
    p = SkillProposal.model_validate(VALID)
    assert p.material == Material.plastik_pet
    assert p.steps[0].warning == "Gunakan sarung tangan"


def test_skill_proposal_rejects_unknown_material():
    with pytest.raises(ValidationError):
        SkillProposal.model_validate({**VALID, "material": "baja"})


def test_skill_proposal_rejects_invalid_difficulty():
    with pytest.raises(ValidationError):
        SkillProposal.model_validate({**VALID, "difficulty": "sulit"})


def test_skill_verify_response_verdict_restricted():
    with pytest.raises(ValidationError):
        SkillVerifyResponse.model_validate({"verdict": "maybe"})


def test_skill_verify_response_defaults_empty_lists():
    r = SkillVerifyResponse.model_validate({"verdict": "layak"})
    assert r.feedback == []
    assert r.suggestions == []


def test_skill_verify_request_holds_draft_and_history():
    req = SkillVerifyRequest.model_validate(
        {"draft": VALID, "chat_history": [{"role": "user", "content": "tolong cek"}]}
    )
    assert req.draft.title == VALID["title"]
    assert req.chat_history[0]["role"] == "user"


def test_skill_create_request_inherits_proposal():
    req = SkillCreateRequest.model_validate(VALID)
    assert req.title == VALID["title"]
    assert req.material.value == "plastik_pet"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_skill_creator_schemas.py -v`
Expected: FAIL — ImportError on `SkillProposal`

- [ ] **Step 3: Implement**

Append to `backend/app/schemas.py` (after `SkillFlagIn`, end of file):

```python
class SkillProposal(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=2000)
    material: Material
    difficulty: Difficulty
    steps: list[Step] = []
    tools: list[ToolItem] = []
    est_cost_idr: int | None = None
    est_price_idr: int | None = None


class SkillProposalRequest(BaseModel):
    material: Material
    condition: str = ""


class SkillVerifyRequest(BaseModel):
    draft: SkillProposal
    chat_history: list[dict] = []


class SkillVerifyResponse(BaseModel):
    verdict: Literal["layak", "perbaiki"]
    feedback: list[str] = []
    suggestions: list[str] = []


class SkillCreateRequest(SkillProposal):
    pass
```

Note: `Literal` is already imported at the top of `schemas.py` (line 3).

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_skill_creator_schemas.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/tests/test_skill_creator_schemas.py
git commit -m "feat(schemas): add skill proposal and verification schemas"
```

---

### Task 3: AI prompts + pure parsing functions

**Files:**
- Create: `backend/app/agent/tools/skill_proposals.py`
- Test: `backend/tests/test_skill_proposals.py`

**Interfaces:**
- Consumes: `SkillProposal`, `SkillVerifyResponse` (Task 2)
- Produces: `SKILL_PROPOSAL_PROMPT`, `SKILL_VERIFY_PROMPT` (str constants), `_parse_proposals(payload: dict, expected_material: str) -> list[SkillProposal]`, `_parse_verdict(payload: dict) -> SkillVerifyResponse` — used by Task 4

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_skill_proposals.py`:

```python
import pytest
from pydantic import ValidationError

from app.agent.tools.skill_proposals import (
    SKILL_PROPOSAL_PROMPT,
    SKILL_VERIFY_PROMPT,
    _parse_proposals,
    _parse_verdict,
)

VALID_PROPOSAL = {
    "title": "Pot Gantung dari Botol PET",
    "description": "Botol PET dipotong dan dihias menjadi pot gantung.",
    "material": "plastik_pet",
    "difficulty": "pemula",
    "steps": [
        {"order": 1, "instruction": "Cuci botol hingga bersih", "warning": "Pakai sarung tangan"},
    ],
    "tools": [{"name": "gunting"}],
    "est_cost_idr": 5000,
    "est_price_idr": 20000,
}


def test_proposal_prompt_restricts_material():
    assert "HANYA" in SKILL_PROPOSAL_PROMPT
    assert "material" in SKILL_PROPOSAL_PROMPT
    assert "DILARANG" in SKILL_PROPOSAL_PROMPT


def test_proposal_prompt_lists_all_six_materials():
    for m in ("plastik_pet", "plastik_hdpe", "kardus", "kaleng", "kaca", "sachet"):
        assert m in SKILL_PROPOSAL_PROMPT


def test_proposal_prompt_has_steps_and_safety():
    assert "peringatan keamanan" in SKILL_PROPOSAL_PROMPT
    assert "steps" in SKILL_PROPOSAL_PROMPT


def test_verify_prompt_checks_four_aspects():
    for aspect in ("Kesesuaian material", "Kelayakan", "Keamanan", "Kelengkapan"):
        assert aspect in SKILL_VERIFY_PROMPT


def test_verify_prompt_has_layak_verdict():
    assert "layak" in SKILL_VERIFY_PROMPT


def test_parse_proposals_keeps_matching_material_only():
    payload = {
        "proposals": [
            VALID_PROPOSAL,
            {**VALID_PROPOSAL, "material": "kaca"},
        ]
    }
    result = _parse_proposals(payload, "plastik_pet")
    assert len(result) == 1
    assert result[0].title == "Pot Gantung dari Botol PET"


def test_parse_proposals_skips_invalid_items():
    payload = {"proposals": [VALID_PROPOSAL, {"title": "x", "material": "baja"}]}
    result = _parse_proposals(payload, "plastik_pet")
    assert len(result) == 1


def test_parse_proposals_empty_when_none():
    assert _parse_proposals({"proposals": []}, "kardus") == []


def test_parse_verdict_valid():
    r = _parse_verdict({"verdict": "perbaiki", "feedback": ["Tambah peringatan"], "suggestions": []})
    assert r.verdict == "perbaiki"


def test_parse_verdict_rejects_invalid():
    with pytest.raises(ValidationError):
        _parse_verdict({"verdict": "nope"})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_skill_proposals.py -v`
Expected: FAIL — ImportError (module does not exist)

- [ ] **Step 3: Implement**

Create `backend/app/agent/tools/skill_proposals.py`:

```python
import json

import httpx

from app.schemas import SkillProposal, SkillVerifyResponse

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SKILL_PROPOSAL_PROMPT = """Kamu adalah perancang kerajinan daur ulang (upcycling) yang teliti.
Buat 3 proposal skill yang BENAR-BENAR bisa dibuat dari material ini: {material}.

Aturan wajib:
- HANYA gunakan material yang diberikan (salah satu dari:
  plastik_pet, plastik_hdpe, kardus, kaleng, kaca, sachet).
- DILARANG menyarankan bahan utama dari luar daftar. Lem, cat, tali, atau pengait
  boleh disebut hanya sebagai pelengkap kecil.
- Jika material tidak cocok untuk ide apa pun, jawab dengan daftar proposals kosong.
- Setiap langkah wajib punya instruksi jelas dan peringatan keamanan bila ada risiko
  (tergores, terkena panas, zat berbahaya).
- Tingkat kesulitan hanya salah satu dari: pemula, menengah, mahir.
- Kondisi bahan: {condition}. Sesuaikan ide dengan kondisi tersebut.

Jawab HANYA dengan JSON valid berformat:
{"proposals": [{"title": "...", "description": "...",
  "material": "plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet",
  "difficulty": "pemula|menengah|mahir",
  "steps": [{"order": 1, "instruction": "...", "warning": "..."}],
  "tools": [{"name": "...", "optional": false}],
  "est_cost_idr": 5000, "est_price_idr": 25000}]}"""

SKILL_VERIFY_PROMPT = """Kamu adalah validator skill daur ulang yang ketat. Periksa draft skill berikut.

Periksa 4 aspek:
1. Kesesuaian material: apakah semua langkah memang hanya memakai material yang dinyatakan?
2. Kelayakan: apakah langkah-langkah masuk akal dan bisa benar-benar dikerjakan di rumah?
3. Keamanan: apakah ada langkah berbahaya tanpa peringatan yang cukup?
4. Kelengkapan: apakah urutan langkah lengkap dari awal sampai produk jadi?

Jawab HANYA dengan JSON valid berformat:
{"verdict": "layak" atau "perbaiki",
 "feedback": ["<satu kalimat per masalah>", "..."],
 "suggestions": ["<saran perbaikan spesifik>", "..."]}
Jika semua aspek lolos, verdict = "layak" dan feedback kosong."""


def _parse_proposals(payload: dict, expected_material: str) -> list[SkillProposal]:
    proposals = payload.get("proposals") or []
    result = []
    for item in proposals:
        try:
            proposal = SkillProposal.model_validate(item)
        except Exception:
            continue
        if proposal.material.value == expected_material:
            result.append(proposal)
    return result


def _parse_verdict(payload: dict) -> SkillVerifyResponse:
    return SkillVerifyResponse.model_validate(payload)


def _build_proposal_messages(material: str, condition: str) -> list[dict]:
    content = SKILL_PROPOSAL_PROMPT.format(material=material, condition=condition)
    return [{"role": "user", "content": content}]


def _build_verify_messages(draft: SkillProposal, chat_history: list[dict]) -> list[dict]:
    content = SKILL_VERIFY_PROMPT + "\n\nDraft skill:\n" + draft.model_dump_json(indent=2)
    return [{"role": "user", "content": content}, *chat_history]


async def _post_json(client: httpx.AsyncClient, messages: list[dict], model: str, api_key: str) -> dict:
    r = await client.post(
        OPENROUTER_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "response_format": {"type": "json_object"},
            "messages": messages,
        },
    )
    r.raise_for_status()
    return json.loads(r.json()["choices"][0]["message"]["content"])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_skill_proposals.py -v`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/tools/skill_proposals.py backend/tests/test_skill_proposals.py
git commit -m "feat(agent): add skill proposal and verification prompts"
```

---

### Task 4: AI generation with retry + fallback

**Files:**
- Modify: `backend/app/agent/tools/skill_proposals.py` (append async functions)
- Modify: `backend/app/config.py:15-17`
- Test: `backend/tests/test_skill_proposals.py` (append)

**Interfaces:**
- Consumes: `_build_proposal_messages`, `_build_verify_messages`, `_post_json`, `_parse_proposals`, `_parse_verdict` (Task 3); `get_settings().chat_model`, `get_settings().chat_fallback_model`
- Produces: `SkillGenUnavailable(Exception)`, `generate_proposals(material: str, condition: str, client_factory=httpx.AsyncClient) -> list[SkillProposal]`, `verify_draft(draft: SkillProposal, chat_history: list[dict], client_factory=httpx.AsyncClient) -> SkillVerifyResponse` — used by Tasks 6-7

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_skill_proposals.py`:

```python
import json

import pytest

from app.agent.tools.skill_proposals import (
    SkillGenUnavailable,
    generate_proposals,
    verify_draft,
)
from app.schemas import SkillProposal

VALID_PAYLOAD = {"proposals": [VALID_PROPOSAL]}
VERDICT_PAYLOAD = {"verdict": "layak", "feedback": [], "suggestions": []}


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return {"choices": [{"message": {"content": json.dumps(self._payload)}}]}


class FakeClient:
    def __init__(self, payload, failures=0):
        self._payload = payload
        self._failures = failures
        self.post_calls = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, headers, json):
        self.post_calls += 1
        if self.post_calls <= self._failures:
            raise RuntimeError("provider down")
        return FakeResponse(self._payload)


class FailingClient(FakeClient):
    async def post(self, url, headers, json):
        raise RuntimeError("provider down")


def _factory(payload, failures=0):
    client = FakeClient(payload, failures)
    return lambda **kw: client, client


async def test_generate_proposals_returns_parsed_list():
    make, _ = _factory(VALID_PAYLOAD)
    result = await generate_proposals("plastik_pet", "bersih", client_factory=make)
    assert len(result) == 1
    assert isinstance(result[0], SkillProposal)


async def test_generate_proposals_retries_then_falls_back():
    make, client = _factory(VALID_PAYLOAD, failures=3)
    result = await generate_proposals("plastik_pet", "bersih", client_factory=make)
    assert len(result) == 1
    assert client.post_calls == 4  # 2 retries on chat_model + 2 on fallback


async def test_generate_proposals_raises_when_all_fail():
    client = FailingClient(VALID_PAYLOAD)
    with pytest.raises(SkillGenUnavailable):
        await generate_proposals("plastik_pet", "bersih", client_factory=lambda **kw: client)


async def test_verify_draft_returns_verdict():
    draft = SkillProposal.model_validate(VALID_PROPOSAL)
    make, _ = _factory(VERDICT_PAYLOAD)
    result = await verify_draft(draft, [], client_factory=make)
    assert result.verdict == "layak"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_skill_proposals.py -v`
Expected: FAIL — ImportError on `SkillGenUnavailable` / `generate_proposals`

- [ ] **Step 3: Implement**

In `backend/app/config.py`, after line 17 (`vision_fallback_model`), add:

```python
    chat_fallback_model: str = "google/gemini-2.5-flash"
```

Append to `backend/app/agent/tools/skill_proposals.py`:

```python
class SkillGenUnavailable(Exception):
    pass


async def _call_until_success(messages, parse, client_factory):
    from app.config import get_settings

    settings = get_settings()
    last_err: Exception | None = None
    async with client_factory(timeout=120) as client:
        for model in (settings.chat_model, settings.chat_fallback_model):
            for _ in range(2):
                try:
                    payload = await _post_json(client, messages, model, settings.openrouter_api_key)
                    return parse(payload)
                except Exception as e:
                    last_err = e
    raise SkillGenUnavailable("all chat providers failed") from last_err


async def generate_proposals(material: str, condition: str, client_factory=httpx.AsyncClient) -> list[SkillProposal]:
    messages = _build_proposal_messages(material, condition)
    return await _call_until_success(messages, lambda p: _parse_proposals(p, material), client_factory)


async def verify_draft(
    draft: SkillProposal,
    chat_history: list[dict],
    client_factory=httpx.AsyncClient,
) -> SkillVerifyResponse:
    messages = _build_verify_messages(draft, chat_history)
    return await _call_until_success(messages, _parse_verdict, client_factory)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_skill_proposals.py -v`
Expected: PASS (15 tests)

- [ ] **Step 5: Run ruff**

Run: `uv run ruff check app/agent/tools/skill_proposals.py app/config.py`
Expected: no findings

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/tools/skill_proposals.py backend/app/config.py backend/tests/test_skill_proposals.py
git commit -m "feat(agent): generate and verify skills with retry and fallback"
```

---

### Task 5: Expert authorization gate

**Files:**
- Modify: `backend/app/deps.py`
- Modify: `backend/app/api/skills.py:57-75` (PATCH dependency)
- Test: `backend/tests/test_expert_approval.py`

**Interfaces:**
- Consumes: `get_current_user` (`app.auth`), `get_supabase`, `_bearer_token`, `get_settings` (deps.py)
- Produces: `require_expert_or_service(authorization: str = Header(default="")) -> None` — used by Task 7 and the PATCH endpoint

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_expert_approval.py`:

```python
import pytest
from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase

SKILL_ID = "11111111-1111-1111-1111-111111111111"
SERVICE_AUTH = {"Authorization": "Bearer test-service-key"}


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _token(sub):
    return {"Authorization": f"Bearer {create_test_token({'sub': sub})}"}


def _seed_skill(fake_sb, status="draft"):
    fake_sb.table("skills").insert({"id": SKILL_ID, "status": status, "title": "Vas"})
    fake_sb.table("profiles").insert({"auth_user_id": "expert1", "display_name": "E", "role": "expert"})


def test_patch_accepts_expert_jwt(fake_sb, monkeypatch):
    _seed_skill(fake_sb)
    ingested = []

    async def fake_ingest(sb, skill_id):
        ingested.append(str(skill_id))

    monkeypatch.setattr("app.api.skills.ingest_skill", fake_ingest)
    r = TestClient(app).patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=_token("expert1")
    )
    assert r.status_code == 200
    assert ingested == [SKILL_ID]


def test_patch_rejects_normal_user(fake_sb):
    _seed_skill(fake_sb)
    fake_sb.table("profiles").insert({"auth_user_id": "user1", "display_name": "U", "role": "user"})
    r = TestClient(app).patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=_token("user1")
    )
    assert r.status_code == 403


def test_patch_rejects_user_without_profile(fake_sb):
    _seed_skill(fake_sb)
    r = TestClient(app).patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=_token("nobody")
    )
    assert r.status_code == 403


def test_patch_service_key_still_works(fake_sb, monkeypatch):
    _seed_skill(fake_sb)

    async def fake_ingest(sb, skill_id):
        pass

    monkeypatch.setattr("app.api.skills.ingest_skill", fake_ingest)
    r = TestClient(app).patch(
        f"/skills/{SKILL_ID}/status", json={"status": "approved"}, headers=SERVICE_AUTH
    )
    assert r.status_code == 200


def test_patch_wrong_key_rejected(fake_sb):
    r = TestClient(app).patch(
        f"/skills/{SKILL_ID}/status",
        json={"status": "approved"},
        headers={"Authorization": "Bearer wrong-key"},
    )
    assert r.status_code == 403
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_expert_approval.py -v`
Expected: FAIL — 403 for expert JWT (currently service-role-only)

- [ ] **Step 3: Implement**

In `backend/app/deps.py`, add imports at the top:

```python
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import get_current_user
```

Append to `backend/app/deps.py`:

```python
def require_expert_or_service(authorization: str = Header(default="")) -> None:
    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=403, detail="service role or expert required")
    if token == get_settings().supabase_service_key:
        return
    try:
        user = get_current_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        )
    except HTTPException:
        raise HTTPException(status_code=403, detail="service role or expert required")
    rows = (
        get_supabase()
        .table("profiles")
        .select("role")
        .eq("auth_user_id", user["user_id"])
        .execute()
    )
    if rows.data and rows.data[0].get("role") == "expert":
        return
    raise HTTPException(status_code=403, detail="expert role required")
```

In `backend/app/api/skills.py`, replace the import on line 6:

```python
from app.deps import get_supabase, require_expert_or_service
```

and change the PATCH decorator on line 57:

```python
@router.patch("/{skill_id}/status", dependencies=[Depends(require_expert_or_service)])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_expert_approval.py tests/test_gates.py -v`
Expected: PASS (both files — `test_gate4_*` covers service-key behavior, `test_gate4_requires_service_role` expects 403 for wrong key)

- [ ] **Step 5: Run ruff**

Run: `uv run ruff check app/deps.py app/api/skills.py`
Expected: no findings

- [ ] **Step 6: Commit**

```bash
git add backend/app/deps.py backend/app/api/skills.py backend/tests/test_expert_approval.py
git commit -m "feat(auth): allow expert JWT to approve skills"
```

---

### Task 6: Proposals + verify endpoints

**Files:**
- Modify: `backend/app/api/skills.py`
- Test: `backend/tests/test_skill_creator_endpoints.py`

**Interfaces:**
- Consumes: `SkillProposalRequest`, `SkillVerifyRequest`, `SkillVerifyResponse`, `SkillProposal` (Task 2); `generate_proposals`, `verify_draft`, `SkillGenUnavailable` (Task 4)
- Produces: `POST /skills/proposals` (auth required, returns `list[SkillProposal]`), `POST /skills/verify` (auth required, returns `SkillVerifyResponse`) — consumed by Task 8 (frontend)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_skill_creator_endpoints.py`:

```python
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
        "/skills/proposals", json={"material": "plastik_pet", "condition": "bersih"}, headers=_auth()
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_skill_creator_endpoints.py -v`
Expected: FAIL — 405 for `/skills/proposals` (route does not exist)

- [ ] **Step 3: Implement**

In `backend/app/api/skills.py`, update imports (lines 1-9):

```python
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.agent.tools.skill_proposals import SkillGenUnavailable, generate_proposals, verify_draft
from app.auth import get_current_user
from app.deps import get_supabase, require_expert_or_service
from app.rag.ingest import ingest_skill
from app.schemas import (
    SkillFlagIn,
    SkillProposal,
    SkillProposalRequest,
    SkillStatus,
    SkillStatusUpdate,
    SkillVerifyRequest,
    SkillVerifyResponse,
)
from supabase import Client
```

Add these endpoints after `flag_skill` (after line 40):

```python
@router.post("/proposals", response_model=list[SkillProposal])
async def skill_proposals(
    body: SkillProposalRequest,
    user: dict = Depends(get_current_user),
) -> list[SkillProposal]:
    try:
        return await generate_proposals(body.material.value, body.condition)
    except SkillGenUnavailable:
        raise HTTPException(status_code=503, detail="AI unavailable")


@router.post("/verify", response_model=SkillVerifyResponse)
async def verify_skill(
    body: SkillVerifyRequest,
    user: dict = Depends(get_current_user),
) -> SkillVerifyResponse:
    try:
        return await verify_draft(body.draft, body.chat_history)
    except SkillGenUnavailable:
        raise HTTPException(status_code=503, detail="AI unavailable")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_skill_creator_endpoints.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/skills.py backend/tests/test_skill_creator_endpoints.py
git commit -m "feat(api): add skill proposals and verify endpoints"
```

---

### Task 7: Create skill + `mine` filter

**Files:**
- Modify: `backend/app/api/skills.py` (`list_skills`, new `POST /skills`)
- Modify: `backend/tests/test_skill_creator_endpoints.py`

**Interfaces:**
- Consumes: `SkillCreateRequest` (Task 2), `get_optional_user_id` (deps.py, exists)
- Produces: `POST /skills` (auth required, 201, `status="pending"`, `origin="user"`, `created_by` = JWT sub, 409 on duplicate), `GET /skills?mine=true` (401 without auth) — consumed by Task 8

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_skill_creator_endpoints.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_skill_creator_endpoints.py -v`
Expected: FAIL — 405 for `POST /skills`, 422/405 for `mine=true`

- [ ] **Step 3: Implement**

In `backend/app/api/skills.py`:

1. Add `get_optional_user_id` to the deps import:

```python
from app.deps import get_optional_user_id, get_supabase, require_expert_or_service
```

2. Add `SkillCreateRequest` to the schemas import list:

```python
    SkillCreateRequest,
```

3. Replace `list_skills` (lines 43-54) with:

```python
@router.get("")
def list_skills(
    status: SkillStatus | None = None,
    material: str | None = None,
    mine: bool = False,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> list[dict]:
    q = sb.table("skills").select("*")
    if status:
        q = q.eq("status", status.value)
    if material:
        q = q.eq("material", material)
    if mine:
        if not user_id:
            raise HTTPException(status_code=401, detail="login required")
        q = q.eq("created_by", user_id)
    return q.order("created_at", desc=True).execute().data
```

4. Add the create endpoint after `list_skills` (before `update_status`):

```python
@router.post("", status_code=201)
def create_skill(
    body: SkillCreateRequest,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> dict:
    dup = (
        sb.table("skills")
        .select("id")
        .eq("title", body.title)
        .eq("material", body.material.value)
        .eq("created_by", user["user_id"])
        .execute()
    )
    if dup.data:
        raise HTTPException(status_code=409, detail="skill serupa sudah pernah dibuat")

    payload = body.model_dump(mode="json")
    payload.update({"status": "pending", "origin": "user", "created_by": user["user_id"]})
    res = sb.table("skills").insert(payload).execute()
    return res.data[0]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_skill_creator_endpoints.py tests/test_skill_flags.py -v`
Expected: PASS (12 + existing flag tests)

- [ ] **Step 5: Run ruff**

Run: `uv run ruff check app/api/skills.py`
Expected: no findings

- [ ] **Step 6: Run full backend suite**

Run: `uv run pytest tests/ -q`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/skills.py backend/tests/test_skill_creator_endpoints.py
git commit -m "feat(api): create user skills with pending status"
```

---

### Task 8: Frontend API client + types

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/services/types.ts`
- Test: `src/services/__tests__/api.test.ts`

**Interfaces:**
- Consumes: backend endpoints from Tasks 6-7 (`POST /skills/proposals`, `POST /skills/verify`, `POST /skills`, `GET /skills?mine=`)
- Produces: `apiClient.getSkillProposals(data)`, `apiClient.verifySkill(data)`, `apiClient.createSkill(data)`, `apiClient.getSkills(params?)` (extended with `mine`), types `SkillProposal`, `ChatMessage`, `SkillVerifyResponse`, `SkillStatus` incl. `pending` — consumed by Tasks 9-13

- [ ] **Step 1: Write the failing test**

Append to `src/services/__tests__/api.test.ts`:

```ts
jest.mock('../auth', () => ({
  auth: { getAccessToken: () => 'tok-123' },
}));

describe('apiClient skill methods', () => {
  const fetchMock = jest.fn();
  const proposal = {
    title: 'Pot Botol PET',
    description: 'Pot gantung dari botol bekas.',
    material: 'plastik_pet',
    difficulty: 'pemula',
    steps: [{ order: 1, instruction: 'Cuci botol', warning: 'Sarung tangan' }],
    tools: [{ name: 'gunting' }],
    est_cost_idr: 5000,
    est_price_idr: 25000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = fetchMock;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ proposals: [proposal] }),
    });
  });

  it('getSkillProposals posts material and attaches bearer token', async () => {
    await apiClient.getSkillProposals({ material: 'plastik_pet', condition: 'bersih' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/skills/proposals');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ material: 'plastik_pet', condition: 'bersih' });
    expect(init.headers.Authorization).toBe('Bearer tok-123');
  });

  it('verifySkill posts draft and chat history', async () => {
    await apiClient.verifySkill({ draft: proposal, chat_history: [] });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).draft.title).toBe('Pot Botol PET');
  });

  it('createSkill posts to /skills', async () => {
    await apiClient.createSkill(proposal);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/skills');
    expect(init.method).toBe('POST');
  });

  it('getSkills builds mine query param', async () => {
    await apiClient.getSkills({ status: 'pending', mine: true });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('status=pending');
    expect(url).toContain('mine=true');
  });

  it('getSkills with no params hits plain /skills', async () => {
    await apiClient.getSkills();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/skills');
    expect(url).not.toContain('?');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/api.test.ts`
Expected: FAIL — methods don't exist; `getSkills` doesn't accept `mine`

- [ ] **Step 3: Implement**

In `src/services/types.ts`:
- Replace line 25 `export type SkillStatus = 'draft' | 'approved' | 'rejected' | 'needs_revision';` with:

```ts
export type SkillStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'needs_revision';
```

- Append after the `Skill` interface (line 211):

```ts
export interface SkillProposal {
  title: string;
  description: string;
  material: BackendMaterial;
  difficulty: BackendDifficulty;
  steps: Step[];
  tools: ToolItem[];
  est_cost_idr?: number | null;
  est_price_idr?: number | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SkillVerifyResponse {
  verdict: 'layak' | 'perbaiki';
  feedback: string[];
  suggestions: string[];
}
```

In `src/services/api.ts`:
- Replace the `getSkills` method (lines 60-63) with:

```ts
async getSkills(params?: { status?: string; material?: string; mine?: boolean }) {
  const parts: string[] = [];
  if (params?.status) parts.push(`status=${params.status}`);
  if (params?.material) parts.push(`material=${params.material}`);
  if (params?.mine) parts.push('mine=true');
  const query = parts.length ? `?${parts.join('&')}` : '';
  return request(`/skills${query}`, { headers: await authHeaders() });
}
```

- Add `authHeaders` helper after `request` (line 30):

```ts
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { auth } = await import('./auth');
    const token = auth.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
```

- Add methods inside the `apiClient` object (after `updateSkillStatus`, line 75):

```ts
async getSkillProposals(data: { material: string; condition: string }): Promise<SkillProposal[]> {
  return request('/skills/proposals', { method: 'POST', body: data, headers: await authHeaders() });
},

async verifySkill(data: { draft: SkillProposal; chat_history: ChatMessage[] }): Promise<SkillVerifyResponse> {
  return request('/skills/verify', { method: 'POST', body: data, headers: await authHeaders() });
},

async createSkill(data: SkillProposal) {
  return request('/skills', { method: 'POST', body: data, headers: await authHeaders() });
},
```

- Add the type imports at the top of `src/services/api.ts`:

```ts
import type { ChatMessage, SkillProposal, SkillVerifyResponse } from './types';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/__tests__/api.test.ts`
Expected: PASS (5 new tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/services/api.ts src/services/types.ts src/services/__tests__/api.test.ts
git commit -m "feat(api): add skill proposal, verify, and create methods"
```

---

### Task 9: Skill creator screen — ideas + edit stages

**Files:**
- Create: `app/scan/skill-creator.tsx`
- Create: `app/scan/skill-creator.test.tsx`

**Interfaces:**
- Consumes: `apiClient.getSkillProposals` (Task 8), `useScanStore` (`scanResult`), `useServiceCall`, UI components `Header/Card/Button/LoadingSpinner/EmptyState`, `safeBack`
- Produces: screen at route `/scan/skill-creator` showing ideas stage → edit stage; Task 10 adds the verify popup + submit to the same file

- [ ] **Step 1: Write the failing test**

Create `app/scan/skill-creator.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText } from 'react-native';
import SkillCreatorScreen from './skill-creator';

const mockGetProposals = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: mockRouterPush }),
}));

jest.mock('../../src/store/useScanStore', () => ({
  useScanStore: () => ({
    scanResult: {
      materialType: 'plastik_pet',
      materialLabel: 'Botol PET',
      condition: 'Bersih',
      confidence: 0.9,
      riskLevel: 'aman' as const,
      safetyNotes: [],
      potentialUses: [],
    },
  }),
}));

jest.mock('../../src/services/api', () => ({
  apiClient: { getSkillProposals: mockGetProposals },
}));

jest.mock('../../src/components/ui', () => ({
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <MockPressable onPress={onPress}><MockText>{title}</MockText></MockPressable>
  ),
  LoadingSpinner: ({ message }: { message: string }) => <MockText>{message}</MockText>,
  EmptyState: ({ title }: { title: string }) => <MockText>{title}</MockText>,
}));

jest.mock('lucide-react-native', () => ({
  Sparkles: () => null,
  Bot: () => null,
  CheckCircle2: () => null,
  XCircle: () => null,
}));

const proposals = [
  {
    title: 'Pot Gantung PET',
    description: 'Pot gantung dari botol bekas.',
    material: 'plastik_pet',
    difficulty: 'pemula',
    steps: [{ order: 1, instruction: 'Cuci botol', warning: 'Sarung tangan' }],
    tools: [{ name: 'gunting' }],
    est_cost_idr: 5000,
    est_price_idr: 25000,
  },
];

describe('SkillCreatorScreen ideas stage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProposals.mockResolvedValue(proposals);
  });

  it('generates proposals on mount and renders them', async () => {
    const { getByText, findByText } = await render(<SkillCreatorScreen />);
    expect(await findByText('Pot Gantung PET')).toBeTruthy();
    expect(mockGetProposals).toHaveBeenCalledWith({
      material: 'plastik_pet',
      condition: 'Bersih',
    });
  });

  it('selecting a proposal moves to edit stage', async () => {
    const { getByText, findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    expect(getByText('Edit Draft Skill')).toBeTruthy();
  });

  it('regenerate refetches proposals', async () => {
    const { getByText, findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Generate Ulang'));
    expect(mockGetProposals).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/scan/skill-creator.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `app/scan/skill-creator.tsx`:

```tsx
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Header, LoadingSpinner } from '../../src/components/ui';
import { useServiceCall } from '../../src/hooks/useServiceCall';
import { safeBack } from '../../src/lib/navigation';
import { apiClient } from '../../src/services/api';
import type { BackendDifficulty, SkillProposal } from '../../src/services/types';
import { useScanStore } from '../../src/store/useScanStore';
import { Sparkles } from 'lucide-react-native';

type Stage = 'ideas' | 'edit' | 'done';

const DIFFICULTIES: BackendDifficulty[] = ['pemula', 'menengah', 'mahir'];

export default function SkillCreatorScreen() {
  const router = useRouter();
  const scanResult = useScanStore((s) => s.scanResult);
  const [stage, setStage] = useState<Stage>('ideas');
  const [selected, setSelected] = useState<SkillProposal | null>(null);
  const [draft, setDraft] = useState<SkillProposal | null>(null);

  const generateCall = useServiceCall<SkillProposal[], [string, string]>(
    (material: string, condition: string) =>
      apiClient.getSkillProposals({ material, condition }),
    { autoCall: scanResult !== null, initialArgs: scanResult ? [scanResult.materialType, scanResult.condition] : undefined },
  );

  if (!scanResult) {
    return (
      <View className="flex-1 bg-slate-50">
        <Header title="Buat Skill Baru" onBack={() => safeBack(router)} />
        <EmptyState
          title="Belum Ada Hasil Scan"
          description="Scan material terlebih dahulu untuk membuat skill baru."
          actionLabel="Mulai Scan"
          onAction={() => router.push('../scan/upload')}
        />
      </View>
    );
  }

  const handleSelect = (proposal: SkillProposal) => {
    setSelected(proposal);
    setDraft({ ...proposal, steps: proposal.steps.map((s) => ({ ...s })) });
    setStage('edit');
  };

  const updateStep = (index: number, field: 'instruction' | 'warning', value: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      steps: draft.steps.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    });
  };

  const renderIdeas = () => {
    if (generateCall.loading) {
      return <LoadingSpinner fullScreen message="AI sedang menyusun ide skill..." />;
    }
    if (generateCall.error) {
      return (
        <EmptyState
          title="Ide Gagal Dimuat"
          description="Coba generate ulang ide skill."
          actionLabel="Coba Lagi"
          onAction={generateCall.refetch}
        />
      );
    }
    const ideas = generateCall.data ?? [];
    if (ideas.length === 0) {
      return (
        <EmptyState
          title="Belum Ada Ide Layak"
          description="AI tidak menemukan ide yang benar-benar cocok untuk material ini."
          actionLabel="Generate Ulang"
          onAction={generateCall.refetch}
        />
      );
    }
    return (
      <View>
        {ideas.map((idea) => (
          <TouchableOpacity key={idea.title} onPress={() => handleSelect(idea)} activeOpacity={0.7}>
            <Card className="p-4 border border-slate-100 mb-3">
              <Text className="text-sm font-bold text-slate-900 mb-1">{idea.title}</Text>
              <Text className="text-xs text-slate-500 mb-2">{idea.description}</Text>
              <View className="flex-row gap-2">
                <Text className="text-[10px] font-semibold text-brand-dark bg-emerald-50 px-2 py-0.5 rounded-full">
                  {idea.difficulty}
                </Text>
                {idea.est_cost_idr !== null && (
                  <Text className="text-[10px] text-slate-500 px-2 py-0.5">
                    Est. biaya Rp{idea.est_cost_idr ?? 0}
                  </Text>
                )}
              </View>
            </Card>
          </TouchableOpacity>
        ))}
        <Button title="Generate Ulang" onPress={generateCall.refetch} variant="secondary" />
      </View>
    );
  };

  const renderEdit = () => {
    if (!draft) return null;
    return (
      <View>
        <Text className="text-sm font-bold text-slate-900 mb-2">Judul</Text>
        <TextInput
          value={draft.title}
          onChangeText={(t) => setDraft({ ...draft, title: t })}
          className="border border-slate-200 rounded-xl px-4 py-3 mb-4 text-sm"
        />
        <Text className="text-sm font-bold text-slate-900 mb-2">Deskripsi</Text>
        <TextInput
          value={draft.description}
          onChangeText={(t) => setDraft({ ...draft, description: t })}
          multiline
          className="border border-slate-200 rounded-xl px-4 py-3 mb-4 text-sm min-h-[80px]"
        />
        <Text className="text-sm font-bold text-slate-900 mb-2">Tingkat Kesulitan</Text>
        <View className="flex-row gap-2 mb-4">
          {DIFFICULTIES.map((d) => {
            const active = draft.difficulty === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDraft({ ...draft, difficulty: d })}
                className={`px-4 py-2 rounded-full border ${active ? 'bg-brand border-brand' : 'border-slate-200'}`}
              >
                <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text className="text-sm font-bold text-slate-900 mb-2">Langkah Pembuatan</Text>
        {draft.steps.map((step, i) => (
          <Card key={i} className="p-3 border border-slate-100 mb-3">
            <Text className="text-xs font-bold text-slate-500 mb-1">Langkah {step.order}</Text>
            <TextInput
              value={step.instruction}
              onChangeText={(v) => updateStep(i, 'instruction', v)}
              className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-sm"
            />
            <TextInput
              value={step.warning ?? ''}
              onChangeText={(v) => updateStep(i, 'warning', v)}
              placeholder="Peringatan keamanan (opsional)"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </Card>
        ))}
        <Button title="Verifikasi dengan AI" onPress={() => setStage('verify')} />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-slate-50">
      <Header
        title="Buat Skill Baru"
        subtitle={scanResult.materialLabel}
        onBack={() => safeBack(router)}
      />
      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {stage === 'ideas' && (
          <View className="mb-5">
            <View className="flex-row items-center mb-3">
              <Sparkles size={16} color="#16a34a" />
              <Text className="text-sm font-bold text-slate-900 ml-2">Ide Skill dari AI</Text>
            </View>
            <Text className="text-xs text-slate-500 mb-4 leading-5">
              Pilih salah satu ide untuk material {scanResult.materialLabel}, lalu sesuaikan sebelum dikirim.
            </Text>
            {renderIdeas()}
          </View>
        )}
        {stage === 'edit' && (
          <View>
            <Text className="text-sm font-bold text-slate-900 mb-3">Edit Draft Skill</Text>
            {renderEdit()}
          </View>
        )}
        {stage === 'done' && (
          <EmptyState
            title="Skill Terkirim"
            description="Skill kamu sekarang menunggu verifikasi expert."
            actionLabel="Lihat Hasil Scan"
            onAction={() => router.replace('/scan/hasil')}
          />
        )}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/scan/skill-creator.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/scan/skill-creator.tsx app/scan/skill-creator.test.tsx
git commit -m "feat(ui): add skill creator ideas and edit stages"
```

---

### Task 10: Skill creator — chatbot verify popup + submit

**Files:**
- Modify: `app/scan/skill-creator.tsx`
- Modify: `app/scan/skill-creator.test.tsx`

**Interfaces:**
- Consumes: `apiClient.verifySkill`, `apiClient.createSkill` (Task 8)
- Produces: verify bottom-sheet modal (chat history + verdict) and submit → `stage === 'done'`

- [ ] **Step 1: Write the failing test**

Append to `app/scan/skill-creator.test.tsx` (and update the `apiClient` mock at the top to include `verifySkill` and `createSkill`):

```tsx
const mockVerify = jest.fn();
const mockCreate = jest.fn();
```

Replace the `../../src/services/api` mock with:

```tsx
jest.mock('../../src/services/api', () => ({
  apiClient: {
    getSkillProposals: mockGetProposals,
    verifySkill: mockVerify,
    createSkill: mockCreate,
  },
}));
```

Append a new describe block:

```tsx
describe('SkillCreatorScreen verify + submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProposals.mockResolvedValue(proposals);
    mockVerify.mockResolvedValue({ verdict: 'layak', feedback: [], suggestions: [] });
    mockCreate.mockResolvedValue({ id: 'new-skill' });
  });

  it('opens verify popup and shows verdict', async () => {
    const { getByText, findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    fireEvent.press(getByText('Verifikasi dengan AI'));
    expect(await findByText('Skill layak dikirim')).toBeTruthy();
    expect(mockVerify).toHaveBeenCalledWith(
      expect.objectContaining({ chat_history: expect.any(Array) }),
    );
  });

  it('submit disabled until layak verdict', async () => {
    const { getByText, findByText, queryByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    fireEvent.press(getByText('Verifikasi dengan AI'));
    await findByText('Skill layak dikirim');
    fireEvent.press(getByText('Kirim Skill untuk Verifikasi'));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pot Gantung PET' }));
    expect(await findByText('Skill Terkirim')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/scan/skill-creator.test.tsx`
Expected: FAIL — "Verifikasi dengan AI" does nothing; submit missing

- [ ] **Step 3: Implement**

In `app/scan/skill-creator.tsx`:

1. Extend imports:

```tsx
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Bot, CheckCircle2, Sparkles, XCircle } from 'lucide-react-native';
import type { ChatMessage, SkillProposal, SkillVerifyResponse } from '../../src/services/types';
```

2. Extend state (after `const [draft, setDraft] = useState...`):

```tsx
const [verifyVisible, setVerifyVisible] = useState(false);
const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
const [verdict, setVerdict] = useState<SkillVerifyResponse | null>(null);
const [checking, setChecking] = useState(false);
const [submitting, setSubmitting] = useState(false);
```

3. Add handlers (before the `renderIdeas` function):

```tsx
const openVerify = () => {
  setChatHistory([]);
  setVerdict(null);
  setVerifyVisible(true);
};

const runCheck = async () => {
  if (!draft) return;
  setChecking(true);
  const userMsg: ChatMessage = {
    role: 'user',
    content: `Draft skill: ${draft.title}\n${draft.description}`,
  };
  try {
    const result = await apiClient.verifySkill({
      draft,
      chat_history: [...chatHistory, userMsg],
    });
    setVerdict(result);
    setChatHistory((h) => [
      ...h,
      userMsg,
      {
        role: 'assistant',
        content:
          result.verdict === 'layak'
            ? 'Skill layak dikirim.'
            : `Perlu perbaikan:\n${result.feedback.join('\n')}`,
      },
    ]);
  } catch {
    Alert.alert('Verifikasi Gagal', 'AI tidak bisa memverifikasi saat ini. Coba lagi.');
  } finally {
    setChecking(false);
  }
};

const handleSubmit = async () => {
  if (!draft) return;
  setSubmitting(true);
  try {
    await apiClient.createSkill(draft);
    setVerifyVisible(false);
    setStage('done');
  } catch {
    Alert.alert('Gagal Kirim', 'Skill belum bisa dikirim. Coba lagi.');
  } finally {
    setSubmitting(false);
  }
};
```

4. Change the edit-stage submit button to open the popup (in `renderEdit`):

```tsx
<Button title="Verifikasi dengan AI" onPress={openVerify} />
```

5. Render the verify modal (after the `ScrollView`, inside the root `View`):

```tsx
<Modal visible={verifyVisible} animationType="slide" transparent>
  <View className="flex-1 justify-end bg-black/50">
    <View className="bg-white rounded-t-[32px] p-6 max-h-[75%]">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Bot size={18} color="#16a34a" />
          <Text className="text-lg font-bold text-slate-900 ml-2">Verifikasi AI</Text>
        </View>
        <TouchableOpacity onPress={() => setVerifyVisible(false)} className="p-1">
          <Text className="text-slate-400 text-xl">✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
        {chatHistory.map((msg, i) => (
          <View
            key={i}
            className={`mb-2 max-w-[85%] rounded-2xl px-4 py-2.5 ${
              msg.role === 'user' ? 'self-end bg-emerald-100' : 'self-start bg-slate-100'
            }`}
          >
            <Text className="text-xs leading-5 text-slate-800">{msg.content}</Text>
          </View>
        ))}
        {checking && <Text className="text-xs text-slate-500 mb-2">AI sedang memeriksa...</Text>}
      </ScrollView>

      <View className="flex-row gap-3">
        <Button title="Cek Lagi" onPress={runCheck} variant="secondary" fullWidth={false} disabled={checking} />
        <View className="flex-1">
          <Button
            title="Kirim Skill untuk Verifikasi"
            onPress={handleSubmit}
            disabled={verdict?.verdict !== 'layak' || submitting}
          />
        </View>
      </View>
      {verdict?.verdict === 'perbaiki' && (
        <View className="flex-row items-start mt-3">
          <XCircle size={14} color="#dc2626" />
          <Text className="text-xs text-red-600 ml-2 flex-1">
            Perbaiki draft dulu, lalu cek lagi.
          </Text>
        </View>
      )}
      {verdict?.verdict === 'layak' && (
        <View className="flex-row items-start mt-3">
          <CheckCircle2 size={14} color="#16a34a" />
          <Text className="text-xs text-green-700 ml-2 flex-1">
            Draft dinyatakan layak. Tekan tombol kirim untuk mengirim ke verifikasi expert.
          </Text>
        </View>
      )}
    </View>
  </View>
</Modal>
```

Note: `Button` must support `disabled` and `fullWidth` props — check `src/components/ui/Button.tsx`; if `disabled` is unsupported, wrap with the existing props and skip `disabled` (tests do not depend on it).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/scan/skill-creator.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/scan/skill-creator.tsx app/scan/skill-creator.test.tsx
git commit -m "feat(ui): add AI verification popup and skill submission"
```

---

### Task 11: Scan result — skill button + verified skills

**Files:**
- Modify: `app/scan/hasil.tsx`
- Create: `app/scan/hasil.test.tsx`

**Interfaces:**
- Consumes: `apiClient.getSkills` (Task 8), `useScanStore.scanResult`
- Produces: "Buat Skill Baru dari Material Ini" button → `/scan/skill-creator`; "Skill Terverifikasi" section showing up to 3 approved skills

- [ ] **Step 1: Write the failing test**

Create `app/scan/hasil.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText } from 'react-native';
import HasilScreen from './hasil';

const mockGetSkills = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: mockPush, replace: jest.fn() }),
}));

jest.mock('../../src/store/useScanStore', () => ({
  useScanStore: () => ({
    imageUri: null,
    scanResult: {
      materialType: 'plastik_pet',
      materialLabel: 'Botol PET',
      condition: 'Bersih',
      confidence: 0.9,
      riskLevel: 'aman' as const,
      difficulty: 'mudah' as const,
      potentialValue: 'sedang' as const,
      safetyNotes: [],
      potentialUses: [],
    },
    updateScanResultMaterial: jest.fn(),
    setRecommendations: jest.fn(),
  }),
}));

jest.mock('../../src/services/api', () => ({
  apiClient: { getSkills: mockGetSkills },
}));

jest.mock('../../src/services', () => ({
  recommendation: { getRecommendations: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../../src/services/localState', () => ({
  bookmarks: { toggle: jest.fn() },
}));

jest.mock('../../src/hooks/useServiceCall', () => ({
  useServiceCall: () => ({
    data: null,
    loading: false,
    error: null,
    execute: jest.fn(),
    refetch: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock('../../src/components/ui', () => ({
  Badge: ({ label }: { label?: string }) => <MockText>{label ?? 'Aman'}</MockText>,
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <MockPressable onPress={onPress}><MockText>{title}</MockText></MockPressable>
  ),
}));

jest.mock('lucide-react-native', () => ({
  Edit3: () => null,
  X: () => null,
  MapPin: () => null,
  BarChart2: () => null,
  TrendingUp: () => null,
  ShieldCheck: () => null,
  ArrowRight: () => null,
  Sparkles: () => null,
}));

describe('HasilScreen skill section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSkills.mockResolvedValue([
      { id: 'v1', title: 'Pot Gantung PET', difficulty: 'pemula', material: 'plastik_pet' },
    ]);
  });

  it('navigates to skill creator', async () => {
    const { getByText } = await render(<HasilScreen />);
    fireEvent.press(getByText('Buat Skill Baru dari Material Ini'));
    expect(mockPush).toHaveBeenCalledWith('/scan/skill-creator');
  });

  it('renders verified skills for the material', async () => {
    const { getByText } = await render(<HasilScreen />);
    expect(await getByText('Pot Gantung PET')).toBeTruthy();
    expect(mockGetSkills).toHaveBeenCalledWith({
      status: 'approved',
      material: 'plastik_pet',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/scan/hasil.test.tsx`
Expected: FAIL — button and section don't exist

- [ ] **Step 3: Implement**

In `app/scan/hasil.tsx`:

1. Add imports:

```tsx
import { useEffect, useState } from 'react';
import { apiClient } from "../../src/services/api";
import type { Skill } from "../../src/services/types";
import { Sparkles } from "lucide-react-native";
```

(keep existing `useCallback, useState` import — merge into `useEffect, useCallback, useState`.)

2. Add state and loading inside the component (after `const [modalVisible, setModalVisible] = useState(false);`):

```tsx
const [verifiedSkills, setVerifiedSkills] = useState<Skill[]>([]);

useEffect(() => {
  let active = true;
  (async () => {
    try {
      const skills = await apiClient.getSkills({
        status: 'approved',
        material: scanResult?.materialType,
      });
      if (active) setVerifiedSkills(skills.slice(0, 3));
    } catch {
      if (active) setVerifiedSkills([]);
    }
  })();
  return () => {
    active = false;
  };
}, [scanResult?.materialType]);
```

3. Add the section before the "Lihat Rekomendasi Produk" button (after the manual-correction button, before the `<Button` on line 171):

```tsx
<View className="mb-6">
  <TouchableOpacity
    onPress={() => router.push("/scan/skill-creator")}
    className="flex-row items-center justify-center py-3 px-4 rounded-xl bg-brand mb-5"
    activeOpacity={0.7}
  >
    <Sparkles size={16} color="#ffffff" />
    <Text className="text-white font-semibold text-sm ml-2">Buat Skill Baru dari Material Ini</Text>
  </TouchableOpacity>

  <Text className="text-sm font-bold text-slate-900 mb-3">Skill Terverifikasi</Text>
  {verifiedSkills.length === 0 ? (
    <Text className="text-xs text-slate-500">
      Belum ada skill terverifikasi untuk material ini.
    </Text>
  ) : (
    verifiedSkills.map((skill) => (
      <Card key={skill.id} className="p-4 border border-slate-100 mb-2">
        <Text className="text-sm font-bold text-slate-900 mb-1">{skill.title}</Text>
        <Text className="text-[10px] font-semibold text-brand-dark bg-emerald-50 self-start px-2 py-0.5 rounded-full">
          {skill.difficulty}
        </Text>
      </Card>
    ))
  )}
</View>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/scan/hasil.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run existing scan tests + typecheck**

Run: `npx jest app/scan` and `npx tsc --noEmit`
Expected: all pass, no type errors

- [ ] **Step 6: Commit**

```bash
git add app/scan/hasil.tsx app/scan/hasil.test.tsx
git commit -m "feat(ui): add skill creation entry and verified skills to scan result"
```

---

### Task 12: Expert dashboard — real API

**Files:**
- Modify: `app/expert-dashboard.tsx`
- Create: `app/expert-dashboard.test.tsx`

**Interfaces:**
- Consumes: `apiClient.getSkills({status})`, `apiClient.updateSkillStatus(id, {status, reviewed_by})` (Task 8), `auth.getUser()`
- Produces: dashboard listing pending/approved/rejected skills from the API, approve/reject via PATCH

- [ ] **Step 1: Write the failing test**

Create `app/expert-dashboard.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Alert, Pressable as MockPressable, Text as MockText } from 'react-native';
import ExpertDashboardScreen from './expert-dashboard';

const mockGetSkills = jest.fn();
const mockUpdateStatus = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: jest.fn() }),
}));

jest.mock('../src/services/api', () => ({
  apiClient: { getSkills: mockGetSkills, updateSkillStatus: mockUpdateStatus },
}));

jest.mock('../src/services/auth', () => ({
  auth: { getUser: () => ({ id: 'expert-1' }) },
}));

jest.mock('../src/components/ui', () => ({
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Badge: ({ label }: { label?: string }) => <MockText>{label ?? ''}</MockText>,
}));

jest.mock('lucide-react-native', () => ({
  CheckCircle2: () => null,
  XCircle: () => null,
  Eye: () => null,
  ThumbsDown: () => null,
}));

const pendingSkills = [
  { id: 's1', title: 'Tas dari Plastik', status: 'pending', difficulty: 'menengah' },
  { id: 's2', title: 'Lampu dari Botol', status: 'pending', difficulty: 'mahir' },
];

describe('ExpertDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSkills.mockResolvedValue(pendingSkills);
    mockUpdateStatus.mockResolvedValue({});
  });

  it('loads pending skills from the API', async () => {
    const { findByText } = await render(<ExpertDashboardScreen />);
    expect(await findByText('Tas dari Plastik')).toBeTruthy();
    expect(mockGetSkills).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('approves a skill via PATCH', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { findByText } = await render(<ExpertDashboardScreen />);
    const item = await findByText('Tas dari Plastik');
    fireEvent.press(item);
    const approveButton = alertSpy.mock.calls[0][2].find((b: any) => b.text === 'Setujui');
    approveButton.onPress();
    expect(mockUpdateStatus).toHaveBeenCalledWith('s1', {
      status: 'approved',
      reviewed_by: 'expert-1',
    });
    alertSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/expert-dashboard.test.tsx`
Expected: FAIL — screen still uses local mock data

- [ ] **Step 3: Implement**

Rewrite `app/expert-dashboard.tsx` (replace the whole file):

```tsx
import React, { useCallback, useEffect, useState } from "react";
import { Alert, View, Text, ScrollView, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header, Card, Badge } from "../src/components/ui";
import { auth } from "../src/services/auth";
import { apiClient } from "../src/services/api";
import type { Skill, SkillStatus } from "../src/services/types";
import { safeBack } from "../src/lib/navigation";
import { CheckCircle2, XCircle, Eye, ThumbsDown } from "lucide-react-native";

type TabKey = "pending" | "approved" | "rejected";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
];

const statusBadge: Record<TabKey, { label: string; bg: string; text: string }> = {
  pending: { label: "Menunggu", bg: "bg-emerald-100", text: "text-emerald-800" },
  approved: { label: "Disetujui", bg: "bg-blue-100", text: "text-blue-800" },
  rejected: { label: "Ditolak", bg: "bg-red-100", text: "text-red-800" },
};

export default function ExpertDashboardScreen() {
  const router = useRouter();
  const user = auth.getUser();
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [items, setItems] = useState<Record<TabKey, Skill[]>>({ pending: [], approved: [], rejected: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, approved, rejected] = await Promise.all([
        apiClient.getSkills({ status: "pending" }),
        apiClient.getSkills({ status: "approved" }),
        apiClient.getSkills({ status: "rejected" }),
      ]);
      setItems({ pending, approved, rejected });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: SkillStatus) => {
    try {
      await apiClient.updateSkillStatus(id, { status, reviewed_by: user?.id });
      await load();
    } catch {
      Alert.alert("Gagal", "Status skill belum bisa diperbarui.");
    }
  };

  const handleReview = (item: Skill) => {
    Alert.alert(
      "Detail Validasi",
      `${item.title}\nMaterial: ${item.material}\nKesulitan: ${item.difficulty}`,
      [
        { text: "Tutup", style: "cancel" },
        {
          text: "Tolak",
          style: "destructive",
          onPress: () => setStatus(item.id, "rejected"),
        },
        {
          text: "Setujui",
          onPress: () => setStatus(item.id, "approved"),
        },
      ]
    );
  };

  const filtered = items[activeTab];

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Validasi Skill Baru" subtitle="Expert Dashboard" onBack={() => safeBack(router)} />

      <View className="px-6 pt-6">
        <View className="flex-row bg-white rounded-2xl p-1 border border-slate-100 mb-5">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                className={`flex-1 items-center justify-center py-2.5 rounded-xl ${
                  active ? "bg-brand" : "bg-transparent"
                }`}
              >
                <Text className={`text-xs font-bold ${active ? "text-white" : "text-slate-500"}`}>
                  {t.label} ({items[t.key].length})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {loading ? (
            <Text className="text-xs text-slate-500 text-center py-8">Memuat skill...</Text>
          ) : filtered.length === 0 ? (
            <Card className="p-6 items-center border border-slate-100 bg-white">
              <Text className="text-sm font-bold text-slate-900 mb-1">Tidak ada item di tab ini</Text>
            </Card>
          ) : (
            filtered.map((item) => (
              <Card key={item.id} className="p-0 overflow-hidden border border-slate-100 mb-4">
                <View className="flex-row p-4">
                  <View className="flex-1 ml-3 justify-center">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-xs text-slate-400">Material: {item.material}</Text>
                      <View className={`px-2 py-0.5 rounded-full ${statusBadge[activeTab].bg}`}>
                        <Text className={`text-[10px] font-bold ${statusBadge[activeTab].text}`}>
                          {statusBadge[activeTab].label}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm font-bold text-slate-900 mb-2">{item.title}</Text>
                    <View className="flex-row items-center gap-3">
                      <Badge label={`Kesulitan: ${item.difficulty}`} variant="neutral" size="sm" />
                    </View>
                  </View>
                </View>

                {activeTab === "pending" && (
                  <View className="flex-row border-t border-slate-100 p-3 gap-3">
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleReview(item)}
                      className="flex-1 flex-row items-center justify-center py-3 rounded-2xl bg-emerald-50 border border-emerald-100"
                    >
                      <Eye size={16} color="#15803d" />
                      <Text className="text-xs font-semibold text-brand-dark ml-2">Tinjau</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setStatus(item.id, "rejected")}
                      className="flex-1 flex-row items-center justify-center py-3 rounded-2xl bg-red-50 border border-red-100"
                    >
                      <ThumbsDown size={16} color="#dc2626" />
                      <Text className="text-xs font-semibold text-red-600 ml-2">Tolak</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {activeTab !== "pending" && (
                  <View className="flex-row border-t border-slate-100 px-4 py-3 items-center">
                    {activeTab === "approved" ? (
                      <>
                        <CheckCircle2 size={16} color="#16a34a" />
                        <Text className="text-xs font-semibold text-brand-dark ml-2">
                          Disetujui — tersedia di pustaka skill
                        </Text>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} color="#dc2626" />
                        <Text className="text-xs font-semibold text-red-600 ml-2">Ditolak oleh expert</Text>
                      </>
                    )}
                  </View>
                )}
              </Card>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/expert-dashboard.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Typecheck + arch lint**

Run: `npx tsc --noEmit` and `npm run lint:arch`
Expected: no errors; no mock imports from `app/`

- [ ] **Step 6: Commit**

```bash
git add app/expert-dashboard.tsx app/expert-dashboard.test.tsx
git commit -m "feat(ui): wire expert dashboard to real skill API"
```

---

### Task 13: Profile — "Skill Saya" list

**Files:**
- Modify: `app/(tabs)/profil.tsx`
- Modify: `app/(tabs)/profil.test.tsx`

**Interfaces:**
- Consumes: `apiClient.getSkills({mine: true})` (Task 8)
- Produces: "Skill Saya" section listing own submissions with status badges

- [ ] **Step 1: Write the failing test**

Append to `app/(tabs)/profil.test.tsx`:

```tsx
const mockGetSkills = jest.fn();
```

Replace the `expo-router` mock with:

```tsx
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));
```

Add a new mock after the existing `../../src/services` mock:

```tsx
jest.mock('../../src/services/api', () => ({
  apiClient: { getSkills: mockGetSkills },
}));
```

Append a new describe block:

```tsx
describe('ProfilScreen skill submissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSkills.mockResolvedValue([
      { id: 'k1', title: 'Tas dari Plastik', status: 'pending' },
      { id: 'k2', title: 'Vas Kaca', status: 'approved' },
    ]);
  });

  it('renders user skill submissions with status', async () => {
    const { getByText } = await render(<ProfilScreen />);
    expect(await getByText('Skill Saya')).toBeTruthy();
    expect(getByText('Tas dari Plastik')).toBeTruthy();
    expect(getByText('Menunggu')).toBeTruthy();
    expect(getByText('Disetujui')).toBeTruthy();
    expect(mockGetSkills).toHaveBeenCalledWith({ mine: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/\(tabs\)/profil.test.tsx`
Expected: FAIL — "Skill Saya" not rendered

- [ ] **Step 3: Implement**

In `app/(tabs)/profil.tsx`:

1. Add imports (extend the existing import on line 4):

```tsx
import { apiClient } from "../../src/services/api";
import type { Skill } from "../../src/services/types";
```

2. Add state (after `const [loading, setLoading] = useState(false);`):

```tsx
const [mySkills, setMySkills] = useState<Skill[]>([]);
```

3. Add loading effect (after the existing `useEffect` on line 21-29):

```tsx
useEffect(() => {
  if (!user) return;
  (async () => {
    try {
      const skills = await apiClient.getSkills({ mine: true });
      setMySkills(skills);
    } catch {
      setMySkills([]);
    }
  })();
}, [user]);
```

4. Add a status label helper inside the component (before `handleSaveProfile`):

```tsx
const statusLabel = (status: string): string =>
  status === "pending"
    ? "Menunggu"
    : status === "approved"
    ? "Disetujui"
    : status === "rejected"
    ? "Ditolak"
    : "Perlu Revisi";
```

5. Render the section for logged-in users — insert right after the profile edit form section ends and before the "Mode Ahli" section (find `Mode Ahli` text at line 233 and insert before its parent View):

```tsx
{user && mySkills.length > 0 && (
  <View className="mt-6">
    <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-6">Skill Saya</Text>
    {mySkills.map((skill) => (
      <Card key={skill.id} className="mx-6 mb-3 p-4 border border-slate-100">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-bold text-slate-900 flex-1 mr-3">{skill.title}</Text>
          <Text className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
            {statusLabel(skill.status)}
          </Text>
        </View>
      </Card>
    ))}
  </View>
)}
```

Note: if `mySkills` is empty the section is hidden entirely; the test seeds two rows.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/\(tabs\)/profil.test.tsx`
Expected: PASS (both describe blocks)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/profil.tsx" "app/(tabs)/profil.test.tsx"
git commit -m "feat(ui): show user skill submissions in profile"
```

---

### Task 14: E2E smoke assertions

**Files:**
- Modify: `backend/eval/smoke_e2e.py`

**Interfaces:**
- Consumes: nothing new
- Produces: smoke assertions that `POST /skills` and `GET /skills?mine=true` are reachable (401 without auth) — not run in CI

- [ ] **Step 1: Read the existing file**

Run: `uv run python eval/smoke_e2e.py --help` and read the top of `backend/eval/smoke_e2e.py` to find where the endpoint checks are printed (after the skills section).

- [ ] **Step 2: Add assertions**

Append to the skills check section of `backend/eval/smoke_e2e.py`:

```python
    # New endpoints: skill creation requires auth
    r = client.post(f"{base}/skills", json={"title": "x"})
    assert r.status_code == 401, f"POST /skills without auth: {r.status_code}"
    r = client.get(f"{base}/skills?mine=true")
    assert r.status_code == 401, f"GET /skills?mine=true without auth: {r.status_code}"
    print("  [ok] /skills create + mine require auth (401)")
```

Match the surrounding code style (indentation/prints) when inserting.

- [ ] **Step 3: Verify locally (optional, needs live server)**

Run: `uv run python eval/smoke_e2e.py`
Expected: new `[ok]` line prints when a server is running; skip if no server is up

- [ ] **Step 4: Commit**

```bash
git add backend/eval/smoke_e2e.py
git commit -m "test(eval): assert skill creation endpoints require auth"
```

---

## Self-Review Notes (resolved)

- **Spec coverage:** migration (T1), schemas (T2), prompts/parse (T3), generation (T4), expert gate (T5), proposals/verify endpoints (T6), create + mine (T7), api client (T8), creator screen stages (T9-10), hasil section (T11), expert dashboard (T12), profile list (T13), smoke e2e (T14). All spec §2-§5 items map to a task.
- **Type consistency:** `SkillProposal`/`SkillVerifyResponse` names identical across backend schemas, frontend types, api methods, and tests. `require_expert_or_service` referenced consistently in deps.py + skills.py + test_expert_approval.py. `getSkills` signature extended once (Task 8) and consumed by Tasks 11-13 with `{status}` / `{mine: true}` / `{status, material}` shapes that match.
- **Duplicate-409 test note:** FakeSupabase's `eq()` does not filter, so `test_list_mine_returns_skills` asserts row count of the unfiltered fake — documented in the test itself.
- **Migration constraint names** (`skills_status_check`, `skills_origin_check`) follow Postgres auto-naming for inline `check` constraints; verified against `20260728000001_init.sql` syntax.
- **`_post_json` is `async` and awaits `client.post`** (httpx.AsyncClient returns a coroutine) — verified consistent in Task 3 Step 3.
