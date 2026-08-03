import pytest
from pydantic import ValidationError

from app.schemas import (
    Material,
    SkillCreateRequest,
    SkillProposal,
    SkillVerifyRequest,
    SkillVerifyResponse,
)

VALID = {
    "title": "Pot Tanaman dari Botol PET",
    "description": "Mengubah botol PET bekas menjadi pot gantung sederhana.",
    "material": "plastik_pet",
    "difficulty": "pemula",
    "steps": [{"order": 1, "instruction": "Cuci botol", "warning": "Gunakan sarung tangan"}],
    "tools": [{"name": "gunting", "optional": False}],
    "est_cost_idr": 5000,
    "est_price_idr": 25000,
}


def test_skill_proposal_accepts_valid_draft():
    p = SkillProposal.model_validate(VALID)
    assert p.material == Material.plastik_pet
    assert p.steps[0].warning == "Gunakan sarung tangan"


def test_skill_proposal_rejects_unknown_material():
    with pytest.raises(ValidationError):
        SkillProposal.model_validate({**VALID, "material": "baja"})


def test_skill_proposal_rejects_invalid_difficulty():
    with pytest.raises(ValidationError):
        SkillProposal.model_validate({**VALID, "difficulty": "sulit"})


def test_skill_verify_response_verdict_restricted():
    with pytest.raises(ValidationError):
        SkillVerifyResponse.model_validate({"verdict": "maybe"})


def test_skill_verify_response_defaults_empty_lists():
    r = SkillVerifyResponse.model_validate({"verdict": "layak"})
    assert r.feedback == []
    assert r.suggestions == []


def test_skill_verify_request_holds_draft_and_history():
    req = SkillVerifyRequest.model_validate(
        {"draft": VALID, "chat_history": [{"role": "user", "content": "tolong cek"}]}
    )
    assert req.draft.title == VALID["title"]
    assert req.chat_history[0]["role"] == "user"


def test_skill_create_request_inherits_proposal():
    req = SkillCreateRequest.model_validate(VALID)
    assert req.title == VALID["title"]
    assert req.material.value == "plastik_pet"
