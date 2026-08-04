# Context-Aware Sequential Image Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give WASTEX skill image generation visual context — each step panel references the previous panel (primary) and the scan photo (secondary anchor) — via the 9Router real image endpoint and a three-layer master prompt.

**Architecture:** (1) DB columns link a skill and each generated panel to reference images; (2) `generate_image` moves from chat/completions+modalities to `POST /images/generations` with provider-specific reference fields; (3) `generate_all_visuals` threads the previous panel's bytes into each next panel; (4) panel prompts are assembled as master + reference-policy + step-specific layers; (5) frontend propagates `scan_id` into `ScanResult` and the create-skill payload.

**Tech Stack:** FastAPI (backend), supabase-py, httpx, SQL migrations, jest-expo (frontend), expo-router.

## Global Constraints

- Ruff: line-length 100; `B008`/`BLE001` ignored (do not wrap bare exceptions).
- Python 3.12 + uv; run backend tests `uv run pytest` from `backend/`; frontend `npx jest <path>` from repo root.
- Tests never hit real providers — always monkeypatch/mock `generate_image` and httpx.
- Existing test fakes: `backend/tests/fakes.py` `FakeSupabase`; `app.deps.get_supabase` override pattern (see `test_visuals_api.py`).
- Supabase migrations: numbered `YYYYMMDD*_*.sql` in `backend/supabase/migrations/`, must be idempotent (`create table if not exists` / `add column if not exists`).
- `skills.reference_image_path` NULL ⇒ prompt-only generation (no behavior change for existing skills).
- The generated `prompt` column and `image_path` naming (`{skill_id}-{kind}{-step}.png`) must stay exactly as-is for app/UI compatibility.
- Reference list order matters: index 0 = **previous panel** (primary), index 1 = **scan photo** (secondary anchor). `_generate_visual` receives this list as-is.

---

### Task 1: DB migration — reference image columns

**Files:**
- Create: `backend/supabase/migrations/20260805000001_reference_image_path.sql`
- Test: `backend/tests/test_migrations_reference_image_path.py`

**Interfaces:**
- Consumes: existing `skills` and `generated_visuals` tables.
- Produces: `skills.reference_image_path` (text, nullable); `generated_visuals.reference_image_path` (text, nullable).

- [ ] **Step 1: Write the failing test**

```python
import subprocess

from pathlib import Path

MIG_PATH = (
    Path(__file__).resolve().parents[1]
    / "supabase"
    / "migrations"
    / "20260805000001_reference_image_path.sql"
)
SQL = MIG_PATH.read_text()

def test_migration_adds_reference_image_path_columns():
    assert "alter table skills add column if not exists reference_image_path text" in SQL
    assert (
        "alter table generated_visuals add column if not exists reference_image_path text"
        in SQL
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_migrations_reference_image_path.py -v` (from `backend/`)
Expected: FAIL — `FileNotFoundError: no such file`

- [ ] **Step 3: Write the migration**

```sql
alter table skills
  add column if not exists reference_image_path text;

alter table generated_visuals
  add column if not exists reference_image_path text;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_migrations_reference_image_path.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/20260805000001_reference_image_path.sql backend/tests/test_migrations_reference_image_path.py
git commit -m "feat(db): add reference_image_path columns for visual context"
```

---

### Task 2: `generate_image` moves to the real image endpoint with reference support

**Files:**
- Modify: `backend/app/agent/tools/image_gen.py`
- Test: `backend/tests/test_image_gen_endpoint.py`

**Interfaces:**
- Consumes: nothing new (uses `get_settings()` as today).
- Produces:
  - `async def generate_image(prompt: str, reference_images: list[bytes] | None = None) -> bytes`
  - `ImageGenUnavailable` unchanged.
  - `def build_master_prompt(step_prompt: str, has_references: bool) -> str`
  - `_REFERENCE_FIELD_NAMES: dict[str, str]` mapping provider prefix → request field name (`"image"` default; `"codex"` → `"image"` + `"image_detail": "high"`).

- [ ] **Step 1: Write the failing tests**

```python
import pytest
from unittest.mock import AsyncMock, patch

from app.agent.tools.image_gen import build_master_prompt, generate_image


def test_generate_image_posts_to_generations_endpoint():
    async def fake_post(url, headers=None, json=None):
        assert url.endswith("/images/generations?response_format=binary")
        assert "modalities" not in (json or {})
        assert json["model"] == "oc/test-image-model"
        assert json["prompt"] == "a bottle"
        assert json["size"] == "1024x1024"
        response = AsyncMock()
        response.status_code = 200
        response.raise_for_status = lambda: None
        response.content = b"raw-png-bytes"
        return response

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = fake_post
        with patch("app.agent.tools.image_gen.get_settings") as mock_settings:
            mock_settings.return_value.openrouter_base_url = "http://proxy/v1"
            mock_settings.return_value.openrouter_api_key = "key"
            mock_settings.return_value.image_model = "oc/test-image-model"

            result = asyncio_run(generate_image("a bottle"))
            assert result == b"raw-png-bytes"


def test_generate_image_sends_reference_image():
    captured = {}

    async def fake_post(url, headers=None, json=None):
        captured.update(json or {})
        response = AsyncMock()
        response.raise_for_status = lambda: None
        response.content = b"raw-png-bytes"
        return response

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = fake_post
        with patch("app.agent.tools.image_gen.get_settings") as mock_settings:
            mock_settings.return_value.openrouter_base_url = "http://proxy/v1"
            mock_settings.return_value.openrouter_api_key = "key"
            mock_settings.return_value.image_model = "oc/test-image-model"

            asyncio_run(generate_image("a bottle", [b"\x89PNG-prev", b"\x89PNG-photo"]))
            # provider default (openai-compatible) uses "image" with the PRIMARY ref only
            import base64

            assert captured["image"] == base64.b64encode(b"\x89PNG-prev").decode()


def test_master_prompt_layers():
    step = "Step 2 instruction text"
    with_refs = build_master_prompt(step, has_references=True)
    assert "illustrator of a single DIY upcycling tutorial panel" in with_refs
    assert "previous panel is the truth" in with_refs
    assert "step 2 instruction text" in with_refs
    assert "scan photo keeps the real object" in with_refs

    without_refs = build_master_prompt(step, has_references=False)
    assert "previous panel is the truth" not in without_refs
    assert "step 2 instruction text" in without_refs
```

Where `asyncio_run` is a small helper (uses `asyncio.run`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_image_gen_endpoint.py -v`
Expected: FAIL (function not defined / assertion on old endpoint)

- [ ] **Step 3: Implement**

In `backend/app/agent/tools/image_gen.py`, replace the request function and add the master prompt helper:

```python
_REFERENCE_FIELD_NAMES = {
    "codex": "image",  # codex accepts images[]; single primary ref via "image" for now
}

_MASTER_PROMPT = (
    "Helpful, objective illustrator of a single DIY upcycling tutorial panel. "
    "Rules: draw ONLY the action the step describes; never render text, letters, "
    "numbers or watermarks in the image; single object centered, front-left 3/4 "
    "view; composition and item must stay consistent across all panels that "
    "share a reference image."
)

_REFERENCE_POLICY = (
    " The previous panel is the truth for the item's look and style - match it. "
    "The scan photo keeps the real object's shape/color/material accurate."
)


def build_master_prompt(step_prompt: str, has_references: bool) -> str:
    policy = _REFERENCE_POLICY if has_references else ""
    return f"{_MASTER_PROMPT}{policy}\n\n{step_prompt}"
```

And replace `generate_image`:

```python
async def generate_image(prompt: str, reference_images: list[bytes] | None = None) -> bytes:
    s = get_settings()
    import base64 as b64

    payload: dict = {
        "model": s.image_model,
        "prompt": prompt,
        "size": "1024x1024",
    }
    primary = reference_images[0] if reference_images else None
    if primary is not None:
        field = _REFERENCE_FIELD_NAMES.get(s.image_model.split("/")[0], "image")
        payload[field] = b64.b64encode(primary).decode()
        if field == "image" and s.image_model.split("/")[0] == "codex":
            payload["image_detail"] = "high"

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{s.openrouter_base_url}/images/generations?response_format=binary",
            headers={"Authorization": f"Bearer {s.openrouter_api_key}"},
            json=payload,
        )
        r.raise_for_status()
        return r.content
```

Note: primary reference is the previous panel (index 0); the scan photo (secondary) is conveyed via the text policy line, not as a second binary field — single-ref providers cannot take two images. Multi-reference is out of scope per the spec.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_image_gen_endpoint.py -v`
Expected: PASS

- [ ] **Step 5: Run the existing prompt/pipeline tests to catch regressions**

Run: `uv run pytest tests/test_image_prompts.py tests/test_visuals_api.py -v`
Expected: PASS (test_visuals_api may fail where it stubs `generate_image(prompt)` with one arg — see Task 3 note; if it fails only on signature, proceed)

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/tools/image_gen.py backend/tests/test_image_gen_endpoint.py
git commit -m "feat(agent): image gen via /images/generations with reference + master prompt"
```

---

### Task 3: Sequential threading in `generate_all_visuals`

**Files:**
- Modify: `backend/app/api/visuals.py`
- Modify: `backend/tests/fakes.py` — `FakeStorageBucket` gains `download(path) -> bytes` (returns stored bytes; `upload` keeps them)
- Modify: `backend/tests/test_visuals_api.py`

**Interfaces:**
- Consumes: `generate_image(prompt, reference_images)` (Task 2), `build_master_prompt` (Task 2).
- Produces:
  - `async def _load_reference_bytes(sb, skill) -> list[bytes]` — scan photo bytes for the skill (`skill["reference_image_path"]` is the *object path* relative to the `scans` bucket, e.g. `"uuid.jpg"`; empty list when NULL/download fails)
  - `async def _load_panel_bytes(sb, image_path) -> bytes` — previously generated panel from the `visuals` bucket
  - `async def _generate_visual(sb, skill, kind, step, reference_images: list[bytes] | None = None) -> dict` — returns `{"image_path": path}` plus stores `reference_image_path` in `generated_visuals`
  - `async def generate_all_visuals(sb, skill_id) -> None` — threads previous panel bytes

- [ ] **Step 0: Add download() to FakeSupabase storage**

In `backend/tests/fakes.py`, extend `FakeStorageBucket`:

```python
class FakeStorageBucket:
    def __init__(self):
        self.uploads = []
        self.removed = []
        self._stored: dict[str, bytes] = {}

    def upload(self, path, data, file_options=None):
        self.uploads.append((path, len(data), file_options))
        self._stored[path] = data if isinstance(data, bytes) else bytes(data)

    def download(self, path):
        return self._stored.get(path, b"")

    def remove(self, paths):
        self.removed.extend(paths)
```

- [ ] **Step 1: Update tests for threading + master prompt**

Add to `backend/tests/test_visuals_api.py`:

```python
def test_generate_all_threads_previous_panel(fake_sb, monkeypatch):
    fake_sb.table("skills").insert(
        {
            **SKILL,
            "reference_image_path": "photo-1.jpg",
            "steps": [
                {"order": 1, "instruction": "Cuci botol", "warning": None},
                {"order": 2, "instruction": "Potong botol", "warning": None},
            ],
        }
    )
    calls = []

    async def fake_generate(prompt, reference_images=None):
        calls.append((prompt, reference_images))
        return b"fake-png-bytes"

    async def fake_load_ref(sb, skill):
        return [b"photo-bytes"]

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)
    monkeypatch.setattr(visuals_api, "_load_reference_bytes", fake_load_ref)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    assert len(calls) == 4  # 2 storyboards + before_after + mockup
    # step 1: no previous panel yet -> photo only
    assert calls[0][1] == [b"photo-bytes"]
    assert "illustrator of a single DIY upcycling tutorial panel" in calls[0][0]
    # step 2: previous panel output is the primary reference, photo second
    assert calls[1][1] == [b"fake-png-bytes", b"photo-bytes"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_visuals_api.py::test_generate_all_threads_previous_panel -v`
Expected: FAIL — `_load_reference_bytes` not found / signature mismatch

- [ ] **Step 3: Implement threading**

In `backend/app/api/visuals.py`:

```python
async def _load_reference_bytes(sb: Client, skill: dict) -> list[bytes]:
    """Return the scan photo bytes (secondary anchor), empty list if none."""
    path = skill.get("reference_image_path")
    if not path:
        return []
    try:
        data = sb.storage.from_("scans").download(path)
        return [data if isinstance(data, bytes) else bytes(data)]
    except Exception:
        return []
```

Modify `_generate_visual` to accept and store references:

```python
async def _generate_visual(
    sb: Client,
    skill: dict,
    kind: Kind,
    step: int | None,
    reference_images: list[bytes] | None = None,
) -> dict:
    if kind == "storyboard":
        target = _step_by_order(skill, step)
        if target is None:
            raise KeyError(f"step {step} not found")
        prompt = build_storyboard_prompt(skill, target)
    elif kind == "before_after":
        prompt = build_before_after_prompt(skill)
    else:
        prompt = build_mockup_prompt(skill)

    refs = reference_images or []
    final_prompt = build_master_prompt(prompt, has_references=bool(refs))
    image = await generate_image(final_prompt, refs)

    path = _cache_key(skill["id"], kind, step)
    sb.storage.from_("visuals").upload(path, image, {"content-type": "image/png"})
    ref_path = skill.get("reference_image_path")
    sb.table("generated_visuals").insert(
        {
            "skill_id": skill["id"],
            "kind": kind,
            "step_order": step,
            "image_path": path,
            "prompt": final_prompt,
            "reference_image_path": ref_path,
        }
    ).execute()
    return {"skill_id": skill["id"], "kind": kind, "step": step, "image_path": path, "cached": False}
```

Modify `generate_all_visuals` to thread the previous panel and cap refs at 3:

```python
async def generate_all_visuals(sb: Client, skill_id: str) -> None:
    res = sb.table("skills").select("*").eq("id", skill_id).execute()
    skill = next((row for row in (res.data or []) if str(row.get("id")) == skill_id), None)
    if not skill or skill.get("status") != "approved":
        return

    cached = sb.table("generated_visuals").select("*").eq("skill_id", skill_id).execute()
    have = {(row.get("kind"), row.get("step_order")) for row in (cached.data or [])}

    photo = await _load_reference_bytes(sb, skill)
    last_panel: bytes | None = None

    orders = sorted(
        st.get("order") for st in (skill.get("steps") or []) if st.get("order") is not None
    )
    for order in orders:
        if ("storyboard", order) in have:
            row = next(
                r for r in (cached.data or []) if (r.get("kind"), r.get("step_order")) == ("storyboard", order)
            )
            last_panel = await _load_panel_bytes(sb, row["image_path"])
            continue
        try:
            refs = [last_panel] + photo if last_panel is not None else list(photo)
            out = await _generate_visual(sb, skill, "storyboard", order, refs)
            last_panel = await _load_panel_bytes(sb, out["image_path"])
        except ImageGenUnavailable:
            last_panel = None

    extra: list[tuple[Kind, None]] = [("before_after", None), ("mockup", None)]
    for kind, step in extra:
        if (kind, step) in have:
            continue
        try:
            refs = [last_panel] + photo if last_panel is not None else list(photo)
            await _generate_visual(sb, skill, kind, step, refs[:3])
        except ImageGenUnavailable:
            continue
```

Add `_load_panel_bytes` (reads a previously generated panel from the `visuals` bucket, for cache-resume):

```python
async def _load_panel_bytes(sb: Client, image_path: str) -> bytes:
    data = sb.storage.from_("visuals").download(image_path)
    return data if isinstance(data, bytes) else bytes(data)
```

Also read the cached panel bytes via `_load_panel_bytes` in the loop for `last_panel` (done above).

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_visuals_api.py -v`
Expected: PASS (update existing `stub_image` fixture to accept `reference_images=None` kwarg)

The existing `stub_image` fixture must be updated:

```python
@pytest.fixture()
def stub_image(monkeypatch):
    async def fake_generate(prompt, reference_images=None):
        return b"fake-png-bytes"

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/visuals.py backend/tests/test_visuals_api.py
git commit -m "feat(visuals): thread previous panel + scan photo into step generation"
```

---

### Task 4: Skill creation carries the scan reference

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/api/skills.py`
- Modify: `backend/tests/test_skills_api.py` (or `test_gates.py` existing suite)
- Test: `backend/tests/test_skill_reference_image.py`

**Interfaces:**
- Consumes: `SkillCreateRequest` (existing), `scans` table (`image_url` for the scan).
- Produces: `SkillCreateRequest.reference_scan_id: UUID | None = None`; on POST `/skills`, backend resolves `scans` row → `reference_image_path` set on the inserted skill.

- [ ] **Step 1: Write the failing test**

```python
from uuid import uuid4

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

def _auth_header() -> dict:
    token = create_test_token({"sub": "u1", "email": "u@x.app"})
    return {"Authorization": f"Bearer {token}"}

def test_create_skill_resolves_scan_reference(fake_sb):
    scan_id = str(uuid4())
    fake_sb.table("scans").insert(
        {"id": scan_id, "user_id": "u1", "image_url": f"{scan_id}.jpg"}
    )
    client = TestClient(app)
    payload = {
        "title": "Vas Botol PET",
        "description": "Membuat vas dari botol PET bekas.",
        "material": "plastik_pet",
        "difficulty": "mudah",
        "steps": [{"order": 1, "instruction": "Cuci botol", "warning": None}],
        "reference_scan_id": scan_id,
    }
    r = client.post("/skills", json=payload, headers=_auth_header())
    assert r.status_code == 201
    assert r.json()["reference_image_path"] == f"{scan_id}.jpg"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_skill_reference_image.py -v`
Expected: FAIL — 422 unknown field OR reference_image_path missing

- [ ] **Step 3: Implement**

In `backend/app/schemas.py`, extend `SkillCreateRequest`:

```python
class SkillCreateRequest(SkillProposal):
    reference_scan_id: UUID | None = None
```

In `backend/app/api/skills.py` `create_skill`, resolve the scan before inserting:

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
    if any(str(row.get("created_by")) == user["user_id"] for row in dup.data):
        raise HTTPException(status_code=409, detail="skill serupa sudah pernah dibuat")

    reference_image_path = None
    if body.reference_scan_id is not None:
        scans = sb.table("scans").select("image_url").eq("id", str(body.reference_scan_id)).limit(1).execute()
        scan_row = next(
            (r for r in (scans.data or []) if r.get("id") == str(body.reference_scan_id) and r.get("image_url")),
            None,
        )
        if scan_row is not None and str(scan_row.get("user_id", "")) == user["user_id"]:
            reference_image_path = scan_row["image_url"]

    payload = body.model_dump(mode="json")
    payload.pop("reference_scan_id", None)
    payload.update(
        {
            "status": "pending",
            "origin": "user",
            "created_by": user["user_id"],
            "reference_image_path": reference_image_path,
        }
    )
    res = sb.table("skills").insert(payload).execute()
    return res.data[0]
```

Note: verification of scan ownership (`user_id` matches) — keep it; only the scan's own owner may link it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_skill_reference_image.py -v`
Expected: PASS

- [ ] **Step 5: Run the skills suite to catch regressions**

Run: `uv run pytest tests/test_gates.py tests/test_skills_api.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas.py backend/app/api/skills.py backend/tests/test_skill_reference_image.py
git commit -m "feat(skills): link created skill to scan reference photo"
```

---

### Task 5: Frontend propagates `scan_id` into create-skill payload

**Files:**
- Modify: `src/services/types.ts`
- Modify: `src/services/index.ts`
- Modify: `src/services/api.ts`
- Modify: `app/scan/skill-creator.tsx`
- Test: `src/services/__tests__/scanner.test.ts`

**Interfaces:**
- Consumes: backend `BackendScanResult.scan_id`; `ScanResult`.
- Produces: `ScanResult.scan_id?: string`; `apiClient.createSkill` payload includes `reference_scan_id`.

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/scanner.test.ts`:

```ts
import * as services from "../index";

const mockScan = jest.fn();
jest.mock("../api", () => ({
  apiClient: {
    scan: (...args: unknown[]) => mockScan(...args),
  },
}));

jest.isolateModules(() => {
  const { scanner } = require("../index");
  (globalThis as Record<string, unknown>).__testScanner = scanner;
});

describe("ApiScanner", () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockScan.mockResolvedValue({
      scan_id: "11111111-2222-3333-4444-555555555555",
      status: "identified",
      identification: { material: "plastik_pet", condition: "bening", confidence: 0.9 },
    });
  });

  it("propagates scan_id from the backend response", async () => {
    const scanner = (services as unknown as { scanner: services.WasteScannerService }).scanner;
    const result = await scanner.scan("file:///tmp/x.jpg");
    expect(result.scan_id).toBe("11111111-2222-3333-4444-555555555555");
    // controls the mock: with USE_MOCK=false the real ApiScanner code path runs
    expect(mockScan).toHaveBeenCalledWith("file:///tmp/x.jpg");
  });
});
```

Note: if jest module-mocking `../api` conflicts with other test suites in that folder (module cache), fall back to asserting the mapping directly by exporting a pure mapper. The essential assertion is: `ApiScanner.scan` copies `result.scan_id` onto the returned `ScanResult`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/scanner.test.ts -t "propagates scan_id"`
Expected: FAIL — `scan_id` undefined (type error if strict) — the mock response has `scan_id` but `ScanResult` mapping drops it

- [ ] **Step 3: Implement**

`src/services/types.ts` — add to `ScanResult`:

```ts
scan_id?: string;
```

`src/services/index.ts` `ApiScanner.scan` — copy the id:

```ts
return {
  ...base,
  condition: result.identification?.condition ?? base.condition,
  confidence: result.identification?.confidence ?? 0,
  needsVerification: result.status === "needs_manual_verification",
  scan_id: result.scan_id,
};
```

`src/services/api.ts` `createSkill` — allow the extra field (it passes `data` through already; no change needed unless typing is strict — if `SkillProposal` lacks the field, add union):

```ts
async createSkill(data: SkillProposal & { reference_scan_id?: string }) {
  return request('/skills', { method: 'POST', body: data, headers: await authHeaders() });
},
```

`app/scan/skill-creator.tsx` — include scan id in the submit payload. Find the submit/approve handler (around the `submitting` state) and add:

```ts
const scanId = scanResult?.scan_id;
// ...when building createSkill payload:
reference_scan_id: scanId ?? undefined,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the 6 pre-existing errors (profil.tsx flex ×2, Input.tsx, auth tests ×2) remain — no new ones.

- [ ] **Step 6: Commit**

```bash
git add src/services/types.ts src/services/index.ts src/services/api.ts app/scan/skill-creator.tsx src/services/__tests__/scanner.test.ts
git commit -m "feat(scan): propagate scan_id and link it on skill creation"
```

---

### Task 6: Config default image model + full-suite verification

**Files:**
- Modify: `backend/app/config.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `image_model` default pointing at a reference-capable model id available on the proxy (`oc/*` or `gf/*` as discovered at runtime; verify with `curl /v1/models/image` during this task).

- [ ] **Step 1: Discover the current image models on the proxy**

Run: `curl -H "Authorization: Bearer $OPENROUTER_API_KEY" http://localhost:20128/v1/models/image | jq -r '.data[].id' | head`
Expected: list of ids (e.g. `black-forest-labs/flux-*`, `ag/gemini-3.1-flash-image`, ...). Take the first id whose provider supports `image` reference (any of `black-forest-labs`, `fal-ai`, `runwayml`, `nanobanana`, `codex`). If none exist, keep the existing default (prompt-only fallback remains correct).

- [ ] **Step 2: Update config default**

In `backend/app/config.py`, update:

```python
image_model: str = "<id printed in step 1>"  # keep google/gemini-2.5-flash-image-preview if proxy lists none
```

- [ ] **Step 3: Run full backend suite**

Run: `uv run pytest tests/ -v --tb=short`
Expected: 149+ passed, 4 skipped (was 149 before this feature; expect new tests added → count grows)

- [ ] **Step 4: Ruff gate**

Run: `uv run ruff check backend/ && uv run ruff format --check backend/`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add backend/app/config.py
git commit -m "chore(config): default image model to reference-capable id"
```

- [ ] **Step 6: Manual E2E (optional, needs the backend running)**

With the server running (`uv run uvicorn app.main:app --port 8000`), re-create a skill with a scan reference and approve it; verify `generated_visuals` rows carry `reference_image_path`.

---

## Self-Review Notes

- Spec section 1 (data model) → Tasks 1 + 4 + 5.
- Spec section 2 (endpoint + reference mapping) → Task 2.
- Spec section 2b (three-layer master prompt) → Task 2 (`build_master_prompt`) + Task 3 wiring.
- Spec section 3 (sequential threading, cache resume, cap 3) → Task 3.
- Spec section 4 (failure continues with photo-only refs) → Task 3 (`last_panel = None` on failure).
- Spec section 5 (config) → Task 6.
- Spec section 6 (tests) → spread across Tasks 2–5.
- Out of scope items are not implemented (refine mode, multi-ref codex, training-based).
