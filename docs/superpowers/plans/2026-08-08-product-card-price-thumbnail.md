# Harga Jual di Kartu Produk + Thumbnail per Material — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kartu rekomendasi produk menampilkan harga jual (`suggested_price`) dan skill tanpa visual menampilkan thumbnail placeholder per material.

**Architecture:** (1) Refactor logika pricing backend menjadi fungsi murni `compute_pricing(skill)` yang dipanggil ulang oleh `GET /products` untuk menambahkan `suggested_price`/`total_cost` per skill — satu request, tanpa N+1 dari frontend. (2) Frontend menambah field `suggestedPrice`/`material` di tipe `ProductRecommendation`, memetakannya dari backend, menampilkan harga jual di kartu, dan komponen `MaterialThumbnail` per material sebagai fallback gambar.

**Tech Stack:** FastAPI + supabase-py (backend), React Native + Expo + TypeScript + lucide-react-native (frontend), pytest + jest.

## Global Constraints

- Backend: ruff (line-length 100), `uv run pytest` dari `backend/`; CI gate `uv run ruff check backend/` + `uv run ruff format --check backend/`.
- Frontend: `npx tsc --noEmit` dari root; `npm test`/`npx jest`; lint:arch melarang `app/` import dari `src/mocks`.
- `estimatedCost` lama TETAP ada di tipe `ProductRecommendation` (kompatibilitas), hanya tidak ditampilkan lagi.
- Semua label UI dalam Bahasa Indonesia, konsisten dengan halaman yang ada.
- Tidak mengubah DB schema; tidak mengubah `generate_all_visuals`.

---

### Task 1: Refactor pricing backend → fungsi murni `compute_pricing`

**Files:**
- Modify: `backend/app/api/pricing.py`
- Test: `backend/tests/test_pricing.py`

**Interfaces:**
- Consumes: tidak ada (logika pricing murni dari dict skill).
- Produces: `compute_pricing(skill: dict) -> dict` — payload lengkap pricing
  (`skill_id, title, material_cost, additional_materials, additional_materials_cost,
  labor_cost, total_cost, profit_margin, suggested_price, currency`). Digunakan oleh
  Task 2 dan endpoint `GET /pricing/{skill_id}` yang sudah ada.

- [ ] **Step 1: Write the failing test** — panggil fungsi murni langsung tanpa HTTP:

```python
def test_compute_pricing_pure_function():
    from app.api.pricing import compute_pricing

    skill = {
        "id": "88888888-aaaa-4aaa-8aaa-888888888888",
        "title": "Organizer PET",
        "material": "plastik_pet",
        "difficulty": "mahir",
        "steps": [{"order": i, "instruction": "x"} for i in range(1, 8)],
        "est_cost_idr": 0,
        "est_price_idr": 15000,
        "additional_materials": [],
        "additional_materials_cost_idr": 0,
    }
    out = compute_pricing(skill)
    assert out["skill_id"] == "88888888-aaaa-4aaa-8aaa-888888888888"
    assert out["labor_cost"] == 21000
    assert out["total_cost"] == 21500
    assert out["suggested_price"] == 22000
    assert out["profit_margin"] == 0
    assert out["currency"] == "IDR"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_pricing.py::test_compute_pricing_pure_function -v`
Expected: FAIL (ImportError / function not defined)

- [ ] **Step 3: Implement `compute_pricing`**

Pindahkan isi `calculate_pricing` (logika mulai `steps = skill.get("steps") or []` s/d
return dict) ke fungsi murni `compute_pricing(skill: dict) -> dict`. Endpoint
`calculate_pricing` menjadi: query skill → 404 jika kosong → `return compute_pricing(skill)`.
Simpan semua konstanta (LABOR_RATES, HOURS_PER_STEP, PRICE_CEILINGS, floor, ceiling)
persis seperti sekarang — TIDAK mengubah perilaku numerik.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_pricing.py -v`
Expected: semua 8 test PASS (termasuk yang lama, karena perilaku numerik tidak berubah).

- [ ] **Step 5: Ruff + commit**

```bash
cd backend && uv run ruff check app/api/pricing.py && uv run ruff format --check app/api/pricing.py
git add backend/app/api/pricing.py backend/tests/test_pricing.py
git commit -m "refactor(pricing): extract pure compute_pricing from endpoint"
```

---

### Task 2: Enrich `/products` dengan `suggested_price` + `total_cost`

**Files:**
- Modify: `backend/app/api/products.py`
- Test: `backend/tests/test_products.py`

**Interfaces:**
- Consumes: `compute_pricing(skill: dict) -> dict` dari Task 1.
- Produces: `GET /products` dan `GET /products/{id}` mengembalikan baris skill + field
  `suggested_price` dan `total_cost` (int). Dipakai Task 3 untuk mapping frontend.

- [ ] **Step 1: Write the failing test**

```python
def test_get_products_includes_suggested_price(fake_sb):
    fake_sb.table("skills").insert(
        {
            "id": "99999999-aaaa-4aaa-8aaa-999999999999",
            "title": "Vas PET",
            "material": "plastik_pet",
            "difficulty": "pemula",
            "steps": [{"order": 1, "instruction": "x"}],
            "est_cost_idr": 8000,
            "est_price_idr": 25000,
            "status": "approved",
        }
    )
    response = client.get("/products")
    assert response.status_code == 200
    rows = response.json()
    assert rows
    row = rows[0]
    assert row["suggested_price"] == 25000
    assert row["total_cost"] > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_products.py::test_get_products_includes_suggested_price -v`
Expected: FAIL (KeyError `suggested_price`)

- [ ] **Step 3: Implement**

Di `list_products`: setelah `resp.data`, kembalikan list hasil
`{**skill, **{k: v for k, v in compute_pricing(skill).items() if k in ("suggested_price", "total_cost")}}`.
Di `get_product`: sama untuk satu baris (404 tetap seperti sekarang).
Tambahkan `from app.api.pricing import compute_pricing` (tanpa circular import —
pricing.py tidak import products.py).

- [ ] **Step 4: Run tests**

Run: `cd backend && uv run pytest tests/test_products.py tests/test_pricing.py -v`
Expected: semua PASS. Jalankan juga `uv run pytest -q` → 324+ passed.

- [ ] **Step 5: Ruff + commit**

```bash
cd backend && uv run ruff check app/api/products.py && uv run ruff format --check app/api/products.py
git add backend/app/api/products.py backend/tests/test_products.py
git commit -m "feat(products): include suggested_price and total_cost in product payloads"
```

---

### Task 3: Tipe + mapping frontend (`ProductRecommendation`, `skillToProduct`, mock)

**Files:**
- Modify: `src/services/types.ts:63-71`
- Modify: `src/services/index.ts:101-111`
- Modify: `src/mocks/mockData.ts` (MOCK_RECOMMENDATIONS + MOCK_PRODUCTS jika ada)

**Interfaces:**
- Consumes: field baru `suggested_price`/`total_cost` dari backend (Task 2).
- Produces: `ProductRecommendation` dengan `suggestedPrice: number`,
  `totalCost?: number`, `material: string`; `skillToProduct` memetakan ketiganya.
  Dipakai Task 4 dan 5.

- [ ] **Step 1: Extend type**

Di `src/services/types.ts`, tambahkan pada `ProductRecommendation`:
```ts
suggestedPrice: number;
totalCost?: number;
material: string;
```
(`estimatedCost` tetap ada.)

- [ ] **Step 2: Update `skillToProduct`**

```ts
function skillToProduct(skill: Skill): ProductRecommendation {
  return {
    id: skill.id,
    name: skill.title,
    thumbnailUri: "",
    difficulty: DIFFICULTY_MAP[skill.difficulty] ?? "sedang",
    estimatedCost: skill.est_cost_idr ?? 0,
    suggestedPrice: skill.suggested_price ?? skill.est_price_idr ?? 0,
    totalCost: skill.total_cost,
    material: skill.material,
    estimatedTimeMinutes: (skill.steps?.length ?? 0) * 10 || 30,
    shortDescription: skill.description ?? "",
  };
}
```
Cek tipe `Skill` di `src/services/types.ts` — tambahkan `suggested_price?`/`total_cost?`
bila tidak ada (atau cast dari `skill as any` pada pemetaan bila backend type sudah memilikinya).

- [ ] **Step 3: Update mock data**

Di `src/mocks/mockData.ts`, tiap entri `MOCK_RECOMMENDATIONS[*][*]` tambahkan:
`suggestedPrice`, `material` (nilai per material), dan `totalCost` bila ada.
Contoh (prod_pet_1): `suggestedPrice: 35000, material: "plastik_pet", totalCost: 12000`.

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit` (root) → bersih.
Run: `npx jest src/services/index.test.ts src/mocks` → PASS (perbaiki assertion bila
ada yang bergantung pada field lama).

- [ ] **Step 5: Commit**

```bash
git add src/services/types.ts src/services/index.ts src/mocks/mockData.ts
git commit -m "feat(products): map suggestedPrice and material in recommendation mapping"
```

---

### Task 4: `MaterialThumbnail` + kartu menampilkan harga jual

**Files:**
- Create: `src/features/MaterialThumbnail.tsx`
- Modify: `src/features/index.tsx` (ProductCard: gunakan MaterialThumbnail + suggestedPrice)

**Interfaces:**
- Consumes: `ProductRecommendation.material` / `thumbnailUri` / `suggestedPrice`.
- Produces: `MaterialThumbnail({ product, size? })` — komponen yang merender gambar
  bila `thumbnailUri` ada, placeholder berwarna+ikon per material bila kosong/gagal.
  Dipakai Task 5 di ideas.tsx dan detail produk.

- [ ] **Step 1: Create `MaterialThumbnail.tsx`**

```tsx
import React from "react";
import { Image, View } from "react-native";
import { Bottle, Box, Coffee, Package, Recycle, Wine } from "lucide-react-native";
import { colors } from "../theme";

const MATERIAL_META: Record<string, { icon: React.ElementType; bg: string; fg: string }> = {
  plastik_pet: { icon: Bottle, bg: "#E0F2FE", fg: "#0284C7" },
  plastik_hdpe: { icon: Recycle, bg: "#CCFBF1", fg: "#0D9488" },
  kardus: { icon: Box, bg: "#FEF3C7", fg: "#B45309" },
  kaleng: { icon: Coffee, bg: "#F1F5F9", fg: "#64748B" },
  kaca: { icon: Wine, bg: "#DCFCE7", fg: "#16A34A" },
  sachet: { icon: Package, bg: "#FFEDD5", fg: "#EA580C" },
};

export interface MaterialThumbnailProps {
  readonly product: { thumbnailUri: string; material: string; name: string };
  readonly style?: object;
  readonly iconSize?: number;
}

export function MaterialThumbnail({ product, style, iconSize = 28 }: MaterialThumbnailProps): React.JSX.Element {
  const meta = MATERIAL_META[product.material] ?? MATERIAL_META.plastik_pet;
  const [failed, setFailed] = React.useState(false);
  if (product.thumbnailUri && !failed) {
    return (
      <Image source={{ uri: product.thumbnailUri }} accessibilityLabel={product.name}
        style={style} resizeMode="cover" onError={() => setFailed(true)} />
    );
  }
  const Icon = meta.icon;
  return (
    <View style={[{ backgroundColor: meta.bg, alignItems: "center", justifyContent: "center" }, style]}>
      <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.85)" }}>
        <Icon size={iconSize} color={meta.fg} />
      </View>
    </View>
  );
}
```
Cek nama ikon tersedia di lucide-react-native yang terpasang (fallback: `Recycle`/
`Package` bila `Bottle`/`Coffee` tidak ada — sesuaikan import).

- [ ] **Step 2: Update ProductCard**

- Ganti blok `{imageFailed ? (...) : (<Image .../>)}` (baris 40-54) dengan
  `<MaterialThumbnail product={product} style={{ height: 128, width: 116, borderRadius: 18 }} />`.
- Ganti baris 80-82 (`formatRupiah(product.estimatedCost)`) dengan
  `formatRupiah(product.suggestedPrice)`.
- Hapus `imageFailed` state yang tidak terpakai; hapus import `Leaf` bila tidak
  dipakai komponen lain.

- [ ] **Step 3: Tests + typecheck**

Run: `npx tsc --noEmit`; `npx jest src/features` → PASS.
Cek `lint:arch`: tidak ada import mocks dari app/.

- [ ] **Step 4: Commit**

```bash
git add src/features/MaterialThumbnail.tsx src/features/index.tsx
git commit -m "feat(card): material placeholder thumbnail and sell price on product card"
```

---

### Task 5: Fallback thumbnail di daftar ide + halaman detail

**Files:**
- Modify: `app/ideas.tsx:37-40` (Image → MaterialThumbnail)
- Modify: `app/product/[id]/index.tsx:130` (Image → MaterialThumbnail)

**Interfaces:**
- Consumes: `MaterialThumbnail` dari Task 4.
- Produces: tidak ada (tampilan saja).

- [ ] **Step 1: Update `app/ideas.tsx`**

Ganti `<Image source={{ uri: item.thumbnailUri }} className="w-24 h-24 rounded-xl bg-slate-200" resizeMode="cover" />`
dengan:
```tsx
<MaterialThumbnail product={item} style={{ width: 96, height: 96, borderRadius: 12 }} />
```
Import `MaterialThumbnail` dari `../../src/features/MaterialThumbnail`; hapus import
`Image` bila tidak dipakai lagi.

- [ ] **Step 2: Update `app/product/[id]/index.tsx`**

Ganti `<Image source={{ uri: product.thumbnailUri }} className="w-full h-[296px]" resizeMode="cover" />`
dengan:
```tsx
<MaterialThumbnail product={product} style={{ width: "100%", height: 296 }} />
```
Import `MaterialThumbnail`; hapus import `Image` bila tidak dipakai lagi.

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit`; `npx jest app/ideas app/product` → PASS.

- [ ] **Step 4: Commit**

```bash
git add app/ideas.tsx app/product/\[id\]/index.tsx
git commit -m "feat(ui): material placeholder thumbnail on ideas list and product detail"
```

---

### Task 6: Verifikasi akhir

- [ ] **Step 1: Backend penuh**

Run: `cd backend && uv run pytest -q` → semua passed; `uv run ruff check app/ scripts/ tests/` + `uv run ruff format --check app/ scripts/ tests/` → bersih.

- [ ] **Step 2: Frontend penuh**

Run: `npx tsc --noEmit` (root) → bersih; `npx jest` → semua suite passed.

- [ ] **Step 3: Smoke test manual**

- Jalankan backend (`uv run uvicorn app.main:app --port 8000`) + Expo web (`npm run web`).
- `GET /products` memuat `suggested_price`/`total_cost`.
- Kartu rekomendasi menampilkan harga jual (mis. Rp 22.000 untuk organizer modular).
- Skill tanpa visual menampilkan placeholder warna sesuai material (PET biru muda, dst).
- Halaman detail produk tidak blank.

- [ ] **Step 4: Update spec status**

Tambahkan catatan "implemented" di `docs/superpowers/specs/2026-08-08-product-card-price-thumbnail-design.md`.
