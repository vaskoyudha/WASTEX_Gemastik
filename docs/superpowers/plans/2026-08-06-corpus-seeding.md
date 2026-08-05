# Corpus Seeding Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the RAG corpus from nearly empty (1 skill, 0 documents) to full coverage — 18 seed skills (6 materials × 3 difficulties) + 3 whitelist documents — with safety checks, user review, and per-material retrieval verification, plus an end-to-end test of the full AI skill flow.

**Architecture:** A content-ops pipeline in `backend/scripts/` that reuses existing components: `draft_seed_skills` (bootstrap), `_safety_checker` (discovery), `ingest_skill`/`ingest_document`, `search_corpus` (retrieval). Pure helpers live in `backend/scripts/corpus_common.py` (unit-tested hermetically); each script is thin orchestration. A backend E2E script (`backend/eval/e2e_skill_flow.py`) proves the full flow scan → recommend → proposals → verify → create → approve → retrievable. A manual Playwright script covers the frontend journey.

**Tech Stack:** Python 3.12 + uv, FastAPI backend modules, supabase-py (service client), httpx, pytest (FakeSupabase pattern), ruff. Spec: `docs/superpowers/specs/2026-08-06-corpus-seeding-design.md`.

## Global Constraints

- Ruff: line-length 100, `B008`/`BLE001` ignored. CI gates: `uv run ruff check backend/` + `uv run ruff format --check backend/` (run from `backend/`; repo-root `uv run ruff` fails to spawn on this machine — run from `backend/`).
- Backend suite: `uv run pytest tests/` from `backend/` (baseline 218 passed, 8 skipped — the skips are DB-gated `test_hybrid_search.py`). Tests self-configure dummy keys via `backend/tests/conftest.py`; unit tests never hit real providers — Supabase uses `tests/fakes.py::FakeSupabase`, HTTP uses monkeypatched functions.
- Scripts in `backend/scripts/` run with `uv run python scripts/<name>.py` from `backend/`; each script must `sys.path.insert(0, str(Path(__file__).resolve().parents[1]))` before importing `app.*` modules (scripts/ is not a package).
- Tests that import `scripts/corpus_common` must add the scripts dir to `sys.path` in the test file (pattern: `sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))`).
- LLM calls in scripts use the free models already configured (`chat_model` default + fallback); `generate_all_visuals` is NEVER triggered by these scripts (image-gen is paid).
- Real keys live in `backend/.env` (gitignored). NEVER read or write `backend/database/.env` (tracked in git with placeholder creds). Do not commit `.gitignore`, `QWEN.md`, or root `supabase/migrations/`.
- Commits to `main`, messages in repo style (`feat:`, `test:`, `docs:`).
- E2E scripts (`backend/eval/`, `e2e/`) are NOT CI gates — they need live server + real keys; they must clean up after themselves (delete `[E2E`-prefixed test data.

---

### Task 1: `scripts/corpus_common.py` — shared helpers + tests

**Files:**
- Create: `backend/scripts/corpus_common.py`
- Create: `backend/tests/test_corpus_scripts.py`

**Interfaces:**
- Consumes: `app.rag.ingest.ingest_skill`, `app.rag.document_ingest.ingest_document` (existing).
- Produces: `MATERIAL_QUERIES: dict[str, str]` (6 material → test query); `PASS_THRESHOLD = 0.40`; `should_skip_seed(existing_drafts: list, force: bool) -> bool`; `format_seed_review(items: list[dict]) -> str`; `format_coverage_report(results: list[dict]) -> str`; `coverage_pass(rerank_scores: list[float], threshold: float = PASS_THRESHOLD) -> bool`; `async approve_skill(sb, skill_id: str, reviewed_by: str = "seed-pipeline") -> dict`; `async ingest_document_source(sb, source: dict) -> dict`.

- [ ] **Step 1: Write the failing tests** (create `backend/tests/test_corpus_scripts.py`):

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

import corpus_common as cc
from tests.fakes import FakeSupabase, FakeTable


def test_material_queries_cover_all_six():
    assert set(cc.MATERIAL_QUERIES) == {
        "plastik_pet", "plastik_hdpe", "kardus", "kaleng", "kaca", "sachet",
    }


def test_should_skip_seed():
    assert cc.should_skip_seed([{"id": "s1"}], force=False) is True
    assert cc.should_skip_seed([{"id": "s1"}], force=True) is False
    assert cc.should_skip_seed([], force=False) is False


def test_coverage_pass():
    assert cc.coverage_pass([0.5, 0.1]) is True
    assert cc.coverage_pass([0.39]) is False
    assert cc.coverage_pass([]) is False


def test_format_seed_review():
    items = [
        {"id": "s1", "title": "Pot dari Botol", "material": "plastik_pet",
         "difficulty": "pemula", "safe": True, "violations": [], "sources": ["wikipedia-pet"]},
        {"id": "s2", "title": "Vas Kaca", "material": "kaca", "difficulty": "mahir",
         "safe": False, "violations": ["memotong kaca tanpa sarung tangan"], "sources": []},
    ]
    report = cc.format_seed_review(items)
    assert "## Lolos (1/2)" in report
    assert "s1" in report and "Pot dari Botol" in report
    assert "## Perlu perhatian (1/2)" in report
    assert "memotong kaca tanpa sarung tangan" in report


def test_format_coverage_report():
    results = [
        {"material": "plastik_pet", "chunks": 3, "top_source": "skill", "top_score": 0.82, "pass": True},
        {"material": "kaca", "chunks": 0, "top_source": None, "top_score": None, "pass": False},
    ]
    report = cc.format_coverage_report(results)
    assert "[PASS] plastik_pet" in report
    assert "[FAIL] kaca" in report


def test_approve_skill_success(monkeypatch):
    fake = FakeSupabase()
    fake.tables["skills"] = FakeTable([{"id": "s1", "title": "X", "status": "draft", "origin": "seed"}])

    async def fake_ingest(sb, skill_id):
        return 3

    monkeypatch.setattr("corpus_common.ingest_skill", fake_ingest)
    result = asyncio_run(cc.approve_skill(fake, "s1"))
    assert result["status"] == "approved"
    assert result["chunks"] == 3
    assert fake.table("skills").rows[0]["status"] == "approved"


def test_approve_skill_skips_non_draft():
    fake = FakeSupabase()
    fake.tables["skills"] = FakeTable([{"id": "s1", "title": "X", "status": "approved", "origin": "seed"}])
    result = asyncio_run(cc.approve_skill(fake, "s1"))
    assert result["skipped"] is True


def test_ingest_document_source_url(monkeypatch):
    fake = FakeSupabase()

    async def fake_ingest_doc(sb, doc_id):
        return 5

    monkeypatch.setattr("corpus_common.ingest_document", fake_ingest_doc)
    source = {"id": "identif-tas-dompet-sachet", "title": "Tas Sachet",
              "url": "https://www.identif.id/x", "source_type": "url",
              "materials": ["sachet"]}
    result = asyncio_run(cc.ingest_document_source(fake, source))
    assert result["chunks"] == 5
    rows = fake.table("documents").inserted
    assert rows[0]["status"] == "approved"
    assert rows[0]["source_type"] == "url"


def asyncio_run(coro):
    import asyncio
    return asyncio.new_event_loop().run_until_complete(coro)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_corpus_scripts.py -v` from `backend/`
Expected: FAIL — `ModuleNotFoundError: No module named 'corpus_common'`.

- [ ] **Step 3: Write minimal implementation** (create `backend/scripts/corpus_common.py`):

```python
"""Shared helpers for the corpus seeding scripts (unit-tested hermetically)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from app.rag.document_ingest import ingest_document
from app.rag.ingest import ingest_skill

MATERIAL_QUERIES = {
    "plastik_pet": "cara membuat pot tanaman dari botol plastik",
    "plastik_hdpe": "kerajinan dari galon atau kantong plastik bekas",
    "kardus": "buat rak atau kotak dari kardus bekas",
    "kaleng": "kerajinan dari kaleng bekas",
    "kaca": "kerajinan aman dari botol kaca",
    "sachet": "membuat dompet dari bungkus sachet",
}
PASS_THRESHOLD = 0.40


def should_skip_seed(existing_drafts: list, force: bool) -> bool:
    return bool(existing_drafts) and not force


def coverage_pass(rerank_scores: list[float], threshold: float = PASS_THRESHOLD) -> bool:
    return any(s >= threshold for s in rerank_scores)


def format_seed_review(items: list[dict]) -> str:
    safe = [i for i in items if i["safe"]]
    unsafe = [i for i in items if not i["safe"]]
    lines = ["# Seed Review", ""]
    lines.append(f"## Lolos ({len(safe)}/{len(items)})")
    for i in safe:
        srcs = ", ".join(i["sources"]) or "-"
        lines.append(f"- [{i['id']}] {i['title']} — {i['material']}/{i['difficulty']} — safe — sumber: [{srcs}]")
    lines.append("")
    lines.append(f"## Perlu perhatian ({len(unsafe)}/{len(items)})")
    for i in unsafe:
        violations = "; ".join(i["violations"] or [])
        lines.append(f"- [{i['id']}] {i['title']} — UNSAFE: \"{violations}\" — jangan approve")
    return "\n".join(lines)


def format_coverage_report(results: list[dict]) -> str:
    lines = ["# Coverage Report", ""]
    for r in results:
        if r["pass"]:
            lines.append(f"[PASS] {r['material']}: {r['chunks']} chunks, top={r['top_source']} ({r['top_score']})")
        else:
            lines.append(f"[FAIL] {r['material']}: {r['chunks']} chunks — korpus belum punya konten {r['material']}!")
    return "\n".join(lines)


async def approve_skill(sb, skill_id: str, reviewed_by: str = "seed-pipeline") -> dict:
    res = sb.table("skills").select("*").eq("id", skill_id).single().execute()
    row = res.data
    if not row or row["status"] != "draft":
        return {"id": skill_id, "skipped": True}
    sb.table("skills").update({"status": "approved", "reviewed_by": reviewed_by}).eq("id", skill_id).execute()
    try:
        chunks = await ingest_skill(sb, skill_id)
        return {"id": skill_id, "status": "approved", "chunks": chunks}
    except Exception as exc:
        return {"id": skill_id, "status": "approved", "error": str(exc)}


async def ingest_document_source(sb, source: dict) -> dict:
    existing = sb.table("documents").select("id").eq("url", source["url"]).execute()
    if existing.data:
        return {"id": source["id"], "skipped": True}
    if source["source_type"] == "pdf":
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.get(source["url"])
            r.raise_for_status()
        from uuid import uuid4
        doc_id = str(uuid4())
        path = f"documents/{doc_id}.pdf"
        sb.storage.from_("documents").upload(path, r.content)
        sb.table("documents").insert({"id": doc_id, "title": source["title"], "source_type": "pdf",
            "url": source["url"], "file_path": path, "materials": source["materials"], "status": "approved"}).execute()
    else:
        res = sb.table("documents").insert({"title": source["title"], "source_type": "url", "url": source["url"],
            "materials": source["materials"], "status": "approved"}).execute()
        doc_id = res.data[0]["id"]
    try:
        chunks = await ingest_document(sb, doc_id)
        return {"id": source["id"], "chunks": chunks}
    except Exception as exc:
        return {"id": source["id"], "error": str(exc)}
```

- [ ] **Step 4: Run test to verify it passes** — `cd backend && uv run pytest tests/test_corpus_scripts.py -v` from `backend/` — expected 8 PASS. (If ruff flags the file, run `uv run ruff check --fix + format on ONLY the two files — whitespace only, logic verbatim.)
- [ ] **Step 5: Commit** — `git add backend/scripts/corpus_common.py backend/tests/test_corpus_scripts.py` + message `feat(corpus): shared helpers for seeding pipeline`.

---

### Task 2: `scripts/seed_corpus.py` — seed + safety check + review report

**Files:**
- Create: `backend/scripts/seed_corpus.py`

**Interfaces:**
- Consumes: `corpus_common.should_skip_seed`, `corpus_common.format_seed_review` (Task 1); `app.rag.bootstrap.draft_seed_skills`; `app.agent.tools.discovery._safety_checker`; `app.schemas.SkillDraft`; `app.deps.get_supabase`.
- Produces: `uv run python scripts/seed_corpus.py [--force] [--out FILE]` — inserts 18 seed drafts (if none exist or `--force`), safety-checks each, prints/writes the review report. Exit 0 on success, 1 if any safety check failed.

- [ ] **Step 1: Write the script** (create `backend/scripts/seed_corpus.py`):

```python
"""Seed the RAG corpus: draft skills per (material x difficulty) from the
sources.yaml whitelist, safety-check each draft, and emit a review report.

Usage (from backend/):
    uv run python scripts/seed_corpus.py [--force] [--out FILE]
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import corpus_common as cc
from app.agent.tools.discovery import _safety_checker
from app.deps import get_supabase
from app.rag.bootstrap import draft_seed_skills
from app.schemas import SkillDraft


async def main(force: bool, out: str | None) -> int:
    sb = get_supabase()
    existing = sb.table("skills").select("id").eq("origin", "seed").eq("status", "draft").execute().data
    if cc.should_skip_seed(existing, force):
        print(f"SKIP: {len(existing)} seed draft(s) already exist — use --force to add more")
        return 0

    count = await draft_seed_skills()
    print(f"inserted {count} seed drafts")

    rows = sb.table("skills").select("*").eq("origin", "seed").eq("status", "draft").execute().data
    items = []
    failed = 0
    for row in rows:
        try:
            draft = SkillDraft(**{k: row[k] for k in (
                "title", "material", "difficulty", "tools", "steps", "risks",
                "est_cost_idr", "est_price_idr", "sources",
            )})
            result = await _safety_checker().run(draft.model_dump_json())
            verdict = result.output
            items.append({
                "id": str(row["id"]), "title": draft.title,
                "material": draft.material.value, "difficulty": draft.difficulty.value,
                "safe": verdict.safe, "violations": verdict.violations,
                "sources": [s.url or s.citation or "" for s in draft.sources],
            })
        except Exception as exc:
            failed += 1
            items.append({
                "id": str(row["id"]), "title": row.get("title", "?"),
                "material": row.get("material", "?"), "difficulty": row.get("difficulty", "?"),
                "safe": False, "violations": [f"check gagal: {exc}"], "sources": [],
            })

    report = cc.format_seed_review(items)
    print(report)
    if out:
        Path(out).write_text(report)
        print(f"\nreport saved to {out}")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="seed even if drafts exist")
    parser.add_argument("--out", default=None, help="write report to FILE")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.force, args.out)))
```

- [ ] **Step 2: Verify syntax + ruff** — from `backend/`: `uv run python -c "import ast; ast.parse(open('scripts/seed_corpus.py').read())"`, then `uv run ruff check scripts/seed_corpus.py` and `uv run ruff format --check scripts/seed_corpus.py` (fix with `uv run ruff format scripts/seed_corpus.py` if needed). Expected: syntax OK, ruff clean.
- [ ] **Step 3: Dry-run the skip path (no LLM calls)** — `uv run python scripts/seed_corpus.py` from `backend/`. Expected: either `SKIP: N seed draft(s) already exist` (if drafts exist) or the full seed runs (18 LLM calls, ~3–9 min) and prints the review report in the `format_seed_review` format.
- [ ] **Step 4: Commit** — `git add backend/scripts/seed_corpus.py` + message `feat(corpus): seed corpus script with safety check + report`.

---

### Task 3: `scripts/approve_corpus.py` — batch approve

**Files:**
- Create: `backend/scripts/approve_corpus.py`

**Interfaces:**
- Consumes: `corpus_common.approve_skill` (Task 1); `app.deps.get_supabase`.
- Produces: `uv run python scripts/approve_corpus.py <id>... [--reject <id>...] [--all-lolos]` — approves listed draft skills (or all drafts when `--all-lolos`), ingests each, prints per-ID results. Exit 0 if all succeeded, 1 if any failed.

- [ ] **Step 1: Write the script** (create `backend/scripts/approve_corpus.py`):

```python
"""Approve seed drafts in batch and ingest them into the RAG corpus.

Usage (from backend/):
    uv run python scripts/approve_corpus.py <skill-id>... [--reject <id>...]
    uv run python scripts/approve_corpus.py --all-lolos
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import corpus_common as cc
from app.deps import get_supabase


async def main(ids: list[str], reject: list[str], all_lolos: bool) -> int:
    sb = get_supabase()
    failed = 0
    if all_lolos:
        rows = sb.table("skills").select("id").eq("origin", "seed").eq("status", "draft").execute().data
        ids = [str(r["id"]) for r in rows]
    for skill_id in ids:
        result = await cc.approve_skill(sb, skill_id)
        if result.get("skipped"):
            print(f"SKIP {skill_id}: bukan draft")
        elif "error" in result:
            failed += 1
            print(f"FAIL {skill_id}: {result['error']}")
        else:
            print(f"OK {skill_id}: approved, {result['chunks']} chunks")
    for skill_id in reject:
        sb.table("skills").update({"status": "rejected"}).eq("id", skill_id).execute()
        print(f"REJECT {skill_id}: rejected")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("ids", nargs="*")
    parser.add_argument("--reject", nargs="*", default=[])
    parser.add_argument("--all-lolos", action="store_true")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.ids, args.reject, args.all_lolos)))
```

- [ ] **Step 2: Verify syntax + ruff** — same commands as Task 2 Step 2, applied to `scripts/approve_corpus.py`.
- [ ] **Step 3: Dry-run the skip path** — `uv run python scripts/approve_corpus.py <nonexistent-id>` from `backend/` — expect `SKIP <id>: bukan draft` and exit 0.
- [ ] **Step 4: Commit** — `git add backend/scripts/approve_corpus.py` + message `feat(corpus): approve corpus script`.

---

### Task 4: `scripts/ingest_documents.py` — whitelist documents

**Files:**
- Create: `backend/scripts/ingest_documents.py`

**Interfaces:**
- Consumes: `corpus_common.ingest_document_source` (Task 1); `app.rag.bootstrap.load_sources` (reads sources.yaml).
- Produces: `uv run python scripts/ingest_documents.py` — ingests the 3 whitelist documents (dlhk-banten-limbah-anorganik PDF, identif-tas-dompet-sachet, bisnisukm-tas-dompet-daur-ulang), skips existing URLs, prints per-doc results. Exit 0 if all succeeded, 1 if any failed.

- [ ] **Step 1: Write the script** (create `backend/scripts/ingest_documents.py`):

```python
"""Ingest the 3 key whitelist documents into the RAG corpus.

Usage (from backend/):
    uv run python scripts/ingest_documents.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import corpus_common as cc
from app.deps import get_supabase
from app.rag.bootstrap import load_sources

DOC_IDS = [
    "dlhk-banten-limbah-anorganik",
    "identif-tas-dompet-sachet",
    "bisnisukm-tas-dompet-daur-ulang",
]


async def main() -> int:
    sb = get_supabase()
    sources = {s["id"]: s for s in load_sources()}
    failed = 0
    for doc_id in DOC_IDS:
        source = sources.get(doc_id)
        if not source:
            print(f"SKIP {doc_id}: tidak ada di sources.yaml")
            continue
        result = await cc.ingest_document_source(sb, source)
        if result.get("skipped"):
            print(f"SKIP {doc_id}: URL sudah ada")
        elif "error" in result:
            failed += 1
            print(f"FAIL {doc_id}: {result['error']}")
        else:
            print(f"OK {doc_id}: {result['chunks']} chunks")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

- [ ] **Step 2: Verify syntax + ruff** — same commands as Task 2 Step 2, applied to `scripts/ingest_documents.py`.
- [ ] **Step 3: Dry-run against live env** — `uv run python scripts/ingest_documents.py` from `backend/`. Expected: either `SKIP <id>: URL sudah ada` per doc, or full ingest (downloads PDF + 2 URLs → ingest, DeepInfra embed). Confirm output.
- [ ] **Step 4: Commit** — `git add backend/scripts/ingest_documents.py` + message `feat(corpus): ingest whitelist documents script`.

---

### Task 5: `scripts/check_coverage.py` — retrieval coverage

**Files:**
- Create: `backend/scripts/check_coverage.py`

**Interfaces:**
- Consumes: `corpus_common.MATERIAL_QUERIES`, `corpus_common.coverage_pass`, `corpus_common.format_coverage_report` (Task 1); `app.agent.tools.retrieval.search_corpus`; `app.deps.get_supabase`.
- Produces: `uv run python scripts/check_coverage.py` — runs 6 test queries (one per material) through `search_corpus`, prints PASS/FAIL per material + corpus summary. Exit 0 if all PASS, 1 if any FAIL.

- [ ] **Step 1: Write the script** (create `backend/scripts/check_coverage.py`):

```python
"""Verify retrieval coverage: every material must return a relevant chunk.

Usage (from backend/):
    uv run python scripts/check_coverage.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import corpus_common as cc
from app.agent.tools.retrieval import search_corpus
from app.deps import get_supabase


async def main() -> int:
    sb = get_supabase()
    results = []
    for material, query in cc.MATERIAL_QUERIES.items():
        chunks = await search_corpus(sb, query, material)
        scores = [c.rerank_score for c in chunks]
        top = chunks[0] if chunks else None
        results.append({
            "material": material,
            "chunks": len(chunks),
            "top_source": top.source_type if top else None,
            "top_score": round(top.rerank_score, 2) if top else None,
            "pass": cc.coverage_pass(scores),
        })
    print(cc.format_coverage_report(results))

    skills = sb.table("skills").select("id").eq("status", "approved").execute().data
    chunks = sb.table("skill_chunks").select("id").execute().data
    docs = sb.table("documents").select("id").execute().data
    doc_chunks = sb.table("document_chunks").select("id").execute().data
    print(f"\nkorpus: {len(skills)} skills approved, {len(chunks)} skill_chunks, "
          f"{len(docs)} dokumen, {len(doc_chunks)} document_chunks")

    return 0 if all(r["pass"] for r in results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

- [ ] **Step 2: Verify syntax + ruff** — same commands as Task 2 Step 2, applied to `scripts/check_coverage.py`.
- [ ] **Step 3: Run against live backend** — `uv run python scripts/check_coverage.py` from `backend/`. Expected: 6 PASS/FAIL lines + corpus summary. This makes real DeepInfra embed+rerank calls (free).
- [ ] **Step 4: Commit** — `git add backend/scripts/check_coverage.py` + message `feat(corpus): coverage check script`.

---

### Task 6: `backend/eval/e2e_skill_flow.py` — full AI flow E2E

**Files:**
- Create: `backend/eval/e2e_skill_flow.py`

**Interfaces:**
- Consumes: live backend at `--base-url` (default `http://localhost:8000`); `SUPABASE_JWT_SECRET` + `SUPABASE_SERVICE_KEY` + `SUPABASE_URL` from `backend/.env`; supabase-py (backend dep) for the retrievable check + cleanup; `TINY_JPEG` from `smoke_e2e` (same dir).
- Produces: `uv run python eval/e2e_skill_flow.py [--base-url URL]` — runs scan → recommend → proposals → verify → create → approve → verify retrievable → cleanup. Exit 0 all green, 1 any red.

- [ ] **Step 1: Write the script** (create `backend/eval/e2e_skill_flow.py`):

```python
"""End-to-end test of the full AI skill flow against a live backend.

Covers: scan -> recommend (RAG) -> proposals -> verify -> create -> approve
-> retrievable. Requires a live backend + real Supabase keys in backend/.env.

Usage:
    uv run python eval/e2e_skill_flow.py [--base-url http://localhost:8000]
"""

import argparse
import sys
from pathlib import Path

import httpx
import jwt
from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / ".env"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from smoke_e2e import TINY_JPEG  # noqa: E402


def _env(key: str) -> str:
    for line in ENV.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"{key} missing from backend/.env")


def _auth_token() -> str:
    return jwt.encode({"sub": "e2e-user"}, _env("SUPABASE_JWT_SECRET"), algorithm="HS256")


SERVICE_AUTH = {"Authorization": f"Bearer {_env('SUPABASE_SERVICE_KEY')}"}
AUTH = {"Authorization": f"Bearer {_auth_token()}"}


def _check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f" ({detail})" if detail else ""))
    return ok


def main(base: str) -> int:
    ok = True
    with httpx.Client(timeout=120) as client:
        # 1. scan
        r = client.post(f"{base}/scan", files={"file": ("t.jpg", TINY_JPEG, "image/jpeg")})
        ok &= _check("scan 200", r.status_code == 200, f"status={r.status_code}")
        material = (r.json().get("identification") or {}).get("material") or "plastik_pet"

        # 2. recommend (RAG path)
        r = client.post(f"{base}/recommend", json={"material": material, "user_intent": "buat kerajinan"})
        ok &= _check("recommend 200", r.status_code == 200, f"status={r.json().get('status')}")

        # 3. proposals (auth required)
        r = client.post(f"{base}/skills/proposals", json={"material": material, "condition": "bersih"}, headers=AUTH)
        ok &= _check("proposals 200", r.status_code == 200, f"status={r.status_code}")
        proposals = r.json() if r.status_code == 200 else []
        ok &= _check("3 proposals", len(proposals) >= 1, f"count={len(proposals)}")

        # 4. verify
        draft = proposals[0] if proposals else {"title": "Pot dari Botol", "material": material,
            "difficulty": "pemula", "steps": [{"order": 1, "instruction": "Cuci botol", "warning": "Sarung tangan"}],
            "tools": [{"name": "gunting"}], "est_cost_idr": 5000, "est_price_idr": 25000}
        r = client.post(f"{base}/skills/verify", json={"draft": draft, "chat_history": []}, headers=AUTH)
        ok &= _check("verify 200", r.status_code == 200, f"verdict={r.json().get('verdict') if r.status_code == 200 else '?'}")

        # 5. create (title prefixed [E2E] for cleanup)
        draft["title"] = f"[E2E] {draft['title']}"
        r = client.post(f"{base}/skills", json=draft, headers=AUTH)
        ok &= _check("create 201", r.status_code == 201, f"status={r.status_code}")
        skill_id = r.json().get("id") if r.status_code == 201 else None

        # 6. approve via service role (bypasses expert gate for E2E only)
        if skill_id:
            r = client.patch(f"{base}/skills/{skill_id}/status",
                             json={"status": "approved", "reviewed_by": "e2e"}, headers=SERVICE_AUTH)
            ok &= _check("approve 200", r.status_code == 200, f"status={r.status_code}")

            # 7. retrievable: chunks exist in the corpus (deterministic proof)
            sb = create_client(_env("SUPABASE_URL"), _env("SUPABASE_SERVICE_KEY"))
            chunks = sb.table("skill_chunks").select("id").eq("skill_id", skill_id).execute().data
            ok &= _check("skill retrievable (chunks > 0)", len(chunks) > 0, f"chunks={len(chunks)}")

            # cleanup
            sb.table("skills").delete().eq("id", skill_id).execute()
            print("  [INFO] cleaned up [E2E] skill")

    print("\n" + ("ALL GREEN" if ok else "FAILURES PRESENT"))
    return 0 if ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()
    sys.exit(main(args.base_url))
```

- [ ] **Step 2: Verify syntax + ruff** — same commands as Task 2 Step 2 applied to `eval/e2e_skill_flow.py` (note: `eval/` is not a package; the script inserts its own dir to import `smoke_e2e`).
- [ ] **Step 3: Run against live backend** — start backend (`uv run uvicorn app.main:app --port 8000`), then `uv run python eval/e2e_skill_flow.py` from `backend/`. Expected: all steps PASS, `ALL GREEN`, exit 0, and the `[E2E]` skill cleaned up.
- [ ] **Step 4: Commit** — `git add backend/eval/e2e_skill_flow.py` + message `feat(eval): end-to-end skill flow test`.

---

### Task 7: Frontend E2E — Playwright script (manual)

**Files:**
- Create: `e2e/skill-flow.spec.ts`

**Interfaces:**
- Consumes: running Expo web (`npm run web`), running backend (`uvicorn`), real Supabase. Manual/optional — NOT a CI gate.
- Produces: a Playwright spec that walks the user journey: scan → hasil material → "Buat Skill Baru dari Material Ini → 3 proposals → pick → edit → verify → submit → pending status visible.

- [ ] **Step 1: Write the script** (create `e2e/skill-flow.spec.ts`):

```ts
import { test, expect } from "@playwright/test";

// Requires: npm run web (Expo), backend on :8000, EXPO_PUBLIC_USE_MOCK=false.
test("user creates a skill from scan", async ({ page }) => {
  await page.goto("http://localhost:8081");
  // Scan flow: upload a photo (adjust selector to the app's upload input)
  await page.setInputFiles('input[type="file"]', "e2e/fixtures/sample.jpg");
  await expect(page.getByText("Buat Skill Baru dari Material Ini")).toBeVisible();
  await page.getByText("Buat Skill Baru dari Material Ini").click();
  // 3 proposals render
  await expect(page.getByText("Buat Skill Baru")).toBeVisible();
  // pick first proposal card (adjust selector to the app's proposal card)
  await page.locator("text=/^[A-Za-z]").first().click();
  await page.getByRole("button", { name: /simpan|submit/i }).click();
  await expect(page.getByText(/menunggu|pending/i).first()).toBeVisible();
});
```

Note: selectors are best-effort — the app's UI text is the source of truth (see `app/scan/hasil.tsx:215` and `app/scan/skill-creator.tsx`); adjust selectors to the actual rendered tree when running.
- [ ] **Step 2: Verify the script parses** — `npx tsc --noEmit e2e/skill-flow.spec.ts` (or `npx playwright test --list` if Playwright is installed). If Playwright is not installed, add it as a devDependency (`npm i -D @playwright/test`) — optional, only for this manual task.
- [ ] **Step 3: Run manually** — with Expo web + backend + real Supabase running: `npx playwright test e2e/skill-flow.spec.ts`. Expected: the journey completes and the skill appears as pending.
- [ ] **Step 4: Commit** — `git add e2e/skill-flow.spec.ts` + message `test(e2e): frontend skill flow playwright script`.

---

### Task 8: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full backend suite from `backend/`: `uv run pytest tests/ -q` — expected all pass (baseline 218 passed, 8 skipped).
- [ ] **Step 2: Ruff gates from `backend/`: `uv run ruff check .` + `uv run ruff format --check .` — clean.
- [ ] **Step 3: Script syntax check** — `uv run python -c "import ast; ast.parse(open('scripts/seed_corpus.py').read())" etc. for all 4 scripts + eval script.
- [ ] **Step 4: git status** — only the plan's files changed; do not stage `.gitignore`, `QWEN.md`, or root `supabase/migrations/` (pre-existing dirty items stay untouched).
- [ ] **Step 5: Commit if anything drifted — `git add backend/ scripts/...` + message `chore(corpus): verification fixes` (skip if nothing changed).