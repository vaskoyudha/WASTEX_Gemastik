# Spec — Additional Materials: Deklarasi Terstruktur + Warning System

Tanggal: 2026-08-05 · Status: disetujui user (brainstorming)

## Ringkasan

Skill pembuatan kerajinan sering membutuhkan **bahan pelengkap** (tali, cat, lem, tanah, pengait) dan **alat** yang bukan merupakan bahan utama hasil scan (mis. scan hanya mendeteksi `kaleng`, tapi skill butuh tali untuk gantungan). Saat ini verifier menolak skill yang menyebut cat/tali karena dianggap melanggar whitelist material — hasil nyata: proposal "Pot Tanaman Gantung Mini dari Kaleng" mendapat verdict `perbaiki`.

Fitur ini: bahan pelengkap dideklarasikan **terstruktur** dalam field `additional_materials` sejak generator, **diterima verifier** selama terdaftar, dan **diwajibkan warning** ke user (badge + popup + detail skill) karena bahan tersebut tidak berasal dari scan.

## Data Model

### Schema baru (backend/app/schemas.py)

```python
class AdditionalMaterial(BaseModel):
    name: str
    category: Literal["tali", "cat", "lem", "tanah_tanaman", "pengait", "alat", "lainnya"]
    est_cost_idr: int = 0
    purpose: str = ""

class SkillProposal(...):
    ...
    additional_materials: list[AdditionalMaterial] = []
    additional_materials_cost_idr: int = 0  # dihitung server, bukan LLM
```

- `ToolItem` (alat) tetap `{name, optional}` — tidak berubah.
- `SkillCreateRequest` mewarisi otomatis.
- `additional_materials_cost_idr` dihitung server = `sum(m.est_cost_idr)`; LLM tidak menentukannya (non-deterministik).

### Migration (backend/supabase/migrations/20260805*.sql)

```sql
alter table skills add column if not exists additional_materials jsonb not null default '[]';
alter table skills add column if not exists additional_materials_cost_idr int not null default 0;
```

Idempotent (pola migrasi existing).

## Generator & Verifier (kunci agar lolos)

### SKILL_PROPOSAL_PROMPT (backend/app/agent/tools/skill_proposals.py)

- Wajib mengisi `additional_materials` untuk semua bahan pelengkap yang dipakai langkah (tali, cat, lem, tanah/tanaman, pengait, dll.), dengan `name`, `category`, `est_cost_idr`, `purpose`.
- Iron law disesuaikan: bahan utama tetap hanya dari whitelist `plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet`; **bahan pelengkap boleh disebut di langkah HANYA jika terdaftar di `additional_materials`**.
- Format output JSON ditambah field `additional_materials`.

### SKILL_VERIFY_PROMPT

Aturan baru (pengganti parsial: "bahan utama di luar material yang dinyatakan → WAJIB perbaiki"):

1. Bahan di `additional_materials` **BUKAN pelanggaran** whitelist.
2. Wajib `perbaiki` jika: langkah memakai bahan pelengkap yang **tidak terdaftar** di `additional_materials`; `est_cost_idr` sangat tidak masuk akal (> Rp100.000/item); risiko alat tanpa warning cukup.
3. `purpose` tiap bahan wajib ada (≥3 kata) — mencegah deklarasi kosong.
4. Feedback wajib menyebut bahan yang bermasalah secara spesifik.

### Hitung biaya (backend/app/api/pricing.py)

- `est_cost_idr` skill = biaya bahan utama (dari `MATERIAL_COSTS` existing) + `additional_materials_cost_idr`.
- `GET /pricing/{skill_id}` menampilkan breakdown: bahan utama + per-item bahan tambahan + total.

## Frontend

### src/services/types.ts

- `AdditionalMaterial` type baru.
- `SkillProposal` (frontend) + `ProductTutorial` / `BackendProductTutorial` + produk mapping: tambah `additional_materials` + `additional_materials_cost_idr`.
- Perbaiki mismatch yang ada: `toolsAndMaterials` bertipe `{name, optional}` object, bukan `string[]`.

### src/services/index.ts

- `tutorialFromBackend` (atau mapper sejenis): petakan `additional_materials` ke `ProductTutorial`.
- `SkillProposal` mapping dari backend meneruskan `additional_materials`.

### app/scan/skill-creator.tsx

- Daftar proposal: tiap kartu tampilkan badge "Bahan Tambahan" — nama + harga (mis. `tali (Rp2.000)`), max 3 + "+N lainnya".
- Popup verifikasi: jika `verdict === 'layak'` dan skill punya `additional_materials`, tampilkan **warning** (ikon ⚠️/alert): "Skill ini butuh bahan tambahan yang TIDAK termasuk hasil scan: tali, cat, ... Pastikan Anda menyediakannya."
- Kondisi submit tetap `verdict === 'layak'` (warning tidak memblokir).

### app/product/[id]/index.tsx + tutorial.tsx

- Section "Bahan Tambahan" terpisah dari "Alat & Bahan": nama, kategori, harga, kegunaan.
- Pricing breakdown menampilkan bahan tambahan per item.

## Error handling

- `additional_materials` jsonb selalu default `[]` → skill lama & row tanpa field tetap jalan.
- Parse defensif: item yang tidak valid (name kosong, category tak dikenal, est_cost bukan int) **di-skip**; skill tetap dibuat.
- `GET /tutorial`: hapus `select` kolom `materials` yang **tidak pernah ada** di DB (bug latent ketemu saat riset — error akan muncul setelah query dijalankan). Tools dibaca dari `tools`.

## Testing

- Backend unit:
  - migration: kolom ada + idempotent (pola `test_migrations_reference_image_path.py`).
  - generator: output proposal punya `additional_materials` valid (fake client).
  - verifier: menerima bahan tambahan terdaftar (verdict layak); menolak bahan tak terdaftar; menolak harga tidak masuk akal.
  - pricing: breakdown total = bahan utama + jumlah additional_materials.
  - skills create: `additional_materials` tersimpan.
- Frontend (jest):
  - skill-creator: badge tambahan tampil; warning tampil saat layak+ada bahan tambahan; tidak tampil saat tanpa bahan tambahan.
  - product detail: section bahan tambahan render.
- Regresi: full backend suite + frontend suite; ruff.

## Out of scope

- Integrasi toko/marketplace/keranjang belanja (WASTEX tetap bukan marketplace).
- AI chat tanya-jawab bahan.
- Editor tools di UI.
