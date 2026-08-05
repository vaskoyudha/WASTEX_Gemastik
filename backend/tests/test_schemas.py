import pytest
from pydantic import ValidationError

from app.schemas import (
    AdditionalMaterial,
    Material,
    MaterialIdentification,
    RecommendRequest,
    SkillDraft,
    SkillProposal,
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


def test_step_accepts_visual_description() -> None:
    from app.schemas import Step

    s = Step(order=1, instruction="Potong botol", visual_description="Tangan memotong botol PET")
    assert s.visual_description == "Tangan memotong botol PET"
    assert Step(order=1, instruction="x").visual_description is None


def test_solution_package_accepts_est_time() -> None:
    from app.schemas import SolutionPackage

    p = SolutionPackage(recommendation="Vas", est_time_minutes=45)
    assert p.est_time_minutes == 45
    assert SolutionPackage(recommendation="Vas").est_time_minutes is None


def test_additional_material_defaults():
    m = AdditionalMaterial(
        name="tali", category="tali", est_cost_idr=2000, purpose="untuk gantungan"
    )
    assert m.est_cost_idr == 2000


def test_additional_material_unknown_category_rejected():
    with pytest.raises(ValidationError):
        AdditionalMaterial(name="x", category="nuklir")


def test_additional_material_rejects_negative_cost():
    with pytest.raises(ValidationError):
        AdditionalMaterial(name="tali", category="tali", est_cost_idr=-1)


def test_skill_proposal_accepts_additional_materials():
    p = SkillProposal.model_validate(
        {
            "title": "Pot dari Kaleng",
            "description": "Pot gantung dari kaleng bekas.",
            "material": "kaleng",
            "difficulty": "pemula",
            "additional_materials": [
                {
                    "name": "tali",
                    "category": "tali",
                    "est_cost_idr": 2000,
                    "purpose": "untuk gantungan",
                }
            ],
        }
    )
    assert p.additional_materials[0].name == "tali"


def test_skill_proposal_rejects_negative_est_cost():
    with pytest.raises(ValidationError):
        SkillProposal(
            title="Pot dari Kaleng",
            description="Pot gantung dari kaleng bekas.",
            material=Material.kaleng,
            difficulty="pemula",
            est_cost_idr=-5000,
        )
