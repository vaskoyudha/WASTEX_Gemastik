# Document Sources for RAG — Design

**Date:** 2026-08-05
**Status:** Approved by user (sections 1–3)
**Related:** docs/superpowers/specs/2026-08-03-user-skill-creation-flow-design.md, docs/superpowers/plans/PROGRESS.md

## 1. Goal

Buku dan artikel pengolahan sampah anorganik (PDF + URL) dapat masuk **langsung ke
korpus RAG** dan di-retrieve bersama skill yang sudah ada. User yang bertanya
"cara membuat X dari botol PET" mendapat jawaban yang mengutip skill **atau**
dokumen (judul + halaman/bagian). Hanya expert/admin yang bisa menambah dokumen,
dan dokumen melewati gate `pending → approved` sebelum di-embed dan bisa di-retrieve —
meniru lifecycle skill yang sudah ada.

Keputusan yang sudah disepakati (brainstorming 2026-08-05):
1. Dokumen langsung masuk korpus RAG (bukan sekadar bahan draft skill).
2. Format sumber: PDF dan URL artikel.
3. Gate: pending → review expert → approved → ingest (seperti skill).
4. Retrieval: satu korpus gabungan — jawaban bisa mengutip skill_id atau document_id.
5. Submitter: expert/admin saja (tidak ada submit dari user biasa).

## 2. Data Model — Migration `20260806000002_document_sources.sql`

```sql
create table documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null check (source_type in ('pdf', 'url')),
  url text,                          -- sumber asli (link PDF/artikel)
  file_path text,                    -- path di storage bucket `documents` untuk PDF
  materials text[] not null default '{}',   -- mapping ke taksonomi 6 material
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_by uuid not null,          -- expert yang upload
  reviewed_by text,
  indexed_at timestamptz,            -- null = belum ter-index (anti silent failure)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  embedding vector(1024) not null,
  fts tsvector generated always as (to_tsvector('indonesian', content)) stored,
  metadata jsonb not null default '{}'   -- {materials, section, page}
);
```

- `fts` sebagai generated column — meniru `skill_chunks` (init migration), sehingga
  `hybrid_search` memperlakukan kedua sumber secara identik.
- **Material mapping:** dokumen boleh dipetakan ke **satu atau lebih** dari 6 material
  (buku pengolahan sampah umumnya lintas material). Nilai divalidasi di backend saat
  upload (`POST /documents` menolak 400 jika ada nilai di luar taksonomi
  `plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet`). Semua chunk dokumen
  mewarisi **seluruh array** `materials` — lihat §4.1 untuk aturan filter.
- Index: HNSW (`embedding vector_cosine_ops`), GIN (`fts`), `documents (status)`,
  `document_chunks (document_id)`.
- Trigger `set_updated_at` untuk `documents` (sama seperti `skills`).
- RLS: policy select `status = 'approved'` untuk anon/authenticated; **akses expert
  (daftar semua status, approve, delete) via service-role client** — backend sudah
  memakai service key (`get_supabase`) yang bypass RLS, mengikuti pola endpoint
  skill yang ada. `document_chunks` readable semua (chunks hanya ada untuk dokumen
  approved).
- Storage: bucket baru `documents` (mengikuti pola bucket `scans`).
- Catatan: root `supabase/migrations/` adalah duplikat untracked — edit hanya di
  `backend/supabase/migrations/` (kanonik).

## 3. Ingestion Pipeline — `backend/app/rag/document_ingest.py` (baru)

```
extract_pdf(path)   → teks per halaman        (pypdf, dependency baru)
extract_url(url)    → teks utama + heading    (httpx + BeautifulSoup, dependency baru)

ingest_document(sb, document_id):
  - gate: hanya status='approved' (ValueError jika bukan, sama seperti ingest_skill)
  - delete-then-insert chunk per document_id (re-ingest aman, tanpa duplikat)
  - PDF: chunk per halaman → metadata {page, materials}
  - URL: deteksi heading (h1/h2) → metadata {section, materials}
  - embed dengan embed_texts (bge-m3) yang sudah ada
  - sukses → documents.indexed_at = now()
  - gagal → log error; indexed_at tetap null (retry via reingest)
```

- Reuse: `chunk_text` (750 kata, overlap 15%), `embed_texts`, pola `ingest_skill`.
- Batas keamanan: PDF ≤ 500 halaman / 50MB; URL fetch timeout 30s, batas ukuran 5MB.
- Dependency baru di `pyproject.toml`: `pypdf`, `beautifulsoup4`.

## 4. Retrieval Integration

### 4.1 `hybrid_search` ditulis ulang (di migration yang sama)

```
create or replace function hybrid_search(
  query_embedding vector(1024), query_text text,
  material_filter text default null, match_count int default 20, rrf_k int default 60
) returns table (chunk_id uuid, source_type text, source_id uuid,
                 content text, metadata jsonb, score double precision)

- vec/lex CTE dari skill_chunks (seperti sekarang; source_type='skill')
- vec/lex CTE dari document_chunks (source_type='document')
- Filter material per sumber:
  - skill: `metadata->>'material' = material_filter` (skalar, seperti sekarang)
  - dokumen: `metadata->'materials' ? material_filter` (jsonb array contains)
- UNION semua → RRF 1/(rrf_k + rank) dari rank gabungan → limit match_count
- skill_id lama → source_id + source_type='skill' (backward-compatible)
```

### 4.2 Sisi backend

- `retrieval.py`: `search_skills` → `search_corpus`; `RetrievedChunk` mendapat field
  `source_type` dan `source_id`. Caller satu-satunya: `recommend.py` — diupdate.
- `orchestrator.py` `generate_solution`: konteks dilabeli `[skill_id: X]` atau
  `[document_id: Y (judul, halaman N)]`; `GROUNDING_PROMPT` ditambah aturan kutip
  document_id untuk klaim dari dokumen. Field `sources` di `SolutionPackage` tetap
  `list[str]`; entry dokumen berformat `document:<id>` (kontrak backward-compatible,
  frontend tidak berubah di v1).
- Gate 2 di `recommend.py` tidak berubah: top chunk < 0.40 → `generic_safe_procedure`
  + discovery background.

## 5. API — `backend/app/api/documents.py` (router baru, prefix `/documents`)

| Endpoint | Auth | Fungsi |
|---|---|---|
| `POST /documents` (JSON) | expert/service | `{title, source_type:"url", url, materials[]}` → fetch URL untuk validasi (fail fast 400) → insert `pending` |
| `POST /documents` (multipart) | expert/service | Upload PDF → validasi extract saat upload (fail fast 400) → simpan ke storage bucket `documents` → `file_path` → insert `pending` |
| `GET /documents?status=` | expert (via service role, semua status) / anon (approved via RLS) | Daftar dokumen |
| `PATCH /documents/{id}/status` | expert | approve → background task `ingest_document`; reject → update status saja |
| `POST /documents/{id}/reingest` | expert | retry manual bila `indexed_at` null (jalur repair) |
| `DELETE /documents/{id}` | expert | hapus dokumen + chunks (cascade) + file storage |

- Reuse `require_expert_or_service` (deps.py) — tidak ada auth baru.
- `main.py`: mount router `/documents` (mengikuti pola router yang ada).
- Background task approval → `ingest_document` (pola sama dengan skills.py).

## 6. Error Handling & Keamanan

| Skenario | Perilaku |
|---|---|
| URL gagal di-fetch saat upload (404/timeout/5MB+) | `POST` 400, dokumen tidak masuk pending |
| PDF korup / tidak bisa di-extract | Upload 400 (validasi extract saat upload) |
| Extract gagal saat approval (ingest) | `indexed_at` null + log; terlihat di `GET /documents`; retry via reingest — tidak ada approved-but-silently-broken |
| Provider embed down | Fallback hash-embedding yang sudah ada (degraded mode) |
| Dokumen dihapus | Chunks hilang via cascade + file storage dihapus |
| Re-approval / reingest | delete-then-insert → tanpa duplikat chunk |

- Upload & approval hanya expert/service (`require_expert_or_service`).
- URL fetch: timeout 30s, batas ukuran 5MB, redirect dibatasi.
- PDF: batas 500 halaman / 50MB.

## 7. Testing

- **Unit (hermetik, gaya conftest yang ada):**
  - `extract_pdf`: fixture PDF kecil (1–2 halaman) → teks + nomor halaman benar
  - `extract_url`: `httpx.MockTransport` → teks utama + heading jadi section
  - `ingest_document`: pola FakeSupabase → chunk dibuat, `indexed_at` ter-set;
    dokumen non-approved → `ValueError`
  - API `documents.py`: gate expert (token non-expert → 403), alur
    pending→approve→reject, URL invalid → 400, reingest
- **Retrieval:** `hybrid_search` adalah SQL (tidak di-unit-test langsung, mengikuti
  pola existing); `search_corpus` di-test dengan stub RPC + rerank mock.
- **Eval (opsional/stretch):** tambah 3–5 query dokumen ke `golden.jsonl` supaya
  RAGAS mengukur dokumen juga.

## 8. Scope

- **Baru:** tabel `documents` + `document_chunks` (migration), `rag/document_ingest.py`,
  `api/documents.py`, rewrite `hybrid_search`, `retrieval.py` (`search_corpus`),
  tweak `GROUNDING_PROMPT`, storage bucket `documents`.
- **Berubah:** `recommend.py` (caller), `main.py` (mount router), `pyproject.toml`
  (+`pypdf`, +`beautifulsoup4`).
- **Tidak disentuh:** tabel `skills`/`skill_chunks`, lifecycle skill, visuals,
  frontend (kontrak `sources` backward-compatible).
- **Di luar scope:** retrofit `index_status` untuk `skills` (perbaikan terpisah),
  submit dokumen oleh user biasa, UI frontend untuk daftar/kutipan dokumen.
