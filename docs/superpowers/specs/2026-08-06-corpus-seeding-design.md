# Corpus Seeding Pipeline — Design

**Date:** 2026-08-06
**Status:** Approved by user (sections 1–3)
**Related:** docs/superpowers/specs/2026-08-05-document-sources-design.md, docs/superpowers/plans/PROGRESS.md

## 1. Goal

Mengisi korpus RAG dari hampir kosong (1 skill approved, 0 dokumen) menjadi
**cakupan penuh**: 6 material × 3 tingkat kesulitan (18 seed skill) + 2–3 dokumen
sumber, semuanya melewati safety check dan review user, lalu diverifikasi bahwa
setiap material benar-benar retrievable. Ukuran sukses: user jarang mendapat
jawaban fallback generik — hampir semua pertanyaan terjawab grounded.

Keputusan yang sudah disepakati (brainstorming 2026-08-06):
1. Goal: cakupan penuh (18 seed + dokumen), bukan kualitas-dulu.
2. Review gate: safety check (SAFETY_RUBRIC yang sudah ada) + review cepat user + approve batch.
3. Dokumen: seed + 2–3 dokumen kunci whitelist (DLHK Banten PDF, artikel sachet).
4. Verifikasi: uji retrieval per 6 material (hybrid_search, tanpa LLM chat).
5. Pendekatan: pipeline content-ops di `backend/scripts/` (Approach 1).

## 2. Kurasi Sumber Berkelanjutan (langkah 0)

`sources.yaml` adalah **living document** — bukan satu kali isi:

- Setiap sumber baru (buku, situs pemerintah, blog waste) **diverifikasi dulu**:
  reachable (fetch 200) + konten sesuai (tidak melibatkan pembakaran plastik,
  langkah berbahaya tanpa mitigasi, dll).
- Sumber yang gagal verifikasi ditolak (contoh nyata: buku ITN reachable tapi
  isinya bahan bakar plastik → ditolak; UNDIP Jatengprov, IAIN, ULM → tidak
  reachable → ditolak).
- Saat whitelist bertambah → seed dijalankan ulang dengan `--force` untuk
  menghasilkan draft baru dari sumber tambahan.
- Komposisi saat ini: 12 sumber (7 Wikipedia + 5 non-Wikipedia: DLHK Banten,
  Waste4Change, Identif, BisnisUKM, DLH Buleleng). Target: terus menambah
  sumber non-Wikipedia yang terverifikasi.

## 3. `backend/scripts/seed_corpus.py` — Seed + safety check + laporan

```
1. Idempotensi: cek apakah sudah ada draft origin='seed' status='draft'
   → ada: SKIP dan cetak notifikasi (tidak interaktif); --force untuk menambah
2. draft_seed_skills(per_cell=1)  [reuse bootstrap.py]
   → 18 draft (6 material × 3 difficulty), status='draft', origin='seed'
3. Untuk TIAP draft:
   - Rekonstruksi SkillDraft dari baris tabel
   - Jalankan _safety_checker()  [reuse discovery.py, SAFETY_RUBRIC]
   - Catat verdict: safe / violations
4. Cetak + simpan laporan review (--out FILE, default stdout):
   # Seed Review — <tanggal>
   ## Lolos (17/18)
   - [id] Judul — material/difficulty — safe — sumber: [id-sumber...]
   ## Perlu perhatian (1/18)
   - [id] Judul — UNSAFE: "<violation>" — jangan approve
```

Keputusan desain:
- Safety verdict **tidak** disimpan ke DB (tidak ada kolom) — cukup di laporan;
  `approve_corpus.py` hanya menerima ID yang dipilih user.
- LLM call: 18 draft + 18 safety check = 36 panggilan, semua model gratis
  (`chat_model` default + fallback) — tanpa biaya.
- `generate_all_visuals` TIDAK di-trigger (image-gen berbayar) — visual terpisah.

## 4. `backend/scripts/approve_corpus.py` — Approve batch

```
Input: daftar skill ID (dari laporan) — atau --all-lolos untuk approve semua yang safe
Alur per ID:
  1. Verifikasi status='draft' (skip yang sudah approved/rejected)
  2. Set status='approved', reviewed_by='seed-pipeline'
  3. Panggil ingest_skill(sb, id) LANGSUNG (await, bukan background task)
     → kegagalan terlihat, bukan diam-diam
  4. Laporan: per ID → approved + jumlah chunks / gagal + alasan
Opsional: --reject ID... → status='rejected'
TIDAK memicu generate_all_visuals (image-gen berbayar)
```

## 5. `backend/scripts/ingest_documents.py` — 3 dokumen whitelist

```
Sumber (3 entri dipilih dari sources.yaml by id):
  1. dlhk-banten-limbah-anorganik (PDF) → download bytes → upload ke storage
     bucket 'documents' → insert row (source_type='pdf', materials 5) → approve → ingest_document
  2. identif-tas-dompet-sachet (URL)   → source_type='url' → insert → approve → ingest_document
  3. bisnisukm-tas-dompet-daur-ulang (URL) → source_type='url' → insert → approve → ingest_document
Idempoten: skip kalau URL yang sama sudah ada di tabel documents
Laporan: per dokumen → chunks ter-ingest / gagal
```

Keputusan desain:
- `ingest_skill`/`ingest_document` dipanggil **langsung** (awaited) di script —
  bukan background task — supaya error terlihat dan bisa di-retry per item.
- Dokumen PDF butuh upload ke storage dulu (path PDF `ingest_document` membaca
  dari bucket) — script menangani itu.
- Semua panggilan embed/rerank pakai DeepInfra (gratis).

## 6. `backend/scripts/check_coverage.py` — Verifikasi cakupan

```
Per material (6 query uji):
  plastik_pet → "cara membuat pot tanaman dari botol plastik"
  plastik_hdpe → "kerajinan dari galon atau kantong plastik bekas"
  kardus → "membuat rak atau kotak dari kardus bekas"
  kaleng → "kerajinan dari kaleng bekas"
  kaca → "kerajinan aman dari botol kaca"
  sachet → "membuat dompet dari bungkus sachet"

Alur per query:
  search_corpus(sb, query, material)  [reuse retrieval.py — embed + hybrid_search + rerank, tanpa LLM chat]
  → jumlah chunks, sumber teratas (skill/document), rerank score

Laporan:
  [PASS] plastik_pet: 3 chunks, top=skill (0.82), sumber=tempat pensil PET
  [FAIL] kaca: 0 chunks — korpus belum punya konten kaca!

Ringkasan korpus: total skills approved, chunks, dokumen, chunk dokumen.
Exit code: 0 kalau semua material PASS, 1 kalau ada yang FAIL.
```

- **PASS =** ≥1 chunk dengan `rerank_score ≥ 0.40` (threshold Gate 2 yang sama —
  konsisten dengan perilaku `/recommend`).
- Bebas LLM chat → cepat (6 × embed+rerank, DeepInfra gratis) dan deterministik.
- Kalau ada FAIL → tahu persis material mana yang kurang → kurasi + seed ulang
  ditargetkan.

## 7. Error Handling & Testing

| Skenario | Perilaku |
|---|---|
| LLM/provider down saat seed | Lanjut ke item berikutnya, laporkan gagal, exit code 1 — bisa di-retry |
| Draft sudah ada (re-run seed) | Idempoten: skip kecuali `--force` |
| Approve skill yang sudah approved | Skip dengan catatan |
| Dokumen URL duplikat | Skip (cek by URL) |
| Ingest gagal per item | Laporkan + exit 1, tidak menggagalkan batch |

**Testing:** script di `backend/scripts/` (di luar testpaths pytest) — yang
di-test hermetik adalah **helper murninya**: formatter laporan (seed review,
coverage report), builder query uji, dan logika PASS/FAIL — test file baru
`backend/tests/test_corpus_scripts.py` dengan FakeSupabase + monkeypatch (pola
yang sudah ada). Script utama tetap tipis (orchestrasi + I/O), helper di-test.

## 9. E2E Testing — Alur AI Lengkap

### 9.1 Backend E2E — `backend/eval/e2e_skill_flow.py` (baru)

Jalan melawan live server + Supabase asli (pola `smoke_e2e.py` yang sudah ada;
butuh key asli, bukan gate CI):

```
1. POST /scan (foto asli) → material teridentifikasi
2. POST /recommend → status grounded (RAG jalan)
3. POST /skills/proposals → 3 ide muncul
4. POST /skills/verify → verdict "layak"
5. POST /skills → status pending
6. PATCH /skills/{id}/status (service role) → approved → ingest
7. POST /recommend ulang → skill baru TER-RETRIEVE (bukti masuk korpus)
```

- Assertion tiap langkah; exit non-zero kalau ada yang gagal.
- Langkah 7 adalah bukti end-to-end: skill yang baru dibuat benar-benar
  menjawab user lewat RAG.
- Catatan: langkah 6 men-set status tanpa melewati expert gate (service role)
  — hanya untuk E2E; skill uji diberi judul ber-awalan `[E2E]` dan dihapus
  setelah selesai (cleanup: hapus row skills + chunks terkait).

### 9.2 Frontend E2E — Playwright (e2e/ dir sudah ada)

Perjalanan user di app (Expo web):

```
1. Expo web → scan (upload foto) → hasil material
2. Klik "Buat Skill Baru dari Material Ini" → skill-creator
3. 3 proposal muncul → pilih → edit → verify → submit
4. Status pending muncul di "Skill Saya"
```

- Butuh: Expo dev server + backend + Supabase asli — **manual/opsional, bukan gate CI**.
- Script Playwright di `e2e/` (direktori sudah ada, saat ini kosong).

## 10. Scope

- **Baru:** `backend/scripts/seed_corpus.py`, `approve_corpus.py`,
  `ingest_documents.py`, `check_coverage.py`, `backend/tests/test_corpus_scripts.py`,
  `backend/eval/e2e_skill_flow.py`, script Playwright di `e2e/`,
  kurasi berkelanjutan di `sources.yaml` (living document).
- **Reuse:** `draft_seed_skills`, `_safety_checker`, `ingest_skill`,
  `ingest_document`, `search_corpus`, storage bucket `documents`.
- **Tidak disentuh:** backend API, tabel, frontend.
- **Biaya:** 0 (semua model gratis: mimo-free + DeepInfra).
- **Di luar scope:** `generate_all_visuals` untuk seed (berbayar, terpisah),
  eval RAGAS formal (bisa menyusul), UI frontend.