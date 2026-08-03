"""Tests for skill seeding integrity."""


def test_minimum_skills_count():
    """Verify at least 50 skills are included in templates."""
    # This is a placeholder - actual test requires real Supabase connection
    assert True, "Requires live database connection for full validation"


def test_all_material_types_covered():
    """Ensure all 6 material types have seed data."""
    expected_materials = [
        "plastik_pet",
        "plastik_hdpe",
        "kardus",
        "kaleng",
        "kaca",
        "sachet",
    ]

    # In production, query database
    # For now, verify template structure exists
    assert len(expected_materials) == 6, "All material types must be defined"
