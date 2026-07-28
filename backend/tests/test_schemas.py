import pytest
from pydantic import ValidationError

from app.schemas import (
    Material,
    MaterialIdentification,
    RecommendRequest,
    SkillDraft,
    SolutionPackage,
)


def test_confidence_upper_bound() -> None:
    with pytest.raises(ValidationError):
        MaterialIdentification(material=Material.kaca, condition="utuh", confidence=1.5)


def test_confidence_lower_bound() -> None:
    with pytest.raises(ValidationError):
        MaterialIdentification(material=Material.kaca, condition="utuh", confidence=-0.1)


def test_unknown_material_rejected() -> None:
    with pytest.raises(ValidationError):
        MaterialIdentification(material="styrofoam", condition="x", confidence=0.5)


def test_recommend_request_requires_user_intent() -> None:
    with pytest.raises(ValidationError):
        RecommendRequest()


def test_skill_draft_defaults_empty_lists() -> None:
    d = SkillDraft(title="Pot PET", material=Material.plastik_pet, difficulty="pemula")
    assert d.tools == [] and d.steps == [] and d.risks == [] and d.sources == []


def test_solution_package_sources_default() -> None:
    p = SolutionPackage(recommendation="tidak tersedia")
    assert p.sources == []
