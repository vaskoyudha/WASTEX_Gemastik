from pathlib import Path

MIG_PATH = (
    Path(__file__).resolve().parents[1]
    / "supabase"
    / "migrations"
    / "20260805000001_reference_image_path.sql"
)
SQL = MIG_PATH.read_text()


def test_migration_adds_reference_image_path_columns():
    assert "alter table skills add column if not exists reference_image_path text" in SQL
    assert (
        "alter table generated_visuals add column if not exists reference_image_path text"
        in SQL
    )