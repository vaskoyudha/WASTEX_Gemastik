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


def test_proposal_prompt_requires_additional_materials_declaration():
    assert "additional_materials" in SKILL_PROPOSAL_PROMPT
    assert "WAJIB dideklarasikan" in SKILL_PROPOSAL_PROMPT


def test_verify_prompt_allows_declared_additional_materials():
    assert "additional_materials" in SKILL_VERIFY_PROMPT
    assert "BUKAN pelanggaran" in SKILL_VERIFY_PROMPT


def test_verify_prompt_rejects_undeclared_materials():
    assert "tidak terdaftar" in SKILL_VERIFY_PROMPT


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


import json

from app.agent.tools.skill_proposals import (
    STEP_CONTINUITY_CRITIQUE_PROMPT,
    STEP_REPAIR_PROMPT,
    SkillGenUnavailable,
    _build_critique_messages,
    _build_repair_messages,
    _parse_critiques,
    _parse_single_proposal,
    generate_proposals,
    verify_draft,
)

VALID_PAYLOAD = {"proposals": [VALID_PROPOSAL]}
VERDICT_PAYLOAD = {"verdict": "layak", "feedback": [], "suggestions": []}
KONTINU_PAYLOAD = {"critiques": [{"index": 0, "verdict": "kontinu", "steps": []}]}
PERBAIKI_PAYLOAD = {
    "critiques": [
        {
            "index": 0,
            "verdict": "perbaiki",
            "steps": [
                {
                    "order": 2,
                    "missing_prerequisite": "lubang drainase",
                    "note": "isi tanah tanpa drainase",
                }
            ],
            "suggestions": ["tambahkan langkah melubangi dasar kaleng"],
        }
    ]
}
REPAIRED_PAYLOAD = {
    "proposal": {
        **VALID_PROPOSAL,
        "title": "Pot Gantung dari Botol PET (diperbaiki)",
        "steps": [
            {
                "order": 1,
                "instruction": "Cuci botol hingga bersih",
                "warning": "Pakai sarung tangan",
            },
            {"order": 2, "instruction": "Lubangi dasar botol untuk drainase", "warning": None},
            {"order": 3, "instruction": "Isi tanah dan tanam", "warning": None},
        ],
    }
}


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return {"choices": [{"message": {"content": json.dumps(self._payload)}}]}

    @property
    def text(self):
        return json.dumps(self.json())


class FakeClient:
    def __init__(self, payloads, failures=0):
        self._payloads = payloads
        self._failures = failures
        self.post_calls = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, headers, json):
        self.post_calls += 1
        if self.post_calls <= self._failures:
            raise RuntimeError("provider down")
        payload = self._payloads[min(self.post_calls - 1, len(self._payloads) - 1)]
        return FakeResponse(payload)


class FailingClient(FakeClient):
    async def post(self, url, headers, json):
        raise RuntimeError("provider down")


def _factory(payloads, failures=0):
    client = FakeClient(payloads, failures)
    return lambda **kw: client, client


async def test_generate_proposals_returns_parsed_list():
    make, client = _factory([VALID_PAYLOAD, KONTINU_PAYLOAD])
    result = await generate_proposals("plastik_pet", "bersih", client_factory=make)
    assert len(result) == 1
    assert isinstance(result[0], SkillProposal)
    assert client.post_calls == 2  # generate + kritik


async def test_generate_proposals_repairs_flagged_proposal():
    make, client = _factory([VALID_PAYLOAD, PERBAIKI_PAYLOAD, REPAIRED_PAYLOAD])
    result = await generate_proposals("plastik_pet", "bersih", client_factory=make)
    assert len(result) == 1
    assert result[0].title == "Pot Gantung dari Botol PET (diperbaiki)"
    assert len(result[0].steps) == 3
    assert client.post_calls == 3  # generate + kritik + repair


async def test_generate_proposals_keeps_proposal_when_critique_fails():
    make, client = _factory([VALID_PAYLOAD, VALID_PAYLOAD])
    result = await generate_proposals("plastik_pet", "bersih", client_factory=make)
    assert len(result) == 1
    assert result[0].title == "Pot Gantung dari Botol PET"
    assert client.post_calls == 5  # 1 generate + 4 percobaan kritik yang gagal parse


async def test_generate_proposals_retries_then_falls_back():
    make, client = _factory(
        [VALID_PAYLOAD, VALID_PAYLOAD, VALID_PAYLOAD, VALID_PAYLOAD, KONTINU_PAYLOAD],
        failures=3,
    )
    result = await generate_proposals("plastik_pet", "bersih", client_factory=make)
    assert len(result) == 1
    assert client.post_calls == 5  # 2 retry chat + 2 fallback + 1 kritik


async def test_generate_proposals_raises_when_all_fail():
    client = FailingClient([VALID_PAYLOAD])
    with pytest.raises(SkillGenUnavailable):
        await generate_proposals("plastik_pet", "bersih", client_factory=lambda **kw: client)


def test_parse_critiques_valid():
    result = _parse_critiques(PERBAIKI_PAYLOAD)
    assert len(result) == 1
    assert result[0].verdict == "perbaiki"
    assert result[0].steps[0].missing_prerequisite == "lubang drainase"


def test_parse_single_proposal_valid():
    result = _parse_single_proposal(REPAIRED_PAYLOAD)
    assert result.title == "Pot Gantung dari Botol PET (diperbaiki)"


def test_build_critique_messages_includes_proposals():
    draft = SkillProposal.model_validate(VALID_PROPOSAL)
    msgs = _build_critique_messages([draft])
    assert msgs[0]["role"] == "user"
    assert "Pot Gantung" in msgs[0]["content"]
    assert "{material}" not in msgs[0]["content"]


def test_build_repair_messages_includes_draft_and_gaps():
    draft = SkillProposal.model_validate(VALID_PROPOSAL)
    critique = _parse_critiques(PERBAIKI_PAYLOAD)[0]
    msgs = _build_repair_messages(draft, critique)
    assert msgs[0]["role"] == "user"
    assert "Pot Gantung" in msgs[0]["content"]
    assert "lubang drainase" in msgs[0]["content"]
    assert "{draft_json}" not in msgs[0]["content"]


def test_critique_prompt_has_contract_sections():
    for section in ("Iron Law", "Aturan", "Red Flags", "Self-Check"):
        assert section in STEP_CONTINUITY_CRITIQUE_PROMPT


def test_repair_prompt_has_contract_sections():
    for section in ("Iron Law", "Aturan", "Red Flags"):
        assert section in STEP_REPAIR_PROMPT


async def test_verify_draft_returns_verdict():
    draft = SkillProposal.model_validate(VALID_PROPOSAL)
    make, _ = _factory([VERDICT_PAYLOAD])
    result = await verify_draft(draft, [], client_factory=make)
    assert result.verdict == "layak"
