# Image-Gen Consistency Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ] `) syntax for tracking.

**Goal:** Make sequential tutorial image generation produce visually consistent panels by anchoring every prompt to a canonical object identity (extracted once from the scan photo via vision) plus a stronger reference policy and per-panel timeline context.

**Architecture:** Add an `ObjectIdentity` extraction step (`IDENTITY_PROMPT` + `extract_object_identity` in the existing vision tool, mirroring `scan_material`'s retry pattern). Inject the identity block into `build_storyboard_prompt` so every panel repeats the same object description; strengthen `_REFERENCE_POLICY` with mechanism-level instructions (match exactly, only the action changes, photo is shape/color-only, never photorealistic); add a "step X of N" timeline. Wire identity extraction once per skill batch in `generate_all_visuals`.

**Tech Stack:** FastAPI + pydantic, httpx (9Router proxy via OpenRouter-compatible API), pytest, ruff. Existing files: `backend/app/agent/tools/vision.py`, `backend/app/agent/tools/image_gen.py`, `backend/app/api/visuals.py`, `backend/app/schemas.py`.

## Global Constraints

- Ruff: line-length 100, `B008`/`BLE001` intentionally ignored. CI gate: `uv run ruff check backend/` then `uv run ruff format --check backend/` (run from repo root: `backend/.venv/bin/ruff ...`).
- Backend suite: `uv run pytest tests/` from `backend/` (baseline 171 passed, 4 skipped, 1 pre-existing warning). Tests self-configure dummy keys via `backend/tests/conftest.py`; unit tests never hit real providers — vision tests use a fake `client_factory`.
- LLM prompts follow the behavioral contract enforced by `backend/tests/test_prompt_contract.py`: each prompt string must contain "Iron Law", a MUST/NEVER/WAJIB rule, "Red Flags", and "Self-Check". New prompts go into that file's `ALL_PROMPTS` dict.
- Indonesian LLM prompt copy (matches `VISION_PROMPT`); output JSON field names in English (machine-consumed).
- Existing tests that assert prompt substrings may need updating WHERE THIS PLAN CHANGES THE TEXT — update assertions to the new text, never weaken them.
- Commits to `main` per AGENTS.md. Do not commit the untracked `supabase/migrations` symlink scratch or the `.gitignore` modification.

---

### Task 1: ObjectIdentity schema + identity extraction vision call

**Files:**
- Modify: `backend/app/schemas.py` (after `MaterialIdentification`, ~line 36)
- Modify: `backend/app/agent/tools/vision.py` (`IDENTITY_PROMPT` const, `build_vision_messages` signature, `_extract_identity`, `extract_object_identity`)
- Modify: `backend/tests/test_vision_prompt.py` (append prompt tests)
- Modify: `backend/tests/test_prompt_contract.py` (add `IDENTITY_PROMPT` to `ALL_PROMPTS`)
- Create: `backend/tests/test_vision_identity.py`

**Interfaces:**
- Consumes: `app.schemas` (BaseModel pattern), `app.config.get_settings`, existing `parse_proxy_json` (vision.py:68).
- Produces: pydantic `ObjectIdentity` `{shape: str, dominant_colors: list[str], material: str, notable_features: list[str] = []}`; `IDENTITY_PROMPT: str`; `extract_object_identity(image_bytes: bytes, content_type: str = "image/jpeg", client_factory=httpx.AsyncClient) -> ObjectIdentity` raising `VisionUnavailable` when all providers fail; `build_vision_messages(data_url: str, prompt: str = VISION_PROMPT) -> list[dict]` (backward compatible — existing callers pass one arg).

- [ ] **Step 1: Write the failing tests** (create `backend/tests/test_vision_identity.py`):

```python
import asyncio
import json

import pytest

from app.agent.tools.vision import (
    IDENTITY_PROMPT,
    VisionUnavailable,
    extract_object_identity,
)
from app.schemas import ObjectIdentity


class FakeClient:
    """Minimal async httpx stand-in: post() returns self, .text is the body."""

    def __init__(self, content: str):
        self.content = content
        self.post_calls = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, headers=None, json=None):
        self.post_calls += 1
        return self

    def raise_for_status(self):
        pass

    @property
    def text(self) -> str:
        return self.content


def _wrap(content: str) -> str:
    return json.dumps({"choices": [{"message": {"content": content}}]})


def test_extract_identity_parses_canonical_fields():
    body = _wrap(
        json.dumps(
            {
                "shape": "tall clear bottle with narrow neck",
                "dominant_colors": ["transparent", "blue"],
                "material": "plastik_pet",
                "notable_features": ["white cap"],
            }
        )
    )
    client = FakeClient(body)
    identity = asyncio.run(
        extract_object_identity(b"x", "image/jpeg", client_factory=lambda **kw: client)
    )
    assert isinstance(identity, ObjectIdentity)
    assert identity.shape == "tall clear bottle with narrow neck"
    assert identity.material == "plastik_pet"
    assert identity.dominant_colors == ["transparent", "blue"]
    assert identity.notable_features == ["white cap"]


def test_extract_identity_raises_when_all_providers_fail():
    client = FakeClient("not json at all")
    with pytest.raises(VisionUnavailable):
        asyncio.run(
            extract_object_identity(b"x", "image/jpeg", client_factory=lambda **kw: client)
        )
    assert client.post_calls == 4  # 2 retries on vision_model + 2 on fallback
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_vision_identity.py -v`
Expected: FAIL — `ImportError: cannot import name 'IDENTITY_PROMPT'` / `ObjectIdentity` missing.

- [ ] **Step 3: Add the schema** (in `backend/app/schemas.py`, after `MaterialIdentification` ~line 36):

```python
class ObjectIdentity(BaseModel):
    shape: str
    dominant_colors: list[str]
    material: str
    notable_features: list[str] = []
```

- [ ] **Step 4: Add the prompt + extraction function** (in `backend/app/agent/tools/vision.py`; import `ObjectIdentity` from `app.schemas`):

```python
IDENTITY_PROMPT = """# Tugas
Analisis foto sampah daur ulang dan tulis identitas visual KANONIK objeknya untuk menjaga konsistensi ilustrasi tutorial.

## Iron Law
DESKRIPSI HANYA BERDASARKAN BUKTI VISUAL YANG TERLIHAT DI FOTO. Jangan menebak, jangan menambah detail imajinasi.

## Aturan (MUST/NEVER)
1. shape: bentuk dasar objek dalam bahasa Inggris, 3-8 kata (mis. "tall clear bottle with narrow neck").
2. dominant_colors: 1-3 warna yang benar-benar terlihat (Inggris, mis. "transparent", "blue", "white").
3. material: salah satu dari plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet.
4. notable_features: 0-2 ciri khas yang terlihat (mis. "white cap", "bent label", "dented side").
5. Output HANYA JSON valid. Tanpa teks lain di luar JSON.

## Red Flags (hati-hati bila ini terjadi)
- Warna dari pencahayaan/kuning lampu dianggap warna asli -> jangan, sebutkan warna netral.
- Menyebut ciri yang tidak terlihat di foto -> jangan.
- Shape terlalu panjang/bertele-tele -> ringkas 3-8 kata.

## Self-Check (sebelum menjawab)
- Setiap field didukung bukti visual di foto?
- dominant_colors hanya warna yang benar-benar terlihat?
- JSON valid, tanpa trailing text/koma?

## Format Output (WAJIB)
Jawab HANYA dengan JSON valid:
{"shape": "...", "dominant_colors": ["..."], "material": "plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet", "notable_features": ["..."]}"""
```

Change `build_vision_messages` (line 75) to accept a prompt parameter:

```python
def build_vision_messages(data_url: str, prompt: str = VISION_PROMPT) -> list[dict]:
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
            ],
        }
    ]
```

Add below `_identify` (after line 102):

```python
async def _extract_identity(
    client: httpx.AsyncClient, model: str, data_url: str, api_key: str
) -> ObjectIdentity:
    s = get_settings()
    r = await client.post(
        f"{s.openrouter_base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "response_format": {"type": "json_object"},
            "messages": build_vision_messages(data_url, IDENTITY_PROMPT),
        },
    )
    r.raise_for_status()
    payload = json.loads(parse_proxy_json(r.text)["choices"][0]["message"]["content"])
    return ObjectIdentity.model_validate(payload)
```

Add below `scan_material` (end of file):

```python
async def extract_object_identity(
    image_bytes: bytes,
    content_type: str = "image/jpeg",
    client_factory=httpx.AsyncClient,
) -> ObjectIdentity:
    s = get_settings()
    data_url = f"data:{content_type};base64,{base64.b64encode(image_bytes).decode()}"
    last_err: Exception | None = None
    async with client_factory(timeout=60) as client:
        # Same retry shape as scan_material: 2 attempts per provider, model -> fallback.
        for model in (s.vision_model, s.vision_fallback_model):
            for _ in range(2):
                try:
                    return await _extract_identity(client, model, data_url, s.openrouter_api_key)
                except Exception as e:
                    last_err = e
    raise VisionUnavailable("all vision providers failed") from last_err
```

- [ ] **Step 5: Add prompt contract + prompt content tests**

In `backend/tests/test_prompt_contract.py`, add the import and dict entry:

```python
from app.agent.tools.vision import IDENTITY_PROMPT, VISION_PROMPT
```
```python
ALL_PROMPTS = {
    "GROUNDING_PROMPT": GROUNDING_PROMPT,
    "SELLING_PROMPT": SELLING_PROMPT,
    "DRAFT_PROMPT": DRAFT_PROMPT,
    "SAFETY_RUBRIC": SAFETY_RUBRIC,
    "SKILL_PROPOSAL_PROMPT": SKILL_PROPOSAL_PROMPT,
    "SKILL_VERIFY_PROMPT": SKILL_VERIFY_PROMPT,
    "SEED_PROMPT": SEED_PROMPT,
    "VISION_PROMPT": VISION_PROMPT,
    "IDENTITY_PROMPT": IDENTITY_PROMPT,
}
```

Append to `backend/tests/test_vision_prompt.py` — the file already imports `VISION_PROMPT, build_vision_messages` from `app.agent.tools.vision` at the top; add `IDENTITY_PROMPT` to that existing import line (no duplicate import statements):

```python
def test_identity_prompt_describes_json_fields():
    for field in ("shape", "dominant_colors", "material", "notable_features"):
        assert field in IDENTITY_PROMPT


def test_identity_prompt_forbids_guessing():
    assert "Jangan menebak" in IDENTITY_PROMPT


def test_identity_messages_reuse_high_detail():
    messages = build_vision_messages("data:image/jpeg;base64,AAAA", IDENTITY_PROMPT)
    assert messages[0]["content"][0]["text"] == IDENTITY_PROMPT
    assert messages[0]["content"][1]["image_url"]["detail"] == "high"
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_vision_identity.py tests/test_vision_prompt.py tests/test_prompt_contract.py -v`
Expected: PASS (identity extraction + contract for `IDENTITY_PROMPT`).

- [ ] **Step 7: Run the full backend suite + ruff**

Run: `cd backend && uv run pytest tests/ -q --tb=short` — expect baseline +4 new tests passing, 4 skipped, same 1 warning.
Then from repo root: `backend/.venv/bin/ruff check backend/ && backend/.venv/bin/ruff format --check backend/` — clean.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas.py backend/app/agent/tools/vision.py backend/tests/test_vision_identity.py backend/tests/test_vision_prompt.py backend/tests/test_prompt_contract.py
git commit -m "feat(vision): extract canonical object identity for visual consistency"
```

---

### Task 2: Identity block + timeline + strengthened reference policy in image_gen

**Files:**
- Modify: `backend/app/agent/tools/image_gen.py` (`build_identity_block`, `build_storyboard_prompt`, `_REFERENCE_POLICY`, import)
- Modify: `backend/tests/test_image_gen_endpoint.py` (update `test_master_prompt_layers`, append prompt tests)

**Interfaces:**
- Consumes: `ObjectIdentity` from `app.schemas` (Task 1); existing `_MATERIAL_EN`, `_STYLE_STORYBOARD`, `_MASTER_PROMPT`, `_REFERENCE_POLICY` in image_gen.py.
- Produces: `build_storyboard_prompt(skill: dict, step: dict, identity: ObjectIdentity | None = None, step_count: int | None = None) -> str` — when identity given, appends a "Object identity is FIXED for every panel: ..." block; when `step_count` given, formats "step N of M" instead of "step N". `_REFERENCE_POLICY` becomes a mechanism-level instruction. Existing callers passing 2 args keep working.

- [ ] **Step 1: Write the failing tests** (append to `backend/tests/test_image_gen_endpoint.py`). First update its imports: the file currently has `from app.agent.tools.image_gen import (ImageGenUnavailable, build_master_prompt, generate_image)` — add `build_storyboard_prompt` to that import, and add `from app.schemas import ObjectIdentity`. Then append:

```python
def test_storyboard_prompt_includes_identity_block():
    skill = {"title": "Vas Botol PET", "material": "plastik_pet"}
    step = {"order": 1, "instruction": "Cuci botol", "warning": None}
    identity = ObjectIdentity(
        shape="tall clear bottle with narrow neck",
        dominant_colors=["transparent", "blue"],
        material="plastik_pet",
        notable_features=["white cap"],
    )
    prompt = build_storyboard_prompt(skill, step, identity=identity)
    assert "Object identity is FIXED for every panel" in prompt
    assert "tall clear bottle with narrow neck" in prompt
    assert "transparent" in prompt
    assert "white cap" in prompt


def test_storyboard_prompt_includes_timeline():
    skill = {"title": "Vas Botol PET", "material": "plastik_pet"}
    step = {"order": 2, "instruction": "Potong botol", "warning": None}
    prompt = build_storyboard_prompt(skill, step, step_count=3)
    assert "step 2 of 3" in prompt


def test_storyboard_prompt_without_identity_and_count_unchanged_shape():
    skill = {"title": "Vas Botol PET", "material": "plastik_pet"}
    step = {"order": 1, "instruction": "Cuci botol", "warning": "Hati-hati gunting"}
    prompt = build_storyboard_prompt(skill, step)
    assert "Object identity is FIXED" not in prompt
    assert "step 1" in prompt
    assert "Cuci botol" in prompt
    assert "Hati-hati gunting" in prompt
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_image_gen_endpoint.py -v -k "storyboard_prompt or master_prompt"`
Expected: FAIL — `AttributeError: module ... has no attribute 'build_storyboard_prompt'` (not yet imported) or missing identity block.

- [ ] **Step 3: Implement `build_identity_block` + update `build_storyboard_prompt`** (in `backend/app/agent/tools/image_gen.py`; add `from app.schemas import ObjectIdentity` to imports):

```python
def build_identity_block(identity: ObjectIdentity | None) -> str:
    if identity is None:
        return ""
    colors = ", ".join(identity.dominant_colors) or "unknown"
    features = "; ".join(identity.notable_features) or "none"
    return (
        f" Object identity is FIXED for every panel: {identity.shape}, "
        f"material {identity.material}, dominant colors {colors}, "
        f"notable features {features}. Keep this identity identical in every panel."
    )


def build_storyboard_prompt(
    skill: dict,
    step: dict,
    identity: ObjectIdentity | None = None,
    step_count: int | None = None,
) -> str:
    material = _MATERIAL_EN.get(skill.get("material", ""), "recycled household waste")
    warning = step.get("warning")
    safety = f" Emphasize safe handling: {warning}." if warning else ""
    panel = f"step {step.get('order')} of {step_count}" if step_count else f"step {step.get('order')}"
    return (
        f"Instructional storyboard panel for an upcycling craft tutorial, {panel}. "
        f"Project: {skill.get('title')} made from {material}.{build_identity_block(identity)} "
        f"Show this action clearly: {step.get('instruction')}.{safety} {_STYLE_STORYBOARD}"
    )
```

- [ ] **Step 4: Strengthen `_REFERENCE_POLICY`** (replace lines 74-77):

```python
_REFERENCE_POLICY = (
    " Study the reference image carefully and match it exactly: keep the object's "
    "shape, colors, materials, and illustration style IDENTICAL to the previous panel; "
    "only the action changes. The scan photo is ONLY a source for the real object's "
    "shape/color/material - always render it in flat illustration style, never "
    "photorealistic, never blending photo texture into the panel."
)
```

- [ ] **Step 5: Update `test_master_prompt_layers`** (its old substrings no longer exist):

```python
def test_master_prompt_layers():
    step = "Step 2 instruction text"
    with_refs = build_master_prompt(step, has_references=True)
    assert "illustrator of a single DIY upcycling tutorial panel" in with_refs
    assert "match it exactly" in with_refs
    assert "only the action changes" in with_refs
    assert "never photorealistic" in with_refs
    assert "Step 2 instruction text" in with_refs

    without_refs = build_master_prompt(step, has_references=False)
    assert "only the action changes" not in without_refs
    assert "Step 2 instruction text" in without_refs
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_image_gen_endpoint.py -v`
Expected: PASS (all, incl. the 3 new + updated master-prompt test).

- [ ] **Step 7: Run the full backend suite + ruff**

Run: `cd backend && uv run pytest tests/ -q --tb=short` — expect baseline + Task-1 + Task-2 tests passing, 4 skipped, 1 warning.
Then from repo root: `backend/.venv/bin/ruff check backend/ && backend/.venv/bin/ruff format --check backend/` — clean.

- [ ] **Step 8: Commit**

```bash
git add backend/app/agent/tools/image_gen.py backend/tests/test_image_gen_endpoint.py
git commit -m "feat(image-gen): anchor object identity, timeline, and reference policy in prompts"
```

---

### Task 3: Wire identity extraction through generate_all_visuals

**Files:**
- Modify: `backend/app/api/visuals.py` (imports, `_generate_visual`, `generate_all_visuals`)
- Modify: `backend/tests/test_visuals_api.py` (append tests)

**Interfaces:**
- Consumes: `extract_object_identity` + `VisionUnavailable` from `app.agent.tools.vision` (Task 1); `build_storyboard_prompt(skill, step, identity=..., step_count=...)` (Task 2); `_load_reference_bytes(sb, skill)` (visuals.py:46).
- Produces: `_generate_visual(..., identity=None, step_count=None)` passing both through to `build_storyboard_prompt`; `generate_all_visuals` extracts identity ONCE from the scan photo (falling back to `None` on `VisionUnavailable`) and threads it through every storyboard panel with `step_count=len(orders)`.

- [ ] **Step 1: Write the failing test** (append to `backend/tests/test_visuals_api.py`; add `ObjectIdentity` import and `from app.agent.tools.vision import VisionUnavailable`):

```python
def test_generate_all_threads_object_identity_and_timeline(fake_sb, monkeypatch):
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
    fake_sb.storage.from_("scans").upload("photo-1.jpg", b"scan-bytes")
    prompts = []

    async def fake_generate(prompt, reference_images=None):
        prompts.append(prompt)
        return b"fake-png-bytes"

    async def fake_identity(image_bytes, content_type="image/jpeg", client_factory=None):
        return ObjectIdentity(
            shape="tall clear bottle",
            dominant_colors=["transparent"],
            material="plastik_pet",
            notable_features=["white cap"],
        )

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)
    monkeypatch.setattr(visuals_api, "extract_object_identity", fake_identity)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    assert "Object identity is FIXED for every panel" in prompts[0]
    assert "tall clear bottle" in prompts[0]
    assert "step 1 of 2" in prompts[0]
    assert "step 2 of 2" in prompts[1]


def test_generate_all_continues_when_identity_extraction_fails(fake_sb, monkeypatch):
    fake_sb.table("skills").insert(
        {
            **SKILL,
            "reference_image_path": "photo-1.jpg",
            "steps": [{"order": 1, "instruction": "Cuci botol", "warning": None}],
        }
    )
    fake_sb.storage.from_("scans").upload("photo-1.jpg", b"scan-bytes")
    prompts = []

    async def fake_generate(prompt, reference_images=None):
        prompts.append(prompt)
        return b"fake-png-bytes"

    async def boom_identity(image_bytes, content_type="image/jpeg", client_factory=None):
        raise VisionUnavailable("provider down")

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)
    monkeypatch.setattr(visuals_api, "extract_object_identity", boom_identity)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    assert len(prompts) == 3  # 1 storyboard + before_after + mockup
    assert "Object identity is FIXED" not in prompts[0]
    assert "step 1" in prompts[0]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_visuals_api.py -v -k "identity"`
Expected: FAIL — `AttributeError: module 'app.api.visuals' has no attribute 'extract_object_identity'`.

- [ ] **Step 3: Implement** (in `backend/app/api/visuals.py`):

Update the imports (line 5-12 block):

```python
from app.agent.tools.image_gen import (
    ImageGenUnavailable,
    build_before_after_prompt,
    build_master_prompt,
    build_mockup_prompt,
    build_storyboard_prompt,
    generate_image,
)
from app.agent.tools.vision import VisionUnavailable, extract_object_identity
from app.deps import get_supabase
from app.schemas import ObjectIdentity
from supabase import Client
```

Update `_generate_visual` signature and the storyboard branch:

```python
async def _generate_visual(
    sb: Client,
    skill: dict,
    kind: Kind,
    step: int | None,
    reference_images: list[bytes] | None = None,
    identity: ObjectIdentity | None = None,
    step_count: int | None = None,
) -> dict:
    if kind == "storyboard":
        target = _step_by_order(skill, step)
        if target is None:
            raise KeyError(f"step {step} not found")
        prompt = build_storyboard_prompt(skill, target, identity=identity, step_count=step_count)
    elif kind == "before_after":
        prompt = build_before_after_prompt(skill)
    else:
        prompt = build_mockup_prompt(skill)
```

Update `generate_all_visuals` (after `photo = await _load_reference_bytes(sb, skill)` at line 118):

```python
    photo = await _load_reference_bytes(sb, skill)
    identity = None
    if photo:
        try:
            identity = await extract_object_identity(photo[0])
        except VisionUnavailable:
            identity = None
    last_panel: bytes | None = None
```

And in the storyboard loop (line 135), pass both:

```python
            out = await _generate_visual(
                sb, skill, "storyboard", order, refs, identity=identity, step_count=len(orders)
            )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_visuals_api.py -v`
Expected: PASS (both new tests + all pre-existing — the pre-existing `test_generate_all_generates_steps_in_order` still passes because its fixture has no `reference_image_path` so identity stays `None` and prompts keep "step N").

- [ ] **Step 5: Run the full backend suite + ruff**

Run: `cd backend && uv run pytest tests/ -q --tb=short` — expect baseline + all new tests passing, 4 skipped, 1 warning.
Then from repo root: `backend/.venv/bin/ruff check backend/ && backend/.venv/bin/ruff format --check backend/` — clean.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/visuals.py backend/tests/test_visuals_api.py
git commit -m "feat(visuals): extract and thread object identity through panel generation"
```

---

### Task 4: Full verification gates

**Files:** None modified.

- [ ] **Step 1: Backend full suite** — `cd backend && uv run pytest tests/ -q --tb=short` → all pass (baseline 171 + ~9 new), 4 skipped, 1 pre-existing warning.
- [ ] **Step 2: Ruff gates** — from repo root: `backend/.venv/bin/ruff check backend/ && backend/.venv/bin/ruff format --check backend/` → clean.
- [ ] **Step 3: Confirm git log** — `git log --oneline -5` lists the 3 feature commits; working tree has only the pre-existing `.gitignore` mod and the untracked `supabase/migrations` symlink.
- [ ] **Step 4: Optional live smoke (needs proxy + real keys — NOT in CI)** — with 9Router on `localhost:20128` and the backend `.env` configured, run `cd backend && uv run python -c "import asyncio; from app.agent.tools.vision import extract_object_identity; print(asyncio.run(extract_object_identity(open('../visuals/manual-generation/pet_bottle.jpg','rb').read())))"` and confirm a canonical `ObjectIdentity` JSON prints. If the proxy is down, skip — unit tests cover the contract.

---

### Follow-ups (explicitly out of scope for this plan)

- **Auto-verify loop**: generate panel → vision QA (`{"verdict":"ok|needs_revision",...}`) → regenerate on failure, integrated into `generate_all_visuals`. This is a separate subsystem (state machine + regeneration budget) and deserves its own plan.
- **Multi-reference binary upload**: for providers that accept multiple images (gpt-image-1, ideogram), send `[panel-1, scan-photo]` as actual image inputs instead of only refs[0] — gated on `_REFERENCE_FIELD_NAMES`/capabilities discovery.
- **Manual kit regeneration**: after this plan lands, regenerate `visuals/manual-generation/README-pet-bottle.md` section D prompts with the identity block + timeline (requires a live `extract_object_identity` run on the scan photo).
