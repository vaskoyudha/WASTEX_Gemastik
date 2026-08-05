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
