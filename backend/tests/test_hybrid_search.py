import os
from pathlib import Path

import pytest

psycopg = pytest.importorskip("psycopg")

DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)
MIGRATION = Path(__file__).parents[1] / "supabase/migrations/20260728000001_init.sql"
DOCS_MIGRATION = (
    Path(__file__).parents[1] / "supabase/migrations/20260806000002_document_sources.sql"
)

# Bare Postgres (CI service container) has no Supabase auth schema; stub it so
# the migration's RLS policy using auth.uid() applies. Local `supabase start`
# already has both the schema and the migration applied.
AUTH_STUB = """
create schema if not exists auth;
create or replace function auth.uid() returns uuid
language sql stable as 'select null::uuid';
"""


def vec(hot: int) -> str:
    values = ["0"] * 1024
    values[hot] = "1"
    return "[" + ",".join(values) + "]"


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


@pytest.fixture()
def seeded(db):
    with db.cursor() as cur:
        cur.execute("delete from skills")
        cur.execute(
            "insert into skills (title, material, difficulty, status, origin) values "
            "('Pot dari botol PET','plastik_pet','pemula','approved','seed') returning id"
        )
        skill_id = cur.fetchone()[0]
        cur.execute(
            "insert into skill_chunks (skill_id, content, embedding, metadata) values "
            "(%s, 'cara membuat pot tanaman dari botol plastik bekas', %s::vector,"
            ' \'{"material": "plastik_pet"}\'),'
            "(%s, 'melipat kardus bekas menjadi rak buku sederhana', %s::vector,"
            ' \'{"material": "kardus"}\')',
            (skill_id, vec(0), skill_id, vec(1)),
        )
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
    return skill_id


def _search(db, embedding: str, text: str, material: str | None):
    with db.cursor() as cur:
        cur.execute(
            "select source_type, source_id, content, metadata, score "
            "from hybrid_search(%s::vector, %s, %s, 5)",
            (embedding, text, material),
        )
        return cur.fetchall()


def test_vector_match_ranks_first(db, seeded):
    rows = _search(db, vec(0), "pot tanaman botol plastik", None)
    assert rows
    assert "pot tanaman" in rows[0][2]
    assert rows[0][4] > 0


def test_material_filter_excludes_other_materials(db, seeded):
    rows = _search(db, vec(1), "rak buku kardus", "plastik_pet")
    assert all(r[3]["material"] == "plastik_pet" for r in rows if r[0] == "skill")


def test_no_match_returns_empty(db, seeded):
    rows = _search(db, vec(2), "zzz qqq tidakadakata", "kaca")
    assert rows == []


def test_lexical_only_still_matches(db, seeded):
    # Orthogonal embedding, but FTS should still find the kardus chunk.
    rows = _search(db, vec(3), "rak buku kardus", None)
    assert any("rak buku" in r[2] for r in rows)


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
