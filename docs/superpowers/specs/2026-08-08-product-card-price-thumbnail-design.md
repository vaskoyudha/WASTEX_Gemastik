# Design: Harga Jual di Kartu Produk + Thumbnail Sementara per Material

Tanggal: 2026-08-08

## Masalah

1. **Pricing tidak terlihat**: kartu rekomendasi produk menampilkan `estimatedCost`
   (`= est_cost_idr` dari DB), yang bernilai 0 untuk sebagian besar skill (6 dari 21
   skill approved bernilai 0/null). Harga jual (`suggested_price` dari `GET /pricing`)
   hanya muncul di halaman detail, sehingga di daftar rekomendasi harga tampak hilang/0.
2. **Thumbnail kosong**: `skillToProduct` (src/services/index.ts:101-111) selalu
   mengisi `thumbnailUri: ""`. Untuk skill tanpa visual `before_after`/`mockup` di
   bucket `visuals`, kartu menampilkan placeholder Leaf generik (src/features/index.tsx:40-45),
   dan halaman detail produk tidak punya fallback sama sekali (blank area).

## Keputusan (disetujui user)

1. Kartu rekomendasi menampilkan **harga jual (suggested price)**.
2. Thumbnail sementara **per material** (6 gambar placeholder: PET, HDPE, kardus,
   kaleng, kaca, sachet).

## Pendekatan

### Backend: `compute_pricing` + enrich produk

- Refactor `calculate_pricing` di `backend/app/api/pricing.py` menjadi fungsi murni
  `compute_pricing(skill: dict) -> dict` yang mengembalikan seluruh payload pricing
  (material_cost, labor_cost, total_cost, suggested_price, profit_margin, dst).
  Endpoint `GET /pricing/{skill_id}` tinggal memanggil fungsi ini.
- `GET /products` dan `GET /products/{id}` (backend/app/api/products.py) menambahkan
  field `suggested_price` dan `total_cost` ke setiap baris skill dengan memanggil
  `compute_pricing(skill)` — harga dihitung server-side, tidak perlu N+1 request
  dari frontend.

### Frontend: tipe + mapping + komponen thumbnail

- `ProductRecommendation` (src/services/types.ts:63-71) ditambah:
  - `suggestedPrice: number`
  - `totalCost?: number`
  - `material: string`
  (Field lama `estimatedCost` TETAP ada di tipe untuk kompatibilitas, tapi tidak
  lagi ditampilkan di kartu.)
- `skillToProduct` (src/services/index.ts:101-111) memetakan `suggested_price` dari
  backend ke `suggestedPrice` (fallback `est_price_idr`, fallback 0), `total_cost` ke
  `totalCost`, dan `material` dari skill.
- Mock data `MOCK_RECOMMENDATIONS` (src/mocks/mockData.ts) ditambah `suggestedPrice`,
  `material` (dan `totalCost` bila ada) agar mode mock tetap kompatibel.
- `ProductCard` (src/features/index.tsx) menampilkan `formatRupiah(product.suggestedPrice)`
  (bukan `estimatedCost`).
- Komponen baru `MaterialThumbnail` (di src/features/index.tsx atau file baru)
  menampilkan placeholder per material saat `thumbnailUri` kosong:
  - `plastik_pet`: ikon botol, warna biru muda pastel
  - `plastik_hdpe`: ikon wadah, warna teal
  - `kardus`: ikon kotak, warna coklat muda
  - `kaleng`: ikon kaleng, warna abu-abu
  - `kaca`: ikon botol kaca, warna hijau muda
  - `sachet`: ikon kantong, warna oranye muda
- Fallback ini dipakai di:
  - `ProductCard` (src/features/index.tsx:40-53)
  - `app/ideas.tsx` (daftar semua ide — saat ini tanpa fallback)
  - `app/product/[id]/index.tsx:130` (halaman detail — saat ini blank tanpa fallback)

## Batas / Non-goals

- Tidak membuat file gambar placeholder baru; cukup ikon + warna dari komponen.
- Tidak mengubah logika `generate_all_visuals`; placeholder hanya fallback tampilan.
- Tidak mengubah `est_cost_idr` di DB.
- `estimatedTimeMinutes` tidak disentuh.

## Verifikasi

- Backend: `uv run pytest` — tambah/update test untuk `GET /products` yang mengembalikan
  `suggested_price` (test_products.py).
- Frontend: `npx tsc --noEmit` + `npx jest` — update test yang memakai
  `ProductRecommendation` bila diperlukan.
- Manual: halaman rekomendasi menampilkan harga jual, kartu skill kosong menampilkan
  placeholder per material, halaman detail tidak blank.

> Status: implemented (2026-08-08)
