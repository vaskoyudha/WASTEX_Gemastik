# Document Sources for RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest curated PDF/URL documents (buku/artikel pengolahan sampah) directly into the RAG corpus so `/recommend` answers can cite document chunks alongside skill chunks.

**Architecture:** New `documents` + `document_chunks` tables (mirroring `skills`/`skill_chunks`, incl. generated `fts` column); a `rag/document_ingest.py` module that extracts text (pypdf for PDF, httpx+BeautifulSoup for URL), reuses `chunk_text`/`embed_texts`, and embeds only `approved` documents; `hybrid_search` rewritten to UNION both chunk sources with RRF, returning `source_type`/`source_id`; `search_skills` renamed `search_corpus`; `generate_solution` labels chunks `[skill_id: X]` / `[document_id: Y]`; new expert-only `/documents` API router with `indexed_at` + `/reingest` repair path.

**Tech Stack:** FastAPI + pydantic, supabase-py (service-role client), pypdf, beautifulsoup4, httpx, pytest (TestClient + FakeSupabase + psycopg integration), ruff. Spec: `docs/superpowers/specs/2026-08-05-document-sources-design.md`.

## Global Constraints

- Ruff: line-length 100, `B008`/`BLE001` intentionally ignored. CI gates: `uv run ruff check backend/` then `uv run ruff format --check backend/` (run from `backend/`).
- Backend suite: `uv run pytest tests/` from `backend/`. Tests self-configure dummy keys via `backend/tests/conftest.py`; unit tests never hit real providers — HTTP calls use `httpx.MockTransport` or `client_factory` injection, Supabase uses `tests/fakes.py::FakeSupabase`.
- TestClient executes Starlette `BackgroundTasks` synchronously before the response returns — approve-triggered ingest can be asserted directly in the test.
- LLM prompts follow the behavioral contract in `backend/tests/test_prompt_contract.py`: each prompt must contain "Iron Law", a MUST/NEVER/WAJIB rule, "Red Flags", and "Self-Check"; all prompts are registered in that file's `ALL_PROMPTS` dict. `GROUNDING_PROMPT` is already registered — when its text changes, keep the four required sections intact so the contract test stays green.
- Indonesian LLM prompt copy; output JSON field names in English (machine-consumed).
- Migration is canonical ONLY in `backend/supabase/migrations/`. Do NOT edit, stage, or commit the untracked root `supabase/migrations/` duplicate or the `.gitignore` modification.
- Commits to `main`, messages in repo style (`feat:`, `test:`, `docs:`).
- **Design refinement vs spec:** the spec lists PDF upload under `POST /documents` (multipart); a FastAPI route cannot serve both JSON and multipart, so PDF upload lives at `POST /documents/pdf`. Everything else matches the spec verbatim.

---

### Task 1: Migration — documents tables, RLS, bucket, hybrid_search rewrite

**Files:**
- Create: `backend/supabase/migrations/20260806000002_document_sources.sql`
- Create: `backend/tests/test_migrations_document_sources.py`

**Interfaces:**
- Consumes: `set_updated_at()` function + `vector` extension from `20260728000001_init.sql`.
- Produces: tables `documents` (columns: id, title, source_type, url, file_path, materials, status, created_by, reviewed_by, indexed_at, created_at, updated_at) and `document_chunks` (id, document_id, content, embedding vector(1024), fts generated, metadata); RLS policies; storage bucket `documents`; `hybrid_search(query_embedding vector(1024), query_text text, material_filter text default null, match_count int default 20, rrf_k int default 60)` returning `(chunk_id uuid, source_type text, source_id uuid, content text, metadata jsonb, score double precision)` — signature of the old function kept, so existing callers/tests that select a column subset still work.

- [ ] **Step 1: Write the failing migration test** (create `backend/tests/test_migrations_document_sources.py`):

```python
from pathlib import Path

SQL = Path(__file__).parents[1] / "supabase" / "migrations" / "20260806000002_document_sources.sql"


def test_migration_creates_documents_tables():
    text = SQL.read_text()
    assert "create table documents" in text
    assert "create table document_chunks" in text


def test_migration_gates_indexes_and_metadata():
    text = SQL.read_text()
    assert "'pending'" in text and "'approved'" in text and "'rejected'" in text
    assert "('pdf', 'url')" in text
    assert "indexed_at" in text
    assert "on delete cascade" in text
    assert "document_chunks_embedding_idx" in text
    assert "document_chunks_fts_idx" in text
    assert "documents_updated_at" in text
    assert "to_tsvector('indonesian', content)" in text


def test_migration_rls_and_bucket():
    text = SQL.read_text()
    assert "row level security" in text
    assert "status = 'approved'" in text
    assert "storage.buckets" in text and "'documents'" in text


def test_migration_rewrites_hybrid_search_with_source_type():
    text = SQL.read_text()
    assert "create or replace function hybrid_search" in text
    assert "source_type" in text
    assert "'skill' as source_type" in text
    assert "'document' as source_type" in text
    assert "metadata->'materials' ? material_filter" in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_migrations_document_sources.py -v` from `backend/`
Expected: FAIL — `FileNotFoundError` for the missing migration file.

- [ ] **Step 3: Write the migration** (create `backend/supabase/migrations/20260806000002_document_sources.sql`):

```sql
-- Documents: curated PDF/URL sources ingested into the RAG corpus (spec 2026-08-05).
create table documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null check (source_type in ('pdf', 'url')),
  url text,
  file_path text,
  materials text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid,
  reviewed_by text,
  indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  embedding vector(1024) not null,
  fts tsvector generated always as (to_tsvector('indonesian', content)) stored,
  metadata jsonb not null default '{}'
);

create index document_chunks_embedding_idx on document_chunks using hnsw (embedding vector_cosine_ops);
create index document_chunks_fts_idx on document_chunks using gin (fts);
create index documents_status_idx on documents (status);
create index document_chunks_document_id_idx on document_chunks (document_id);

create trigger documents_updated_at
  before update on documents
  for each row execute function set_updated_at();

alter table documents enable row level security;
alter table document_chunks enable row level security;

create policy "documents approved readable" on documents for select using (status = 'approved');
create policy "document_chunks readable by all" on document_chunks for select using (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Unified hybrid retrieval over skill + document chunks (spec §4.1).
create or replace function hybrid_search(
  query_embedding vector(1024),
  query_text text,
  material_filter text default null,
  match_count int default 20,
  rrf_k int default 60
) returns table (chunk_id uuid, source_type text, source_id uuid, content text, metadata jsonb, score double precision)
language sql stable as $$
  with vec_skill as (
    select id, row_number() over (order by embedding <=> query_embedding) as rank
    from skill_chunks
    where material_filter is null or metadata->>'material' = material_filter
    order by embedding <=> query_embedding
    limit greatest(match_count * 2, 40)
  ),
  lex_skill as (
    select id, row_number() over (
      order by ts_rank_cd(fts, websearch_to_tsquery('indonesian', query_text)) desc
    ) as rank
    from skill_chunks
    where fts @@ websearch_to_tsquery('indonesian', query_text)
      and (material_filter is null or metadata->>'material' = material_filter)
    limit greatest(match_count * 2, 40)
  ),
  vec_doc as (
    select id, row_number() over (order by embedding <=> query_embedding) as rank
    from document_chunks
    where material_filter is null or metadata->'materials' ? material_filter
    order by embedding <=> query_embedding
    limit greatest(match_count * 2, 40)
  ),
  lex_doc as (
    select id, row_number() over (
      order by ts_rank_cd(fts, websearch_to_tsquery('indonesian', query_text)) desc
    ) as rank
    from document_chunks
    where fts @@ websearch_to_tsquery('indonesian', query_text)
      and (material_filter is null or metadata->'materials' ? material_filter)
    limit greatest(match_count * 2, 40)
  )
  select c.id,
         'skill' as source_type, c.skill_id as source_id, c.content, c.metadata,
         coalesce(1.0 / (rrf_k + vec_skill.rank), 0) + coalesce(1.0 / (rrf_k + lex_skill.rank), 0) as score
  from skill_chunks c
  left join vec_skill on vec_skill.id = c.id
  left join lex_skill on lex_skill.id = c.id
  where vec_skill.id is not null or lex_skill.id is not null
  union all
  select c.id,
         'document' as source_type, c.document_id as source_id, c.content, c.metadata,
         coalesce(1.0 / (rrf_k + vec_doc.rank), 0) + coalesce(1.0 / (rrf_k + lex_doc.rank), 0) as score
  from document_chunks c
  left join vec_doc on vec_doc.id = c.id
  left join lex_doc on lex_doc.id = c.id
  where vec_doc.id is not null or lex_doc.id is not null
  order by score desc
  limit match_count;
$$;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_migrations_document_sources.py -v` from `backend/`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/20260806000002_document_sources.sql backend/tests/test_migrations_document_sources.py
git commit -m "feat(documents): migration for document sources + unified hybrid_search"
```

---

### Task 2: Pydantic schemas for documents

**Files:**
- Modify: `backend/app/schemas.py` (append after `SkillCreateRequest`, ~line 180)
- Create: `backend/tests/test_document_schemas.py`

**Interfaces:**
- Consumes: `Material` enum (already in `app.schemas`).
- Produces: `DocumentSourceType(str, Enum)` with `pdf`/`url`; `DocumentCreateRequest(BaseModel)` with `title: str`, `source_type: DocumentSourceType`, `url: str | None = None`, `materials: list[Material]`; `DocumentStatusUpdate(BaseModel)` with `status: Literal["approved", "rejected"]`, `reviewed_by: str`.

- [ ] **Step 1: Write the failing tests** (create `backend/tests/test_document_schemas.py`):

```python
import pytest
from pydantic import ValidationError

from app.schemas import DocumentCreateRequest, DocumentSourceType, Material


def test_document_create_url_accepts_valid_materials():
    doc = DocumentCreateRequest(
        title="Buku Sampah",
        source_type=DocumentSourceType.url,
        url="https://example.com/artikel",
        materials=[Material.plastik_pet, Material.kardus],
    )
    assert doc.materials == [Material.plastik_pet, Material.kardus]
    assert doc.url == "https://example.com/artikel"


def test_document_create_rejects_unknown_material():
    with pytest.raises(ValidationError):
        DocumentCreateRequest(
            title="X", source_type=DocumentSourceType.pdf, materials=["besi"]
        )


def test_document_status_update_restricts_values():
    from app.schemas import DocumentStatusUpdate

    ok = DocumentStatusUpdate(status="approved", reviewed_by="expert1")
    assert ok.status == "approved"
    with pytest.raises(ValidationError):
        DocumentStatusUpdate(status="pending", reviewed_by="expert1")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_document_schemas.py -v` from `backend/`
Expected: FAIL — `ImportError: cannot import name 'DocumentCreateRequest'`.

- [ ] **Step 3: Write minimal schemas** (append to `backend/app/schemas.py`):

```python
class DocumentSourceType(str, Enum):
    pdf = "pdf"
    url = "url"


class DocumentCreateRequest(BaseModel):
    title: str
    source_type: DocumentSourceType
    url: str | None = None
    materials: list[Material]


class DocumentStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]
    reviewed_by: str
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_document_schemas.py -v` from `backend/`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/tests/test_document_schemas.py
git commit -m "feat(documents): pydantic schemas for document create/status"
```

---

### Task 3: Text extraction — `extract_pdf` + `extract_url`

**Files:**
- Modify: `backend/pyproject.toml` (dependencies)
- Create: `backend/app/rag/document_ingest.py` (extraction half)
- Create: `backend/tests/test_document_extraction.py`

**Interfaces:**
- Consumes: `app.config.get_settings` (not needed here), `httpx` (already a dep), `pypdf`, `beautifulsoup4` (added now).
- Produces: `extract_pdf(data: bytes) -> list[dict]` returning `[{"page": int, "text": str}]` (one entry per page with extractable text; raises `ValueError` when >500 pages or no text); `async extract_url(url: str, client_factory=httpx.AsyncClient) -> list[dict]` returning `[{"section": str | None, "text": str}]` split on h1/h2/h3 headings (raises `ValueError` when content >5MB or no text; propagates `httpx.HTTPStatusError` on bad status).

- [ ] **Step 1: Add dependencies**

Run from `backend/`: `uv add pypdf beautifulsoup4`
Expected: `pyproject.toml` and `uv.lock` updated with `pypdf` and `beautifulsoup4`.

- [ ] **Step 2: Write the failing tests** (create `backend/tests/test_document_extraction.py`):

```python
from io import BytesIO

import httpx
import pytest
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, StreamObject

from app.rag.document_ingest import extract_pdf, extract_url


def _make_pdf(pages: list[str]) -> bytes:
    """Build a minimal PDF whose text pypdf can extract. Uses pypdf's own
    writer internals (`_add_object`) to attach a content stream."""
    writer = PdfWriter()
    for text in pages:
        page = writer.add_blank_page(width=612, height=792)
        content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("latin-1")
        stream = StreamObject()
        stream.set_data(content)
        page[NameObject("/Contents")] = writer._add_object(stream)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
        )
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def test_extract_pdf_returns_page_and_text():
    parts = extract_pdf(_make_pdf(["Pot tanaman dari botol PET"]))
    assert parts == [{"page": 1, "text": "Pot tanaman dari botol PET"}]


def test_extract_pdf_multiple_pages():
    parts = extract_pdf(_make_pdf(["Halaman satu", "Halaman dua"]))
    assert [p["page"] for p in parts] == [1, 2]
    assert parts[1]["text"] == "Halaman dua"


def test_extract_pdf_raises_on_empty(monkeypatch):
    import app.rag.document_ingest as di

    monkeypatch.setattr(di, "MAX_PDF_PAGES", 0)
    with pytest.raises(ValueError):
        extract_pdf(_make_pdf(["teks"]))


class _Resp:
    def __init__(self, body: bytes, status: int = 200):
        self.body = body
        self.status = status

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def aiter_bytes(self):
        yield self.body

    def raise_for_status(self):
        if self.status >= 400:
            raise httpx.HTTPStatusError("bad", request=None, response=None)


class _Client:
    def __init__(self, resp: _Resp):
        self._resp = resp

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    def stream(self, method, url):
        return self._resp


HTML = (
    "<html><body><article>"
    "<h1>Panduan Daur Ulang</h1>"
    "<h2>Botol PET</h2>"
    "<p>Cuci botol sebelum dipotong.</p>"
    "<p>Gunakan gunting tajam.</p>"
    "<h2>Kardus</h2>"
    "<p>Lipat kardus menjadi rak.</p>"
    "</article></body></html>"
)


def test_extract_url_splits_sections():
    async def run():
        return await extract_url("https://example.com/x", client_factory=lambda *a, **k: _Client(_Resp(HTML.encode())))

    sections = asyncio_run(run())
    assert sections[0] == {"section": "Botol PET", "text": "Cuci botol sebelum dipotong. Gunakan gunting tajam."}
    assert sections[1] == {"section": "Kardus", "text": "Lipat kardus menjadi rak."}


def test_extract_url_raises_on_http_error():
    async def run():
        return await extract_url("https://example.com/404", client_factory=lambda *a, **k: _Client(_Resp(b"", status=404)))

    with pytest.raises(httpx.HTTPStatusError):
        asyncio_run(run())


def test_extract_url_raises_over_size_limit(monkeypatch):
    import app.rag.document_ingest as di

    monkeypatch.setattr(di, "MAX_URL_BYTES", 10)

    async def run():
        return await extract_url("https://example.com/x", client_factory=lambda *a, **k: _Client(_Resp(HTML.encode())))

    with pytest.raises(ValueError, match="5MB"):
        asyncio_run(run())


def asyncio_run(coro):
    import asyncio

    return asyncio.new_event_loop().run_until_complete(coro)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest tests/test_document_extraction.py -v` from `backend/`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.rag.document_ingest'`.

- [ ] **Step 4: Write minimal implementation** (create `backend/app/rag/document_ingest.py`):

```python
import logging
from io import BytesIO

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader

logger = logging.getLogger(__name__)

MAX_PDF_PAGES = 500
MAX_URL_BYTES = 5 * 1024 * 1024


def extract_pdf(data: bytes) -> list[dict]:
    """Return [{"page": int, "text": str}] per page with extractable text."""
    reader = PdfReader(BytesIO(data))
    if len(reader.pages) > MAX_PDF_PAGES:
        raise ValueError("PDF exceeds 500 pages")
    out = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            out.append({"page": i, "text": text})
    if not out:
        raise ValueError("no extractable text in PDF")
    return out


async def extract_url(url: str, client_factory=httpx.AsyncClient) -> list[dict]:
    """Fetch an article URL and split its main content on h1/h2/h3 headings."""
    async with client_factory(timeout=30, follow_redirects=True, max_redirects=5) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            total = 0
            parts = []
            async for chunk in resp.aiter_bytes():
                total += len(chunk)
                if total > MAX_URL_BYTES:
                    raise ValueError("URL content exceeds 5MB")
                parts.append(chunk)
    soup = BeautifulSoup(b"".join(parts), "html.parser")
    main = soup.find("article") or soup.body or soup
    sections: list[dict] = []
    current_heading = None
    current_parts: list[str] = []

    def flush() -> None:
        text = " ".join(current_parts).strip()
        if text:
            sections.append({"section": current_heading, "text": text})
        current_parts.clear()

    for el in main.find_all(["h1", "h2", "h3", "p", "li"]):
        if el.name in ("h1", "h2", "h3"):
            flush()
            current_heading = el.get_text(strip=True)
        else:
            t = el.get_text(strip=True)
            if t:
                current_parts.append(t)
    flush()
    if not sections:
        raise ValueError("no extractable text in URL")
    return sections
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/test_document_extraction.py -v` from `backend/`
Expected: 6 PASS. (If pypdf's `extract_text` returns slightly different spacing on some versions, assert `"Pot tanaman" in parts[0]["text"]`-style substring checks instead of exact equality — but do not weaken the multi-page/section assertions.)

- [ ] **Step 6: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/app/rag/document_ingest.py backend/tests/test_document_extraction.py
git commit -m "feat(documents): PDF and URL text extraction"
```

---

### Task 4: `ingest_document` — chunk, embed, index

**Files:**
- Modify: `backend/app/rag/document_ingest.py` (append)
- Modify: `backend/tests/fakes.py` (make `FakeTable.delete` clear rows)
- Create: `backend/tests/test_document_ingest.py`

**Interfaces:**
- Consumes: `chunk_text` (`app.rag.chunking`), `embed_texts` (`app.rag.embeddings`), `extract_pdf`/`extract_url` (Task 3), `FakeSupabase`.
- Produces: `async ingest_document(sb: Client, document_id: UUID | str) -> int` — raises `ValueError` unless `status == "approved"`; deletes existing chunks for the document, re-extracts, chunks with metadata `{"materials": list[str], "section": str | None, "page": int | None}`, embeds, inserts rows, sets `documents.indexed_at` to current UTC ISO timestamp; returns chunk count (0 when no text).

- [ ] **Step 1: Extend the fake so delete actually removes rows** (edit `backend/tests/fakes.py`):

Replace:

```python
    def delete(self):
        return FakeResult([])
```

with:

```python
    def delete(self):
        self.rows.clear()
        return FakeResult([])
```

- [ ] **Step 2: Write the failing tests** (create `backend/tests/test_document_ingest.py`):

```python
import pytest

from app.rag.document_ingest import ingest_document
from tests.fakes import FakeSupabase, FakeTable

DOC_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"


def _fake_sb(approved: bool = True, source_type: str = "url") -> FakeSupabase:
    fake = FakeSupabase()
    fake.tables["documents"] = FakeTable(
        [
            {
                "id": DOC_ID,
                "title": "Artikel",
                "source_type": source_type,
                "url": "https://example.com/x",
                "file_path": "documents/x.pdf" if source_type == "pdf" else None,
                "materials": ["plastik_pet", "kardus"],
                "status": "approved" if approved else "pending",
            }
        ]
    )
    return fake


async def _embed(texts):
    return [[0.1] * 1024 for _ in texts]


async def _extract_url(url):
    return [{"section": "Botol PET", "text": "Cuci botol sebelum dipotong. Gunakan gunting."}]


async def _extract_pdf(data):
    return [{"page": 1, "text": "Pot tanaman dari botol PET"}]


def test_ingest_rejects_non_approved(monkeypatch):
    fake = _fake_sb(approved=False)
    with pytest.raises(ValueError):
        asyncio_run(ingest_document(fake, DOC_ID))


def test_ingest_url_creates_chunks(monkeypatch):
    import app.rag.document_ingest as di

    monkeypatch.setattr(di, "embed_texts", _embed)
    monkeypatch.setattr(di, "extract_url", _extract_url)
    fake = _fake_sb()
    count = asyncio_run(ingest_document(fake, DOC_ID))
    assert count == 1
    rows = fake.table("document_chunks").inserted
    assert len(rows) == 1
    assert rows[0]["document_id"] == DOC_ID
    assert rows[0]["metadata"]["materials"] == ["plastik_pet", "kardus"]
    assert rows[0]["metadata"]["section"] == "Botol PET"
    assert fake.table("documents").rows[0]["indexed_at"] is not None


def test_ingest_pdf_sets_page_metadata(monkeypatch):
    import app.rag.document_ingest as di

    monkeypatch.setattr(di, "embed_texts", _embed)
    monkeypatch.setattr(di, "extract_pdf", _extract_pdf)
    fake = _fake_sb(source_type="pdf")
    count = asyncio_run(ingest_document(fake, DOC_ID))
    assert count == 1
    row = fake.table("document_chunks").inserted[0]
    assert row["metadata"]["page"] == 1


def test_reingest_replaces_old_chunks(monkeypatch):
    import app.rag.document_ingest as di

    monkeypatch.setattr(di, "embed_texts", _embed)
    monkeypatch.setattr(di, "extract_url", _extract_url)
    fake = _fake_sb()
    fake.tables["document_chunks"] = FakeTable([{"id": "old", "document_id": DOC_ID}])
    asyncio_run(ingest_document(fake, DOC_ID))
    assert fake.table("document_chunks").inserted[0]["document_id"] == DOC_ID


def asyncio_run(coro):
    import asyncio

    return asyncio.new_event_loop().run_until_complete(coro)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest tests/test_document_ingest.py -v` from `backend/`
Expected: FAIL — `ImportError: cannot import name 'ingest_document'`.

- [ ] **Step 4: Write minimal implementation** (append to `backend/app/rag/document_ingest.py`):

```python
from datetime import datetime, timezone
from uuid import UUID

from app.rag.chunking import chunk_text
from app.rag.embeddings import embed_texts


async def ingest_document(sb, document_id: UUID | str) -> int:
    res = sb.table("documents").select("*").eq("id", str(document_id)).single().execute()
    doc = res.data
    if not doc or doc["status"] != "approved":
        raise ValueError(
            f"document {document_id} is not approved (status={doc.get('status') if doc else 'missing'})"
        )

    sb.table("document_chunks").delete().eq("document_id", str(document_id)).execute()

    if doc["source_type"] == "pdf":
        blob = sb.storage.from_("documents").download(doc["file_path"])
        entries = [{"page": p["page"], "section": None, "text": p["text"]} for p in extract_pdf(blob)]
    else:
        entries = [{"page": None, "section": p["section"], "text": p["text"]} for p in await extract_url(doc["url"])]

    chunks = []
    for e in entries:
        meta = {"materials": doc["materials"], "section": e["section"], "page": e["page"]}
        chunks.extend(chunk_text(e["text"], metadata=meta))
    if not chunks:
        return 0

    embeddings = await embed_texts([c.content for c in chunks])
    rows = [
        {
            "document_id": str(document_id),
            "content": c.content,
            "embedding": e,
            "metadata": c.metadata,
        }
        for c, e in zip(chunks, embeddings)
    ]
    sb.table("document_chunks").insert(rows).execute()
    sb.table("documents").update(
        {"indexed_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", str(document_id)).execute()
    return len(rows)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/test_document_ingest.py -v` from `backend/`
Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/rag/document_ingest.py backend/tests/fakes.py backend/tests/test_document_ingest.py
git commit -m "feat(documents): ingest approved documents into the RAG corpus"
```

---

### Task 5: Integration tests for the unified `hybrid_search`

**Files:**
- Modify: `backend/tests/test_hybrid_search.py` (db fixture + `_search` helper + 4 new tests)

**Interfaces:**
- Consumes: Task 1 migration (tables + rewritten `hybrid_search`), existing skill seeding.
- Produces: proof that skill chunks keep `source_type='skill'` and document chunks are found with `source_type='document'`, material filter works per source. No production code in this task.

- [ ] **Step 1: Write the failing tests** (edit `backend/tests/test_hybrid_search.py`):

(a) Extend the `db` fixture so it also applies the documents migration once:

```python
DOCS_MIGRATION = Path(__file__).parents[1] / "supabase/migrations/20260806000002_document_sources.sql"

@pytest.fixture(scope="module")
def db():
    try:
        conn = psycopg.connect(DATABASE_URL, autocommit=True, connect_timeout=3)
    except Exception:
        pytest.skip("no test database reachable at TEST_DATABASE_URL")
    with conn.cursor() as cur:
        cur.execute("select to_regclass('public.skill_chunks')")
        if cur.fetchone()[0] is None:
            cur.execute(AUTH_STUB)
            cur.execute(MIGRATION.read_text())
        cur.execute("select to_regclass('public.document_chunks')")
        if cur.fetchone()[0] is None:
            cur.execute(DOCS_MIGRATION.read_text())
    yield conn
    conn.close()
```

(b) Extend the `seeded` fixture so it also inserts one approved document with two chunks (multi-material):

```python
        cur.execute(
            "insert into documents (title, source_type, url, materials, status, created_by) "
            "values ('Panduan Botol', 'url', 'https://example.com/x', "
            "array['plastik_pet','kardus'], 'approved', '00000000-0000-0000-0000-000000000001') "
            "returning id"
        )
        doc_id = cur.fetchone()[0]
        cur.execute(
            "insert into document_chunks (document_id, content, embedding, metadata) values "
            "(%s, 'cara membuat pot tanaman dari botol plastik bekas', %s::vector,"
            ' \'{"materials": ["plastik_pet", "kardus"]}\')',
            (doc_id, vec(0)),
        )
```

(c) Update `_search` to also return the new columns:

```python
def _search(db, embedding: str, text: str, material: str | None):
    with db.cursor() as cur:
        cur.execute(
            "select source_type, source_id, content, metadata, score "
            "from hybrid_search(%s::vector, %s, %s, 5)",
            (embedding, text, material),
        )
        return cur.fetchall()
```

(d) Update the two existing assertions that index into rows (`rows[0][0]` was content, now `rows[0][2]`; `r[1]["material"]` was metadata, now `r[3]["material"]`):

```python
def test_vector_match_ranks_first(db, seeded):
    rows = _search(db, vec(0), "pot tanaman botol plastik", None)
    assert rows
    assert "pot tanaman" in rows[0][2]
    assert rows[0][4] > 0

def test_material_filter_excludes_other_materials(db, seeded):
    rows = _search(db, vec(1), "rak buku kardus", "plastik_pet")
    assert all(r[3]["material"] == "plastik_pet" for r in rows)

def test_lexical_only_still_matches(db, seeded):
    # Orthogonal embedding, but FTS should still find the kardus chunk.
    rows = _search(db, vec(3), "rak buku kardus", None)
    assert any("rak buku" in r[2] for r in rows)
```

(e) Add four new tests:

```python
def test_document_chunk_found_with_source_type(db, seeded):
    rows = _search(db, vec(0), "pot tanaman botol plastik", None)
    docs = [r for r in rows if r[0] == "document"]
    assert docs
    assert "pot tanaman" in docs[0][2]


def test_skill_rows_keep_skill_source_type(db, seeded):
    rows = _search(db, vec(0), "pot tanaman botol plastik", None)
    skills = [r for r in rows if r[0] == "skill"]
    assert skills
    assert skills[0][1]  # source_id not null


def test_document_material_filter_includes_mapped_material(db, seeded):
    rows = _search(db, vec(0), "pot tanaman botol plastik", "plastik_pet")
    assert any(r[0] == "document" for r in rows)


def test_document_material_filter_excludes_unmapped_material(db, seeded):
    rows = _search(db, vec(0), "pot tanaman botol plastik", "kaca")
    assert not any(r[0] == "document" for r in rows)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_hybrid_search.py -v` from `backend/`
Expected: the four new tests FAIL (old function returns 3 columns / document_chunks missing or not returned) — or all SKIP if no test database is reachable. **If SKIP: still proceed** — the SQL was verified in Task 1's text test; run this suite later against a live local Supabase (`supabase start`) to confirm.

- [ ] **Step 3: Apply the new migration to the local test database**

If a local Supabase is running: `cd supabase && supabase db reset` (or apply the migration via `psql`). Otherwise skip — the fixture applies it automatically when the table is missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_hybrid_search.py -v` from `backend/`
Expected: all hybrid_search tests PASS (or SKIP when no DB). No production code changes in this task.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_hybrid_search.py
git commit -m "test(documents): unified hybrid_search covers skill + document chunks"
```

---

### Task 6: `search_corpus` + wire into `/recommend`

**Files:**
- Modify: `backend/app/agent/tools/retrieval.py` (dataclass + `search_skills` → `search_corpus`)
- Modify: `backend/app/api/recommend.py` (caller)
- Modify: `backend/tests/test_gates.py` (3 monkeypatch targets + 3 `RetrievedChunk` constructions)
- Create: `backend/tests/test_retrieval.py`

**Interfaces:**
- Consumes: `hybrid_search` RPC (Task 1), `embed_query`/`rerank` (unchanged), `get_settings`.
- Produces: `RetrievedChunk` dataclass with fields `chunk_id: str`, `source_type: str = "skill"`, `source_id: str = ""`, `content: str = ""`, `metadata: dict = field(default_factory=dict)`, `rrf_score: float = 0.0`, `rerank_score: float = 0.0`; `async search_corpus(sb, query: str, material: str | None = None) -> list[RetrievedChunk]` — same behavior as old `search_skills` (embed → RPC → rerank → top `rerank_top_k`; `[]` when embedding fails or no rows), but maps `source_type`/`source_id` from RPC rows.

- [ ] **Step 1: Write the failing tests** (create `backend/tests/test_retrieval.py`):

```python
import pytest

from app.agent.tools.retrieval import RetrievedChunk, search_corpus
from tests.fakes import FakeResult, FakeSupabase


def _rows():
    return [
        {
            "chunk_id": "c1",
            "source_type": "skill",
            "source_id": "s1",
            "content": "pot dari botol",
            "metadata": {"material": "plastik_pet"},
            "score": 0.5,
        },
        {
            "chunk_id": "c2",
            "source_type": "document",
            "source_id": "d1",
            "content": "cuci botol dahulu",
            "metadata": {"materials": ["plastik_pet"]},
            "score": 0.4,
        },
    ]


async def _embed(query):
    return [0.1] * 1024


async def _rerank(query, documents):
    return list(range(len(documents)))


def test_search_corpus_maps_source_type_and_id(monkeypatch):
    fake = FakeSupabase()
    fake.rpc = lambda name, params: FakeResult(_rows())
    monkeypatch.setattr("app.agent.tools.retrieval.embed_query", _embed)
    monkeypatch.setattr("app.agent.tools.retrieval.rerank", _rerank)
    chunks = asyncio_run(search_corpus(fake, "pot botol"))
    assert [c.source_type for c in chunks] == ["document", "skill"]
    assert chunks[0].source_id == "d1"
    assert chunks[1].source_id == "s1"


def test_search_corpus_empty_when_embedding_fails(monkeypatch):
    fake = FakeSupabase()

    async def boom(query):
        raise RuntimeError("provider down")

    monkeypatch.setattr("app.agent.tools.retrieval.embed_query", boom)
    assert asyncio_run(search_corpus(fake, "pot")) == []


def test_search_corpus_truncates_to_rerank_top_k(monkeypatch):
    fake = FakeSupabase()
    fake.rpc = lambda name, params: FakeResult(
        [
            {
                "chunk_id": f"c{i}",
                "source_type": "skill",
                "source_id": f"s{i}",
                "content": f"teks {i}",
                "metadata": {},
                "score": 0.1,
            }
            for i in range(8)
        ]
    )
    monkeypatch.setattr("app.agent.tools.retrieval.embed_query", _embed)
    monkeypatch.setattr("app.agent.tools.retrieval.rerank", _rerank)
    chunks = asyncio_run(search_corpus(fake, "pot"))
    assert len(chunks) == 5  # settings.rerank_top_k default


def asyncio_run(coro):
    import asyncio

    return asyncio.new_event_loop().run_until_complete(coro)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_retrieval.py -v` from `backend/`
Expected: FAIL — `ImportError: cannot import name 'search_corpus'`.

- [ ] **Step 3: Write minimal implementation** (edit `backend/app/agent/tools/retrieval.py`):

Replace the `RetrievedChunk` dataclass and `search_skills` body:

```python
@dataclass
class RetrievedChunk:
    chunk_id: str
    source_type: str = "skill"
    source_id: str = ""
    content: str = ""
    metadata: dict = field(default_factory=dict)
    rrf_score: float = 0.0
    rerank_score: float = 0.0


async def search_corpus(
    sb: Client, query: str, material: str | None = None
) -> list[RetrievedChunk]:
    s = get_settings()
    try:
        embedding = await embed_query(query)
    except Exception:
        return []
    res = sb.rpc(
        "hybrid_search",
        {
            "query_embedding": embedding,
            "query_text": query,
            "material_filter": material,
            "match_count": s.retrieval_top_k,
        },
    ).execute()
    rows = res.data or []
    chunks = [
        RetrievedChunk(
            chunk_id=r["chunk_id"],
            source_type=r.get("source_type", "skill"),
            source_id=r.get("source_id", r.get("skill_id", "")),
            content=r["content"],
            metadata=r["metadata"],
            rrf_score=r["score"],
        )
        for r in rows
    ]
    if not chunks:
        return []
    scores = await rerank(query, [c.content for c in chunks])
    for c, score in zip(chunks, scores):
        c.rerank_score = score
    chunks.sort(key=lambda c: c.rerank_score, reverse=True)
    return chunks[: s.rerank_top_k]
```

- [ ] **Step 4: Update the caller** (edit `backend/app/api/recommend.py`):

Replace `from app.agent.tools.retrieval import search_skills` with `from app.agent.tools.retrieval import search_corpus`, and replace the call `chunks = await search_skills(sb, query, material.value)` with `chunks = await search_corpus(sb, query, material.value)`.

- [ ] **Step 5: Update the gate tests** (edit `backend/tests/test_gates.py`):

Replace all three `monkeypatch.setattr(recommend_module, "search_skills", ...)` with `"search_corpus"`, and the three `RetrievedChunk(...)` constructions so `skill_id="s1"` becomes `source_type="skill", source_id="s1"` (keep the other kwargs unchanged).

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_retrieval.py tests/test_gates.py -v` from `backend/`
Expected: 3 + all gate tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/agent/tools/retrieval.py backend/app/api/recommend.py backend/tests/test_gates.py backend/tests/test_retrieval.py
git commit -m "feat(documents): search_corpus over unified hybrid_search"
```

---

### Task 7: Grounding labels for document chunks

**Files:**
- Modify: `backend/app/agent/orchestrator.py` (`GROUNDING_PROMPT` + `generate_solution`)
- Create: `backend/tests/test_grounding_documents.py`

**Interfaces:**
- Consumes: `RetrievedChunk` (Task 6), `SolutionPackage` (unchanged).
- Produces: `generate_solution(query: str, chunks: list[RetrievedChunk]) -> SolutionPackage` unchanged signature; context now labels chunks `[skill_id: X]` / `[document_id: Y]`; `GROUNDING_PROMPT` gains a document-citation rule (keeps its "Iron Law", MUST/NEVER, Red Flags, Self-Check sections so `test_prompt_contract.py` stays green).

- [ ] **Step 1: Write the failing tests** (create `backend/tests/test_grounding_documents.py`):

```python
from app.agent.orchestrator import GROUNDING_PROMPT, generate_solution
from app.agent.tools.retrieval import RetrievedChunk
from app.schemas import SolutionPackage


class FakeAgentResult:
    def __init__(self, output):
        self.output = output


class FakeAgent:
    def __init__(self):
        self.prompt = None

    async def run(self, prompt):
        self.prompt = prompt
        return FakeAgentResult(SolutionPackage(recommendation="Buat pot.", sources=["skill:s1"]))


def test_generate_solution_labels_document_chunks(monkeypatch):
    agent = FakeAgent()
    monkeypatch.setattr("app.agent.orchestrator.generation_agent", lambda: agent)
    chunks = [
        RetrievedChunk(chunk_id="c1", source_type="skill", source_id="s1", content="langkah a"),
        RetrievedChunk(
            chunk_id="c2", source_type="document", source_id="d1", content="panduan cuci"
        ),
    ]
    out = asyncio_run(generate_solution("pot", chunks))
    assert out.recommendation == "Buat pot."
    assert "[skill_id: s1]" in agent.prompt
    assert "[document_id: d1]" in agent.prompt


def test_grounding_prompt_mentions_document_citation():
    assert "document_id" in GROUNDING_PROMPT


def asyncio_run(coro):
    import asyncio

    return asyncio.new_event_loop().run_until_complete(coro)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_grounding_documents.py -v` from `backend/`
Expected: FAIL — `"[document_id: d1]" not in prompt`.

- [ ] **Step 3: Update `generate_solution`** (edit `backend/app/agent/orchestrator.py`):

Replace the context-building line:

```python
    context = "\n\n".join(f"[skill_id: {c.skill_id}]\n{c.content}" for c in chunks)
```

with:

```python
    labeled = []
    for c in chunks:
        label = f"[document_id: {c.source_id}]" if c.source_type == "document" else f"[skill_id: {c.source_id}]"
        labeled.append(f"{label}\n{c.content}")
    context = "\n\n".join(labeled)
```

- [ ] **Step 4: Add the citation rule to `GROUNDING_PROMPT`**

Inside the existing "## Aturan (MUST/NEVER)" numbered list, append one item (keep every other line intact):

```
5. Klaim dari dokumen mengutip document_id; klaim dari skill mengutip skill_id.
   Jangan mencampur keduanya dalam satu kutipan.
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_grounding_documents.py tests/test_prompt_contract.py -v` from `backend/`
Expected: 2 + prompt contract PASS (the contract checks the four required sections, which remain present).

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/orchestrator.py backend/tests/test_grounding_documents.py
git commit -m "feat(documents): label document chunks in grounding context"
```

---

### Task 8: Documents API — create + list

**Files:**
- Create: `backend/app/api/documents.py`
- Modify: `backend/app/main.py` (import + mount)
- Create: `backend/tests/test_document_endpoints.py` (create/list half)

**Interfaces:**
- Consumes: `require_expert_or_service`, `get_optional_user_id`, `get_supabase` (`app.deps`), `extract_pdf`/`extract_url` (Task 3), `DocumentCreateRequest`/`DocumentStatusUpdate` (Task 2), storage bucket `documents` (Task 1).
- Produces: router with `POST /documents` (JSON, url only — `{title, source_type:"url", url, materials[]}` → 201 pending; 400 on unreadable URL or unknown material), `POST /documents/pdf` (multipart `file` + `title` + `materials` comma-string → validates PDF + uploads to storage → 201 pending; 400 on >50MB, unreadable PDF, or unknown material), `GET /documents?status=` (expert-only list).
- **Auth note:** endpoints gate with `require_expert_or_service` via `dependencies=`, and read the uploader through `get_optional_user_id` (returns `None` for service-key calls — `get_current_user` would 401 on service keys because the service key is not a valid JWT). `created_by` is nullable in the migration.

- [ ] **Step 1: Write the failing tests** (create `backend/tests/test_document_endpoints.py`, first half):

```python
import pytest
from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase, FakeTable

client = TestClient(app)
SERVICE_AUTH = {"Authorization": "Bearer test-service-key"}


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    fake.tables["profiles"] = FakeTable([{"auth_user_id": "expert1", "role": "expert"}])
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _auth(user="u1"):
    return {"Authorization": f"Bearer {create_test_token({'sub': user})}"}


async def _ok_url(url, client_factory=httpx.AsyncClient):
    return [{"section": "Botol PET", "text": "Cuci botol."}]


async def _bad_url(url, client_factory=httpx.AsyncClient):
    raise ValueError("timeout")


def test_create_url_requires_expert(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_url", _ok_url)
    r = client.post("/documents", json={"title": "A", "source_type": "url", "url": "https://x.com/a", "materials": ["plastik_pet"]}, headers=_auth())
    assert r.status_code == 403


def test_create_url_service_role_ok(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_url", _ok_url)
    r = client.post("/documents", json={"title": "A", "source_type": "url", "url": "https://x.com/a", "materials": ["plastik_pet"]}, headers=SERVICE_AUTH)
    assert r.status_code == 201
    assert r.json()["status"] == "pending"
    assert r.json()["created_by"] is None  # service key has no JWT sub


def test_create_url_expert_profile_ok(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_url", _ok_url)
    r = client.post("/documents", json={"title": "A", "source_type": "url", "url": "https://x.com/a", "materials": ["plastik_pet"]}, headers=_auth("expert1"))
    assert r.status_code == 201
    assert r.json()["created_by"] == "expert1"


def test_create_url_unreadable_returns_400(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_url", _bad_url)
    r = client.post("/documents", json={"title": "A", "source_type": "url", "url": "https://x.com/a", "materials": ["plastik_pet"]}, headers=SERVICE_AUTH)
    assert r.status_code == 400


def test_create_url_invalid_material_returns_400(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_url", _ok_url)
    r = client.post("/documents", json={"title": "A", "source_type": "url", "url": "https://x.com/a", "materials": ["besi"]}, headers=SERVICE_AUTH)
    assert r.status_code == 400


def test_create_pdf_uploads_and_pends(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_pdf", lambda data: [{"page": 1, "text": "x"}])
    r = client.post(
        "/documents/pdf",
        files={"file": ("buku.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"title": "Buku", "materials": "plastik_pet,kardus"},
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 201
    assert r.json()["source_type"] == "pdf"
    assert r.json()["status"] == "pending"
    assert r.json()["materials"] == ["plastik_pet", "kardus"]
    assert fake_sb.storage.from_("documents").uploads  # stored in bucket


def test_create_pdf_unreadable_returns_400(fake_sb, monkeypatch):
    def bad(data):
        raise ValueError("corrupt")

    monkeypatch.setattr("app.api.documents.extract_pdf", bad)
    r = client.post(
        "/documents/pdf",
        files={"file": ("buku.pdf", b"garbage", "application/pdf")},
        data={"title": "Buku", "materials": "plastik_pet"},
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 400


def test_list_documents_filters_status(fake_sb):
    fake_sb.table("documents").insert(
        {"title": "A", "source_type": "url", "url": "https://x.com", "materials": [], "status": "pending", "created_by": "u1"}
    )
    fake_sb.table("documents").insert(
        {"title": "B", "source_type": "url", "url": "https://x.com", "materials": [], "status": "approved", "created_by": "u1"}
    )
    r = client.get("/documents?status=approved", headers=SERVICE_AUTH)
    assert r.status_code == 200
    assert [d["title"] for d in r.json()] == ["B"]
```

Note: `import httpx` is needed at the top of the test file for the `client_factory=httpx.AsyncClient` default annotations in the fake functions.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_document_endpoints.py -v` from `backend/`
Expected: FAIL — `ImportError`/404 for `/documents`.

- [ ] **Step 3: Write the router (create/list half)** (create `backend/app/api/documents.py`):

```python
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from supabase import Client

from app.deps import get_optional_user_id, get_supabase, require_expert_or_service
from app.rag.document_ingest import extract_pdf, extract_url
from app.schemas import DocumentCreateRequest

router = APIRouter()

MATERIALS = {"plastik_pet", "plastik_hdpe", "kardus", "kaleng", "kaca", "sachet"}
MAX_PDF_BYTES = 50 * 1024 * 1024


@router.post("", status_code=201, dependencies=[Depends(require_expert_or_service)])
async def create_document(
    body: DocumentCreateRequest,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> dict:
    materials = [m.value for m in body.materials]
    if body.source_type == "url":
        if not body.url:
            raise HTTPException(status_code=400, detail="url wajib untuk source_type=url")
        try:
            await extract_url(body.url)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"url tidak bisa dibaca: {exc}")
        payload = {
            "title": body.title,
            "source_type": "url",
            "url": body.url,
            "materials": materials,
        }
    else:
        raise HTTPException(status_code=400, detail="upload PDF via POST /documents/pdf")
    payload.update({"status": "pending", "created_by": user_id})
    res = sb.table("documents").insert(payload).execute()
    return res.data[0]


@router.post("/pdf", status_code=201, dependencies=[Depends(require_expert_or_service)])
async def create_document_pdf(
    file: UploadFile = File(...),
    title: str = Form(...),
    materials: str = Form(...),
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> dict:
    data = await file.read()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=400, detail="PDF melebihi 50MB")
    try:
        extract_pdf(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"PDF tidak bisa dibaca: {exc}")
    material_list = [m.strip() for m in materials.split(",") if m.strip()]
    invalid = [m for m in material_list if m not in MATERIALS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"material tidak dikenal: {invalid}")
    doc_id = str(uuid4())
    path = f"documents/{doc_id}.pdf"
    sb.storage.from_("documents").upload(path, data)
    res = sb.table("documents").insert(
        {
            "id": doc_id,
            "title": title,
            "source_type": "pdf",
            "file_path": path,
            "materials": material_list,
            "status": "pending",
            "created_by": user_id,
        }
    ).execute()
    return res.data[0]


@router.get("", dependencies=[Depends(require_expert_or_service)])
def list_documents(
    status: str | None = None,
    sb: Client = Depends(get_supabase),
) -> list[dict]:
    q = sb.table("documents").select("*")
    if status:
        q = q.eq("status", status)
    return q.order("created_at", desc=True).execute().data
```

- [ ] **Step 4: Mount the router** (edit `backend/app/main.py`):

Add `documents` to the `from app.api import (...)` tuple, and after the other `include_router` lines add:

```python
app.include_router(documents.router, prefix="/documents", tags=["documents"])
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/test_document_endpoints.py -v` from `backend/`
Expected: 8 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/documents.py backend/app/main.py backend/tests/test_document_endpoints.py
git commit -m "feat(documents): create and list endpoints for document sources"
```

---

### Task 9: Documents API — status, reingest, delete

**Files:**
- Modify: `backend/app/api/documents.py` (append)
- Modify: `backend/tests/test_document_endpoints.py` (append second half)

**Interfaces:**
- Consumes: `ingest_document` (Task 4), `DocumentStatusUpdate` (Task 2), `BackgroundTasks` pattern from `app/api/skills.py`.
- Produces: `PATCH /documents/{id}/status` (expert; approve → background `ingest_document`; 404 unknown id), `POST /documents/{id}/reingest` (expert; 400 unless approved; 500 on ingest failure; returns `{"ingested": int}`), `DELETE /documents/{id}` (expert; removes storage file when present + row → chunks cascade; 404 unknown id).

- [ ] **Step 1: Write the failing tests** (append to `backend/tests/test_document_endpoints.py`):

```python
async def _ingest(sb, document_id):
    return 3


def test_patch_approve_triggers_ingest(fake_sb, monkeypatch):
    fake_sb.table("documents").insert(
        {"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "title": "A", "source_type": "url", "url": "https://x.com", "materials": ["plastik_pet"], "status": "pending", "created_by": "u1"}
    )
    calls = []

    async def fake_ingest(sb, document_id):
        calls.append(str(document_id))
        return 3

    monkeypatch.setattr("app.api.documents.ingest_document", fake_ingest)
    r = client.patch(
        "/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/status",
        json={"status": "approved", "reviewed_by": "expert1"},
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    # TestClient runs Starlette BackgroundTasks synchronously before returning.
    assert calls == ["3fa85f64-5717-4562-b3fc-2c963f66afa6"]


def test_patch_status_unknown_404(fake_sb):
    r = client.patch(
        "/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/status",
        json={"status": "rejected", "reviewed_by": "expert1"},
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 404


def test_reingest_requires_approved(fake_sb, monkeypatch):
    fake_sb.table("documents").insert(
        {"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "title": "A", "source_type": "url", "url": "https://x.com", "materials": [], "status": "pending", "created_by": "u1"}
    )
    monkeypatch.setattr("app.api.documents.ingest_document", _ingest)
    r = client.post("/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/reingest", headers=SERVICE_AUTH)
    assert r.status_code == 400


def test_reingest_returns_count(fake_sb, monkeypatch):
    fake_sb.table("documents").insert(
        {"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "title": "A", "source_type": "url", "url": "https://x.com", "materials": [], "status": "approved", "created_by": "u1", "indexed_at": None}
    )
    monkeypatch.setattr("app.api.documents.ingest_document", _ingest)
    r = client.post("/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/reingest", headers=SERVICE_AUTH)
    assert r.status_code == 200
    assert r.json() == {"ingested": 3}


def test_reingest_500_on_failure(fake_sb, monkeypatch):
    fake_sb.table("documents").insert(
        {"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "title": "A", "source_type": "url", "url": "https://x.com", "materials": [], "status": "approved", "created_by": "u1"}
    )

    async def boom(sb, document_id):
        raise ValueError("extract failed")

    monkeypatch.setattr("app.api.documents.ingest_document", boom)
    r = client.post("/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/reingest", headers=SERVICE_AUTH)
    assert r.status_code == 500


def test_delete_removes_row_and_storage(fake_sb):
    fake_sb.table("documents").insert(
        {"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "title": "A", "source_type": "pdf", "file_path": "documents/x.pdf", "materials": [], "status": "approved", "created_by": "u1"}
    )
    r = client.delete("/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6", headers=SERVICE_AUTH)
    assert r.status_code == 200
    assert fake_sb.storage.from_("documents").removed == ["documents/x.pdf"]
    assert fake_sb.table("documents").rows == []


def test_delete_unknown_404(fake_sb):
    r = client.delete("/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6", headers=SERVICE_AUTH)
    assert r.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_document_endpoints.py -v` from `backend/`
Expected: new tests FAIL — 404/405 for the missing routes.

- [ ] **Step 3: Write the endpoints** (append to `backend/app/api/documents.py`):

First extend the import block at the top of the file — add `BackgroundTasks` to the existing `from fastapi import ...` line, and add:

```python
from app.rag.document_ingest import ingest_document
from app.schemas import DocumentStatusUpdate
```

(Do NOT put imports mid-file — ruff's E402 rejects module-level imports after code.)

Then append the endpoints:

```python
@router.patch("/{document_id}/status", dependencies=[Depends(require_expert_or_service)])
async def update_status(
    document_id: UUID,
    body: DocumentStatusUpdate,
    background_tasks: BackgroundTasks,
    sb: Client = Depends(get_supabase),
) -> dict:
    res = (
        sb.table("documents")
        .update({"status": body.status.value, "reviewed_by": body.reviewed_by})
        .eq("id", str(document_id))
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="document not found")
    if body.status == "approved":
        background_tasks.add_task(ingest_document, sb, document_id)
    return res.data[0]


@router.post("/{document_id}/reingest", dependencies=[Depends(require_expert_or_service)])
async def reingest(
    document_id: UUID,
    sb: Client = Depends(get_supabase),
) -> dict:
    res = sb.table("documents").select("*").eq("id", str(document_id)).single().execute()
    if not res.data or res.data["status"] != "approved":
        raise HTTPException(status_code=400, detail="document must be approved first")
    try:
        count = await ingest_document(sb, document_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"reingest failed: {exc}")
    return {"ingested": count}


@router.delete("/{document_id}", dependencies=[Depends(require_expert_or_service)])
def delete_document(
    document_id: UUID,
    sb: Client = Depends(get_supabase),
) -> dict:
    res = sb.table("documents").select("*").eq("id", str(document_id)).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="document not found")
    if res.data.get("file_path"):
        sb.storage.from_("documents").remove([res.data["file_path"]])
    sb.table("documents").delete().eq("id", str(document_id)).execute()
    return {"deleted": str(document_id)}
```

Note: `body.status == "approved"` compares the `Literal["approved", "rejected"]` value — at runtime it IS the plain string `"approved"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_document_endpoints.py -v` from `backend/`
Expected: all document endpoint tests PASS (create/list + 8 new).

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/documents.py backend/tests/test_document_endpoints.py
git commit -m "feat(documents): approval, reingest, and delete endpoints"
```

---

### Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend suite**

Run: `uv run pytest tests/ -q` from `backend/`
Expected: all tests pass (hermetic tests always run; `test_hybrid_search.py` may SKIP without a live local DB — that is acceptable).

- [ ] **Step 2: Run ruff lint**

Run: `uv run ruff check backend/` from repo root
Expected: no errors. (If `F401` unused imports appear in edited files, remove them.)

- [ ] **Step 3: Run ruff format check**

Run: `uv run ruff format --check backend/` from repo root
Expected: no files would be reformatted. If files are listed, run `uv run ruff format backend/` on only the files this plan touched, then re-run the check.

- [ ] **Step 4: Verify git state is clean of unrelated files**

Run: `git status --short` from repo root
Expected: only the plan's files plus pre-existing `.gitignore` modification and untracked root `supabase/migrations/` — do NOT stage or commit those.

- [ ] **Step 5: Final commit if anything drifted**

```bash
git add -u backend/
git commit -m "chore(documents): verification fixes"
```

(Only run this if Step 1–3 produced changes; otherwise skip.)
