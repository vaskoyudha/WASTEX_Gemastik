import pytest
from pydantic import ValidationError

from app.schemas import (
    CompletionGalleryItem,
    SkillCompletion,
    SkillCompletionCreate,
    SkillCompletionsSummary,
)


def test_create_accepts_valid_rating():
    c = SkillCompletionCreate(rating=5, comment="mantap")
    assert c.rating == 5
    assert c.comment == "mantap"


def test_create_rejects_rating_out_of_range():
    with pytest.raises(ValidationError):
        SkillCompletionCreate(rating=6)
    with pytest.raises(ValidationError):
        SkillCompletionCreate(rating=0)


def test_completion_roundtrip():
    c = SkillCompletion(
        id="c1",
        user_id="u1",
        skill_id="s1",
        photo_path="c1.jpeg",
        rating=4,
        comment=None,
        created_at="2026-01-01T00:00:00Z",
    )
    assert c.rating == 4
    assert c.comment is None


def test_summary_defaults_gallery_empty():
    s = SkillCompletionsSummary(skill_id="s1", avg_rating=0.0, count=0)
    assert s.gallery == []


def test_gallery_item_shape():
    g = CompletionGalleryItem(
        photo_url="https://x/completions/a.jpeg",
        rating=5,
        comment="ok",
        created_at="2026-01-01T00:00:00Z",
        user_display_name="Budi",
    )
    assert g.user_display_name == "Budi"
