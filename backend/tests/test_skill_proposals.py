import pytest
from pydantic import ValidationError

from app.agent.tools.skill_proposals import (
    SKILL_PROPOSAL_PROMPT,
    SKILL_VERIFY_PROMPT,
    _build_proposal_messages,
    _build_verify_messages,
    _parse_proposals,
    _parse_verdict,
)
from app.schemas import SkillProposal

VALID_PROPOSAL = {
    "title": "Pot Gantung dari Botol PET",
    "description": "Botol PET dipotong dan dihias menjadi pot gantung.",
    "material": "plastik_pet",
    "difficulty": "pemula",
    "steps": [
        {"order": 1, "instruction": "Cuci botol hingga bersih", "warning": "Pakai sarung tangan"},
    ],
    "tools": [{"name": "gunting"}],
    "est_cost_idr": 5000,
    "est_price_idr": 20000,
}


def test_proposal_prompt_restricts_material():
    assert "HANYA" in SKILL_PROPOSAL_PROMPT
    assert "material" in SKILL_PROPOSAL_PROMPT
    assert "DILARANG" in SKILL_PROPOSAL_PROMPT


def test_proposal_prompt_lists_all_six_materials():
    for m in ("plastik_pet", "plastik_hdpe", "kardus", "kaleng", "kaca", "sachet"):
        assert m in SKILL_PROPOSAL_PROMPT


def test_proposal_prompt_has_steps_and_safety():
    assert "peringatan keamanan" in SKILL_PROPOSAL_PROMPT
    assert "steps" in SKILL_PROPOSAL_PROMPT


def test_verify_prompt_checks_four_aspects():
    for aspect in ("Kesesuaian material", "Kelayakan", "Keamanan", "Kelengkapan"):
        assert aspect in SKILL_VERIFY_PROMPT


def test_verify_prompt_has_layak_verdict():
    assert "layak" in SKILL_VERIFY_PROMPT


def test_parse_proposals_keeps_matching_material_only():
    payload = {
        "proposals": [
            VALID_PROPOSAL,
            {**VALID_PROPOSAL, "material": "kaca"},
        ]
    }
    result = _parse_proposals(payload, "plastik_pet")
    assert len(result) == 1
    assert result[0].title == "Pot Gantung dari Botol PET"


def test_parse_proposals_skips_invalid_items():
    payload = {"proposals": [VALID_PROPOSAL, {"title": "x", "material": "baja"}]}
    result = _parse_proposals(payload, "plastik_pet")
    assert len(result) == 1


def test_parse_proposals_empty_when_none():
    assert _parse_proposals({"proposals": []}, "kardus") == []


def test_parse_verdict_valid():
    r = _parse_verdict(
        {"verdict": "perbaiki", "feedback": ["Tambah peringatan"], "suggestions": []}
    )
    assert r.verdict == "perbaiki"


def test_parse_verdict_rejects_invalid():
    with pytest.raises(ValidationError):
        _parse_verdict({"verdict": "nope"})


def test_build_proposal_messages_formats_without_errors():
    msgs = _build_proposal_messages("kardus", "basah")
    assert msgs[0]["role"] == "user"
    assert "kardus" in msgs[0]["content"]
    assert "basah" in msgs[0]["content"]
    assert "{material}" not in msgs[0]["content"]
    assert "{condition}" not in msgs[0]["content"]


def test_build_verify_messages_includes_draft():
    draft = SkillProposal.model_validate(VALID_PROPOSAL)
    msgs = _build_verify_messages(draft, [])
    assert msgs[0]["role"] == "user"
    assert "Pot Gantung" in msgs[0]["content"]
    assert "{verdict}" not in msgs[0]["content"]


def test_build_verify_messages_appends_history():
    draft = SkillProposal.model_validate(VALID_PROPOSAL)
    history = [{"role": "user", "content": "cek lagi"}]
    msgs = _build_verify_messages(draft, history)
    assert len(msgs) == 2
    assert msgs[1] == history[0]
