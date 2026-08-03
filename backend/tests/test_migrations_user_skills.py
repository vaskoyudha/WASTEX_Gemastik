from pathlib import Path

from app.schemas import SkillStatus

SQL = Path(__file__).parents[1] / "supabase" / "migrations" / "20260803000001_user_skills.sql"


def test_skill_status_has_pending():
    assert SkillStatus.pending.value == "pending"


def test_migration_adds_user_skill_columns():
    text = SQL.read_text()
    assert "created_by" in text
    assert "'pending'" in text
    assert "origin" in text
    assert "'user'" in text
    assert "description" in text
    assert "profiles" in text
    assert "role" in text
    assert "skills_created_by_idx" in text
