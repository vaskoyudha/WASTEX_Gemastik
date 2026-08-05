# Fix Plan: Skill duplicate-check dead code (TDD)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the duplicate-skill guard in `POST /skills` so the 409 actually fires in production, driven by a TDD red-green cycle that reproduces the real PostgREST behavior.

**Background (from final review of the e2e-fixes branch):**
`backend/app/api/skills.py:102-112` (`create_skill`) runs the duplicate check as:
```python
dup = (
    sb.table("skills")
    .select("id")
    .eq("title", body.title)
    .eq("material", body.material.value)
    .eq("created_by", user["user_id"])
    .execute()
)
# FakeSupabase eq() is a no-op; filter created_by client-side to match prod semantics.
if any(str(row.get("created_by")) == user["user_id"] for row in dup.data):
    raise HTTPException(status_code=409, detail="skill serupa sudah pernah dibuat")
```
The query selects ONLY the `id` column, but the client-side filter reads `row.get("created_by")` — which PostgREST never returns → `any(...)` is always `False` → **the 409 never fires in production**, so duplicate skills insert silently. Tests never caught it because `FakeSupabase.select()` (backend/tests/fakes.py:100-101) is a no-op that returns FULL row dicts, so the client-side filter works in tests.

## Global Constraints

- Ruff: line-length 100; CI gates `uv run ruff check backend/` then `uv run ruff format --check backend/` (run from repo root: `backend/.venv/bin/ruff ...`). Backend suite: `uv run pytest tests/` from `backend/` (baseline 171 passed, 4 skipped, 1 warning).
- Tests must stay deterministic and never hit real providers (conftest self-configures dummy keys).
- The 409 duplicate guard must keep working under `FakeSupabase` (whose `eq()` is deliberately a no-op) AND under real PostgREST — the client-side filter stays as the test-side guard, but the select must include every column the filter reads.
- `FakeSupabase.select()` fidelity: making it column-accurate is the enabler for this TDD cycle — but it is shared test infrastructure used by many suites. Any change must keep the full backend suite green (run it).
- Indonesian API detail strings (existing: "skill serupa sudah pernah dibuat").
- Commits to `main` per AGENTS.md. Do not commit the untracked `supabase/migrations` symlink scratch or the `.gitignore` modification.

---

### Task 1: TDD — make FakeSupabase select column-accurate, fix the dup-check select

**Files:**
- Modify: `backend/tests/fakes.py` (`FakeTable.select`)
- Modify: `backend/app/api/skills.py` (`create_skill` dup-check, lines 102-112)
- Modify: `backend/tests/test_skill_creator_endpoints.py` (dup-check tests) and/or new `backend/tests/test_skill_duplicate_check.py`

**Interfaces:**
- Consumes: existing `create_skill` endpoint; existing `FakeSupabase` fixture pattern in `test_skill_creator_endpoints.py`.
- Produces: `FakeSupabase.select()` filters rows to the requested columns (faithful to PostgREST: `"*"` returns full rows; `"a, b"` returns only those keys); `create_skill` dup-check selects `id, created_by`; a regression test proves the 409 fires when the same user re-posts the same title+material.

- [ ] **Step 1: Write the failing test.** In `backend/tests/test_skill_creator_endpoints.py` (or a new focused file using the same `fake_sb` fixture + `_auth_header` pattern from that file), add a test that: inserts a `skills` row `{id: "s1", title: ..., material: "plastik_pet", status: "pending", origin: "user", created_by: "u1", steps: [...]}` into the fake, then POSTs `/skills` with the SAME title+material under the SAME user, and asserts `status_code == 409`. Verify this test currently PASSES (it does today — FakeSupabase returns full rows, so the filter works in tests; record this as the "test passes but doesn't prove prod" baseline).
- [ ] **Step 2: Make the test reproduce the prod bug.** Change `FakeTable.select` in `backend/tests/fakes.py` to honor the column list: parse the select string (`"*"` → all keys; otherwise split on `,`, trim, and return dicts containing only those keys). Run the new test — it must now FAIL (409 not raised, insert proceeds → 201) because the row only carries `id`. This is the RED step: the fake now behaves like real PostgREST, exposing the dead code. Then run the FULL backend suite and record every other test that breaks from the column-accurate fake (expected fallout: tests whose `.select(...)` returns columns they later read — some may need their select string or their fake row extended; fix ONLY what the suite shows, minimally, without weakening assertions).
- [ ] **Step 3: Implement.** In `backend/app/api/skills.py:104`, change `.select("id")` to `.select("id, created_by")`. Keep the client-side filter and its comment (still needed because `FakeSupabase.eq()` is a no-op).
- [ ] **Step 4: Verify GREEN.** The new test passes (409 fires); run `uv run pytest tests/test_skill_creator_endpoints.py -v` then the FULL suite `uv run pytest tests/ -q --tb=short` from `backend/` — expect 171+ new tests passing, 4 skipped, and the fallout from Step 2 resolved.
- [ ] **Step 5: Ruff gates.** From repo root: `backend/.venv/bin/ruff check backend/ && backend/.venv/bin/ruff format --check backend/` — clean.
- [ ] **Step 6: Commit.** `git add backend/app/api/skills.py backend/tests/fakes.py backend/tests/test_skill_creator_endpoints.py` (plus any new test file) `&& git commit -m "fix(skills): select created_by in duplicate check so 409 fires in production"`

---

### Task 2: Full verification gates

**Files:** None modified.

- [ ] **Step 1: Backend full suite** — `cd backend && uv run pytest tests/ -q --tb=short` → all pass (count = baseline + new tests), 4 skipped.
- [ ] **Step 2: Ruff gates** — from root: `backend/.venv/bin/ruff check backend/ && backend/.venv/bin/ruff format --check backend/` → clean.
- [ ] **Step 3: Live smoke (optional but preferred).** A uvicorn dev server runs on :8000 (backend, current code). If up: restart it (`pkill -f "uvicorn app.main:app"; sleep 1; cd backend && (.venv/bin/uvicorn app.main:app --port 8000 >> /tmp/opencode/uvicorn_new.log 2>&1 &)`), then POST `/skills` twice with the same title+material using the same auth token (`create_test_token` with a real-user UUID sub, e.g. `c028de30-63ec-4a11-910d-75b29376d220`; or login via `/auth/login` with e2e@wastex.app / E2e-test-123! and use the ES256 token) — first POST 201, second POST **409**.
- [ ] **Step 4: Confirm git log** — `git log --oneline -3` lists the Task 1 commit; working tree has only the pre-existing `.gitignore` mod and the untracked `supabase/migrations` symlink.
