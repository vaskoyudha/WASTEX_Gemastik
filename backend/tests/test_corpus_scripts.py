import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

import corpus_common as cc

from tests.fakes import FakeSupabase, FakeTable


def test_material_queries_cover_all_six():
    assert set(cc.MATERIAL_QUERIES) == {
        "plastik_pet",
        "plastik_hdpe",
        "kardus",
        "kaleng",
        "kaca",
        "sachet",
    }


def test_should_skip_seed():
    assert cc.should_skip_seed([{"id": "s1"}], force=False) is True
    assert cc.should_skip_seed([{"id": "s1"}], force=True) is False
    assert cc.should_skip_seed([], force=False) is False


def test_coverage_pass():
    assert cc.coverage_pass([0.5, 0.1]) is True
    assert cc.coverage_pass([0.39]) is False
    assert cc.coverage_pass([]) is False


def test_format_seed_review():
    items = [
        {
            "id": "s1",
            "title": "Pot dari Botol",
            "material": "plastik_pet",
            "difficulty": "pemula",
            "safe": True,
            "violations": [],
            "sources": ["wikipedia-pet"],
        },
        {
            "id": "s2",
            "title": "Vas Kaca",
            "material": "kaca",
            "difficulty": "mahir",
            "safe": False,
            "violations": ["memotong kaca tanpa sarung tangan"],
            "sources": [],
        },
    ]
    report = cc.format_seed_review(items)
    assert "## Lolos (1/2)" in report
    assert "s1" in report and "Pot dari Botol" in report
    assert "## Perlu perhatian (1/2)" in report
    assert "memotong kaca tanpa sarung tangan" in report


def test_format_coverage_report():
    results = [
        {
            "material": "plastik_pet",
            "chunks": 3,
            "top_source": "skill",
            "top_score": 0.82,
            "pass": True,
        },
        {"material": "kaca", "chunks": 0, "top_source": None, "top_score": None, "pass": False},
    ]
    report = cc.format_coverage_report(results)
    assert "[PASS] plastik_pet" in report
    assert "[FAIL] kaca" in report


def test_approve_skill_success(monkeypatch):
    fake = FakeSupabase()
    fake.tables["skills"] = FakeTable(
        [{"id": "s1", "title": "X", "status": "draft", "origin": "seed"}]
    )

    async def fake_ingest(sb, skill_id):
        return 3

    monkeypatch.setattr("corpus_common.ingest_skill", fake_ingest)
    result = asyncio_run(cc.approve_skill(fake, "s1"))
    assert result["status"] == "approved"
    assert result["chunks"] == 3
    assert fake.table("skills").rows[0]["status"] == "approved"


def test_approve_skill_skips_non_draft():
    fake = FakeSupabase()
    fake.tables["skills"] = FakeTable(
        [{"id": "s1", "title": "X", "status": "approved", "origin": "seed"}]
    )
    result = asyncio_run(cc.approve_skill(fake, "s1"))
    assert result["skipped"] is True


def test_ingest_document_source_url(monkeypatch):
    fake = FakeSupabase()

    async def fake_ingest_doc(sb, doc_id):
        return 5

    monkeypatch.setattr("corpus_common.ingest_document", fake_ingest_doc)
    # Fixture matches the REAL sources.yaml entry shape (no source_type key).
    source = {
        "id": "identif-tas-dompet-sachet",
        "title": "Tas Sachet",
        "url": "https://www.identif.id/x",
        "materials": ["sachet"],
    }
    result = asyncio_run(cc.ingest_document_source(fake, source))
    assert result["chunks"] == 5
    rows = fake.table("documents").inserted
    assert rows[0]["status"] == "approved"
    assert rows[0]["source_type"] == "url"  # derived from URL (no .pdf suffix)


def test_ingest_document_source_pdf_derived(monkeypatch):
    fake = FakeSupabase()

    async def fake_ingest_doc(sb, doc_id):
        return 7

    monkeypatch.setattr("corpus_common.ingest_document", fake_ingest_doc)

    class FakeResponse:
        content = b"%PDF-1.4 fake"

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url):
            return FakeResponse()

    # Keep the test hermetic: stub the HTTP client so no real network call
    # is made to the fixture's PDF URL.
    monkeypatch.setattr("corpus_common.httpx.AsyncClient", FakeAsyncClient)
    source = {
        "id": "dlhk-banten-limbah-anorganik",
        "title": "DLHK Banten",
        "url": "https://dlhk.bantenprov.go.id/x/Pengelolaan_Limbah_Anorganik.pdf",
        "materials": ["plastik_pet", "kardus"],
    }
    result = asyncio_run(cc.ingest_document_source(fake, source))
    assert result["chunks"] == 7
    rows = fake.table("documents").inserted
    assert rows[0]["source_type"] == "pdf"  # derived from .pdf suffix
    assert fake.storage.from_("documents").uploads  # stored in bucket


def asyncio_run(coro):
    import asyncio

    return asyncio.new_event_loop().run_until_complete(coro)
