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


def _extract_pdf(data):
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
