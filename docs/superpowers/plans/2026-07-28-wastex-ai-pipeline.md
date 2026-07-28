# WASTEX AI Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the WASTEX backend AI pipeline (spec `docs/superpowers/specs/2026-07-28-wastex-ai-pipeline-design.md`) on top of the existing `backend/` scaffold: verified SQL retrieval, all 4 gates tested, image storage, seed bootstrap, RAGAS evaluation, and CI.

**Architecture:** Single FastAPI service in `backend/` + Supabase (Postgres/pgvector/Storage). The scaffold already implements config, schemas, routers, vision (OpenRouter GPT-4o→Gemini), hybrid retrieval + rerank, grounded generation (Pydantic AI/DeepSeek), discovery with safety gate, fallback templates, and the init migration. This plan hardens it with tests and fills the deliberate stubs.

**Tech Stack:** Python 3.12, uv, FastAPI, Pydantic AI, Supabase (supabase-py), pgvector, DeepInfra (BGE-m3 + bge-reranker-v2-m3), OpenRouter, RAGAS, pytest, GitHub Actions.

## Global Constraints

- Embeddings: `BAAI/bge-m3`, dimension **1024** (`vector(1024)` everywhere).
- Reranker: `BAAI/bge-reranker-v2-m3` via DeepInfra.
- Chat model: `deepseek/deepseek-chat`; vision `openai/gpt-4o` with fallback `google/gemini-2.5-flash` — all via OpenRouter.
- Gate 1 threshold: vision `confidence < 0.70` → `needs_manual_verification`.
- Gate 2 threshold: best rerank score `< 0.40` OR zero results → knowledge gap.
- Materials (exact strings): `plastik_pet | plastik_hdpe | kardus | kaleng | kaca | sachet`. Difficulties: `pemula | menengah | mahir`.
- Skill statuses: `draft | approved | rejected | needs_revision`. Origins: `seed | discovered`.
- Only `status='approved'` skills are ever chunked/embedded (structural safety guarantee).
- FTS config: `indonesian`; fusion via Reciprocal Rank Fusion in SQL (call it "lexical search", not BM25).
- User-facing copy in Bahasa Indonesia.
- Secrets env names: `OPENROUTER_API_KEY`, `DEEPINFRA_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`.
- All commands below run from `backend/` unless stated otherwise. Test env vars are injected by `backend/tests/conftest.py` (already present): `SUPABASE_SERVICE_KEY=test-service-key` etc.
- RAGAS targets: faithfulness ≥90%, context precision ≥85%, context recall ≥80%, answer relevancy ≥80%.

---

### Task 1: Commit the scaffold baseline

**Files:**
- No code changes. Commits `backend/` as it exists.

**Interfaces:**
- Consumes: nothing.
- Produces: the baseline all later tasks build on. Key existing interfaces later tasks use:
  - `app.rag.chunking.chunk_text(text: str, metadata: dict | None = None, max_words: int = 750) -> list[Chunk]`; `Chunk(content: str, metadata: dict)`
  - `app.rag.embeddings.embed_texts(texts: list[str]) -> list[list[float]]`, `embed_query(text: str) -> list[float]`
  - `app.rag.reranker.rerank(query: str, documents: list[str]) -> list[float]`
  - `app.rag.ingest.ingest_skill(sb: Client, skill_id: UUID | str) -> int`
  - `app.rag.bootstrap.load_sources() -> list[dict]`, `draft_seed_skills()` (stub, raises `NotImplementedError`)
  - `app.agent.tools.vision.scan_material(image_bytes: bytes, content_type: str = "image/jpeg") -> MaterialIdentification`; raises `VisionUnavailable`
  - `app.agent.tools.retrieval.search_skills(sb, query: str, material: str | None = None) -> list[RetrievedChunk]`; `RetrievedChunk(chunk_id, skill_id, content, metadata, rrf_score, rerank_score)`
  - `app.agent.tools.discovery.discover_skill(material: Material, user_intent: str) -> None`; module-level `_drafter() -> Agent`, `_safety_checker() -> Agent`, `load_sources`
  - `app.agent.orchestrator.build_query(material: str, condition: str, user_intent: str) -> str`, `generate_solution(query: str, chunks: list[RetrievedChunk]) -> SolutionPackage`, `_openrouter_model(model_name: str)`
  - `app.agent.fallback.generic_safe_procedure(material: Material) -> SolutionPackage`
  - `app.deps.get_supabase() -> Client`, `require_service_role`, `get_optional_user_id`
  - `app.schemas`: `Material`, `Difficulty`, `SkillStatus`, `MaterialIdentification`, `SkillDraft`, `SafetyVerdict`, `SolutionPackage`, `ScanResponse`, `RecommendRequest`, `RecommendResponse`, `SkillStatusUpdate`, `IngestRequest`
  - `app.config.get_settings() -> Settings` (fields: `chat_model`, `vision_model`, `vision_fallback_model`, `embedding_model`, `rerank_model`, `vision_confidence_threshold`, `rerank_score_threshold`, `retrieval_top_k`, `rerank_top_k`)

- [ ] **Step 1: Verify green baseline**

Run: `uv run ruff check . && uv run pytest -q`
Expected: `All checks passed!` and `5 passed`

- [ ] **Step 2: Commit**

```bash
cd ..   # repo root
git add backend/
git commit -m "feat(backend): scaffold FastAPI AI pipeline per design spec"
```

---

### Task 2: Pydantic schema unit tests

**Files:**
- Test: `backend/tests/test_schemas.py` (create)

**Interfaces:**
- Consumes: `app.schemas` models (Task 1).
- Produces: nothing new — locks schema behavior for later tasks.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_schemas.py
import pytest
from pydantic import ValidationError

from app.schemas import (
    Material,
    MaterialIdentification,
    RecommendRequest,
    SkillDraft,
    SolutionPackage,
)


def test_confidence_upper_bound() -> None:
    with pytest.raises(ValidationError):
        MaterialIdentification(material=Material.kaca, condition="utuh", confidence=1.5)


def test_confidence_lower_bound() -> None:
    with pytest.raises(ValidationError):
        MaterialIdentification(material=Material.kaca, condition="utuh", confidence=-0.1)


def test_unknown_material_rejected() -> None:
    with pytest.raises(ValidationError):
        MaterialIdentification(material="styrofoam", condition="x", confidence=0.5)


def test_recommend_request_requires_user_intent() -> None:
    with pytest.raises(ValidationError):
        RecommendRequest()


def test_skill_draft_defaults_empty_lists() -> None:
    d = SkillDraft(title="Pot PET", material=Material.plastik_pet, difficulty="pemula")
    assert d.tools == [] and d.steps == [] and d.risks == [] and d.sources == []


def test_solution_package_sources_default() -> None:
    p = SolutionPackage(recommendation="tidak tersedia")
    assert p.sources == []
```

- [ ] **Step 2: Run tests**

Run: `uv run pytest tests/test_schemas.py -v`
Expected: all 6 PASS immediately (they pin existing behavior; if any FAILS, the schema has a bug — fix `app/schemas.py`, not the test).

- [ ] **Step 3: Commit**

```bash
git add tests/test_schemas.py
git commit -m "test: pin Pydantic schema validation behavior"
```

---

### Task 3: hybrid_search SQL tests against Postgres

**Files:**
- Test: `backend/tests/test_hybrid_search.py` (create)
- Modify: `backend/pyproject.toml` (add dev dep `psycopg[binary]`)

**Interfaces:**
- Consumes: `backend/supabase/migrations/20260728000001_init.sql` — SQL function `hybrid_search(query_embedding vector(1024), query_text text, material_filter text, match_count int, rrf_k int) returns table(chunk_id uuid, skill_id uuid, content text, metadata jsonb, score double precision)`.
- Produces: `TEST_DATABASE_URL` env convention used by CI (Task 8). Tests self-apply the migration (with an `auth.uid()` stub) on a bare pgvector Postgres, and skip cleanly when no DB is reachable.

- [ ] **Step 1: Add psycopg dev dependency**

Run: `uv add --dev "psycopg[binary]"`
Expected: `pyproject.toml` dev group gains `psycopg[binary]`, lockfile updated.

- [ ] **Step 2: Write the failing tests**

```python
# backend/tests/test_hybrid_search.py
import os
from pathlib import Path

import pytest

psycopg = pytest.importorskip("psycopg")

DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)
MIGRATION = Path(__file__).parents[1] / "supabase/migrations/20260728000001_init.sql"

# Bare Postgres (CI service container) has no Supabase auth schema; stub it so
# the migration's RLS policy using auth.uid() applies. Local `supabase start`
# already has both the schema and the migration applied.
AUTH_STUB = """
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as 'select null::uuid';
"""


def vec(hot: int) -> str:
    values = ["0"] * 1024
    values[hot] = "1"
    return "[" + ",".join(values) + "]"


@pytest.fixture(scope="module")
def db():
    try:
        conn = psycopg.connect(DATABASE_URL, autocommit=True, connect_timeout=3)
    except Exception:
        pytest.skip("no test database reachable at TEST_DATABASE_URL")
    with conn.cursor() as cur:
        cur.execute("select to_regclass('public.skill_chunks')")
        if cur.fetchone()[0] is None:
            cur.execute(AUTH_STUB)
            cur.execute(MIGRATION.read_text())
    yield conn
    conn.close()


@pytest.fixture()
def seeded(db):
    with db.cursor() as cur:
        cur.execute("delete from skills")
        cur.execute(
            "insert into skills (title, material, difficulty, status, origin) values "
            "('Pot dari botol PET','plastik_pet','pemula','approved','seed') returning id"
        )
        skill_id = cur.fetchone()[0]
        cur.execute(
            "insert into skill_chunks (skill_id, content, embedding, metadata) values "
            "(%s, 'cara membuat pot tanaman dari botol plastik bekas', %s::vector,"
            " '{\"material\": \"plastik_pet\"}'),"
            "(%s, 'melipat kardus bekas menjadi rak buku sederhana', %s::vector,"
            " '{\"material\": \"kardus\"}')",
            (skill_id, vec(0), skill_id, vec(1)),
        )
    return skill_id


def _search(db, embedding: str, text: str, material: str | None):
    with db.cursor() as cur:
        cur.execute(
            "select content, metadata, score from hybrid_search(%s::vector, %s, %s, 5)",
            (embedding, text, material),
        )
        return cur.fetchall()


def test_vector_match_ranks_first(db, seeded):
    rows = _search(db, vec(0), "pot tanaman botol plastik", None)
    assert rows
    assert "pot tanaman" in rows[0][0]
    assert rows[0][2] > 0


def test_material_filter_excludes_other_materials(db, seeded):
    rows = _search(db, vec(1), "rak buku kardus", "plastik_pet")
    assert all(r[1]["material"] == "plastik_pet" for r in rows)


def test_no_match_returns_empty(db, seeded):
    rows = _search(db, vec(2), "zzz qqq tidakadakata", "kaca")
    assert rows == []


def test_lexical_only_still_matches(db, seeded):
    # Orthogonal embedding, but FTS should still find the kardus chunk.
    rows = _search(db, vec(3), "rak buku kardus", None)
    assert any("rak buku" in r[0] for r in rows)
```

- [ ] **Step 3: Start local Supabase and run tests**

Run (repo `backend/`; requires Supabase CLI):
```bash
supabase init --force 2>/dev/null || true   # keeps existing supabase/migrations
supabase start
supabase db reset   # applies backend/supabase/migrations/*
uv run pytest tests/test_hybrid_search.py -v
```
Expected: 4 PASS. If Supabase CLI is unavailable, run a bare pgvector container instead:
```bash
docker run -d --name wastex-pg -e POSTGRES_PASSWORD=postgres -p 54322:5432 pgvector/pgvector:pg16
uv run pytest tests/test_hybrid_search.py -v
```
Expected: 4 PASS (fixture applies auth stub + migration itself). Without any DB: 4 SKIPPED.

- [ ] **Step 4: Commit**

```bash
git add tests/test_hybrid_search.py pyproject.toml uv.lock
git commit -m "test: hybrid_search RRF, material filter, and lexical path against Postgres"
```

---

### Task 4: Test fakes + image upload to Supabase Storage in /scan

**Files:**
- Create: `backend/tests/fakes.py`
- Create: `backend/supabase/migrations/20260728000002_storage_scans.sql`
- Modify: `backend/app/api/scan.py`
- Test: `backend/tests/test_scan_storage.py` (create)

**Interfaces:**
- Consumes: `app.deps.get_supabase`, `app.agent.tools.vision.scan_material`, `ScanResponse`.
- Produces:
  - `tests.fakes.FakeSupabase(tables: dict[str, list[dict]] | None = None)` with `.table(name) -> FakeTable`, `.rpc(name, params) -> FakeResult`, `.storage.from_(bucket) -> FakeStorageBucket`
  - `FakeTable.rows: list[dict]`, `.inserted: list[dict]`, `.updated: list[dict]`
  - `FakeStorageBucket.uploads: list[tuple[str, int, dict | None]]`
  - `/scan` rows now carry `id` (client-generated UUID) and `image_url` (Storage object path `"{scan_id}.{ext}"` in private bucket `scans`).

- [ ] **Step 1: Write the fakes**

```python
# backend/tests/fakes.py
from uuid import uuid4


class FakeResult:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return self

    def eq(self, *args):
        return self

    def order(self, *args, **kwargs):
        return self

    def single(self):
        if isinstance(self.data, list):
            self.data = self.data[0] if self.data else None
        return self


class FakeTable:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.inserted = []
        self.updated = []

    def insert(self, data):
        items = data if isinstance(data, list) else [data]
        stored = [{**item, "id": item.get("id") or str(uuid4())} for item in items]
        self.inserted.extend(stored)
        self.rows.extend(stored)
        return FakeResult(stored)

    def select(self, *args):
        return FakeResult(list(self.rows))

    def update(self, data):
        self.updated.append(data)
        for row in self.rows:
            row.update(data)
        return FakeResult(list(self.rows))

    def delete(self):
        return FakeResult([])


class FakeStorageBucket:
    def __init__(self):
        self.uploads = []

    def upload(self, path, data, file_options=None):
        self.uploads.append((path, len(data), file_options))


class FakeStorage:
    def __init__(self):
        self.buckets = {}

    def from_(self, name):
        return self.buckets.setdefault(name, FakeStorageBucket())


class FakeSupabase:
    def __init__(self, tables=None):
        self.tables = {name: FakeTable(rows) for name, rows in (tables or {}).items()}
        self.storage = FakeStorage()

    def table(self, name):
        return self.tables.setdefault(name, FakeTable())

    def rpc(self, name, params):
        return FakeResult([])
```

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_scan_storage.py
import pytest
from fastapi.testclient import TestClient

import app.api.scan as scan_module
from app.deps import get_supabase
from app.main import app
from app.schemas import Material, MaterialIdentification
from tests.fakes import FakeSupabase

client = TestClient(app)


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _identify(confidence: float):
    async def fake_scan(image_bytes, content_type="image/jpeg"):
        return MaterialIdentification(
            material=Material.plastik_pet, condition="bersih", confidence=confidence
        )

    return fake_scan


def test_scan_uploads_image_and_stores_path(fake_sb, monkeypatch):
    monkeypatch.setattr(scan_module, "scan_material", _identify(0.95))
    r = client.post("/scan", files={"file": ("botol.jpg", b"fakejpegbytes", "image/jpeg")})
    assert r.status_code == 200
    uploads = fake_sb.storage.from_("scans").uploads
    assert len(uploads) == 1
    row = fake_sb.table("scans").inserted[0]
    assert row["image_url"] == uploads[0][0]
    assert row["image_url"].endswith(".jpeg")
    assert row["id"] in row["image_url"]


def test_scan_survives_storage_failure(fake_sb, monkeypatch):
    monkeypatch.setattr(scan_module, "scan_material", _identify(0.95))

    def broken_upload(path, data, file_options=None):
        raise RuntimeError("storage down")

    fake_sb.storage.from_("scans").upload = broken_upload
    r = client.post("/scan", files={"file": ("botol.jpg", b"x", "image/jpeg")})
    assert r.status_code == 200
    assert fake_sb.table("scans").inserted[0]["image_url"] is None
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_scan_storage.py -v`
Expected: FAIL — `KeyError: 'image_url'` (scan.py does not upload yet).

- [ ] **Step 4: Implement upload in scan.py**

Replace the body of `backend/app/api/scan.py` with:

```python
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from supabase import Client

from app.agent.tools.vision import VisionUnavailable, scan_material
from app.config import get_settings
from app.deps import get_optional_user_id, get_supabase
from app.schemas import Material, ScanResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("", response_model=ScanResponse)
async def scan(
    file: UploadFile,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> ScanResponse:
    image = await file.read()
    if not image:
        raise HTTPException(status_code=400, detail="empty image")
    content_type = file.content_type or "image/jpeg"
    try:
        ident = await scan_material(image, content_type)
    except VisionUnavailable:
        raise HTTPException(status_code=503, detail="vision providers unavailable")

    scan_id = str(uuid4())
    object_path = f"{scan_id}.{content_type.split('/')[-1]}"
    image_url: str | None = object_path
    try:
        sb.storage.from_("scans").upload(object_path, image, {"content-type": content_type})
    except Exception:
        logger.exception("scan image upload failed; storing scan without image_url")
        image_url = None

    row = (
        sb.table("scans")
        .insert(
            {
                "id": scan_id,
                "user_id": user_id,
                "image_url": image_url,
                "material": ident.material.value,
                "condition": ident.condition,
                "confidence": ident.confidence,
                "raw_json": ident.model_dump(mode="json"),
            }
        )
        .execute()
        .data[0]
    )

    # Gate 1: low confidence -> user picks material manually.
    if ident.confidence < get_settings().vision_confidence_threshold:
        return ScanResponse(
            scan_id=row["id"],
            status="needs_manual_verification",
            identification=ident,
            material_options=list(Material),
        )
    return ScanResponse(scan_id=row["id"], status="identified", identification=ident)
```

- [ ] **Step 5: Add the storage bucket migration**

```sql
-- backend/supabase/migrations/20260728000002_storage_scans.sql
insert into storage.buckets (id, name, public)
values ('scans', 'scans', false)
on conflict (id) do nothing;
```

- [ ] **Step 6: Run the full suite**

Run: `uv run pytest -q && uv run ruff check .`
Expected: all PASS (previous suites unaffected), lint clean.

- [ ] **Step 7: Commit**

```bash
git add tests/fakes.py tests/test_scan_storage.py app/api/scan.py supabase/migrations/20260728000002_storage_scans.sql
git commit -m "feat: upload scan images to private Storage bucket, store object path"
```

---

### Task 5: Gate integration tests (4 gates × pass/fail)

**Files:**
- Test: `backend/tests/test_gates.py` (create)

**Interfaces:**
- Consumes: `tests.fakes.FakeSupabase`/`FakeTable` (Task 4), routers, `RetrievedChunk`, `discover_skill` internals (`_drafter`, `_safety_checker`, `load_sources`, `get_supabase` as imported in `app.agent.tools.discovery`), `ingest_skill` as imported in `app.api.skills`.
- Produces: `FakeAgent`/`FakeAgentResult` test doubles (local to this file) — pattern reused in Task 6 tests.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_gates.py
import pytest
from fastapi.testclient import TestClient

import app.agent.tools.discovery as discovery_module
import app.api.recommend as recommend_module
import app.api.scan as scan_module
import app.api.skills as skills_module
from app.agent.tools.retrieval import RetrievedChunk
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
        chunk_id="c1", skill_id="s1", content="langkah", metadata={}, rrf_score=0.03, rerank_score=0.92
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
    monkeypatch.setattr(discovery_module, "load_sources", lambda: [])
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
```

- [ ] **Step 2: Run the tests**

Run: `uv run pytest tests/test_gates.py -v`
Expected: all 12 PASS. These pin existing gate behavior — a FAIL means a route/gate bug; fix the app code, never weaken the assertion. (Known risk: if `ingest_skill` was not imported into `app/api/skills.py` namespace the monkeypatch target fails — it is, as `from app.rag.ingest import ingest_skill`.)

- [ ] **Step 3: Commit**

```bash
git add tests/test_gates.py
git commit -m "test: integration matrix for all 4 safety/quality gates"
```

---

### Task 6: Seed bootstrap drafting (spec §6)

**Files:**
- Modify: `backend/app/rag/bootstrap.py` (replace `NotImplementedError` stub)
- Test: `backend/tests/test_bootstrap.py` (create)

**Interfaces:**
- Consumes: `load_sources()`, `_openrouter_model`, `get_supabase`, `SkillDraft`, `Material`, `Difficulty`.
- Produces: `draft_seed_skills(per_cell: int = 1) -> int` (count of inserted drafts); module-level `_seed_drafter() -> Agent`. CLI: `uv run python -m app.rag.bootstrap`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_bootstrap.py
import pytest

import app.rag.bootstrap as bootstrap_module
from app.schemas import Material, SkillDraft
from tests.fakes import FakeSupabase


class FakeAgentResult:
    def __init__(self, output):
        self.output = output


class FakeAgent:
    def __init__(self, output):
        self._output = output
        self.prompts = []

    async def run(self, prompt):
        self.prompts.append(prompt)
        return FakeAgentResult(self._output)


async def test_drafts_one_skill_per_material_difficulty_cell(monkeypatch):
    fake_sb = FakeSupabase()
    draft = SkillDraft(title="Contoh", material=Material.kardus, difficulty="pemula")
    agent = FakeAgent(draft)
    monkeypatch.setattr(bootstrap_module, "load_sources", lambda: [{"id": "src-1"}])
    monkeypatch.setattr(bootstrap_module, "get_supabase", lambda: fake_sb)
    monkeypatch.setattr(bootstrap_module, "_seed_drafter", lambda: agent)

    count = await bootstrap_module.draft_seed_skills()

    assert count == 18  # 6 materials x 3 difficulties
    inserted = fake_sb.table("skills").inserted
    assert len(inserted) == 18
    assert all(row["status"] == "draft" and row["origin"] == "seed" for row in inserted)
    assert "plastik_pet" in agent.prompts[0]


async def test_refuses_to_run_without_sources(monkeypatch):
    monkeypatch.setattr(bootstrap_module, "load_sources", lambda: [])
    with pytest.raises(SystemExit):
        await bootstrap_module.draft_seed_skills()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_bootstrap.py -v`
Expected: first test FAILS with `NotImplementedError`; second PASSES (stub already exits on empty sources).

- [ ] **Step 3: Implement draft_seed_skills**

Replace `backend/app/rag/bootstrap.py` entirely with:

```python
"""Seed bootstrap: draft skills per (material x difficulty) from sources.yaml (spec §6)."""

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic_ai import Agent

from app.config import get_settings
from app.deps import get_supabase
from app.schemas import Difficulty, Material, SkillDraft

SOURCES_PATH = Path(__file__).resolve().parents[2] / "sources.yaml"

SEED_PROMPT = """Kamu menyusun draft keterampilan upcycling untuk knowledge base WASTEX.
Gunakan HANYA sumber dari whitelist yang diberikan - kutip di field sources.
Keterampilan harus aman, konkret, dengan alat terjangkau; setiap risiko wajib punya mitigasi.
Sesuaikan kompleksitas dengan tingkat kesulitan yang diminta."""


def load_sources() -> list[dict]:
    if not SOURCES_PATH.exists():
        return []
    data = yaml.safe_load(SOURCES_PATH.read_text()) or {}
    return data.get("sources", [])


@lru_cache
def _seed_drafter() -> Agent:
    from app.agent.orchestrator import _openrouter_model

    return Agent(
        _openrouter_model(get_settings().chat_model),
        output_type=SkillDraft,
        system_prompt=SEED_PROMPT,
        retries=1,
    )


async def draft_seed_skills(per_cell: int = 1) -> int:
    sources = load_sources()
    if not sources:
        raise SystemExit("sources.yaml is empty - curate sources before bootstrapping (spec §6)")
    whitelist = yaml.safe_dump(sources, allow_unicode=True)
    sb = get_supabase()
    count = 0
    for material in Material:
        for difficulty in Difficulty:
            for _ in range(per_cell):
                result = await _seed_drafter().run(
                    f"Whitelist sumber:\n{whitelist}\n\n"
                    f"Material: {material.value}\nTingkat kesulitan: {difficulty.value}"
                )
                draft: SkillDraft = result.output
                sb.table("skills").insert(
                    {**draft.model_dump(mode="json"), "status": "draft", "origin": "seed"}
                ).execute()
                count += 1
    return count


if __name__ == "__main__":
    import asyncio

    print(f"inserted {asyncio.run(draft_seed_skills())} seed drafts")
```

- [ ] **Step 4: Run the full suite**

Run: `uv run pytest -q && uv run ruff check .`
Expected: all PASS (including both bootstrap tests), lint clean.

- [ ] **Step 5: Commit**

```bash
git add app/rag/bootstrap.py tests/test_bootstrap.py
git commit -m "feat: implement seed bootstrap drafting per material x difficulty cell"
```

---

### Task 7: RAGAS evaluation runner (spec §7)

**Files:**
- Modify: `backend/pyproject.toml` (add `eval` dependency group)
- Modify: `backend/eval/run_ragas.py` (replace skeleton)
- Test: `backend/tests/test_eval_loader.py` (create)

**Interfaces:**
- Consumes: `eval/golden.jsonl` rows `{question, ground_truth, type, material}`; live pipeline `search_skills` + `generate_solution` (requires real keys + populated KB — run manually, not in CI).
- Produces: `eval.run_ragas.load_golden() -> list[dict]`, `collect_sample(sample: dict) -> dict` (keys: `user_input`, `retrieved_contexts`, `response`, `reference`), CLI `uv run python eval/run_ragas.py --out eval/results/<date>.json`.

- [ ] **Step 1: Add eval dependency group**

Run: `uv add --group eval ragas langchain-openai`
Expected: `pyproject.toml` gains `[dependency-groups] eval = [...]`, lock updated. (CI installs only `dev`, so RAGAS stays out of CI.)

- [ ] **Step 2: Write the failing loader test**

```python
# backend/tests/test_eval_loader.py
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "run_ragas", Path(__file__).parents[1] / "eval/run_ragas.py"
)
run_ragas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run_ragas)


def test_golden_has_required_fields():
    golden = run_ragas.load_golden()
    assert len(golden) >= 2
    for row in golden:
        assert {"question", "ground_truth", "type", "material"} <= set(row)


def test_golden_includes_adversarial_sample():
    assert any(r["type"] == "adversarial" for r in run_ragas.load_golden())
```

- [ ] **Step 3: Run test to verify current state**

Run: `uv run pytest tests/test_eval_loader.py -v`
Expected: PASS already for the loader (skeleton has `load_golden`); if `exec_module` fails, fix imports in run_ragas.py in the next step.

- [ ] **Step 4: Implement the runner**

Replace `backend/eval/run_ragas.py` entirely with:

```python
"""RAGAS evaluation runner (spec §7). Run manually against a populated KB:

    uv sync --group eval
    uv run python eval/run_ragas.py --out eval/results/2026-07-28.json

Targets: faithfulness >=90%, context precision >=85%, context recall >=80%,
answer relevancy >=80%. Judge LLM via OpenRouter, embeddings via DeepInfra.
"""

import argparse
import asyncio
import json
from pathlib import Path

GOLDEN_PATH = Path(__file__).parent / "golden.jsonl"


def load_golden() -> list[dict]:
    return [json.loads(line) for line in GOLDEN_PATH.read_text().splitlines() if line.strip()]


async def collect_sample(sample: dict) -> dict:
    from app.agent.orchestrator import build_query, generate_solution
    from app.agent.tools.retrieval import search_skills
    from app.deps import get_supabase

    sb = get_supabase()
    query = build_query(sample["material"], "", sample["question"])
    chunks = await search_skills(sb, query, sample["material"])
    package = await generate_solution(query, chunks)
    return {
        "user_input": sample["question"],
        "retrieved_contexts": [c.content for c in chunks],
        "response": package.recommendation,
        "reference": sample["ground_truth"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from ragas import EvaluationDataset, evaluate
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import (
        answer_relevancy,
        context_precision,
        context_recall,
        faithfulness,
    )

    from app.config import get_settings

    settings = get_settings()
    judge = LangchainLLMWrapper(
        ChatOpenAI(
            model=settings.chat_model,
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )
    )
    embeddings = LangchainEmbeddingsWrapper(
        OpenAIEmbeddings(
            model=settings.embedding_model,
            base_url="https://api.deepinfra.com/v1/openai",
            api_key=settings.deepinfra_api_key,
            check_embedding_ctx_length=False,
        )
    )

    golden = load_golden()
    rows = [asyncio.run(collect_sample(s)) for s in golden]
    dataset = EvaluationDataset.from_list(rows)
    result = evaluate(
        dataset,
        metrics=[faithfulness, context_precision, context_recall, answer_relevancy],
        llm=judge,
        embeddings=embeddings,
    )
    df = result.to_pandas()
    metric_cols = ["faithfulness", "context_precision", "context_recall", "answer_relevancy"]
    scores = {col: float(df[col].mean()) for col in metric_cols}

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"n_samples": len(rows), "scores": scores}, indent=2))
    print(json.dumps(scores, indent=2))


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run loader tests + lint**

Run: `uv run pytest tests/test_eval_loader.py -v && uv run ruff check .`
Expected: 2 PASS, lint clean. (Full RAGAS run is a manual staging step — do NOT wire into CI.)

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml uv.lock eval/run_ragas.py tests/test_eval_loader.py
git commit -m "feat: RAGAS runner with OpenRouter judge and DeepInfra embeddings"
```

---

### Task 8: CI workflow

**Files:**
- Create: `.github/workflows/backend-ci.yml` (repo root, NOT backend/)

**Interfaces:**
- Consumes: `TEST_DATABASE_URL` convention from Task 3 (hybrid_search tests self-apply the migration on bare pgvector Postgres).
- Produces: CI gate for every PR touching `backend/**`.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/backend-ci.yml
name: backend-ci

on:
  push:
    branches: [main]
    paths: ["backend/**", ".github/workflows/backend-ci.yml"]
  pull_request:
    paths: ["backend/**", ".github/workflows/backend-ci.yml"]

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      TEST_DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5432/postgres
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync
      - run: uv run ruff check .
      - run: uv run pytest -q
```

- [ ] **Step 2: Validate locally**

Run (from `backend/`): `TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" uv run pytest -q`
Expected: full suite PASS including hybrid_search tests (with local Supabase or the docker pgvector container from Task 3 running; otherwise those 4 SKIP — acceptable locally, CI always runs them).

- [ ] **Step 3: Commit**

```bash
cd ..   # repo root
git add .github/workflows/backend-ci.yml
git commit -m "ci: backend lint + tests with pgvector service container"
```

---

### Task 9: E2E smoke script (staging, manual)

**Files:**
- Create: `backend/scripts/smoke.sh`

**Interfaces:**
- Consumes: deployed `/health`, `/scan`, `/recommend` endpoints.
- Produces: manual release check — 1 real photo per material through `/recommend` (spec §7).

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# E2E smoke (spec §7): run one real photo per material through /scan + /recommend.
# Usage: scripts/smoke.sh https://staging.example.up.railway.app path/to/images
set -euo pipefail

BASE_URL=${1:?usage: smoke.sh <base_url> <image_dir>}
IMAGE_DIR=${2:?usage: smoke.sh <base_url> <image_dir>}

echo "== health"
curl -fsS "$BASE_URL/health"
echo

for img in "$IMAGE_DIR"/*; do
  echo "== scan: $img"
  scan_json=$(curl -fsS -F "file=@$img" "$BASE_URL/scan")
  echo "$scan_json"
  scan_id=$(echo "$scan_json" | python3 -c "import sys,json;print(json.load(sys.stdin)['scan_id'])")
  echo "== recommend: scan_id=$scan_id"
  curl -fsS -H 'Content-Type: application/json' \
    -d "{\"scan_id\": \"$scan_id\", \"user_intent\": \"buat kerajinan sederhana untuk dijual\"}" \
    "$BASE_URL/recommend" | head -c 600
  echo; echo
done
echo "smoke OK"
```

- [ ] **Step 2: Make executable and sanity-check**

Run: `chmod +x scripts/smoke.sh && bash -n scripts/smoke.sh`
Expected: no output (syntax OK). Full run happens manually against staging once deployed and seeded.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke.sh
git commit -m "chore: e2e smoke script for staging (one photo per material)"
```

---

## Deferred (human/ops prerequisites — not code tasks)

- Curate 20–30 vetted sources into `backend/sources.yaml` (blocks bootstrap + discovery).
- Review/approve 50–100 seed skills in Supabase Table Editor after running `uv run python -m app.rag.bootstrap`.
- Grow `eval/golden.jsonl` to 30+ real Q&A pairs (replace placeholders); collect 60 benchmark images (10/class).
- Provision Supabase project, apply migrations (`supabase db push`), set Railway secrets, deploy.
- Replace shared-service-key expert auth with per-expert JWT claims (spec §10 — separate future spec).
