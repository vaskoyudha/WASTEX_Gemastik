# Additional Materials Declaration + Warning System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Declared additional materials (tali, cat, lem, etc.) pass skill verification and surface warnings to users in the app.

**Architecture:** Add `additional_materials` (declared, structured) to proposals + `skills` table, train generator to emit it and verifier to accept it, compute its cost server-side, surface badge/warnings in skill-creator + product screens.

**Tech Stack:** FastAPI + pydantic, Supabase migrations, Expo/React Native (TypeScript), jest-expo, pytest, ruff.

## Global Constraints

- Ruff: line-length 100, `B008`/`BLE001` intentionally ignored. CI gate: `uv run ruff check backend/` then `uv run ruff format --check backend/` (run from repo root: `backend/.venv/bin/ruff ...` — CI runs from root).
- Backend suite: `uv run pytest` from `backend/` (conftest self-configures dummy keys; unit tests never hit real providers).
- Frontend: `npx jest <path>` from repo root, single test: `npx jest <path> -t "<name>"`. Typecheck: `npx tsc --noEmit` — exactly 6 pre-existing errors must remain (profil.tsx flex ×2, Input.tsx, auth tests ×2), no new ones.
- Migrations idempotent (`add column if not exists`), numbered `YYYYMMDD*_*.sql` in `backend/supabase/migrations/`.
- Indonesian UI copy (matches existing screens); LLM prompts Indonesian like existing `SKILL_PROPOSAL_PROMPT`.
- Missing domains: `skills.materials` column does NOT exist — do not select or reference it (see Task 6).

---

### Task 1: Migration for additional_materials columns

**Files:**
- Create: `backend/supabase/migrations/20260805000002_additional_materials.sql`
- Test: `backend/tests/test_migrations_additional_materials.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: DB columns `skills.additional_materials jsonb not null default '[]'` and `skills.additional_materials_cost_idr int not null default 0`.

- [ ] **Step 1: Write the failing test**

```python
from pathlib import Path

MIG_PATH = (
    Path(__file__).resolve().parents[1]
    / "supabase"
    / "migrations"
    / "20260805000002_additional_materials.sql"
)
SQL = MIG_PATH.read_text()


def test_migration_adds_additional_materials_columns():
    assert "alter table skills add column if not exists additional_materials jsonb not null default '[]'" in SQL
    assert "alter table skills add column if not exists additional_materials_cost_idr int not null default 0" in SQL
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_migrations_additional_materials.py -v`
Expected: FAIL — `FileNotFoundError` (migration missing)

- [ ] **Step 3: Write the migration** (single line per statement, matching the reference_image_path migration pattern — `test_migrations_reference_image_path.py` asserts substrings so format must be exact)

```sql
alter table skills add column if not exists additional_materials jsonb not null default '[]';
alter table skills add column if not exists additional_materials_cost_idr int not null default 0;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_migrations_additional_materials.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/20260805000002_additional_materials.sql backend/tests/test_migrations_additional_materials.py
git commit -m "feat(db): add additional_materials columns for skill declarations"
```

---

### Task 2: Schema — AdditionalMaterial model + SkillProposal field

**Files:**
- Modify: `backend/app/schemas.py` (after `ToolItem`, before `Step`)
- Modify: `backend/app/schemas.py` (`SkillProposal` at lines 213-221)
- Test: `backend/tests/test_schemas.py` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `AdditionalMaterial` pydantic model `{name: str, category: Literal[6], est_cost_idr: int = 0, purpose: str = ""}`; `SkillProposal.additional_materials: list[AdditionalMaterial] = []`. `SkillCreateRequest` inherits it automatically (subclass of SkillProposal). Response of `POST /skills/proposals` is `list[SkillProposal]` → includes the new field.

- [ ] **Step 1: Write the failing test** (append to `backend/tests/test_schemas.py`; read the file first to match its imports — it imports `from app.schemas import ...`)

```python
from app.schemas import AdditionalMaterial, SkillProposal


def test_additional_material_defaults():
    m = AdditionalMaterial(name="tali", category="tali", est_cost_idr=2000, purpose="untuk gantungan")
    assert m.est_cost_idr == 2000


def test_additional_material_unknown_category_rejected():
    with pytest.raises(ValidationError):
        AdditionalMaterial(name="x", category="nuklir")


def test_skill_proposal_accepts_additional_materials():
    p = SkillProposal.model_validate(
        {
            "title": "Pot dari Kaleng",
            "description": "Pot gantung dari kaleng bekas.",
            "material": "kaleng",
            "difficulty": "pemula",
            "additional_materials": [
                {"name": "tali", "category": "tali", "est_cost_idr": 2000, "purpose": "untuk gantungan"}
            ],
        }
    )
    assert p.additional_materials[0].name == "tali"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_schemas.py -v -k additional_material`
Expected: FAIL — `ImportError: cannot import name 'AdditionalMaterial'`

- [ ] **Step 3: Implement**

In `backend/app/schemas.py`, after `class ToolItem` (line 40) insert:

```python
class AdditionalMaterial(BaseModel):
    name: str
    category: Literal["tali", "cat", "lem", "tanah_tanaman", "pengait", "alat", "lainnya"]
    est_cost_idr: int = 0
    purpose: str = ""
```

In `SkillProposal` (line 220, after `tools: list[ToolItem] = []`) add:

```python
    additional_materials: list[AdditionalMaterial] = []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_schemas.py -v -k additional_material`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/tests/test_schemas.py
git commit -m "feat(schemas): add AdditionalMaterial declaration model"
```

---

### Task 3: Generator + verifier prompts — declared materials allowed

**Files:**
- Modify: `backend/app/agent/tools/skill_proposals.py` (SKILL_PROPOSAL_PROMPT lines 8-44) + (SKILL_VERIFY_PROMPT lines 46-74)
- Modify: `backend/tests/test_skill_proposals.py` (append prompt assertions)

**Interfaces:**
- Consumes: `SkillProposal.additional_materials` (Task 2).
- Produces: LLM proposals JSON includes `additional_materials`; verifier accepts declared materials and rejects undeclared ones. `_parse_proposals`/`_parse_verdict` unchanged (shape-based).

- [ ] **Step 1: Write the failing test** (append to `backend/tests/test_skill_proposals.py`)

```python
def test_proposal_prompt_requires_additional_materials_declaration():
    assert "additional_materials" in SKILL_PROPOSAL_PROMPT
    assert "WAJIB dideklarasikan" in SKILL_PROPOSAL_PROMPT


def test_verify_prompt_allows_declared_additional_materials():
    assert "additional_materials" in SKILL_VERIFY_PROMPT
    assert "BUKAN pelanggaran" in SKILL_VERIFY_PROMPT


def test_verify_prompt_rejects_undeclared_materials():
    assert "tidak terdaftar" in SKILL_VERIFY_PROMPT
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_skill_proposals.py -v -k additional_materials`
Expected: FAIL — assertions False

- [ ] **Step 3: Update SKILL_PROPOSAL_PROMPT**

Replace the rules + format block (lines 16-44) with:

```python
SKILL_PROPOSAL_PROMPT = """# Tugas
Kamu adalah perancang kerajinan daur ulang (upcycling) yang teliti.
Buat 3 proposal skill yang BENAR-BENAR bisa dibuat dari material ini: {material}.

## Iron Law
HANYA GUNAKAN MATERIAL YANG DIBERIKAN SEBAGAI BAHAN UTAMA. DILARANG MENAMBAH BAHAN UTAMA DARI LUAR.
Jika material tidak cocok untuk ide apa pun, jawab daftar proposals kosong.

## Aturan (MUST/NEVER)
- HANYA gunakan material yang diberikan (salah satu dari:
  plastik_pet, plastik_hdpe, kardus, kaleng, kaca, sachet) sebagai BAHAN UTAMA.
- Bahan pelengkap (tali, cat, lem, tanah/tanaman, pengait, alat bantu kecil,
  dan sejenisnya) BOLEH dipakai, WAJIB dideklarasikan di additional_materials
  dengan name, category (tali|cat|lem|tanah_tanaman|pengait|alat|lainnya),
  est_cost_idr (perkiraan harga wajar dalam IDR), dan purpose (kegunaan, >= 3 kata).
- DILARANG menyebut bahan pelengkap di langkah (instruction/warning) yang TIDAK
  terdaftar di additional_materials.
- Jika material tidak cocok untuk ide apa pun, jawab dengan daftar proposals kosong.
- Setiap langkah wajib punya instruksi jelas dan peringatan keamanan bila ada risiko
  (tergores, terkena panas, zat berbahaya).
- Tingkat kesulitan hanya salah satu dari: pemula, menengah, mahir.
- Kondisi bahan: {condition}. Sesuaikan ide dengan kondisi tersebut.

## Red Flags (hati-hati bila ini terjadi)
- Ide butuh bahan UTAMA di luar whitelist -> buang ide, ganti yang lain.
- Langkah berisiko tanpa peringatan keamanan -> jangan diloloskan.
- Bahan pelengkap disebut di langkah tanpa terdaftar di additional_materials -> perbaiki.
- Ide mustahil dikerjakan di rumah (peralatan industri) -> buang.
- Proposals lebih dari 3 -> jangan, maksimal 3.

## Self-Check (sebelum menjawab)
- Setiap proposal hanya memakai {material} sebagai bahan utama?
- Semua bahan pelengkap di langkah terdaftar di additional_materials?
- Semua langkah aman, jelas, dan peringatan ada untuk risiko?
- JSON valid sesuai format?

Jawab HANYA dengan JSON valid berformat:
{{"proposals": [{{"title": "...", "description": "...",
  "material": "plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet",
  "difficulty": "pemula|menengah|mahir",
  "steps": [{{"order": 1, "instruction": "...", "warning": "..."}}],
  "tools": [{{"name": "...", "optional": false}}],
  "additional_materials": [{{"name": "...", "category": "tali|cat|lem|tanah_tanaman|pengait|alat|lainnya", "est_cost_idr": 2000, "purpose": "..."}}],
  "est_cost_idr": 5000, "est_price_idr": 25000}}]}}"""
```

- [ ] **Step 4: Update SKILL_VERIFY_PROMPT**

Replace rule 1 + red flags (lines 53-63) with:

```python
## Aturan (MUST/NEVER)
1. Kesesuaian material: bahan utama semua langkah HARUS sesuai material yang
   dinyatakan; bahan PELENGKAP (tali, cat, lem, tanah/tanaman, pengait, alat
   bantu kecil) BOLEH dipakai dan BUKAN pelanggaran SELAMA terdaftar di
   additional_materials dengan purpose yang jelas.
2. Kelayakan: apakah langkah-langkah masuk akal dan bisa benar-benar dikerjakan di rumah?
3. Keamanan: apakah ada langkah berbahaya tanpa peringatan yang cukup?
4. Kelengkapan: apakah urutan langkah lengkap dari awal sampai produk jadi?

## Red Flags (hati-hati bila ini terjadi)
- Langkah berbahaya (tajam/panas/beracun) tanpa peringatan -> WAJIB "perbaiki".
- Bahan pelengkap disebut di langkah tapi tidak terdaftar di additional_materials -> WAJIB "perbaiki".
- additional_materials.est_cost_idr tidak wajar (> Rp100.000 per item) atau purpose
  kurang dari 3 kata -> WAJIB "perbaiki".
- Feedback kosong saat verdict "perbaiki" -> jangan, beri alasan spesifik.
- Verdict "layak" karena enggan menolak -> jangan, ikuti aspek.

## Self-Check (sebelum menjawab)
- Verdict konsisten dengan hasil 4 aspek?
- Feedback menyebut masalah spesifik, termasuk bahan pelengkap yang bermasalah?
- JSON valid sesuai format?
```

(The format block lines 70-74 stays unchanged.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_skill_proposals.py tests/test_prompt_contract.py -v`
Expected: PASS (note: `test_proposal_prompt_lists_all_six_materials` still passes — six names still present)

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/tools/skill_proposals.py backend/tests/test_skill_proposals.py
git commit -m "feat(agent): allow declared additional materials in proposal + verify prompts"
```

---

### Task 4: create_skill computes and stores additional_materials_cost_idr

**Files:**
- Modify: `backend/app/api/skills.py` (`create_skill` lines 96-145)
- Test: `backend/tests/test_skill_additional_materials.py` (new)

**Interfaces:**
- Consumes: `SkillCreateRequest.additional_materials` (Task 2).
- Produces: inserted `skills` row carries `additional_materials` (from body) plus `additional_materials_cost_idr` = `sum(item.est_cost_idr)`; response includes both.

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


def test_create_skill_stores_additional_materials_and_cost(fake_sb):
    scan_id = str(uuid4())
    fake_sb.table("scans").insert({"id": scan_id, "user_id": "u1", "image_url": f"{scan_id}.jpg"})
    client = TestClient(app)
    payload = {
        "title": "Pot Gantung Kaleng",
        "description": "Pot gantung mini dari kaleng aluminium.",
        "material": "kaleng",
        "difficulty": "pemula",
        "steps": [{"order": 1, "instruction": "Cuci kaleng", "warning": "Sarung tangan"}],
        "tools": [{"name": "gunting"}],
        "additional_materials": [
            {"name": "tali", "category": "tali", "est_cost_idr": 3000, "purpose": "untuk gantungan pot"},
            {"name": "cat", "category": "cat", "est_cost_idr": 12000, "purpose": "untuk dekorasi permukaan"},
        ],
        "reference_scan_id": scan_id,
    }
    r = client.post("/skills", json=payload, headers=_auth_header())
    assert r.status_code == 201
    assert r.json()["additional_materials_cost_idr"] == 15000
    assert r.json()["additional_materials"][0]["name"] == "tali"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_skill_additional_materials.py -v`
Expected: FAIL — `additional_materials_cost_idr` missing from response dict (KeyError in test)

- [ ] **Step 3: Implement**

In `backend/app/api/skills.py` `create_skill`, inside the `payload.update(...)` block (lines 136-143), add the cost line:

```python
    payload = body.model_dump(mode="json")
    payload.pop("reference_scan_id", None)
    payload["additional_materials_cost_idr"] = sum(
        m.est_cost_idr for m in body.additional_materials
    )
    payload.update(
        {
            "status": "pending",
            "origin": "user",
            "created_by": user["user_id"],
            "reference_image_path": reference_image_path,
        }
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_skill_additional_materials.py -v`
Expected: PASS

- [ ] **Step 5: Run skills suite for regressions**

Run: `uv run pytest tests/test_skill_reference_image.py tests/test_skill_creator_endpoints.py tests/test_gates.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/skills.py backend/tests/test_skill_additional_materials.py
git commit -m "feat(skills): compute and store additional materials cost on create"
```

---

### Task 5: Pricing breakdown includes additional materials

**Files:**
- Modify: `backend/app/api/pricing.py` (lines 26-62)
- Modify: `backend/tests/test_pricing.py` (append)

**Interfaces:**
- Consumes: `skills.additional_materials`, `skills.additional_materials_cost_idr` (Tasks 1+4).
- Produces: `GET /pricing/{skill_id}` response adds `additional_materials` (list of items) and `additional_materials_cost` (int); `total_cost` includes it.

- [ ] **Step 1: Write the failing test** (append; keep existing fixture imports — file already defines `fake_sb` fixture and imports TestClient/app/get_supabase/FakeSupabase)

```python
def test_pricing_includes_additional_materials(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "s3",
            "title": "Pot Gantung",
            "material": "kaleng",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "x"}],
            "est_cost_idr": 800,
            "est_price_idr": None,
            "additional_materials": [
                {"name": "tali", "category": "tali", "est_cost_idr": 3000, "purpose": "gantungan"}
            ],
            "additional_materials_cost_idr": 3000,
        }
    )
    client = TestClient(app)
    r = client.get("/pricing/s3")
    assert r.status_code == 200
    body = r.json()
    assert body["additional_materials_cost"] == 3000
    assert body["additional_materials"][0]["name"] == "tali"
    assert body["total_cost"] == body["material_cost"] + body["labor_cost"] + 3000
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_pricing.py -v -k additional_materials`
Expected: FAIL — `KeyError: 'additional_materials_cost'`

- [ ] **Step 3: Implement**

In `backend/app/api/pricing.py`:
1. Line 30 select: append `, additional_materials, additional_materials_cost_idr`
2. After `material_cost = ...` (line 43) insert:

```python
    additional_items = skill.get("additional_materials") or []
    additional_materials_cost = skill.get("additional_materials_cost_idr") or sum(
        int(item.get("est_cost_idr") or 0) for item in additional_items
    )
    total_cost = material_cost + labor_cost + additional_materials_cost
```

Replace line 44 `total_cost = material_cost + labor_cost` with nothing (now inside above). Return dict: after `"material_cost"` add:

```python
        "additional_materials": additional_items,
        "additional_materials_cost": additional_materials_cost,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_pricing.py -v`
Expected: PASS (all, including pre-existing)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/pricing.py backend/tests/test_pricing.py
git commit -m "feat(pricing): break out additional materials cost into total"
```

---

### Task 6: Tutorial endpoint — fix latent `materials` column bug + return additional_materials

**Files:**
- Modify: `backend/app/api/tutorial.py` (lines 9-35)
- Modify: `backend/tests/test_tutorial.py` (append)

**Interfaces:**
- Consumes: `skills.additional_materials` (Task 1).
- Produces: `GET /tutorial/{skill_id}` returns `additional_materials` array; `materials` key REMOVED (column never existed — bug: `.select("...materials...")` would fail on real Supabase).

- [ ] **Step 1: Write the failing test** (append; reuse fake_sb fixture already in file)

```python
def test_tutorial_returns_additional_materials(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "t1",
            "title": "Pot Gantung",
            "description": "Pot dari kaleng.",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "Cuci kaleng"}],
            "tools": [{"name": "gunting"}],
            "additional_materials": [
                {"name": "tali", "category": "tali", "est_cost_idr": 3000, "purpose": "gantungan"}
            ],
        }
    )
    r = client.get("/tutorial/t1")
    assert r.status_code == 200
    body = r.json()
    assert body["additional_materials"][0]["name"] == "tali"
    assert "materials" not in body
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_tutorial.py -v -k additional_materials`
Expected: FAIL — `KeyError: 'additional_materials'`

- [ ] **Step 3: Implement**

In `backend/app/api/tutorial.py`:
1. Line 13 select: replace `materials, tools, difficulty` with `additional_materials, tools, difficulty`
2. In return dict (lines 26-35), replace `"materials": skill.get("materials", []),` with:

```python
        "additional_materials": skill.get("additional_materials", []),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_tutorial.py -v`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/tutorial.py backend/tests/test_tutorial.py
git commit -m "fix(tutorial): return additional_materials, drop nonexistent materials column"
```

---

### Task 7: Frontend types + mapper for additional materials

**Files:**
- Modify: `src/services/types.ts` (after `ToolItem` line 51; `ProductTutorial` lines 143-150; `BackendTutorial` lines 160-167)
- Modify: `src/services/index.ts` (`ApiTutorial` lines 153-171)
- Modify: `src/services/__tests__/scanner.test.ts` or new `src/services/__tests__/additional-materials.test.ts`
- Modify: `src/mocks/mockData.ts` (`prod_pet_2` tutorial object, line 258)

**Interfaces:**
- Consumes: backend `GET /tutorial` response (Task 6).
- Produces: exported pure mapper `tutorialFromBackend(t: BackendTutorial): ProductTutorial`; `ProductTutorial.additionalMaterials?: AdditionalMaterial[]`; fixes the `toolsAndMaterials` type mismatch (backend returns `{name, optional}` objects, not strings).

- [ ] **Step 1: Write the failing test** (new file `src/services/__tests__/additional-materials.test.ts`; model it on the pure-function test style of `sellingKitFromBackend` — import the exported mapper directly, no module mocking)

```ts
import { tutorialFromBackend } from '../index';
import { BackendTutorial, ProductTutorial, AdditionalMaterial } from '../types';

describe('tutorialFromBackend', () => {
  const backend: BackendTutorial = {
    skill_id: 's1',
    title: 'Pot Gantung',
    description: 'Pot dari kaleng',
    difficulty: 'pemula',
    tools: [{ name: 'gunting', optional: false }],
    steps: [{ order: 1, instruction: 'Cuci kaleng' }],
    estimated_time: '20 menit',
    additional_materials: [
      { name: 'tali', category: 'tali', est_cost_idr: 3000, purpose: 'gantungan' },
    ],
  };

  it('maps additional_materials into ProductTutorial', () => {
    const result: ProductTutorial = tutorialFromBackend(backend);
    expect(result.additionalMaterials).toHaveLength(1);
    expect(result.additionalMaterials![0].name).toBe('tali');
    expect(result.additionalMaterials![0].est_cost_idr).toBe(3000);
  });

  it('maps tools objects to names in toolsAndMaterials', () => {
    const result = tutorialFromBackend(backend);
    expect(result.toolsAndMaterials).toEqual(['gunting']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/additional-materials.test.ts`
Expected: FAIL — `Cannot find name 'tutorialFromBackend'` / type error

- [ ] **Step 3: Implement types**

In `src/services/types.ts`, after `ToolItem` (line 51) add:

```ts
export interface AdditionalMaterial {
  name: string;
  category: 'tali' | 'cat' | 'lem' | 'tanah_tanaman' | 'pengait' | 'alat' | 'lainnya';
  est_cost_idr: number;
  purpose: string;
}
```

In `ProductTutorial` (lines 143-150) add to the interface:

```ts
  additionalMaterials?: AdditionalMaterial[];
```

Change line 147 `toolsAndMaterials: string[];` stays (it remains string[] of display names).

In `BackendTutorial`, change `tools: string[]` (line 165) to:

```ts
  tools: ToolItem[];
```

and add after `tools`:

```ts
  additional_materials: AdditionalMaterial[];
```

Remove `materials: string[];` (line 164) — backend no longer returns it.

- [ ] **Step 4: Implement the mapper**

In `src/services/index.ts`, above `class ApiTutorial` (line 153), add an exported pure function (mirrors `sellingKitFromBackend` pattern):

```ts
export function tutorialFromBackend(t: BackendTutorial): ProductTutorial {
  return {
    productId: t.skill_id,
    steps: t.steps.map((step) => ({
      order: step.order,
      title: `Langkah ${step.order}`,
      description: step.instruction,
      imageUri: '',
      safetyWarning: step.warning ?? undefined,
    })),
    beforeImageUri: '',
    afterImageUri: '',
    mockupImageUri: '',
    toolsAndMaterials: [
      ...(t.tools ?? []).map((tool) => tool.name),
      ...(t.additional_materials ?? []).map((m) => m.name),
    ],
    additionalMaterials: t.additional_materials ?? [],
  };
}
```

Replace the body of `ApiTutorial.getTutorial` (lines 155-170) with:

```ts
  async getTutorial(productId: string): Promise<ProductTutorial> {
    const t = (await apiClient.getTutorial(productId)) as BackendTutorial;
    return tutorialFromBackend(t);
  }
```

- [ ] **Step 5: Update mock data**

In `src/mocks/mockData.ts` `prod_pet_2` tutorial object (line 258), add `additionalMaterials` entry (ProductTutorial allows optional):

```ts
    additionalMaterials: [
      { name: 'Tali rami', category: 'tali' as const, est_cost_idr: 3000, purpose: 'Menggantung vas' },
    ],
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/services --silent`
Expected: PASS (new + existing suites, incl. scanner/index tests)

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the 6 pre-existing errors — no new ones.

- [ ] **Step 8: Commit**

```bash
git add src/services/types.ts src/services/index.ts src/services/__tests__/additional-materials.test.ts src/mocks/mockData.ts
git commit -m "feat(services): expose additional materials in tutorial mapping"
```

---

### Task 8: skill-creator — proposal badge + verify warning

**Files:**
- Modify: `app/scan/skill-creator.tsx` (`renderIdeas` lines 154-177; verify modal line 310 area)
- Modify: `app/scan/skill-creator.test.tsx` (proposals fixture lines 55-66; append tests)

**Interfaces:**
- Consumes: `SkillProposal.additional_materials` (frontend type; backend proposals endpoint returns it).
- Produces: proposal card shows amber badge "Bahan tambahan: tali, cat" (max 3 names); verify popup shows ⚠️ warning when verdict === 'layak' && draft has additional_materials.

- [ ] **Step 1: Write the failing tests**

Update the `proposals` fixture in `app/scan/skill-creator.test.tsx` (lines 55-66) — add `additional_materials` to the proposal:

```ts
    additional_materials: [
      { name: 'tali', category: 'tali', est_cost_idr: 3000, purpose: 'untuk gantungan' },
      { name: 'cat', category: 'cat', est_cost_idr: 12000, purpose: 'untuk dekorasi' },
    ],
```

Append inside the `verify + submit` describe:

```tsx
  it('shows additional materials badge on proposal card', async () => {
    const { findByText } = await render(<SkillCreatorScreen />);
    expect(await findByText('Bahan tambahan: tali, cat')).toBeTruthy();
  });

  it('shows warning in verify popup when laidak with additional materials', async () => {
    const { getByText, findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    fireEvent.press(await findByText('Verifikasi dengan AI'));
    expect(
      await findByText(/Butuh bahan tambahan di luar hasil scan: tali, cat/i),
    ).toBeTruthy();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest app/scan/skill-creator.test.tsx`
Expected: FAIL — both new tests (badge + warning not found)

- [ ] **Step 3: Implement badge** (in `app/scan/skill-creator.tsx` `renderIdeas`, inside the Card, after the difficulty/cost row lines 170)

```tsx
                {idea.additional_materials && idea.additional_materials.length > 0 && (
                  <Text className="text-[10px] text-amber-700 mt-1">
                    Bahan tambahan:{' '}
                    {idea.additional_materials
                      .slice(0, 3)
                      .map((m) => m.name)
                      .join(', ')}
                    {idea.additional_materials.length > 3 ? ' + lainnya' : ''}
                  </Text>
                )}
```

- [ ] **Step 4: Implement warning** — in the verify modal, adjacent to the existing verdict feedback rows (after line 317, inside the same parent View as `verdict?.verdict === 'perbaiki' && ...` block, wrap both in the existing container or add sibling block):

```tsx
            {verdict?.verdict === 'layak' && (draft?.additional_materials?.length ?? 0) > 0 && (
              <View className="flex-row items-start mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <AlertTriangle size={14} color="#d97706" />
                <Text className="text-xs text-amber-800 ml-2 flex-1">
                  Butuh bahan tambahan di luar hasil scan:{' '}
                  {draft!.additional_materials!.map((m) => m.name).join(', ')}. Siapkan bahan
                  ini sebelum mulai mengerjakan.
                </Text>
              </View>
            )}
```

Add `AlertTriangle` to the lucide-react-native import at the top of the file (find existing import line — currently imports `Sparkles`, `Bot`, `CheckCircle2`, `XCircle` from `lucide-react-native`).

- [ ] **Step 5: Also update the test's lucide mock** — `app/scan/skill-creator.test.tsx` line 48-53 mocks lucide icons; add:

```ts
  AlertTriangle: () => null,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest app/scan/skill-creator.test.tsx`
Expected: PASS (all, incl. pre-existing 5)

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the 6 pre-existing errors.

- [ ] **Step 8: Commit**

```bash
git add app/scan/skill-creator.tsx app/scan/skill-creator.test.tsx
git commit -m "feat(scan): show additional materials badge and verify warning"
```

---

### Task 9: Product detail + tutorial screens show Bahan Tambahan section

**Files:**
- Modify: `app/product/[id]/index.tsx` (after "Alat & Bahan" block, line 159)
- Modify: `app/product/[id]/tutorial.tsx` (after steps map, before Tips card line 94)

**Interfaces:**
- Consumes: `ProductTutorial.additionalMaterials` (Task 7).
- Produces: "Bahan Tambahan" section (name + purpose + price) on product detail and tutorial screens; hidden when empty.

- [ ] **Step 1: Implement product detail section** (in `app/product/[id]/index.tsx`, insert after the "Alat & Bahan" ScrollView closing tag at line 159, before the closing `</View>` of the `mb-6` block)

```tsx
        {tutData?.additionalMaterials && tutData.additionalMaterials.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-bold text-slate-900 mb-3">Bahan Tambahan</Text>
            {tutData.additionalMaterials.map((m, idx) => (
              <View
                key={idx}
                className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-2"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-slate-900">{m.name}</Text>
                  <Text className="text-xs font-semibold text-amber-700">
                    Rp {m.est_cost_idr.toLocaleString('id-ID')}
                  </Text>
                </View>
                <Text className="text-[11px] text-slate-500 mt-1">{m.purpose}</Text>
              </View>
            ))}
          </View>
        )}
```

- [ ] **Step 2: Implement tutorial section** (in `app/product/[id]/tutorial.tsx`, insert between the steps map and the Tips card line 94 — after the `{tutData.steps.map(...)}` closing `)}` at line 92)

```tsx
        {tutData?.additionalMaterials && tutData.additionalMaterials.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-bold text-slate-900 mb-3">Bahan Tambahan</Text>
            {tutData.additionalMaterials.map((m, idx) => (
              <View
                key={idx}
                className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-2"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-slate-900">{m.name}</Text>
                  <Text className="text-xs font-semibold text-amber-700">
                    Rp {m.est_cost_idr.toLocaleString('id-ID')}
                  </Text>
                </View>
                <Text className="text-[11px] text-slate-500 mt-1">{m.purpose}</Text>
              </View>
            ))}
          </View>
        )}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the 6 pre-existing errors.

- [ ] **Step 4: Run frontend tests**

Run: `npx jest src/services app --silent`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/product/[id]/index.tsx app/product/[id]/tutorial.tsx
git commit -m "feat(product): show bahan tambahan section on detail and tutorial screens"
```

---

### Task 10: Full verification gates

**Files:**
- None modified.

- [ ] **Step 1: Run backend full suite**

Run (from `backend/`): `uv run pytest tests/ -q --tb=short`
Expected: PASS — count grown from 159 (156+4 skipped previously) by ~10 new tests.

- [ ] **Step 2: Run ruff gates** (from repo root)

Run: `backend/.venv/bin/ruff check backend/ && backend/.venv/bin/ruff format --check backend/`
Expected: clean (if format check flags files, run `backend/.venv/bin/ruff format backend/` and include in the final commit).

- [ ] **Step 3: Run frontend full suite**

Run: `npx jest src app --silent`
Expected: PASS

- [ ] **Step 4: Final pass on new-vs-dead code**

Run: `uv run pytest tests/ -q --tb=short` and confirm no provider calls; verify `git log --oneline -10` lists the 10 feature commits.
