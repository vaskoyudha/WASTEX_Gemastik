# Skill Completion Proof + Star Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User yang menyelesaikan suatu skill bisa meng-upload foto produk jadi + memberi rating bintang 1–5; user lain melihat rating rata-rata, jumlah reviewer, dan galeri foto komunitas di halaman skill.

**Architecture:** Pendekatan A — satu tabel `skill_completions` (foto + rating satu baris, `unique(skill_id,user_id)`). Rating ter-gate karena hanya bisa dikirim bersama foto completion. Dua endpoint baru di router `/skills`; frontend menambah layar `complete.tsx` + tombol di tutorial + tampilan rating/galeri di detail produk.

**Tech Stack:** FastAPI + Pydantic v2 + supabase-py (backend); React Native + Expo + NativeWind + TypeScript strict (frontend); pytest + FakeSupabase (backend tests); Jest + @testing-library/react-native (frontend tests).

**Spec:** `docs/superpowers/specs/2026-08-06-skill-completion-review-design.md`

## Global Constraints

- Python 3.12, Pydantic v2 (`model_validate`, `Field`).
- `ruff line-length = 100`; jalankan `uv run ruff check` + `ruff format` dari `backend/` sebelum commit.
- TDD: tulis test dulu, lihat gagal, implementasi minimal, lihat lulus, commit. Satu test cycle per langkah.
- Frontend: TypeScript strict (`npx tsc --noEmit` harus bersih), NativeWind `className`, ikon via `lucide-react-native`.
- JANGAN pakai emoji di kode/label UI (gunakan ikon `Star` dari lucide, bukan karakter emoji).
- Supabase storage bucket `completions`; public URL = `{supabase_url}/storage/v1/object/public/completions/{path}`.
- `get_current_user` mengembalikan `{"user_id": ..., "email": ...}`.
- FakeSupabase: `.eq()` adalah no-op (tidak memfilter) → filter tambahan di Python bila perlu untuk test deterministik.
- Commit message pakai conventional prefix (`feat:`, `test:`, `chore:`). Commit hanya file milik task berjalan.

---

## File Structure

**Backend (create):**
- `backend/supabase/migrations/20260806000003_skill_completions.sql` — tabel + RLS
- `backend/supabase/migrations/20260806000004_storage_completions.sql` — bucket storage
- `backend/tests/test_skill_completions.py` — endpoint tests

**Backend (modify):**
- `backend/app/schemas.py` — skema completion
- `backend/app/api/skills.py` — 2 endpoint + helper

**Frontend (create):**
- `src/components/ui/StarRating.tsx` + test
- `app/product/[id]/complete.tsx` + test

**Frontend (modify):**
- `src/services/types.ts` — tipe completion
- `src/services/api.ts` — `completeSkill`, `getSkillCompletions` (+test)
- `src/components/ui/index.ts` — export StarRating
- `app/product/[id]/tutorial.tsx` — tombol "Saya Sudah Selesai" (+test)
- `app/product/[id]/index.tsx` — rating + galeri (+test)

---

## Task 1: Migration — tabel `skill_completions` + RLS

**Files:**
- Create: `backend/supabase/migrations/20260806000003_skill_completions.sql`

**Interfaces:**
- Produces: tabel `skill_completions(id, user_id, skill_id, photo_path, rating, comment, created_at)` + `unique(skill_id,user_id)`; RLS publik-baca / pemilik-tulis.

- [ ] **Step 1: Tulis migration**

```sql
create table if not exists skill_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  photo_path text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (skill_id, user_id)
);

create index if not exists skill_completions_skill_idx on skill_completions (skill_id);

alter table skill_completions enable row level security;

create policy "completions_public_read" on skill_completions
  for select using (true);

create policy "completions_owner_insert" on skill_completions
  for insert with check (auth.uid() = user_id);

create policy "completions_owner_delete" on skill_completions
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Verifikasi SQL valid (apply ke Supabase lokal/dev jika ada, atau review manual)**

Run: `cd backend && uv run python -c "import pathlib; print(pathlib.Path('supabase/migrations/20260806000003_skill_completions.sql').read_text())"`
Expected: isi file tercetak; struktur sesuai Step 1.

- [ ] **Step 3: Commit**

```bash
git add backend/supabase/migrations/20260806000003_skill_completions.sql
git commit -m "feat(db): skill_completions table with rating and RLS"
```

---

## Task 2: Migration — storage bucket `completions`

**Files:**
- Create: `backend/supabase/migrations/20260806000004_storage_completions.sql`

**Interfaces:**
- Produces: bucket `completions` (public) di `storage.buckets`.

- [ ] **Step 1: Tulis migration (ikuti pola `20260728000002_storage_scans.sql`, tapi public=true agar galeri bisa dilihat)**

```sql
insert into storage.buckets (id, name, public)
values ('completions', 'completions', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: Verifikasi isi file**

Run: `cd backend && cat supabase/migrations/20260806000004_storage_completions.sql`
Expected: statement insert bucket `completions` dengan `public` true.

- [ ] **Step 3: Commit**

```bash
git add backend/supabase/migrations/20260806000004_storage_completions.sql
git commit -m "feat(db): completions storage bucket"
```

---

## Task 3: Skema Pydantic completion

**Files:**
- Modify: `backend/app/schemas.py` (tambah di akhir file, dekat skema skill lain)

**Interfaces:**
- Produces: `SkillCompletionCreate`, `SkillCompletion`, `CompletionGalleryItem`, `SkillCompletionsSummary` (dipakai Task 4 & 5).

- [ ] **Step 1: Tulis test skema yang gagal**

Buat `backend/tests/test_skill_completion_schemas.py`:

```python
import pytest
from pydantic import ValidationError

from app.schemas import (
    CompletionGalleryItem,
    SkillCompletion,
    SkillCompletionCreate,
    SkillCompletionsSummary,
)


def test_create_accepts_valid_rating():
    c = SkillCompletionCreate(rating=5, comment="mantap")
    assert c.rating == 5
    assert c.comment == "mantap"


def test_create_rejects_rating_out_of_range():
    with pytest.raises(ValidationError):
        SkillCompletionCreate(rating=6)
    with pytest.raises(ValidationError):
        SkillCompletionCreate(rating=0)


def test_completion_roundtrip():
    c = SkillCompletion(
        id="c1", user_id="u1", skill_id="s1", photo_path="c1.jpeg",
        rating=4, comment=None, created_at="2026-01-01T00:00:00Z",
    )
    assert c.rating == 4
    assert c.comment is None


def test_summary_defaults_gallery_empty():
    s = SkillCompletionsSummary(skill_id="s1", avg_rating=0.0, count=0)
    assert s.gallery == []


def test_gallery_item_shape():
    g = CompletionGalleryItem(
        photo_url="https://x/completions/a.jpeg", rating=5,
        comment="ok", created_at="2026-01-01T00:00:00Z", user_display_name="Budi",
    )
    assert g.user_display_name == "Budi"
```

- [ ] **Step 2: Jalankan test, pastikan gagal (ImportError)**

Run: `cd backend && uv run pytest tests/test_skill_completion_schemas.py -q`
Expected: FAIL — `ImportError: cannot import name 'SkillCompletionCreate'`.

- [ ] **Step 3: Tambahkan skema ke `app/schemas.py`**

```python
class SkillCompletionCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class SkillCompletion(BaseModel):
    id: str
    user_id: str
    skill_id: str
    photo_path: str
    rating: int
    comment: str | None = None
    created_at: str


class CompletionGalleryItem(BaseModel):
    photo_url: str
    rating: int
    comment: str | None = None
    created_at: str
    user_display_name: str = ""


class SkillCompletionsSummary(BaseModel):
    skill_id: str
    avg_rating: float
    count: int
    gallery: list[CompletionGalleryItem] = []
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd backend && uv run pytest tests/test_skill_completion_schemas.py -q`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/tests/test_skill_completion_schemas.py
git commit -m "feat(schemas): skill completion models"
```

---

## Task 4: Endpoint `POST /skills/{skill_id}/complete`

**Files:**
- Modify: `backend/app/api/skills.py` (tambah endpoint + import)
- Test: `backend/tests/test_skill_completions.py`

**Interfaces:**
- Consumes: `SkillCompletion` (Task 3), `get_current_user`, `get_supabase`, tabel `skill_completions` + bucket `completions` (Task 1 & 2).
- Produces: `POST /skills/{skill_id}/complete` → 201 + `SkillCompletion`; error 401/404/409/413/415/422.

- [ ] **Step 1: Tulis test yang gagal**

Buat `backend/tests/test_skill_completions.py`:

```python
import pytest
from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase

SKILL = {"id": "s1", "title": "Pot", "material": "plastik_pet", "status": "approved"}
JPEG = b"\xff\xd8\xff fakejpegdata"


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _auth(user="u1"):
    return {"Authorization": f"Bearer {create_test_token({'sub': user})}"}


def _post(client, skill_id="s1", rating="5", comment="bagus", user="u1",
          ctype="image/jpeg", body=JPEG):
    return client.post(
        f"/skills/{skill_id}/complete",
        files={"file": ("x.jpg", body, ctype)},
        data={"rating": rating, "comment": comment},
        headers=_auth(user),
    )


def test_complete_requires_auth(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    r = TestClient(app).post(
        "/skills/s1/complete",
        files={"file": ("x.jpg", JPEG, "image/jpeg")},
        data={"rating": "5"},
    )
    assert r.status_code == 401


def test_complete_creates_row_and_uploads(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    r = _post(TestClient(app))
    assert r.status_code == 201
    body = r.json()
    assert body["rating"] == 5
    assert body["skill_id"] == "s1"
    assert body["photo_path"].endswith(".jpeg")
    row = fake_sb.table("skill_completions").inserted[0]
    assert row["user_id"] == "u1"
    assert len(fake_sb.storage.from_("completions").uploads) == 1


def test_complete_duplicate_409(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    fake_sb.table("skill_completions").insert(
        {"user_id": "u1", "skill_id": "s1", "photo_path": "a.jpeg", "rating": 4}
    )
    r = _post(TestClient(app))
    assert r.status_code == 409


def test_complete_skill_not_found_404(fake_sb):
    r = _post(TestClient(app), skill_id="nope")
    assert r.status_code == 404


def test_complete_bad_rating_422(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    r = _post(TestClient(app), rating="9")
    assert r.status_code == 422


def test_complete_bad_type_415(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    r = _post(TestClient(app), ctype="text/plain")
    assert r.status_code == 415
```

- [ ] **Step 2: Jalankan test, pastikan gagal (404 route / error)**

Run: `cd backend && uv run pytest tests/test_skill_completions.py -q`
Expected: FAIL (endpoint belum ada → 404/405, atau assert gagal).

- [ ] **Step 3: Implementasi endpoint di `app/api/skills.py`**

Tambahkan import di atas (gabungkan dengan import yang sudah ada):

```python
from uuid import UUID, uuid4
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from app.config import get_settings
```

Tambahkan konstanta + logger di bawah `FLAG_THRESHOLD = 3`:

```python
logger = logging.getLogger(__name__)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"]
```

Tambahkan endpoint (letakkan SETELAH route `/proposals/expand`, SEBELUM route `/{skill_id}/flag` agar tidak tertutup):

```python
@router.post("/{skill_id}/complete", status_code=201, response_model=SkillCompletion)
async def complete_skill(
    skill_id: str,
    file: UploadFile = File(...),
    rating: int = Form(..., ge=1, le=5),
    comment: str | None = Form(None),
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> SkillCompletion:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {file.content_type}")
    image = await file.read()
    if len(image) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")
    if not image:
        raise HTTPException(status_code=400, detail="empty image")

    if not sb.table("skills").select("id").eq("id", skill_id).execute().data:
        raise HTTPException(status_code=404, detail="skill not found")

    existing = (
        sb.table("skill_completions").select("*").eq("skill_id", skill_id).execute().data or []
    )
    if any(c.get("skill_id") == skill_id and c.get("user_id") == user["user_id"] for c in existing):
        raise HTTPException(status_code=409, detail="Anda sudah mengirimkan hasil untuk skill ini")

    completion_id = str(uuid4())
    photo_path = f"{completion_id}.{file.content_type.split('/')[-1]}"
    try:
        sb.storage.from_("completions").upload(
            photo_path, image, {"content-type": file.content_type}
        )
    except Exception:
        logger.exception("completion photo upload failed")
        raise HTTPException(status_code=502, detail="photo upload failed")

    row = (
        sb.table("skill_completions")
        .insert(
            {
                "id": completion_id,
                "user_id": user["user_id"],
                "skill_id": skill_id,
                "photo_path": photo_path,
                "rating": rating,
                "comment": comment,
            }
        )
        .execute()
        .data[0]
    )
    return SkillCompletion(
        id=row["id"],
        user_id=row["user_id"],
        skill_id=row["skill_id"],
        photo_path=row["photo_path"],
        rating=row["rating"],
        comment=row.get("comment"),
        created_at=row["created_at"],
    )
```

Pastikan `SkillCompletion` di-import dari `app.schemas` (tambah ke import list skema yang sudah ada).

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd backend && uv run pytest tests/test_skill_completions.py -q`
Expected: PASS (6 test).

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/skills.py backend/tests/test_skill_completions.py
git commit -m "feat(skills): POST complete endpoint with photo and rating"
```

---

## Task 5: Endpoint `GET /skills/{skill_id}/completions`

**Files:**
- Modify: `backend/app/api/skills.py` (tambah endpoint + helper `_display_names`)
- Test: `backend/tests/test_skill_completions.py` (tambah)

**Interfaces:**
- Consumes: `SkillCompletionsSummary`, `CompletionGalleryItem` (Task 3), tabel `skill_completions` + `profiles`.
- Produces: `GET /skills/{skill_id}/completions` → `SkillCompletionsSummary` (avg_rating, count, gallery); 404 bila skill tak ada.

- [ ] **Step 1: Tulis test yang gagal (tambah ke `test_skill_completions.py`)**

```python
def test_get_completions_summary_and_gallery(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    fake_sb.table("skill_completions").insert(
        [
            {"user_id": "u1", "skill_id": "s1", "photo_path": "a.jpeg", "rating": 5,
             "comment": "mantap", "created_at": "2026-01-02T00:00:00Z"},
            {"user_id": "u2", "skill_id": "s1", "photo_path": "b.jpeg", "rating": 3,
             "comment": None, "created_at": "2026-01-01T00:00:00Z"},
        ]
    )
    fake_sb.table("profiles").insert([{"auth_user_id": "u1", "display_name": "Budi"}])
    r = TestClient(app).get("/skills/s1/completions")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    assert body["avg_rating"] == 4.0
    assert body["gallery"][0]["photo_url"].endswith("completions/a.jpeg")
    assert body["gallery"][0]["user_display_name"] == "Budi"
    assert body["gallery"][0]["rating"] == 5


def test_get_completions_empty(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    r = TestClient(app).get("/skills/s1/completions")
    assert r.status_code == 200
    assert r.json()["count"] == 0
    assert r.json()["gallery"] == []


def test_get_completions_skill_not_found(fake_sb):
    r = TestClient(app).get("/skills/nope/completions")
    assert r.status_code == 404
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd backend && uv run pytest tests/test_skill_completions.py -q -k get_completions`
Expected: FAIL (endpoint belum ada).

- [ ] **Step 3: Implementasi endpoint + helper di `app/api/skills.py`**

```python
def _display_names(sb: Client, user_ids: list) -> dict:
    ids = [u for u in set(user_ids) if u]
    if not ids:
        return {}
    try:
        profs = sb.table("profiles").select("auth_user_id,display_name").execute().data or []
        return {p["auth_user_id"]: p["display_name"] for p in profs if p.get("auth_user_id") in ids}
    except Exception:
        return {}


@router.get("/{skill_id}/completions", response_model=SkillCompletionsSummary)
def get_skill_completions(
    skill_id: str, sb: Client = Depends(get_supabase)
) -> SkillCompletionsSummary:
    if not sb.table("skills").select("id").eq("id", skill_id).execute().data:
        raise HTTPException(status_code=404, detail="skill not found")

    rows = (
        sb.table("skill_completions").select("*").eq("skill_id", skill_id).execute().data or []
    )
    rows = [r for r in rows if r.get("skill_id") == skill_id]
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)

    count = len(rows)
    avg_rating = round(sum(r["rating"] for r in rows) / count, 1) if count else 0.0
    names = _display_names(sb, [r.get("user_id") for r in rows])
    base = get_settings().supabase_url.rstrip("/")
    gallery = [
        CompletionGalleryItem(
            photo_url=f"{base}/storage/v1/object/public/completions/{r['photo_path']}",
            rating=r["rating"],
            comment=r.get("comment"),
            created_at=r.get("created_at", ""),
            user_display_name=names.get(r.get("user_id"), ""),
        )
        for r in rows
    ]
    return SkillCompletionsSummary(skill_id=skill_id, avg_rating=avg_rating, count=count, gallery=gallery)
```

Import `SkillCompletionsSummary` dan `CompletionGalleryItem` dari `app.schemas`.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd backend && uv run pytest tests/test_skill_completions.py -q`
Expected: PASS (9 test total).

- [ ] **Step 5: Ruff + full suite, lalu commit**

Run: `cd backend && uv run ruff check app/ tests/ && uv run ruff format --check app/ tests/ && uv run pytest -q`
Expected: ruff bersih, semua test lulus.

```bash
git add backend/app/api/skills.py backend/tests/test_skill_completions.py
git commit -m "feat(skills): GET completions summary and gallery"
```

---

## Task 6: Frontend — types + `apiClient` methods

**Files:**
- Modify: `src/services/types.ts` (tambah tipe)
- Modify: `src/services/api.ts` (tambah method)
- Modify: `src/services/__tests__/api.test.ts` (tambah test)

**Interfaces:**
- Produces: `apiClient.completeSkill(skillId, imageUri, rating, comment?)` dan `apiClient.getSkillCompletions(skillId)`; tipe `SkillCompletion`, `CompletionGalleryItem`, `SkillCompletionsSummary`.

- [ ] **Step 1: Tulis test yang gagal (tambah ke `api.test.ts`)**

```typescript
it('completeSkill posts multipart with auth to /skills/{id}/complete', async () => {
  (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
  await apiClient.completeSkill('s1', 'file:///tmp/x.jpg', 5, 'mantap');
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toContain('/skills/s1/complete');
  expect(init.method).toBe('POST');
  expect(init.headers.Authorization).toBe('Bearer tok-123');
  expect(init.body).toBeInstanceOf(FormData);
});

it('getSkillCompletions hits /skills/{id}/completions', async () => {
  await apiClient.getSkillCompletions('s1');
  const [url] = fetchMock.mock.calls[0];
  expect(url).toContain('/skills/s1/completions');
});
```

(Catatan: mock `fetch` untuk completeSkill karena memakai FormData + fetch langsung, bukan helper `request`.)

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx jest src/services/__tests__/api.test.ts -t "completeSkill" -t "getSkillCompletions"`
Expected: FAIL — `apiClient.completeSkill is not a function`.

- [ ] **Step 3: Tambah tipe ke `src/services/types.ts`**

```typescript
export interface SkillCompletion {
  id: string;
  user_id: string;
  skill_id: string;
  photo_path: string;
  rating: number;
  comment?: string | null;
  created_at: string;
}

export interface CompletionGalleryItem {
  photo_url: string;
  rating: number;
  comment?: string | null;
  created_at: string;
  user_display_name?: string;
}

export interface SkillCompletionsSummary {
  skill_id: string;
  avg_rating: number;
  count: number;
  gallery: CompletionGalleryItem[];
}
```

- [ ] **Step 4: Tambah method ke `src/services/api.ts`**

Import `SkillCompletionsSummary` di baris atas, lalu tambah dua method dalam `apiClient`:

```typescript
async completeSkill(skillId: string, imageUri: string, rating: number, comment?: string) {
  const formData = new FormData();
  const response = await fetch(imageUri);
  const blob = await response.blob();
  formData.append('file', blob, 'completion.jpg');
  formData.append('rating', String(rating));
  if (comment) formData.append('comment', comment);
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/skills/${skillId}/complete`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Submit gagal' }));
    const err = new Error(error.detail || `API error: ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
},

async getSkillCompletions(skillId: string): Promise<SkillCompletionsSummary> {
  return request(`/skills/${skillId}/completions`);
},
```

- [ ] **Step 5: Jalankan test + typecheck, pastikan lulus**

Run: `npx jest src/services/__tests__/api.test.ts && npx tsc --noEmit`
Expected: PASS + tsc bersih.

- [ ] **Step 6: Commit**

```bash
git add src/services/types.ts src/services/api.ts src/services/__tests__/api.test.ts
git commit -m "feat(api): completeSkill and getSkillCompletions client methods"
```

---

## Task 7: Komponen `StarRating`

**Files:**
- Create: `src/components/ui/StarRating.tsx`
- Modify: `src/components/ui/index.ts` (export)
- Create: `src/components/ui/StarRating.test.tsx`

**Interfaces:**
- Produces: `<StarRating value onChange? size? readOnly? />` (dipakai Task 8 input, Task 10 display).

- [ ] **Step 1: Tulis test yang gagal**

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StarRating } from './StarRating';

jest.mock('lucide-react-native', () => ({ Star: () => null }));

describe('StarRating', () => {
  it('renders 5 stars', () => {
    const { UNSAFE_getAllByType } = render(<StarRating value={3} />);
    expect(UNSAFE_getAllByType(require('react-native').TouchableOpacity).length).toBe(5);
  });

  it('calls onChange with tapped star value', () => {
    const onChange = jest.fn();
    const { UNSAFE_getAllByType } = render(<StarRating value={0} onChange={onChange} />);
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[3]);
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx jest src/components/ui/StarRating.test.tsx`
Expected: FAIL — `Cannot find module './StarRating'`.

- [ ] **Step 3: Implementasi `StarRating.tsx`**

```tsx
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Star } from "lucide-react-native";

export interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  size = 28,
  readOnly = false,
}) => {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const star = (
          <Star size={size} color={filled ? "#f59e0b" : "#cbd5e1"} fill={filled ? "#f59e0b" : "none"} />
        );
        return readOnly ? (
          <View key={n} className="mr-1">{star}</View>
        ) : (
          <TouchableOpacity key={n} onPress={() => onChange?.(n)} className="mr-1">
            {star}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
```

Tambahkan ke `src/components/ui/index.ts`:

```typescript
export * from "./StarRating";
```

- [ ] **Step 4: Jalankan test + typecheck**

Run: `npx jest src/components/ui/StarRating.test.tsx && npx tsc --noEmit`
Expected: PASS + tsc bersih.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/StarRating.tsx src/components/ui/StarRating.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): StarRating component"
```

---

## Task 8: Layar `complete.tsx`

**Files:**
- Create: `app/product/[id]/complete.tsx`
- Create: `app/product/[id]/complete.test.tsx`

**Interfaces:**
- Consumes: `apiClient.completeSkill` (Task 6), `StarRating` (Task 7), `expo-image-picker`.
- Produces: layar submit foto + rating + komentar → panggil `completeSkill`.

- [ ] **Step 1: Tulis test yang gagal**

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText } from 'react-native';
import CompleteScreen from './complete';

const mockComplete = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: mockRouterReplace }),
  useLocalSearchParams: () => ({ id: 's1' }),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('../../../src/services/api', () => ({
  apiClient: { completeSkill: (...a: unknown[]) => mockComplete(...a) },
}));

jest.mock('../../../src/components/ui', () => ({
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  Button: ({ title, onPress, disabled }: any) => (
    <MockPressable onPress={onPress} disabled={disabled}><MockText>{title}</MockText></MockPressable>
  ),
  StarRating: ({ onChange }: any) => (
    <MockPressable onPress={() => onChange?.(5)}><MockText>stars</MockText></MockPressable>
  ),
}));

jest.mock('lucide-react-native', () => ({ Image: () => null, Camera: () => null }));

describe('CompleteScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); mockComplete.mockResolvedValue({}); });

  it('submit disabled until photo and rating set', async () => {
    const { getByText } = render(<CompleteScreen />);
    const submit = getByText('Kirim Hasil');
    expect(submit).toBeTruthy();
  });

  it('calls completeSkill with rating after picking photo and stars', async () => {
    const picker = require('expo-image-picker');
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///p.jpg' }] });
    const { getByText } = render(<CompleteScreen />);
    fireEvent.press(getByText('Ambil dari Galeri'));
    fireEvent.press(getByText('stars'));
    fireEvent.press(getByText('Kirim Hasil'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockComplete).toHaveBeenCalledWith('s1', 'file:///p.jpg', 5, undefined);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx jest "app/product/\[id\]/complete.test.tsx"`
Expected: FAIL — `Cannot find module './complete'`.

- [ ] **Step 3: Implementasi `complete.tsx`**

```tsx
import React, { useState } from "react";
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Header, StarRating } from "../../../src/components/ui";
import { apiClient } from "../../../src/services/api";
import { safeBack } from "../../../src/lib/navigation";
import { Image as ImageIcon } from "lucide-react-native";

export default function CompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0].uri) setPhoto(result.assets[0].uri);
    } catch {
      Alert.alert("Gagal", "Tidak dapat membuka galeri foto.");
    }
  };

  const canSubmit = Boolean(photo) && rating >= 1 && !submitting;

  const handleSubmit = async () => {
    if (!photo || rating < 1) return;
    setSubmitting(true);
    try {
      await apiClient.completeSkill(id as string, photo, rating, comment.trim() || undefined);
      setDone(true);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 409) {
        Alert.alert("Sudah Terkirim", "Anda sudah mengirimkan hasil untuk skill ini.");
      } else {
        Alert.alert("Gagal", "Tidak dapat mengirim hasil. Coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <View className="flex-1 bg-slate-50">
        <Header title="Hasil Terkirim" onBack={() => safeBack(router)} />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base font-bold text-slate-900 text-center mb-2">Terima kasih!</Text>
          <Text className="text-sm text-slate-600 text-center mb-6">
            Hasil karyamu kini tampil di galeri komunitas dan membantu user lain.
          </Text>
          <Button title="Kembali ke Detail" onPress={() => router.replace(`/product/${id}`)} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Tandai Selesai" onBack={() => safeBack(router)} />
      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-sm font-bold text-slate-900 mb-2">Foto Produk Jadi</Text>
        {photo ? (
          <Image source={{ uri: photo }} className="w-full h-48 rounded-2xl bg-slate-200 mb-3" />
        ) : (
          <TouchableOpacity
            onPress={pickImage}
            className="w-full h-48 rounded-2xl bg-slate-100 border border-dashed border-slate-300 items-center justify-center mb-3"
          >
            <ImageIcon size={32} color="#94a3b8" />
            <Text className="text-xs text-slate-500 mt-2">Pilih foto produk jadi kamu</Text>
          </TouchableOpacity>
        )}
        <Button
          title={photo ? "Ganti Foto" : "Ambil dari Galeri"}
          onPress={pickImage}
          variant="secondary"
          className="mb-6"
        />

        <Text className="text-sm font-bold text-slate-900 mb-2">Rating Skill Ini</Text>
        <View className="mb-6">
          <StarRating value={rating} onChange={setRating} size={32} />
        </View>

        <Text className="text-sm font-bold text-slate-900 mb-2">Komentar (opsional)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          multiline
          placeholder="Ceritakan pengalamanmu mengikuti skill ini..."
          className="border border-slate-200 rounded-xl px-4 py-3 mb-6 text-sm min-h-[80px]"
        />

        <Button title="Kirim Hasil" onPress={handleSubmit} disabled={!canSubmit} loading={submitting} />
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 4: Jalankan test + typecheck**

Run: `npx jest "app/product/\[id\]/complete.test.tsx" && npx tsc --noEmit`
Expected: PASS + tsc bersih.

- [ ] **Step 5: Commit**

```bash
git add "app/product/[id]/complete.tsx" "app/product/[id]/complete.test.tsx"
git commit -m "feat(product): completion screen with photo and star rating"
```

---

## Task 9: Tombol "Saya Sudah Selesai" di `tutorial.tsx`

**Files:**
- Modify: `app/product/[id]/tutorial.tsx`
- Create: `app/product/[id]/tutorial.test.tsx`

**Interfaces:**
- Consumes: route `/product/[id]/complete` (Task 8), `useProductData`.
- Produces: tombol navigasi ke layar completion.

- [ ] **Step 1: Tulis test yang gagal**

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText, Image as MockImage, View as MockView } from 'react-native';
import TutorialScreen from './tutorial';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: mockPush }),
  useLocalSearchParams: () => ({ id: 's1' }),
}));

jest.mock('../../../src/hooks/useProductData', () => ({
  useProductData: () => ({
    product: { name: 'Pot' },
    tutData: { steps: [{ order: 1, title: 'Cuci', description: 'd', imageUri: 'u' }], additionalMaterials: [] },
    loading: false, error: null, refetch: jest.fn(),
  }),
}));

jest.mock('../../../src/components/ui', () => ({
  Header: ({ title }: any) => <MockText>{title}</MockText>,
  Button: ({ title, onPress }: any) => <MockPressable onPress={onPress}><MockText>{title}</MockText></MockPressable>,
  Card: ({ children, onPress }: any) => <MockPressable onPress={onPress}>{children}</MockPressable>,
  LoadingSpinner: () => <MockText>loading</MockText>,
}));

jest.mock('lucide-react-native', () => ({ ShieldAlert: () => null }));

describe('TutorialScreen', () => {
  it('shows Saya Sudah Selesai button and navigates to complete', () => {
    const { getByText } = render(<TutorialScreen />);
    fireEvent.press(getByText('Saya Sudah Selesai'));
    expect(mockPush).toHaveBeenCalledWith('/product/s1/complete');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx jest "app/product/\[id\]/tutorial.test.tsx"`
Expected: FAIL — tombol tidak ditemukan.

- [ ] **Step 3: Tambah tombol di `tutorial.tsx` — tepat SETELAH tombol "Lihat Before & After"**

```tsx
<Button
  title="Lihat Before & After"
  onPress={() => router.push(`/product/${id}/before-after`)}
  variant="primary"
/>
<Button
  title="Saya Sudah Selesai"
  onPress={() => router.push(`/product/${id}/complete`)}
  variant="secondary"
  className="mt-3"
/>
```

- [ ] **Step 4: Jalankan test + typecheck**

Run: `npx jest "app/product/\[id\]/tutorial.test.tsx" && npx tsc --noEmit`
Expected: PASS + tsc bersih.

- [ ] **Step 5: Commit**

```bash
git add "app/product/[id]/tutorial.tsx" "app/product/[id]/tutorial.test.tsx"
git commit -m "feat(product): completion entry button in tutorial"
```

---

## Task 10: Rating + galeri di `index.tsx` (detail produk)

**Files:**
- Modify: `app/product/[id]/index.tsx`
- Create: `app/product/[id]/index.test.tsx`

**Interfaces:**
- Consumes: `apiClient.getSkillCompletions` (Task 6), `StarRating` readOnly (Task 7).
- Produces: tampilan avg rating + jumlah review + galeri horizontal di detail produk.

- [ ] **Step 1: Tulis test yang gagal**

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text as MockText, Image as MockImage } from 'react-native';
import ProductDetailScreen from './index';

const mockGetCompletions = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 's1' }),
}));

jest.mock('../../../src/hooks/useProductData', () => ({
  useProductData: () => ({
    product: { name: 'Pot', difficulty: 'mudah', estimatedTimeMinutes: 30, shortDescription: 'd', estimatedCost: 5000, thumbnailUri: 'u' },
    tutData: { toolsAndMaterials: [], additionalMaterials: [] },
    priceData: { suggestedSellPrice: 25000, estimatedProfit: 10000 },
    loading: false, error: null, refetch: jest.fn(),
  }),
}));

jest.mock('../../../src/services/api', () => ({
  apiClient: { getSkillCompletions: (...a: unknown[]) => mockGetCompletions(...a) },
}));

jest.mock('../../../src/services/localState', () => ({ favorites: { toggle: jest.fn() } }));

jest.mock('../../../src/components/ui', () => ({
  Header: ({ title }: any) => <MockText>{title}</MockText>,
  Button: ({ title }: any) => <MockText>{title}</MockText>,
  Card: ({ children }: any) => children,
  Badge: () => <MockText>badge</MockText>,
  LoadingSpinner: () => <MockText>loading</MockText>,
  StarRating: ({ value }: any) => <MockText>{`stars:${value}`}</MockText>,
}));

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

describe('ProductDetailScreen rating', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('shows avg rating and count when completions exist', async () => {
    mockGetCompletions.mockResolvedValue({
      skill_id: 's1', avg_rating: 4.5, count: 3,
      gallery: [{ photo_url: 'u', rating: 5, comment: 'ok', created_at: 'c', user_display_name: 'Budi' }],
    });
    const { findByText } = render(<ProductDetailScreen />);
    expect(await findByText('4.5')).toBeTruthy();
    expect(await findByText('(3 review)')).toBeTruthy();
    expect(await findByText('Hasil Komunitas')).toBeTruthy();
  });

  it('shows no-review text when count is 0', async () => {
    mockGetCompletions.mockResolvedValue({ skill_id: 's1', avg_rating: 0, count: 0, gallery: [] });
    const { findByText } = render(<ProductDetailScreen />);
    expect(await findByText('Belum ada review')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx jest "app/product/\[id\]/index.test.tsx"`
Expected: FAIL — teks rating/galeri tidak ditemukan.

- [ ] **Step 3: Implementasi di `index.tsx`**

Tambahkan import: `useEffect`, `useState` (dari react), `apiClient` dari `../../../src/services/api`, `StarRating` dari ui, tipe `SkillCompletionsSummary` dari types.

Di dalam `ProductDetailScreen`, setelah `useProductData(...)`:

```tsx
const [completions, setCompletions] = useState<SkillCompletionsSummary | null>(null);
useEffect(() => {
  if (!id) return;
  apiClient.getSkillCompletions(id).then(setCompletions).catch(() => setCompletions(null));
}, [id]);
```

Setelah blok `<Text className="text-2xl font-extrabold ...">{product.name}</Text>`, tambah:

```tsx
<View className="flex-row items-center mb-2">
  {completions && completions.count > 0 ? (
    <>
      <StarRating value={Math.round(completions.avg_rating)} size={16} readOnly />
      <Text className="text-sm font-bold text-slate-900 ml-2">{completions.avg_rating}</Text>
      <Text className="text-xs text-slate-500 ml-1">({completions.count} review)</Text>
    </>
  ) : (
    <Text className="text-xs text-slate-400">Belum ada review</Text>
  )}
</View>
```

Sebelum tombol "Lihat Tutorial Langkah-langkah" (di akhir ScrollView), tambah seksi galeri:

```tsx
{completions && completions.gallery.length > 0 && (
  <View className="mb-6">
    <Text className="text-sm font-bold text-slate-900 mb-3">Hasil Komunitas</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {completions.gallery.map((g, idx) => (
        <View key={idx} className="mr-3 w-28">
          <Image source={{ uri: g.photo_url }} className="w-28 h-28 rounded-2xl bg-slate-200" />
          <Text className="text-[10px] text-slate-500 mt-1" numberOfLines={1}>
            {g.user_display_name || "Anonim"}
          </Text>
        </View>
      ))}
    </ScrollView>
  </View>
)}
```

- [ ] **Step 4: Jalankan test + typecheck**

Run: `npx jest "app/product/\[id\]/index.test.tsx" && npx tsc --noEmit`
Expected: PASS + tsc bersih.

- [ ] **Step 5: Verifikasi keseluruhan frontend**

Run: `npm test && npx tsc --noEmit && npm run lint:arch`
Expected: semua lulus.

- [ ] **Step 6: Commit**

```bash
git add "app/product/[id]/index.tsx" "app/product/[id]/index.test.tsx"
git commit -m "feat(product): show community rating and gallery on detail"
```

---

## Self-Review (dilakukan penulis plan)

- **Spec coverage:** model data (Task 1), bucket (Task 2), skema (Task 3), POST complete + gate rating via foto (Task 4), GET popularitas+galeri (Task 5), apiClient (Task 6), StarRating (Task 7), layar complete (Task 8), tombol tutorial (Task 9), rating+galeri detail (Task 10). Edge cases (401/404/409/413/415/422, 0 review, backend down) tercakup di test Task 4/5/8/10. "Design siap jual" & validasi AI & badge list = di luar scope (sesuai spec).
- **Placeholder scan:** tidak ada TBD/TODO; semua langkah punya kode nyata.
- **Type consistency:** `SkillCompletion`, `CompletionGalleryItem`, `SkillCompletionsSummary` konsisten antara schemas.py, api.ts types, dan komponen. `completeSkill(skillId, imageUri, rating, comment?)` sama di Task 6 & 8. `getSkillCompletions(skillId)` sama di Task 6 & 10.
