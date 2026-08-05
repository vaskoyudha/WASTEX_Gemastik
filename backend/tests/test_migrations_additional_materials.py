from pathlib import Path

MIG_PATH = (
    Path(__file__).resolve().parents[1]
    / "supabase"
    / "migrations"
    / "20260805000002_additional_materials.sql"
)
SQL = MIG_PATH.read_text()


def test_migration_adds_additional_materials_columns():
    assert (
        "alter table skills add column if not exists additional_materials jsonb not null default '[]'"
        in SQL
    )
    assert (
        "alter table skills add column if not exists additional_materials_cost_idr int not null default 0"
        in SQL
    )
