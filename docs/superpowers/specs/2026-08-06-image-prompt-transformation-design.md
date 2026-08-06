# Design: Transformation-Aware Image Prompts (Identity sebagai Kondisi Awal)

Tanggal: 2026-08-06 · Status: Disetujui user (brainstorming) · Scope: `backend/app/agent/tools/image_gen.py` + tests + kit README

## Masalah

Aturan konsistensi lintas panel terlalu absolut sehingga AI mempertahankan tampilan
awal objek (mis. kaleng merah + logo Coca-Cola) walau instruksi step jelas meminta
mengubahnya (mengecat, mewarnai, melepas label, memotong):

1. `build_identity_block`: "WAJIB TETAP IDENTIK DI SEMUA PANEL ... Jaga identitas
   objek ini identik di setiap panel; hanya aksi yang berubah." — warna & logo masuk
   "identitas".
2. `_REFERENCE_POLICY`: "salin PERSIS bentuk, warna, bahan ... HANYA aksi yang
   berubah." — warna di-pin tanpa pengecualian.
3. Identity card mencampur invariant (bahan, gaya) dengan mutable (bentuk, warna
   permukaan, label/logo).

## Keputusan desain (hasil brainstorming user)

1. **Progresif kumulatif**: panel N menampilkan objek SETELAH aksi step N; panel
   berikutnya melanjutkan kondisi itu; tampilan tidak pernah kembali ke awal.
2. **Deteksi transformasi deterministik** (kata kerja), bukan metadata LLM per step
   → tanpa perubahan schema/DB, berlaku untuk skill lama.
3. **Bentuk juga boleh berubah** mengikuti aksi (dipotong/ditekuk/disambung);
   invariant hanyalah bahan + gaya ilustrasi.

## Desain

### 1. Identity block → "KONDISI AWAL", bukan hukum abadi

```
[IDENTITAS OBJEK — KONDISI AWAL DARI FOTO SCAN]
- Bentuk awal: <shape>
- Warna awal: <colors>
- Bahan: <material>          ← satu-satunya yang WAJIB tetap
- Ciri awal: <features>
Aturan: bahan & gaya ilustrasi selalu konsisten di semua panel. Bentuk boleh
berubah mengikuti aksi (dipotong/ditekuk/disambung). Warna/label boleh berubah
bila aksi step mengubahnya (dicat/dilepas), dan perubahan itu BERLANJUT ke
panel berikutnya — jangan kembalikan ke kondisi awal.
```

### 2. Reference policy → step sebagai prioritas utama

```
[REFERENSI — PRIORITAS: IKUTI STEP, BUKAN PANEL SEBELUMNYA]
1. Instruksi step adalah SUMBER UTAMA: gambar persis aksi dan perubahan yang
   dijelaskan step (bentuk dipotong/ditekuk/disambung, warna dicat, label dilepas,
   hiasan ditempel). Jika bertentangan dengan panel sebelumnya, IKUTI STEP —
   jangan pertahankan tampilan lama.
2. Panel sebelumnya hanya PANDUAN untuk hal yang TIDAK diubah step: salin PERSIS
   bahan, gaya ilustrasi, proporsi, dan sudut pandang; HANYA aksi yang berubah.
3. Foto scan: hanya sumber bentuk/warna/bahan asli objek. Selalu render dalam gaya
   ilustrasi flat, JANGAN pernah fotorealistik, JANGAN mencampur tekstur foto ke dalam panel.
```

Revisi dari draf awal: klausa "PERKECUALIAN TRANSFORMASI" diganti struktur
prioritas bernomor (step > panel sebelumnya > foto scan) agar AI tidak selalu
mengutamakan referensi panel sebelumnya.

### 3. Deteksi kata kerja transformatif

`_TRANSFORM_VERBS`: mengecat, mewarnai, menghias, melepas label, menempel,
menutup, melapisi, memotong, menggunting, menekuk, menyambung, menggambar,
menulis, menghapus, melukis, memberi pola.
`_step_is_transformative(step)` → dicek pada `instruction` + `visual_description`.

### 4. Seksi [KONDISI TAMPAK SAAT INI] (inti progresif kumulatif)

Builder menelusuri step 1..N-1 (dari `skill["steps"]`, tanpa perubahan signature),
mengumpulkan transformasi yang sudah terjadi, lalu:

```
[KONDISI TAMPAK SAAT INI — HASIL STEP SEBELUMNYA]
- Label & logo sudah dilepas
- Permukaan kaleng sudah dicat hijau
Pertahankan kondisi ini; gambarkan objek dalam keadaan ini.
```

Jika step sekarang transformatif, tambah klausa:
`[PENTING — AKSI INI MENGUBAH TAMPILAN] Tampilkan hasil perubahannya; jangan
pertahankan tampilan lama.`

### 5. Tidak berubah

`build_before_after_prompt`, `build_mockup_prompt`, `build_materials_panel_prompt`,
alur `generate_all_visuals` (signature tetap).

## File terdampak

- `backend/app/agent/tools/image_gen.py` — implementasi 1-4.
- `backend/tests/test_image_prompts.py` — kontrak baru + fix `_relevant_items`
  (hay harus mencakup `warning`; bug test yang sedang gagal).
- `backend/tests/test_image_gen_endpoint.py` — sesuaikan assert identity block.
- `visuals/manual-generation/README-coke-can-v2.md` — regenerate kit (demonstrasi
  step "cat" menunjukkan warna berubah).

## Verifikasi

- `uv run pytest` (baseline 230 passed / 8 skipped) + `ruff check` + `ruff format --check`.
- Test baru: klausa transform muncul untuk step "cat", kondisi kumulatif dari
  step sebelumnya, tidak ada klausa untuk step non-transformatif, identity block
  berisi frasa "KONDISI AWAL".
