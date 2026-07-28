# WASTEX Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps between the WASTEX outline document (docx) and the current codebase: replace the out-of-spec marketplace with an AI Selling Assistant, add image generation, Impact Tracker backend, upgraded AI prompts, community flagging, dedup, privacy delete, feedback, scan caching, and an eval harness.

**Architecture:** FastAPI backend (`backend/`) with pydantic-ai agents over OpenRouter, Supabase (Postgres + pgvector + storage), plain-SQL migrations. Expo React Native frontend with a service-layer switch (`USE_MOCK`). All new LLM features follow the existing pattern: `lru_cache`d `Agent` with `output_type` schema + Indonesian system prompt.

**Tech Stack:** Python 3.12 / FastAPI / pydantic-ai / httpx / Supabase, TypeScript / Expo / jest-expo.

## Global Constraints

- Backend commands run FROM `backend/` dir: `uv sync --group dev` once, then `uv run pytest tests/ -v`.
- Backend tests need env dummies: `OPENROUTER_API_KEY=test DEEPINFRA_API_KEY=test SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_KEY=test-service-key` (prefix every pytest command with these, or rely on `tests/conftest.py` if it already sets them — it does; plain `uv run pytest tests/` works).
- Lint before every commit: `uv run ruff check app/ tests/ && uv run ruff format app/ tests/` (line length 100).
- Frontend: `npm test`, `npm run lint:arch`, `npx tsc --noEmit` from repo root. `.npmrc` has `legacy-peer-deps=true`; never "fix" peer deps.
- Migrations: plain SQL in `backend/supabase/migrations/`, filename prefix `20260729NNNNNN_`.
- ALL user-facing AI output MUST be Bahasa Indonesia.
- Docx constraint: WASTEX is **BUKAN marketplace** — no buy/sell transactions, no listings. The Selling Assistant only produces marketing content.
- Docx constraint: safety-first for kaca/kaleng (no glass cutting for pemula, sharp-edge mitigation mandatory).
- Commits: conventional prefixes (`feat:`, `fix:`, `test:`), one commit per task, run on branch `feature/backend-ai-pipeline`.
- Test fakes live in `backend/tests/fakes.py` (`FakeSupabase`); note `FakeResult.eq()` does NOT filter — design tests with one relevant row per table.
- Existing test fixture pattern (reuse everywhere):

```python
import pytest
from fastapi.testclient import TestClient

from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()
```

---

### Task 1: Replace marketplace with AI Selling Assistant (backend)

The current `backend/app/api/selling.py` implements marketplace CRUD (violates docx "bukan marketplace" and writes to a `marketplace` table that has no migration). Replace it entirely with Modul 9: AI Selling Assistant (nama produk, deskripsi, caption, saran foto, ide kemasan).

**Files:**
- Modify: `backend/app/schemas.py` (add `SellingKit` at end of file)
- Create: `backend/app/agent/selling.py`
- Rewrite: `backend/app/api/selling.py`
- Rewrite: `backend/tests/test_selling.py`

**Interfaces:**
- Consumes: `_openrouter_model` from `app.agent.orchestrator`, `get_settings`, `get_supabase`.
- Produces: `SellingKit` pydantic model (fields below), `async generate_selling_kit(skill: dict) -> SellingKit` in `app.agent.selling`, route `GET /selling/{skill_id}` returning `SellingKit` JSON. Task 2 (frontend) consumes this exact JSON shape.

- [ ] **Step 1: Write the failing tests**

Replace the entire content of `backend/tests/test_selling.py` with:

```python
import pytest
from fastapi.testclient import TestClient

import app.api.selling as selling_api
from app.deps import get_supabase
from app.main import app
from app.schemas import SellingKit
from tests.fakes import FakeSupabase


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


FAKE_KIT = SellingKit(
    skill_id="s1",
    product_name="Vas Botol Estetik",
    description="Vas cantik dari botol PET bekas.",
    captions=["Dari sampah jadi cuan! #upcycling"],
    photo_tips=["Foto dekat jendela dengan cahaya alami."],
    packaging_ideas=["Bungkus kertas koran bekas + tali rami."],
    hashtags=["#wastex", "#upcycling"],
)


@pytest.fixture()
def stub_agent(monkeypatch):
    async def fake_generate(skill):
        return FAKE_KIT

    monkeypatch.setattr(selling_api, "generate_selling_kit", fake_generate)


def test_selling_kit_for_approved_skill(fake_sb, stub_agent):
    fake_sb.table("skills").insert(
        {"id": "s1", "title": "Vas Botol", "material": "plastik_pet", "status": "approved"}
    )
    client = TestClient(app)
    r = client.get("/selling/s1")
    assert r.status_code == 200
    body = r.json()
    assert body["product_name"] == "Vas Botol Estetik"
    assert body["captions"]
    assert body["packaging_ideas"]


def test_selling_kit_unknown_skill_404(fake_sb, stub_agent):
    client = TestClient(app)
    r = client.get("/selling/nope")
    assert r.status_code == 404


def test_selling_kit_unapproved_skill_404(fake_sb, stub_agent):
    fake_sb.table("skills").insert(
        {"id": "s1", "title": "Draft", "material": "kaca", "status": "draft"}
    )
    client = TestClient(app)
    r = client.get("/selling/s1")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `uv run pytest tests/test_selling.py -v`
Expected: FAIL — `ImportError: cannot import name 'SellingKit' from 'app.schemas'`

- [ ] **Step 3: Add `SellingKit` schema**

Append to `backend/app/schemas.py`:

```python
class SellingKit(BaseModel):
    skill_id: str = ""
    product_name: str
    description: str
    captions: list[str] = []
    photo_tips: list[str] = []
    packaging_ideas: list[str] = []
    hashtags: list[str] = []
```

- [ ] **Step 4: Create the selling agent**

Create `backend/app/agent/selling.py`:

```python
from functools import lru_cache

from pydantic_ai import Agent

from app.agent.orchestrator import _openrouter_model
from app.config import get_settings
from app.schemas import SellingKit

SELLING_PROMPT = """Kamu adalah AI Selling Assistant WASTEX untuk pengrajin pemula di Indonesia.
WASTEX BUKAN marketplace - kamu hanya membuat materi pemasaran, bukan transaksi.
Dari data produk upcycling yang diberikan, buat dalam Bahasa Indonesia:
1. product_name: nama produk yang menarik dan mudah dicari (maks 5 kata).
2. description: deskripsi produk 2-3 kalimat yang menonjolkan nilai ramah lingkungan
   dan kisah "dari limbah jadi berharga". Jujur, tanpa klaim berlebihan.
3. captions: 3 caption media sosial (Instagram/TikTok) dengan gaya santai, ajakan
   bertindak, dan emoji secukupnya.
4. photo_tips: 3 saran foto produk praktis dengan HP (pencahayaan, latar, sudut).
5. packaging_ideas: 2-3 ide kemasan murah dan ramah lingkungan dari bahan bekas.
6. hashtags: 5-8 hashtag relevan (campuran Indonesia dan Inggris, tanpa spasi).
Sesuaikan nada dengan tingkat kesulitan dan material produk. Jangan mengarang harga."""


@lru_cache
def selling_agent() -> Agent:
    return Agent(
        _openrouter_model(get_settings().chat_model),
        output_type=SellingKit,
        system_prompt=SELLING_PROMPT,
        retries=1,
    )


async def generate_selling_kit(skill: dict) -> SellingKit:
    prompt = (
        f"Produk: {skill.get('title')}\n"
        f"Material: {skill.get('material')}\n"
        f"Tingkat kesulitan: {skill.get('difficulty')}\n"
        f"Perkiraan harga jual (IDR): {skill.get('est_price_idr') or 'tidak tersedia'}\n"
        f"Langkah pembuatan: {skill.get('steps') or []}"
    )
    result = await selling_agent().run(prompt)
    kit = result.output
    kit.skill_id = str(skill.get("id", ""))
    return kit
```

- [ ] **Step 5: Rewrite the selling router**

Replace the entire content of `backend/app/api/selling.py` with:

```python
from fastapi import APIRouter, Depends, HTTPException

from app.agent.selling import generate_selling_kit
from app.deps import get_supabase
from app.schemas import SellingKit
from supabase import Client

router = APIRouter()


@router.get("/{skill_id}", response_model=SellingKit)
async def get_selling_kit(skill_id: str, sb: Client = Depends(get_supabase)) -> SellingKit:
    res = sb.table("skills").select("*").eq("id", skill_id).execute()
    skill = next((row for row in (res.data or []) if str(row.get("id")) == skill_id), None)
    if not skill or skill.get("status") != "approved":
        raise HTTPException(status_code=404, detail="skill not found")
    return await generate_selling_kit(skill)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_selling.py -v`
Expected: 3 PASS. Then run the full suite: `uv run pytest tests/ -v` — everything green (the old marketplace tests were replaced in Step 1).

- [ ] **Step 7: Lint and commit**

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/schemas.py app/agent/selling.py app/api/selling.py tests/test_selling.py
git commit -m "feat: replace marketplace with AI selling assistant per outline Modul 9"
```

---

### Task 2: Frontend selling integration

Wire the real `/selling/{skill_id}` endpoint into the service layer, replacing the dead `getMarketplace` client and the "no backend selling-kit endpoint yet" comment.

**Files:**
- Modify: `src/services/types.ts` (add `BackendSellingKit`, remove `MarketplaceItem`)
- Modify: `src/services/api.ts` (replace `getMarketplace` with `getSellingKit`)
- Modify: `src/services/index.ts` (add `ApiSelling`, wire `selling` to `USE_MOCK`)
- Test: `src/services/__tests__/sellingMapping.test.ts`

**Interfaces:**
- Consumes: backend `GET /selling/{skill_id}` → `{skill_id, product_name, description, captions, photo_tips, packaging_ideas, hashtags}` (Task 1).
- Produces: exported pure function `sellingKitFromBackend(kit: BackendSellingKit): SellingKit` from `src/services/index.ts`; `selling` export becomes mock/API-switched.

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/sellingMapping.test.ts`:

```typescript
import { sellingKitFromBackend } from "../index";
import { BackendSellingKit } from "../types";

describe("sellingKitFromBackend", () => {
  it("maps backend snake_case kit to frontend SellingKit", () => {
    const backend: BackendSellingKit = {
      skill_id: "s1",
      product_name: "Vas Botol Estetik",
      description: "Vas cantik dari botol PET bekas.",
      captions: ["Dari sampah jadi cuan!"],
      photo_tips: ["Cahaya alami"],
      packaging_ideas: ["Koran bekas"],
      hashtags: ["#wastex"],
    };
    const kit = sellingKitFromBackend(backend);
    expect(kit.productId).toBe("s1");
    expect(kit.productName).toBe("Vas Botol Estetik");
    expect(kit.captions).toEqual(["Dari sampah jadi cuan!"]);
    expect(kit.photoTips).toEqual(["Cahaya alami"]);
    expect(kit.packagingIdeas).toEqual(["Koran bekas"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (repo root): `npm test -- sellingMapping`
Expected: FAIL — `sellingKitFromBackend` is not exported.

- [ ] **Step 3: Update types.ts**

In `src/services/types.ts`, replace the `// ---- Backend Marketplace ----` block (the whole `MarketplaceItem` interface) with:

```typescript
// ---- Backend Selling ----
export interface BackendSellingKit {
  skill_id: string;
  product_name: string;
  description: string;
  captions: string[];
  photo_tips: string[];
  packaging_ideas: string[];
  hashtags: string[];
}
```

- [ ] **Step 4: Update api.ts**

In `src/services/api.ts`, replace:

```typescript
  async getMarketplace() {
    return request('/selling');
  },
```

with:

```typescript
  async getSellingKit(skillId: string) {
    return request(`/selling/${skillId}`);
  },
```

- [ ] **Step 5: Update index.ts**

In `src/services/index.ts`:

a) Add `BackendSellingKit` to the type import list from `"./types"` (line 1-19 import block).

b) Below `class ApiPricing` add:

```typescript
export function sellingKitFromBackend(kit: BackendSellingKit): SellingKit {
  return {
    productId: kit.skill_id,
    productName: kit.product_name,
    description: kit.description,
    captions: kit.captions ?? [],
    photoTips: kit.photo_tips ?? [],
    packagingIdeas: kit.packaging_ideas ?? [],
  };
}

class ApiSelling implements SellingAssistantService {
  async getSellingKit(productId: string): Promise<SellingKit> {
    const kit = (await apiClient.getSellingKit(productId)) as BackendSellingKit;
    return sellingKitFromBackend(kit);
  }
}
```

c) Replace:

```typescript
// No backend selling-kit endpoint yet; kit content stays local.
export const selling: SellingAssistantService = new MockSelling();
```

with:

```typescript
export const selling: SellingAssistantService = USE_MOCK ? new MockSelling() : new ApiSelling();
```

- [ ] **Step 6: Verify**

Run: `npm test -- sellingMapping` → PASS. Then `npx tsc --noEmit` → no errors. Then `npm run lint:arch` → pass. Then full `npm test` → all green.

- [ ] **Step 7: Commit**

```bash
git add src/services/types.ts src/services/api.ts src/services/index.ts src/services/__tests__/sellingMapping.test.ts
git commit -m "feat: wire frontend selling service to AI selling assistant endpoint"
```

---

### Task 3: Image generation module + /visuals API

Implements docx Modul 5/6/7 (storyboard tutorial, before-after preview, product mockup) with detailed image prompts, OpenRouter image generation, storage caching (cost-aware).

**Files:**
- Modify: `backend/app/config.py` (add `image_model` setting)
- Create: `backend/app/agent/tools/image_gen.py`
- Create: `backend/app/api/visuals.py`
- Create: `backend/supabase/migrations/20260729000001_generated_visuals.sql`
- Modify: `backend/app/main.py` (register router)
- Test: `backend/tests/test_image_prompts.py`, `backend/tests/test_visuals_api.py`

**Interfaces:**
- Consumes: `get_settings`, `get_supabase`, skill rows (`title`, `material`, `steps`).
- Produces: pure functions `build_storyboard_prompt(skill: dict, step: dict) -> str`, `build_before_after_prompt(skill: dict) -> str`, `build_mockup_prompt(skill: dict) -> str`; `async generate_image(prompt: str) -> bytes`; route `GET /visuals/{skill_id}/{kind}?step=N` (`kind` ∈ `storyboard|before_after|mockup`) returning `{"skill_id", "kind", "step", "image_path", "cached"}`.

- [ ] **Step 1: Write failing prompt-builder tests**

Create `backend/tests/test_image_prompts.py`:

```python
from app.agent.tools.image_gen import (
    build_before_after_prompt,
    build_mockup_prompt,
    build_storyboard_prompt,
)

SKILL = {
    "id": "s1",
    "title": "Vas Botol PET",
    "material": "plastik_pet",
    "steps": [{"order": 1, "instruction": "Potong botol jadi dua", "warning": "Hati-hati gunting"}],
}


def test_storyboard_prompt_mentions_step_and_style():
    p = build_storyboard_prompt(SKILL, SKILL["steps"][0])
    assert "Potong botol jadi dua" in p
    assert "flat illustration" in p
    assert "step 1" in p.lower()
    assert "no text" in p.lower()


def test_before_after_prompt_has_split_layout():
    p = build_before_after_prompt(SKILL)
    assert "Vas Botol PET" in p
    assert "side-by-side" in p
    assert "before" in p.lower() and "after" in p.lower()


def test_mockup_prompt_is_product_photo_style():
    p = build_mockup_prompt(SKILL)
    assert "Vas Botol PET" in p
    assert "product photography" in p
    assert "photorealistic" in p
```

- [ ] **Step 2: Run to verify fail**

Run: `uv run pytest tests/test_image_prompts.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.tools.image_gen'`

- [ ] **Step 3: Add config setting**

In `backend/app/config.py`, inside the `Settings` class, add directly under the `vision_fallback_model` field:

```python
    image_model: str = "google/gemini-2.5-flash-image-preview"
```

- [ ] **Step 4: Create image_gen module**

Create `backend/app/agent/tools/image_gen.py`:

```python
import base64

import httpx

from app.config import get_settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

_MATERIAL_EN = {
    "plastik_pet": "clear PET plastic bottle",
    "plastik_hdpe": "HDPE plastic container",
    "kardus": "corrugated cardboard",
    "kaleng": "aluminum/tin can",
    "kaca": "glass bottle or jar",
    "sachet": "multilayer plastic sachet",
}

_STYLE_STORYBOARD = (
    "Simple flat illustration style, clean pastel colors, thick outlines, "
    "instructional diagram look, plain light background, no text, no watermark, "
    "no human faces, hands only when needed to show the action."
)

_STYLE_PHOTO = (
    "Photorealistic product photography, soft natural window light, neutral "
    "background, shallow depth of field, high detail, no text, no watermark."
)


def build_storyboard_prompt(skill: dict, step: dict) -> str:
    material = _MATERIAL_EN.get(skill.get("material", ""), "recycled household waste")
    warning = step.get("warning")
    safety = f" Emphasize safe handling: {warning}." if warning else ""
    return (
        f"Instructional storyboard panel for an upcycling craft tutorial, step "
        f"{step.get('order')}. Project: {skill.get('title')} made from {material}. "
        f"Show this action clearly: {step.get('instruction')}.{safety} {_STYLE_STORYBOARD}"
    )


def build_before_after_prompt(skill: dict) -> str:
    material = _MATERIAL_EN.get(skill.get("material", ""), "recycled household waste")
    return (
        f"Side-by-side before and after comparison image. Left (before): dirty used "
        f"{material} as household waste. Right (after): the finished upcycled product "
        f"'{skill.get('title')}', clean and attractive. Same lighting both sides, "
        f"divided by a thin vertical line. {_STYLE_PHOTO}"
    )


def build_mockup_prompt(skill: dict) -> str:
    material = _MATERIAL_EN.get(skill.get("material", ""), "recycled household waste")
    return (
        f"Product photography mockup of '{skill.get('title')}', a handmade upcycled "
        f"product crafted from {material}, styled on a wooden table with a small "
        f"plant, ready for an online catalog. Photorealistic. {_STYLE_PHOTO}"
    )


class ImageGenUnavailable(Exception):
    pass


async def generate_image(prompt: str) -> bytes:
    s = get_settings()
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            OPENROUTER_URL,
            headers={"Authorization": f"Bearer {s.openrouter_api_key}"},
            json={
                "model": s.image_model,
                "modalities": ["image", "text"],
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        r.raise_for_status()
        try:
            data_url = r.json()["choices"][0]["message"]["images"][0]["image_url"]["url"]
            return base64.b64decode(data_url.split(",", 1)[1])
        except (KeyError, IndexError) as e:
            raise ImageGenUnavailable("no image in provider response") from e
```

- [ ] **Step 5: Run prompt tests to verify pass**

Run: `uv run pytest tests/test_image_prompts.py -v`
Expected: 3 PASS.

- [ ] **Step 6: Write failing API tests**

Create `backend/tests/test_visuals_api.py`:

```python
import pytest
from fastapi.testclient import TestClient

import app.api.visuals as visuals_api
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase

SKILL = {
    "id": "s1",
    "title": "Vas Botol PET",
    "material": "plastik_pet",
    "status": "approved",
    "steps": [{"order": 1, "instruction": "Potong botol", "warning": None}],
}


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture()
def stub_image(monkeypatch):
    async def fake_generate(prompt):
        return b"fake-png-bytes"

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)


def test_mockup_generates_and_stores(fake_sb, stub_image):
    fake_sb.table("skills").insert(dict(SKILL))
    client = TestClient(app)
    r = client.get("/visuals/s1/mockup")
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "mockup"
    assert body["cached"] is False
    assert body["image_path"].endswith(".png")
    assert fake_sb.storage.from_("visuals").uploads
    assert fake_sb.table("generated_visuals").inserted


def test_storyboard_requires_valid_step(fake_sb, stub_image):
    fake_sb.table("skills").insert(dict(SKILL))
    client = TestClient(app)
    r = client.get("/visuals/s1/storyboard?step=99")
    assert r.status_code == 404


def test_cached_visual_skips_generation(fake_sb, monkeypatch):
    fake_sb.table("skills").insert(dict(SKILL))
    fake_sb.table("generated_visuals").insert(
        {"skill_id": "s1", "kind": "mockup", "step_order": None, "image_path": "v/s1-mockup.png"}
    )

    async def boom(prompt):
        raise AssertionError("must not generate when cached")

    monkeypatch.setattr(visuals_api, "generate_image", boom)
    client = TestClient(app)
    r = client.get("/visuals/s1/mockup")
    assert r.status_code == 200
    assert r.json()["cached"] is True


def test_unknown_kind_422(fake_sb, stub_image):
    client = TestClient(app)
    r = client.get("/visuals/s1/hologram")
    assert r.status_code == 422
```

- [ ] **Step 7: Run to verify fail**

Run: `uv run pytest tests/test_visuals_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.api.visuals'`

- [ ] **Step 8: Create visuals router**

Create `backend/app/api/visuals.py`:

```python
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from app.agent.tools.image_gen import (
    ImageGenUnavailable,
    build_before_after_prompt,
    build_mockup_prompt,
    build_storyboard_prompt,
    generate_image,
)
from app.deps import get_supabase
from supabase import Client

router = APIRouter()

Kind = Literal["storyboard", "before_after", "mockup"]


def _cache_key(skill_id: str, kind: str, step: int | None) -> str:
    suffix = f"-{step}" if step is not None else ""
    return f"{skill_id}-{kind}{suffix}.png"


@router.get("/{skill_id}/{kind}")
async def get_visual(
    skill_id: str,
    kind: Kind,
    step: int | None = None,
    sb: Client = Depends(get_supabase),
) -> dict:
    res = sb.table("skills").select("*").eq("id", skill_id).execute()
    skill = next((row for row in (res.data or []) if str(row.get("id")) == skill_id), None)
    if not skill or skill.get("status") != "approved":
        raise HTTPException(status_code=404, detail="skill not found")

    step_order = step if kind == "storyboard" else None
    cached = sb.table("generated_visuals").select("*").eq("skill_id", skill_id).execute()
    hit = next(
        (
            row
            for row in (cached.data or [])
            if row.get("skill_id") == skill_id
            and row.get("kind") == kind
            and row.get("step_order") == step_order
        ),
        None,
    )
    if hit:
        return {
            "skill_id": skill_id,
            "kind": kind,
            "step": step_order,
            "image_path": hit["image_path"],
            "cached": True,
        }

    if kind == "storyboard":
        steps = skill.get("steps") or []
        target = next((st for st in steps if st.get("order") == step), None)
        if target is None:
            raise HTTPException(status_code=404, detail="step not found")
        prompt = build_storyboard_prompt(skill, target)
    elif kind == "before_after":
        prompt = build_before_after_prompt(skill)
    else:
        prompt = build_mockup_prompt(skill)

    try:
        image = await generate_image(prompt)
    except ImageGenUnavailable:
        raise HTTPException(status_code=503, detail="image provider unavailable")

    path = _cache_key(skill_id, kind, step_order)
    sb.storage.from_("visuals").upload(path, image, {"content-type": "image/png"})
    sb.table("generated_visuals").insert(
        {"skill_id": skill_id, "kind": kind, "step_order": step_order, "image_path": path, "prompt": prompt}
    ).execute()
    return {
        "skill_id": skill_id,
        "kind": kind,
        "step": step_order,
        "image_path": path,
        "cached": False,
    }
```

- [ ] **Step 9: Register router in main.py**

In `backend/app/main.py`:
- Change the import line to: `from app.api import ingest, pricing, products, recommend, scan, selling, skills, tutorial, visuals`
- After the `selling.router` include line add: `app.include_router(visuals.router, prefix="/visuals", tags=["visuals"])`

- [ ] **Step 10: Create migration**

Create `backend/supabase/migrations/20260729000001_generated_visuals.sql`:

```sql
create table if not exists generated_visuals (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skills(id) on delete cascade,
  kind text not null check (kind in ('storyboard', 'before_after', 'mockup')),
  step_order int,
  image_path text not null,
  prompt text,
  created_at timestamptz not null default now(),
  unique (skill_id, kind, step_order)
);

alter table generated_visuals enable row level security;

create policy "generated_visuals_read_all" on generated_visuals
  for select using (true);

insert into storage.buckets (id, name, public)
values ('visuals', 'visuals', true)
on conflict (id) do nothing;
```

- [ ] **Step 11: Run tests**

Run: `uv run pytest tests/test_visuals_api.py tests/test_image_prompts.py -v`
Expected: 7 PASS. Then full suite: `uv run pytest tests/ -v` — green.

- [ ] **Step 12: Lint and commit**

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/config.py app/agent/tools/image_gen.py app/api/visuals.py app/main.py supabase/migrations/20260729000001_generated_visuals.sql tests/test_image_prompts.py tests/test_visuals_api.py
git commit -m "feat: add image generation for storyboard, before-after, and mockup visuals"
```

---

### Task 4: Impact Tracker backend

Docx Modul 10: impact events persisted in Postgres with a per-user summary (dashboard/gamifikasi data source). Anonymous logging allowed (matches `/scan` pattern); summary requires auth.

**Files:**
- Modify: `backend/app/schemas.py` (add `ImpactEventIn`, `ImpactSummary`)
- Create: `backend/app/api/impact.py`
- Create: `backend/supabase/migrations/20260729000002_impact_events.sql`
- Modify: `backend/app/main.py` (register router)
- Test: `backend/tests/test_impact.py`

**Interfaces:**
- Consumes: `get_optional_user_id`, `get_current_user` (from `app.auth`), `get_supabase`, `create_test_token` in tests.
- Produces: `POST /impact` body `{skill_id?, material, waste_kg, est_value_idr}` → inserted row; `GET /impact/summary` (Bearer required) → `{"total_projects": int, "total_waste_kg": float, "total_value_idr": int}`. Task 5 consumes `POST /impact`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_impact.py`:

```python
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


def test_log_impact_anonymous(fake_sb):
    client = TestClient(app)
    r = client.post(
        "/impact",
        json={"material": "plastik_pet", "waste_kg": 0.5, "est_value_idr": 15000},
    )
    assert r.status_code == 201
    inserted = fake_sb.table("impact_events").inserted
    assert len(inserted) == 1
    assert inserted[0]["material"] == "plastik_pet"
    assert inserted[0]["user_id"] is None


def test_log_impact_rejects_bad_material(fake_sb):
    client = TestClient(app)
    r = client.post("/impact", json={"material": "styrofoam", "waste_kg": 1, "est_value_idr": 0})
    assert r.status_code == 422


def test_summary_requires_auth(fake_sb):
    client = TestClient(app)
    r = client.get("/impact/summary")
    assert r.status_code == 401


def test_summary_aggregates_user_rows(fake_sb):
    fake_sb.table("impact_events").insert(
        [
            {"user_id": "u1", "material": "kaca", "waste_kg": 1.5, "est_value_idr": 20000},
            {"user_id": "u1", "material": "kardus", "waste_kg": 0.5, "est_value_idr": 5000},
        ]
    )
    token = create_test_token({"sub": "u1"})
    client = TestClient(app)
    r = client.get("/impact/summary", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["total_projects"] == 2
    assert body["total_waste_kg"] == 2.0
    assert body["total_value_idr"] == 25000
```

- [ ] **Step 2: Run to verify fail**

Run: `uv run pytest tests/test_impact.py -v`
Expected: FAIL — 404s (no `/impact` route yet).

- [ ] **Step 3: Add schemas**

Append to `backend/app/schemas.py`:

```python
class ImpactEventIn(BaseModel):
    skill_id: UUID | None = None
    material: Material
    waste_kg: float = Field(ge=0)
    est_value_idr: int = Field(ge=0)


class ImpactSummary(BaseModel):
    total_projects: int
    total_waste_kg: float
    total_value_idr: int
```

- [ ] **Step 4: Create impact router**

Create `backend/app/api/impact.py`:

```python
from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.deps import get_optional_user_id, get_supabase
from app.schemas import ImpactEventIn, ImpactSummary
from supabase import Client

router = APIRouter()


@router.post("", status_code=201)
def log_impact(
    event: ImpactEventIn,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> dict:
    row = (
        sb.table("impact_events")
        .insert(
            {
                "user_id": user_id,
                "skill_id": str(event.skill_id) if event.skill_id else None,
                "material": event.material.value,
                "waste_kg": event.waste_kg,
                "est_value_idr": event.est_value_idr,
            }
        )
        .execute()
        .data[0]
    )
    return {"id": row["id"]}


@router.get("/summary", response_model=ImpactSummary)
def impact_summary(
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> ImpactSummary:
    res = sb.table("impact_events").select("*").eq("user_id", user["user_id"]).execute()
    rows = [r for r in (res.data or []) if r.get("user_id") == user["user_id"]]
    return ImpactSummary(
        total_projects=len(rows),
        total_waste_kg=round(sum(float(r.get("waste_kg") or 0) for r in rows), 3),
        total_value_idr=sum(int(r.get("est_value_idr") or 0) for r in rows),
    )
```

- [ ] **Step 5: Register router**

In `backend/app/main.py` extend the import to include `impact` (keep alphabetical: `from app.api import impact, ingest, pricing, ...`) and add after the visuals include:

```python
app.include_router(impact.router, prefix="/impact", tags=["impact"])
```

- [ ] **Step 6: Create migration**

Create `backend/supabase/migrations/20260729000002_impact_events.sql`:

```sql
create table if not exists impact_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  skill_id uuid references skills(id) on delete set null,
  material text not null check (material in ('plastik_pet','plastik_hdpe','kardus','kaleng','kaca','sachet')),
  waste_kg numeric not null default 0,
  est_value_idr int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists impact_events_user_idx on impact_events (user_id);

alter table impact_events enable row level security;

create policy "impact_events_owner_read" on impact_events
  for select using (auth.uid() = user_id);
```

- [ ] **Step 7: Run tests, lint, commit**

Run: `uv run pytest tests/test_impact.py -v` → 4 PASS; full suite green.

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/schemas.py app/api/impact.py app/main.py supabase/migrations/20260729000002_impact_events.sql tests/test_impact.py
git commit -m "feat: add impact tracker backend with per-user summary"
```

---

### Task 5: Frontend impact dual-write

Keep local AsyncStorage history as source of truth for the UI, but fire-and-forget a `POST /impact` when the app runs against the real backend, so the docx's PostgreSQL impact tracker gets data.

**Files:**
- Modify: `src/services/api.ts` (add `logImpact`)
- Modify: `src/services/impact/index.ts` (dual-write in `saveProject`)
- Test: `src/services/__tests__/impactSync.test.ts`

**Interfaces:**
- Consumes: `POST /impact` (Task 4), `USE_MOCK` from `src/services/index.ts` would create an import cycle — so read `process.env.EXPO_PUBLIC_USE_MOCK` directly in the impact service.
- Produces: exported pure function `impactEventFromProject(project: SavedProject): { material: string; waste_kg: number; est_value_idr: number }` from `src/services/impact/index.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/impactSync.test.ts`:

```typescript
import { impactEventFromProject } from "../impact";
import { SavedProject } from "../types";

const PROJECT: SavedProject = {
  id: "p1",
  savedAt: "2026-07-29T00:00:00Z",
  material: {
    materialType: "kaca",
    materialLabel: "Kaca",
    condition: "utuh",
    confidence: 0.9,
    riskLevel: "hati_hati",
    safetyNotes: [],
    potentialUses: [],
  },
  product: {
    id: "prod1",
    name: "Vas Kaca",
    thumbnailUri: "",
    difficulty: "sedang",
    estimatedCost: 12000,
    estimatedTimeMinutes: 45,
    shortDescription: "",
  },
  photoUri: "",
};

describe("impactEventFromProject", () => {
  it("maps a saved project to a backend impact event", () => {
    const event = impactEventFromProject(PROJECT);
    expect(event.material).toBe("kaca");
    expect(event.waste_kg).toBe(2);
    expect(event.est_value_idr).toBe(12000);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- impactSync`
Expected: FAIL — `impactEventFromProject` is not exported.

- [ ] **Step 3: Add apiClient.logImpact**

In `src/services/api.ts`, add inside `apiClient` (after `getSellingKit`):

```typescript
  async logImpact(data: { skill_id?: string; material: string; waste_kg: number; est_value_idr: number }) {
    return request('/impact', { method: 'POST', body: data });
  },
```

- [ ] **Step 4: Implement dual-write in impact service**

In `src/services/impact/index.ts`:

a) Add imports at the top: `import { apiClient } from "../api";` (adjust to existing import style) and ensure `SavedProject` is imported from `../types`.

b) Add the exported mapper (module scope, near the top). The `2` matches the existing local proxy of +2kg per project used in the summary:

```typescript
export function impactEventFromProject(project: SavedProject): {
  material: string;
  waste_kg: number;
  est_value_idr: number;
} {
  return {
    material: project.material.materialType,
    waste_kg: 2,
    est_value_idr: project.product.estimatedCost ?? 0,
  };
}
```

c) At the end of `LocalImpactService.saveProject(...)` (after the local AsyncStorage write succeeds), append:

```typescript
    if (process.env.EXPO_PUBLIC_USE_MOCK === "false") {
      apiClient.logImpact(impactEventFromProject(project)).catch(() => {
        // Offline-first: backend sync is best-effort, local history is source of truth.
      });
    }
```

- [ ] **Step 5: Verify**

Run: `npm test -- impactSync` → PASS. Then `npx tsc --noEmit`, `npm run lint:arch`, full `npm test` → all green.

- [ ] **Step 6: Commit**

```bash
git add src/services/api.ts src/services/impact/index.ts src/services/__tests__/impactSync.test.ts
git commit -m "feat: sync saved projects to backend impact tracker (best-effort)"
```

---

### Task 6: Vision prompt upgrade (few-shot, detail:high, ambiguity)

Docx Fase AI-1 requires ciri-ciri per kategori (few-shot descriptors), `detail: high`, and explicit ambiguity handling (e.g., PET vs PVC → lower confidence).

**Files:**
- Modify: `backend/app/agent/tools/vision.py`
- Test: `backend/tests/test_vision_prompt.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `VISION_PROMPT` (expanded), pure function `build_vision_messages(data_url: str) -> list[dict]` used by `_identify`. `scan_material` signature unchanged.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_vision_prompt.py`:

```python
from app.agent.tools.vision import VISION_PROMPT, build_vision_messages

ALL_MATERIALS = ["plastik_pet", "plastik_hdpe", "kardus", "kaleng", "kaca", "sachet"]


def test_prompt_describes_all_six_materials():
    for m in ALL_MATERIALS:
        assert m in VISION_PROMPT


def test_prompt_handles_ambiguity():
    assert "ragu" in VISION_PROMPT.lower() or "ambigu" in VISION_PROMPT.lower()
    assert "0.6" in VISION_PROMPT


def test_messages_use_detail_high():
    messages = build_vision_messages("data:image/jpeg;base64,AAAA")
    image_part = messages[0]["content"][1]
    assert image_part["image_url"]["detail"] == "high"
    assert image_part["image_url"]["url"].startswith("data:image/jpeg")
```

- [ ] **Step 2: Run to verify fail**

Run: `uv run pytest tests/test_vision_prompt.py -v`
Expected: FAIL — cannot import `build_vision_messages`.

- [ ] **Step 3: Upgrade vision.py**

In `backend/app/agent/tools/vision.py`, replace `VISION_PROMPT` with:

```python
VISION_PROMPT = """Identifikasi material sampah utama pada foto ini.

Ciri khas tiap kategori:
- plastik_pet: botol minuman bening/transparan, kaku, dasar berbintik, kode daur ulang 1.
- plastik_hdpe: botol/jerigen buram tidak tembus pandang (sampo, deterjen, galon), kode 2.
- kardus: karton coklat bergelombang, kotak kemasan, tekstur kertas tebal.
- kaleng: logam silinder (minuman aluminium atau kaleng makanan), mengkilap, ada lipatan tepi.
- kaca: botol/toples bening atau berwarna, permukaan keras mengkilap, terlihat berat.
- sachet: kemasan plastik multilayer kecil (kopi, deterjen, mi instan), lentur, metalik di dalam.

Aturan ambiguitas: jika ragu antara dua kategori (misalnya PET vs PVC, atau kaca vs
plastik bening), pilih yang paling mungkin TAPI set confidence maksimal 0.6 dan
sebutkan keraguan itu di field condition.

Jawab HANYA dengan JSON valid berformat:
{"material": "<salah satu: plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet>",
 "condition": "<deskripsi singkat kondisi (bersih/kotor/rusak) dalam bahasa Indonesia>",
 "confidence": <angka 0 sampai 1>}"""
```

Then add the message builder and use it in `_identify` (replace the inline `messages` list):

```python
def build_vision_messages(data_url: str) -> list[dict]:
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": VISION_PROMPT},
                {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
            ],
        }
    ]
```

In `_identify`, change `"messages": [...]` to `"messages": build_vision_messages(data_url),`.

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/test_vision_prompt.py tests/test_scan_validation.py tests/test_scan_storage.py -v`
Expected: all PASS.

- [ ] **Step 5: Lint and commit**

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/agent/tools/vision.py tests/test_vision_prompt.py
git commit -m "feat: upgrade vision prompt with per-material cues, ambiguity rule, and detail:high"
```

---

### Task 7: Grounding prompt upgrade + richer SolutionPackage

Add explicit language/audience/safety rules to the generation prompt, plus `visual_description` per step (feeds Task 3 storyboards later) and `est_time_minutes`.

**Files:**
- Modify: `backend/app/schemas.py` (`Step`, `SolutionPackage`)
- Modify: `backend/app/agent/orchestrator.py` (`GROUNDING_PROMPT`)
- Modify: `src/services/types.ts` (`Step`, `SolutionPackage`)
- Test: extend `backend/tests/test_schemas.py`

**Interfaces:**
- Produces: `Step.visual_description: str | None = None`; `SolutionPackage.est_time_minutes: int | None = None`. Both optional → all existing constructors keep working.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_schemas.py`:

```python
def test_step_accepts_visual_description():
    from app.schemas import Step

    s = Step(order=1, instruction="Potong botol", visual_description="Tangan memotong botol PET")
    assert s.visual_description == "Tangan memotong botol PET"
    assert Step(order=1, instruction="x").visual_description is None


def test_solution_package_accepts_est_time():
    from app.schemas import SolutionPackage

    p = SolutionPackage(recommendation="Vas", est_time_minutes=45)
    assert p.est_time_minutes == 45
    assert SolutionPackage(recommendation="Vas").est_time_minutes is None
```

- [ ] **Step 2: Run to verify fail**

Run: `uv run pytest tests/test_schemas.py -v`
Expected: the 2 new tests FAIL (unexpected keyword / attribute missing).

- [ ] **Step 3: Update schemas.py**

In `backend/app/schemas.py`:

`Step` becomes:

```python
class Step(BaseModel):
    order: int
    instruction: str
    warning: str | None = None
    visual_description: str | None = None
```

`SolutionPackage`: add after `marketing_copy`:

```python
    est_time_minutes: int | None = None
```

- [ ] **Step 4: Update GROUNDING_PROMPT**

In `backend/app/agent/orchestrator.py`, replace `GROUNDING_PROMPT` with:

```python
GROUNDING_PROMPT = """Kamu adalah AI Upcycling Agent WASTEX untuk pengguna awam di Indonesia.
Tulis SEMUA output dalam Bahasa Indonesia yang sederhana dan ramah pemula.

Aturan grounding:
- Susun rekomendasi HANYA dari konteks yang diberikan.
- Jika informasi tidak ada di konteks, tulis "tidak tersedia" - jangan mengarang.
- Setiap klaim harus mengutip skill sumbernya; isi field sources dengan skill_id yang dikutip.

Aturan keselamatan (WAJIB, prioritas tertinggi):
- Jangan pernah menyarankan memotong kaca untuk pemula atau melelehkan/membakar plastik.
- Untuk kaca dan kaleng: selalu sertakan peringatan tepi tajam dan sarung tangan di step warning.
- Setiap risiko harus punya mitigasi konkret.

Format output:
- Langkah berurutan dan konkret; isi visual_description tiap langkah dengan deskripsi
  singkat adegan untuk ilustrasi (apa yang terlihat, alat dan tangan yang bekerja).
- Alat yang terjangkau di rumah tangga Indonesia.
- Estimasi biaya/harga jual dalam IDR dan est_time_minutes total pengerjaan.
- Marketing copy singkat yang jujur."""
```

- [ ] **Step 5: Update frontend types**

In `src/services/types.ts`:
- `Step` (backend-aligned one, ~line 83): add `visual_description?: string;`
- `SolutionPackage`: add `est_time_minutes?: number;` after `marketing_copy?`.

- [ ] **Step 6: Verify all**

Run: `uv run pytest tests/ -v` (from `backend/`) → green. From root: `npx tsc --noEmit` → clean.

- [ ] **Step 7: Lint and commit**

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/schemas.py app/agent/orchestrator.py tests/test_schemas.py ../src/services/types.ts
git commit -m "feat: strengthen grounding prompt and enrich steps with visual descriptions"
```

---

### Task 8: Pricing v2 — use curated skill prices

Current pricing reads a nonexistent `materials` column and ignores curated `est_cost_idr`/`est_price_idr`. Prefer curated values; keep the heuristic as fallback.

**Files:**
- Rewrite: `backend/app/api/pricing.py`
- Rewrite: `backend/tests/test_pricing.py`

**Interfaces:**
- Produces: `GET /pricing/{skill_id}` response keys unchanged: `skill_id, title, material_cost, labor_cost, total_cost, profit_margin, suggested_price, currency` (frontend `BackendPricing` keeps working).

- [ ] **Step 1: Write the failing tests**

Replace `backend/tests/test_pricing.py` with:

```python
import pytest
from fastapi.testclient import TestClient

from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def test_pricing_prefers_curated_values(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "s1",
            "title": "Vas Botol",
            "material": "plastik_pet",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "x"}],
            "est_cost_idr": 8000,
            "est_price_idr": 25000,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/s1")
    assert r.status_code == 200
    body = r.json()
    assert body["material_cost"] == 8000
    assert body["suggested_price"] == 25000
    assert body["total_cost"] == body["material_cost"] + body["labor_cost"]
    assert body["currency"] == "IDR"


def test_pricing_heuristic_fallback(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "s2",
            "title": "Celengan Kaleng",
            "material": "kaleng",
            "difficulty": "menengah",
            "steps": [{"order": 1, "instruction": "a"}, {"order": 2, "instruction": "b"}],
            "est_cost_idr": None,
            "est_price_idr": None,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/s2")
    assert r.status_code == 200
    body = r.json()
    # heuristic: material 800, labor 2 steps * 0.5h * 25000 = 25000
    assert body["material_cost"] == 800
    assert body["labor_cost"] == 25000
    assert body["suggested_price"] % 1000 == 0
    assert body["suggested_price"] >= body["total_cost"]


def test_pricing_unknown_skill_404(fake_sb):
    client = TestClient(app)
    r = client.get("/pricing/nope")
    assert r.status_code == 404
```

- [ ] **Step 2: Run to verify fail**

Run: `uv run pytest tests/test_pricing.py -v`
Expected: FAIL (old implementation sums nonexistent `materials`, ignores curated values).

- [ ] **Step 3: Rewrite pricing.py**

Replace `backend/app/api/pricing.py` with:

```python
from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_supabase
from supabase import Client

router = APIRouter()

MATERIAL_COSTS = {
    "plastik_pet": 500,
    "plastik_hdpe": 600,
    "kardus": 300,
    "kaleng": 800,
    "kaca": 800,
    "sachet": 200,
}

LABOR_RATES = {
    "pemula": 15000,
    "menengah": 25000,
    "mahir": 40000,
}

DEFAULT_MARGIN = 0.4


@router.get("/{skill_id}")
async def calculate_pricing(skill_id: str, sb: Client = Depends(get_supabase)):
    resp = (
        sb.table("skills")
        .select("id, title, material, difficulty, steps, est_cost_idr, est_price_idr")
        .eq("id", skill_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Skill not found")
    skill = resp.data

    steps = skill.get("steps") or []
    labor_rate = LABOR_RATES.get(skill.get("difficulty") or "menengah", 25000)
    labor_cost = int(len(steps) * 0.5 * labor_rate)

    material_cost = skill.get("est_cost_idr") or MATERIAL_COSTS.get(skill.get("material"), 500)
    total_cost = material_cost + labor_cost

    if skill.get("est_price_idr"):
        suggested_price = skill["est_price_idr"]
        profit_margin = round((suggested_price - total_cost) / total_cost, 2) if total_cost else 0
    else:
        profit_margin = DEFAULT_MARGIN
        suggested_price = round(int(total_cost * (1 + profit_margin)) / 1000) * 1000

    return {
        "skill_id": skill["id"],
        "title": skill["title"],
        "material_cost": material_cost,
        "labor_cost": labor_cost,
        "total_cost": total_cost,
        "profit_margin": profit_margin,
        "suggested_price": suggested_price,
        "currency": "IDR",
    }
```

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/test_pricing.py -v` → 3 PASS. Full suite green.

- [ ] **Step 5: Lint and commit**

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/api/pricing.py tests/test_pricing.py
git commit -m "fix: pricing uses curated skill prices and existing columns"
```

---

### Task 9: Community flagging (verification layer 2 of 3)

Docx requires 3 verification layers; community flagging is missing. Authenticated users flag a skill; at 3+ flags the skill auto-drops to `needs_revision` so experts re-review it.

**Files:**
- Create: `backend/supabase/migrations/20260729000003_skill_flags.sql`
- Modify: `backend/app/api/skills.py` (add flag endpoint)
- Modify: `backend/app/schemas.py` (add `SkillFlagIn`)
- Test: `backend/tests/test_skill_flags.py`

**Interfaces:**
- Produces: `POST /skills/{skill_id}/flag` (Bearer required) body `{"reason": str}` → `{"flag_count": int, "status": str}`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_skill_flags.py`:

```python
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
    r = client.post("/skills/s1/flag", json={"reason": "langkah berbahaya"})
    assert r.status_code == 401


def test_flag_inserts_and_reports_count(fake_sb):
    fake_sb.table("skills").insert({"id": "s1", "title": "Vas", "status": "approved"})
    client = TestClient(app)
    r = client.post("/skills/s1/flag", json={"reason": "langkah berbahaya"}, headers=_auth())
    assert r.status_code == 201
    body = r.json()
    assert body["flag_count"] == 1
    assert body["status"] == "approved"
    assert fake_sb.table("skill_flags").inserted[0]["reason"] == "langkah berbahaya"


def test_third_flag_triggers_needs_revision(fake_sb):
    fake_sb.table("skills").insert({"id": "s1", "title": "Vas", "status": "approved"})
    fake_sb.table("skill_flags").insert(
        [
            {"skill_id": "s1", "user_id": "u1", "reason": "a"},
            {"skill_id": "s1", "user_id": "u2", "reason": "b"},
        ]
    )
    client = TestClient(app)
    r = client.post("/skills/s1/flag", json={"reason": "c"}, headers=_auth("u3"))
    assert r.status_code == 201
    body = r.json()
    assert body["flag_count"] == 3
    assert body["status"] == "needs_revision"
    assert {"status": "needs_revision"} in fake_sb.table("skills").updated


def test_flag_unknown_skill_404(fake_sb):
    client = TestClient(app)
    r = client.post("/skills/nope/flag", json={"reason": "x"}, headers=_auth())
    assert r.status_code == 404
```

- [ ] **Step 2: Run to verify fail**

Run: `uv run pytest tests/test_skill_flags.py -v`
Expected: FAIL — 404/405 (route missing).

- [ ] **Step 3: Add schema**

Append to `backend/app/schemas.py`:

```python
class SkillFlagIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
```

- [ ] **Step 4: Add flag endpoint**

In `backend/app/api/skills.py`, add imports (`get_current_user` from `app.auth`, `SkillFlagIn` from `app.schemas`) and append this route at the end of the file:

```python
FLAG_THRESHOLD = 3


@router.post("/{skill_id}/flag", status_code=201)
def flag_skill(
    skill_id: str,
    flag: SkillFlagIn,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> dict:
    res = sb.table("skills").select("*").eq("id", skill_id).execute()
    skill = next((row for row in (res.data or []) if str(row.get("id")) == skill_id), None)
    if not skill:
        raise HTTPException(status_code=404, detail="skill not found")

    sb.table("skill_flags").insert(
        {"skill_id": skill_id, "user_id": user["user_id"], "reason": flag.reason}
    ).execute()

    flags = sb.table("skill_flags").select("*").eq("skill_id", skill_id).execute()
    count = len([f for f in (flags.data or []) if str(f.get("skill_id")) == skill_id])

    status = skill.get("status")
    if count >= FLAG_THRESHOLD and status == "approved":
        status = "needs_revision"
        sb.table("skills").update({"status": status}).eq("id", skill_id).execute()
    return {"flag_count": count, "status": status}
```

Match the existing import style in `skills.py` (it already imports `APIRouter, Depends, HTTPException`, `get_supabase`, `Client`).

- [ ] **Step 5: Create migration**

Create `backend/supabase/migrations/20260729000003_skill_flags.sql`:

```sql
create table if not exists skill_flags (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skills(id) on delete cascade,
  user_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (skill_id, user_id)
);

alter table skill_flags enable row level security;

create policy "skill_flags_owner_insert" on skill_flags
  for insert with check (auth.uid() = user_id);
```

- [ ] **Step 6: Run tests, lint, commit**

Run: `uv run pytest tests/test_skill_flags.py -v` → 4 PASS; full suite green.

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/schemas.py app/api/skills.py supabase/migrations/20260729000003_skill_flags.sql tests/test_skill_flags.py
git commit -m "feat: add community flagging with auto needs_revision at 3 flags"
```

---

### Task 10: Dedup check in discovery

Docx requires "dedup check sebelum simpan skill". Before inserting a discovered draft, compare its title against existing skills of the same material.

**Files:**
- Modify: `backend/app/agent/tools/discovery.py`
- Test: `backend/tests/test_discovery_dedup.py`

**Interfaces:**
- Produces: pure function `is_duplicate_title(title: str, existing_titles: list[str], threshold: float = 0.85) -> bool` in `app.agent.tools.discovery`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_discovery_dedup.py`:

```python
from app.agent.tools.discovery import is_duplicate_title


def test_exact_match_is_duplicate():
    assert is_duplicate_title("Vas Bunga dari Botol PET", ["Vas Bunga dari Botol PET"])


def test_near_match_is_duplicate():
    assert is_duplicate_title("Vas bunga dari botol pet", ["Vas Bunga dari Botol PET bekas"])


def test_different_title_not_duplicate():
    assert not is_duplicate_title("Celengan Kaleng Susu", ["Vas Bunga dari Botol PET"])


def test_empty_existing_not_duplicate():
    assert not is_duplicate_title("Apapun", [])
```

- [ ] **Step 2: Run to verify fail**

Run: `uv run pytest tests/test_discovery_dedup.py -v`
Expected: FAIL — cannot import `is_duplicate_title`.

- [ ] **Step 3: Implement dedup**

In `backend/app/agent/tools/discovery.py`:

a) Add to imports: `from difflib import SequenceMatcher`

b) Add above `discover_skill`:

```python
def is_duplicate_title(title: str, existing_titles: list[str], threshold: float = 0.85) -> bool:
    norm = title.strip().lower()
    return any(
        SequenceMatcher(None, norm, t.strip().lower()).ratio() >= threshold
        for t in existing_titles
    )
```

c) Inside `discover_skill`, after `draft: SkillDraft = draft_result.output` and BEFORE the safety check, insert:

```python
        sb = get_supabase()
        existing = (
            sb.table("skills").select("title, material").eq("material", material.value).execute()
        )
        titles = [
            row["title"]
            for row in (existing.data or [])
            if row.get("material") == material.value and row.get("title")
        ]
        if is_duplicate_title(draft.title, titles):
            logger.info("discovery skipped: duplicate of existing skill (%s)", draft.title)
            return
```

d) Remove the later duplicate `sb = get_supabase()` line (it now exists earlier).

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/test_discovery_dedup.py -v` → 4 PASS. Full suite (`uv run pytest tests/ -v`) green — check `tests/test_gates.py` still passes since discovery flow changed.

- [ ] **Step 5: Lint and commit**

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/agent/tools/discovery.py tests/test_discovery_dedup.py
git commit -m "feat: skip duplicate discovered skills via title similarity check"
```

---

### Task 11: Privacy — DELETE /scan/{scan_id} (UU PDP)

Owners can delete their scan (row + stored image). Also extend the storage fake with `remove`.

**Files:**
- Modify: `backend/tests/fakes.py` (add `remove` to `FakeStorageBucket`)
- Modify: `backend/app/api/scan.py` (add DELETE route)
- Modify: `src/services/api.ts` (add `deleteScan`)
- Test: `backend/tests/test_scan_delete.py`

**Interfaces:**
- Produces: `DELETE /scan/{scan_id}` (Bearer required) → 204; 404 if not found or not owner (don't leak existence). `FakeStorageBucket.remove(paths: list[str])` appends to `self.removed`.

- [ ] **Step 1: Extend the fake**

In `backend/tests/fakes.py`, update `FakeStorageBucket`:

```python
class FakeStorageBucket:
    def __init__(self):
        self.uploads = []
        self.removed = []

    def upload(self, path, data, file_options=None):
        self.uploads.append((path, len(data), file_options))

    def remove(self, paths):
        self.removed.extend(paths)
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_scan_delete.py`:

```python
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


def test_delete_scan_requires_auth(fake_sb):
    client = TestClient(app)
    r = client.delete("/scan/sc1")
    assert r.status_code == 401


def test_owner_deletes_scan_and_image(fake_sb):
    fake_sb.table("scans").insert({"id": "sc1", "user_id": "u1", "image_url": "sc1.jpeg"})
    client = TestClient(app)
    r = client.delete("/scan/sc1", headers=_auth("u1"))
    assert r.status_code == 204
    assert "sc1.jpeg" in fake_sb.storage.from_("scans").removed


def test_non_owner_gets_404(fake_sb):
    fake_sb.table("scans").insert({"id": "sc1", "user_id": "u1", "image_url": "sc1.jpeg"})
    client = TestClient(app)
    r = client.delete("/scan/sc1", headers=_auth("intruder"))
    assert r.status_code == 404
    assert fake_sb.storage.from_("scans").removed == []


def test_unknown_scan_404(fake_sb):
    client = TestClient(app)
    r = client.delete("/scan/nope", headers=_auth())
    assert r.status_code == 404
```

- [ ] **Step 3: Run to verify fail**

Run: `uv run pytest tests/test_scan_delete.py -v`
Expected: FAIL — 405 Method Not Allowed (route missing).

- [ ] **Step 4: Add DELETE route**

In `backend/app/api/scan.py`, add `from app.auth import get_current_user` to imports and append at the end of the file:

```python
@router.delete("/{scan_id}", status_code=204)
def delete_scan(
    scan_id: str,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> None:
    res = sb.table("scans").select("*").eq("id", scan_id).execute()
    row = next((r for r in (res.data or []) if str(r.get("id")) == scan_id), None)
    # UU PDP: return 404 (not 403) for non-owners to avoid leaking scan existence.
    if not row or row.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=404, detail="scan not found")
    if row.get("image_url"):
        try:
            sb.storage.from_("scans").remove([row["image_url"]])
        except Exception:
            logger.exception("failed to remove scan image %s", row["image_url"])
    sb.table("scans").delete().eq("id", scan_id).execute()
```

- [ ] **Step 5: Add frontend client method**

In `src/services/api.ts`, add inside `apiClient` (after `logImpact`); note this endpoint needs a Bearer token, so accept it explicitly:

```typescript
  async deleteScan(scanId: string, token: string) {
    return request(`/scan/${scanId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
```

The `request` helper returns `response.json()`; a 204 has no body, so also update `request` in `src/services/api.ts` — replace `return response.json();` with:

```typescript
  if (response.status === 204) {
    return undefined as unknown as T;
  }
  return response.json();
```

- [ ] **Step 6: Run tests**

Run: `uv run pytest tests/test_scan_delete.py -v` → 4 PASS; full backend suite green. From root: `npx tsc --noEmit` and `npm test` → green.

- [ ] **Step 7: Lint and commit**

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/api/scan.py tests/fakes.py tests/test_scan_delete.py ../src/services/api.ts
git commit -m "feat: add owner-only scan deletion for UU PDP compliance"
```

---

### Task 12: Feedback endpoint

Docx evaluation loop: users rate recommendations and flag inaccuracies, linked to `agent_runs`.

**Files:**
- Create: `backend/supabase/migrations/20260729000004_feedback.sql`
- Modify: `backend/app/schemas.py` (add `FeedbackIn`)
- Create: `backend/app/api/feedback.py`
- Modify: `backend/app/main.py` (register router)
- Test: `backend/tests/test_feedback.py`

**Interfaces:**
- Produces: `POST /feedback` body `{agent_run_id?, rating (1-5), flag_inaccurate: bool, comment?}` → 201 `{"id": ...}`. Anonymous allowed (uses `get_optional_user_id`).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_feedback.py`:

```python
import pytest
from fastapi.testclient import TestClient

from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def test_submit_feedback(fake_sb):
    client = TestClient(app)
    r = client.post(
        "/feedback",
        json={"rating": 4, "flag_inaccurate": False, "comment": "Langkahnya jelas"},
    )
    assert r.status_code == 201
    inserted = fake_sb.table("feedback").inserted
    assert inserted[0]["rating"] == 4
    assert inserted[0]["flag_inaccurate"] is False


def test_feedback_rating_bounds(fake_sb):
    client = TestClient(app)
    assert client.post("/feedback", json={"rating": 0}).status_code == 422
    assert client.post("/feedback", json={"rating": 6}).status_code == 422


def test_feedback_flag_inaccurate_defaults_false(fake_sb):
    client = TestClient(app)
    r = client.post("/feedback", json={"rating": 5})
    assert r.status_code == 201
    assert fake_sb.table("feedback").inserted[0]["flag_inaccurate"] is False
```

- [ ] **Step 2: Run to verify fail**

Run: `uv run pytest tests/test_feedback.py -v`
Expected: FAIL — 404 (route missing).

- [ ] **Step 3: Add schema**

Append to `backend/app/schemas.py`:

```python
class FeedbackIn(BaseModel):
    agent_run_id: UUID | None = None
    rating: int = Field(ge=1, le=5)
    flag_inaccurate: bool = False
    comment: str | None = Field(default=None, max_length=1000)
```

- [ ] **Step 4: Create feedback router**

Create `backend/app/api/feedback.py`:

```python
from fastapi import APIRouter, Depends

from app.deps import get_optional_user_id, get_supabase
from app.schemas import FeedbackIn
from supabase import Client

router = APIRouter()


@router.post("", status_code=201)
def submit_feedback(
    feedback: FeedbackIn,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> dict:
    row = (
        sb.table("feedback")
        .insert(
            {
                "user_id": user_id,
                "agent_run_id": str(feedback.agent_run_id) if feedback.agent_run_id else None,
                "rating": feedback.rating,
                "flag_inaccurate": feedback.flag_inaccurate,
                "comment": feedback.comment,
            }
        )
        .execute()
        .data[0]
    )
    return {"id": row["id"]}
```

- [ ] **Step 5: Register router**

In `backend/app/main.py` add `feedback` to the `from app.api import ...` list (alphabetical: `feedback, impact, ingest, ...`) and add:

```python
app.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
```

- [ ] **Step 6: Create migration**

Create `backend/supabase/migrations/20260729000004_feedback.sql`:

```sql
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  agent_run_id uuid references agent_runs(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  flag_inaccurate boolean not null default false,
  comment text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;
```

- [ ] **Step 7: Run tests, lint, commit**

Run: `uv run pytest tests/test_feedback.py -v` → 3 PASS; full suite green.

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/schemas.py app/api/feedback.py app/main.py supabase/migrations/20260729000004_feedback.sql tests/test_feedback.py
git commit -m "feat: add user feedback endpoint linked to agent runs"
```

---

### Task 13: Vision result caching via image hash (cost-aware)

Identical image bytes skip the vision call and storage upload by reusing a previous scan's identification.

**Files:**
- Create: `backend/supabase/migrations/20260729000005_scan_image_hash.sql`
- Modify: `backend/app/api/scan.py`
- Test: `backend/tests/test_scan_cache.py`

**Interfaces:**
- Produces: `scans.image_hash` column (sha256 hex); POST /scan reuses cached identification when a scan with the same hash exists.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_scan_cache.py`:

```python
import hashlib

import pytest
from fastapi.testclient import TestClient

import app.api.scan as scan_api
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase

IMAGE = b"same-image-bytes"
HASH = hashlib.sha256(IMAGE).hexdigest()


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def test_cached_hash_skips_vision(fake_sb, monkeypatch):
    fake_sb.table("scans").insert(
        {
            "id": "old",
            "image_hash": HASH,
            "material": "kaca",
            "condition": "bersih",
            "confidence": 0.95,
            "raw_json": {"material": "kaca", "condition": "bersih", "confidence": 0.95},
        }
    )

    async def boom(image, content_type="image/jpeg"):
        raise AssertionError("vision must not be called on cache hit")

    monkeypatch.setattr(scan_api, "scan_material", boom)
    client = TestClient(app)
    r = client.post("/scan", files={"file": ("a.jpg", IMAGE, "image/jpeg")})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "identified"
    assert body["identification"]["material"] == "kaca"
    # a new scans row is still recorded for history
    assert len(fake_sb.table("scans").inserted) == 2


def test_new_hash_calls_vision(fake_sb, monkeypatch):
    from app.schemas import MaterialIdentification

    async def fake_vision(image, content_type="image/jpeg"):
        return MaterialIdentification(material="kardus", condition="kering", confidence=0.9)

    monkeypatch.setattr(scan_api, "scan_material", fake_vision)
    client = TestClient(app)
    r = client.post("/scan", files={"file": ("b.jpg", b"fresh-bytes", "image/jpeg")})
    assert r.status_code == 200
    inserted = fake_sb.table("scans").inserted[0]
    assert inserted["image_hash"] == hashlib.sha256(b"fresh-bytes").hexdigest()
```

- [ ] **Step 2: Run to verify fail**

Run: `uv run pytest tests/test_scan_cache.py -v`
Expected: FAIL — first test calls vision (boom) or `image_hash` key missing.

- [ ] **Step 3: Update scan.py**

In `backend/app/api/scan.py`:

a) Add `import hashlib` at the top and `MaterialIdentification` to the `app.schemas` import.

b) In the `scan` endpoint, after the empty-image check (`raise HTTPException(status_code=400, detail="empty image")` block) and the `content_type` line, replace the vision-call block:

```python
    image_hash = hashlib.sha256(image).hexdigest()
    ident: MaterialIdentification | None = None
    prev = sb.table("scans").select("*").eq("image_hash", image_hash).limit(1).execute()
    hit = next(
        (r for r in (prev.data or []) if r.get("image_hash") == image_hash and r.get("raw_json")),
        None,
    )
    if hit:
        ident = MaterialIdentification.model_validate(hit["raw_json"])
    else:
        try:
            ident = await scan_material(image, content_type)
        except VisionUnavailable:
            raise HTTPException(status_code=503, detail="vision providers unavailable")
```

c) Wrap the storage upload so it only happens on cache miss (cached images already exist in storage):

```python
    scan_id = str(uuid4())
    object_path = f"{scan_id}.{content_type.split('/')[-1]}"
    image_url: str | None = object_path
    if hit:
        image_url = hit.get("image_url")
    else:
        try:
            sb.storage.from_("scans").upload(object_path, image, {"content-type": content_type})
        except Exception:
            logger.exception("scan image upload failed; storing scan without image_url")
            image_url = None
```

d) Add `"image_hash": image_hash,` to the insert dict.

- [ ] **Step 4: Create migration**

Create `backend/supabase/migrations/20260729000005_scan_image_hash.sql`:

```sql
alter table scans add column if not exists image_hash text;
create index if not exists scans_image_hash_idx on scans (image_hash);
```

- [ ] **Step 5: Run tests**

Run: `uv run pytest tests/test_scan_cache.py tests/test_scan_storage.py tests/test_scan_validation.py -v`
Expected: all PASS (existing scan tests use fresh empty tables → cache misses). Full suite green.

- [ ] **Step 6: Lint and commit**

```bash
uv run ruff check app/ tests/ && uv run ruff format app/ tests/
git add app/api/scan.py supabase/migrations/20260729000005_scan_image_hash.sql tests/test_scan_cache.py
git commit -m "feat: cache vision results by image hash to cut provider cost"
```

---

### Task 14: Retrieval eval harness + golden dataset

Docx requires a golden dataset (target 100+ questions; seed 12 now, grow over time) and quality metrics. Pure metric functions are unit-tested; the runner script hits the real DB and is run manually, not in CI.

**Files:**
- Create: `backend/app/eval/__init__.py` (empty), `backend/app/eval/metrics.py`
- Create: `backend/eval/golden_dataset.jsonl`
- Create: `backend/scripts/eval_retrieval.py`
- Test: `backend/tests/test_eval_metrics.py`

**Interfaces:**
- Produces: `hit_at_k(expected: list[str], retrieved: list[str], k: int) -> bool`, `mean_reciprocal_rank(cases: list[tuple[list[str], list[str]]]) -> float` in `app.eval.metrics`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_eval_metrics.py`:

```python
from app.eval.metrics import hit_at_k, mean_reciprocal_rank


def test_hit_at_k_true_within_k():
    assert hit_at_k(["s1"], ["s3", "s1", "s2"], k=2)


def test_hit_at_k_false_outside_k():
    assert not hit_at_k(["s1"], ["s3", "s2", "s1"], k=2)


def test_hit_at_k_empty_retrieved():
    assert not hit_at_k(["s1"], [], k=5)


def test_mrr():
    cases = [
        (["s1"], ["s1", "s2"]),  # rank 1 -> 1.0
        (["s2"], ["s1", "s2"]),  # rank 2 -> 0.5
        (["s9"], ["s1", "s2"]),  # miss   -> 0.0
    ]
    assert abs(mean_reciprocal_rank(cases) - 0.5) < 1e-9


def test_mrr_empty_cases():
    assert mean_reciprocal_rank([]) == 0.0
```

- [ ] **Step 2: Run to verify fail**

Run: `uv run pytest tests/test_eval_metrics.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.eval'`

- [ ] **Step 3: Implement metrics**

Create `backend/app/eval/__init__.py` (empty file) and `backend/app/eval/metrics.py`:

```python
def hit_at_k(expected: list[str], retrieved: list[str], k: int) -> bool:
    top = set(retrieved[:k])
    return any(e in top for e in expected)


def mean_reciprocal_rank(cases: list[tuple[list[str], list[str]]]) -> float:
    if not cases:
        return 0.0
    total = 0.0
    for expected, retrieved in cases:
        for rank, item in enumerate(retrieved, start=1):
            if item in expected:
                total += 1.0 / rank
                break
    return total / len(cases)
```

- [ ] **Step 4: Create golden dataset seed**

Create `backend/eval/golden_dataset.jsonl` (12 seed cases; `expected_titles` are matched against retrieved skills' titles case-insensitively — grow this file toward 100+ entries as the skill base grows):

```jsonl
{"query": "Material: plastik_pet. Tujuan pengguna: vas bunga dari botol", "material": "plastik_pet", "expected_titles": ["vas"]}
{"query": "Material: plastik_pet. Tujuan pengguna: pot tanaman gantung", "material": "plastik_pet", "expected_titles": ["pot"]}
{"query": "Material: plastik_hdpe. Tujuan pengguna: wadah penyimpanan dari jerigen", "material": "plastik_hdpe", "expected_titles": ["wadah"]}
{"query": "Material: kardus. Tujuan pengguna: organizer meja dari kardus bekas", "material": "kardus", "expected_titles": ["organizer"]}
{"query": "Material: kardus. Tujuan pengguna: mainan anak dari kardus", "material": "kardus", "expected_titles": ["mainan"]}
{"query": "Material: kaleng. Tujuan pengguna: celengan dari kaleng bekas", "material": "kaleng", "expected_titles": ["celengan"]}
{"query": "Material: kaleng. Tujuan pengguna: tempat pensil dari kaleng", "material": "kaleng", "expected_titles": ["pensil"]}
{"query": "Material: kaca. Tujuan pengguna: lampu hias dari botol kaca", "material": "kaca", "expected_titles": ["lampu"]}
{"query": "Material: kaca. Tujuan pengguna: toples penyimpanan bumbu", "material": "kaca", "expected_titles": ["toples"]}
{"query": "Material: sachet. Tujuan pengguna: tas anyaman dari sachet kopi", "material": "sachet", "expected_titles": ["tas"]}
{"query": "Material: sachet. Tujuan pengguna: dompet dari kemasan sachet", "material": "sachet", "expected_titles": ["dompet"]}
{"query": "Material: plastik_hdpe. Tujuan pengguna: pot bibit dari botol sampo", "material": "plastik_hdpe", "expected_titles": ["pot"]}
```

- [ ] **Step 5: Create the manual runner script**

Create `backend/scripts/eval_retrieval.py` (run manually against a live Supabase — NOT part of CI):

```python
"""Manual retrieval eval: uv run python scripts/eval_retrieval.py (needs real env vars)."""

import asyncio
import json
from pathlib import Path

from app.agent.tools.retrieval import search_skills
from app.deps import get_supabase
from app.eval.metrics import hit_at_k, mean_reciprocal_rank

DATASET = Path(__file__).resolve().parent.parent / "eval" / "golden_dataset.jsonl"
K = 5


async def main() -> None:
    sb = get_supabase()
    skills = sb.table("skills").select("id, title").execute().data or []
    title_by_id = {str(s["id"]): (s.get("title") or "").lower() for s in skills}

    cases: list[tuple[list[str], list[str]]] = []
    hits = 0
    lines = [ln for ln in DATASET.read_text().splitlines() if ln.strip()]
    for line in lines:
        case = json.loads(line)
        chunks = await search_skills(sb, case["query"], case["material"])
        retrieved_ids = []
        for c in chunks:
            if c.skill_id not in retrieved_ids:
                retrieved_ids.append(c.skill_id)
        expected_ids = [
            sid
            for sid, title in title_by_id.items()
            if any(t.lower() in title for t in case["expected_titles"])
        ]
        cases.append((expected_ids, retrieved_ids))
        if hit_at_k(expected_ids, retrieved_ids, K):
            hits += 1

    print(f"cases: {len(cases)}")
    print(f"hit@{K}: {hits / len(cases):.2%}")
    print(f"MRR: {mean_reciprocal_rank(cases):.3f}")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 6: Run tests**

Run: `uv run pytest tests/test_eval_metrics.py -v`
Expected: 5 PASS. Full suite: `uv run pytest tests/ -v` — green. (Do NOT run `scripts/eval_retrieval.py` in this task; it needs a live DB.)

- [ ] **Step 7: Lint and commit**

```bash
uv run ruff check app/ scripts/ tests/ && uv run ruff format app/ scripts/ tests/
git add app/eval/__init__.py app/eval/metrics.py eval/golden_dataset.jsonl scripts/eval_retrieval.py tests/test_eval_metrics.py
git commit -m "feat: add retrieval eval harness with golden dataset seed"
```

---

## Final Verification (after all tasks)

- [ ] Backend, from `backend/`: `uv run pytest tests/ -v` → all green; `uv run ruff check app/ tests/ scripts/` → clean.
- [ ] Frontend, from repo root: `npm test`, `npx tsc --noEmit`, `npm run lint:arch` → all green.
- [ ] Grep sanity: `marketplace` no longer referenced anywhere in `backend/app/` or `src/services/` (docx "bukan marketplace").
- [ ] Optional push: `git push origin feature/backend-ai-pipeline` (ask user first).

## Deliberately Out of Scope (documented for the reviewer)

- Frontend UI for visuals/feedback/flagging (backend-first; UI is a follow-up plan).
- Auth UI in the app (impact summary + scan delete need Bearer tokens; endpoints are ready).
- RAGAS faithfulness scoring (needs an LLM judge + budget; the harness here covers retrieval hit@k/MRR first and the golden dataset grows toward 100+ entries).
- Replacing the shared service-role key with per-expert JWT roles (tracked TODO in `app/deps.py`).
- Material Tutor info screen still reads the local mock catalog (`getMaterialInfo`); moving it to a backend endpoint is a follow-up once curated material content exists in the DB.