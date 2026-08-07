import asyncio
import time

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
from app.schemas import SkillIdea, SkillProposal

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
    _parse_ideas,
    _parse_single_proposal,
    expand_proposal,
    generate_ideas,
    generate_proposals,
    verify_draft,
)

VALID_PAYLOAD = {"proposals": [VALID_PROPOSAL]}
IDEA = {
    "title": "Pot Gantung dari Botol PET",
    "description": "Botol PET diubah menjadi pot gantung sederhana.",
    "material": "plastik_pet",
    "difficulty": "pemula",
    "est_cost_idr": 5000,
    "est_price_idr": 20000,
}
IDEAS_PAYLOAD = {"ideas": [IDEA, {**IDEA, "title": "Pot Gantung B"}]}
EXPAND_PAYLOAD = {"proposal": VALID_PROPOSAL}
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
            {"order": 2, "instruction": "Buka bagian atas botol dengan cutter", "warning": None},
            {"order": 3, "instruction": "Lubangi dasar botol untuk drainase", "warning": None},
            {"order": 4, "instruction": "Isi tanah dan tanam", "warning": None},
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
    make, client = _factory([VALID_PAYLOAD, PERBAIKI_PAYLOAD, REPAIRED_PAYLOAD, KONTINU_PAYLOAD])
    result = await generate_proposals("plastik_pet", "bersih", client_factory=make)
    assert len(result) == 1
    assert result[0].title == "Pot Gantung dari Botol PET (diperbaiki)"
    assert len(result[0].steps) == 4
    assert client.post_calls == 4  # generate + kritik + repair + re-kritik


class SlowClient(FakeClient):
    async def post(self, url, headers, json):
        await asyncio.sleep(0.05)
        return await super().post(url, headers, json)


async def test_generate_proposals_repairs_flagged_proposals_in_parallel():
    _, client = _factory(
        [
            {"proposals": [VALID_PROPOSAL, {**VALID_PROPOSAL, "title": "Pot Gantung B"}]},
            {
                "critiques": [
                    {"index": 0, "verdict": "perbaiki", "steps": [], "suggestions": ["x"]},
                    {"index": 1, "verdict": "perbaiki", "steps": [], "suggestions": ["y"]},
                ]
            },
            REPAIRED_PAYLOAD,
            REPAIRED_PAYLOAD,
            KONTINU_PAYLOAD,
        ],
        failures=0,
    )
    slow = SlowClient(client._payloads)
    start = time.monotonic()
    result = await generate_proposals("plastik_pet", "bersih", client_factory=lambda **kw: slow)
    elapsed = time.monotonic() - start
    assert len(result) == 2
    assert result[0].title == "Pot Gantung dari Botol PET (diperbaiki)"
    assert result[1].title == "Pot Gantung dari Botol PET (diperbaiki)"
    assert elapsed < 0.25, f"repair tidak paralel: {elapsed:.3f}s"


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
    make, client = _factory([VERDICT_PAYLOAD])
    result = await verify_draft(draft, [], client_factory=make)
    assert result.verdict == "layak"
    assert result.draft == draft
    assert result.auto_repaired is False
    assert client.post_calls == 1


async def test_verify_draft_repairs_once_then_verifies_again():
    draft = SkillProposal.model_validate(VALID_PROPOSAL)
    first_verdict = {
        "verdict": "perbaiki",
        "feedback": ["Peringatan pada langkah memotong belum cukup spesifik."],
        "suggestions": ["Tambahkan peringatan penggunaan sarung tangan."],
    }
    repaired = {
        "proposal": {
            **VALID_PROPOSAL,
            "steps": [
                {
                    "order": 1,
                    "instruction": "Cuci dan keringkan botol hingga bersih",
                    "warning": None,
                    "visual_description": "Botol tampak bersih dan kering. Tangan memegang botol di atas meja kerja.",
                },
                {
                    "order": 2,
                    "instruction": "Potong sisi botol menggunakan cutter",
                    "warning": "Gunakan sarung tangan dan arahkan cutter menjauh dari tubuh.",
                    "visual_description": "Tangan bersarung memotong sisi botol. Mata cutter mengarah menjauh dari tubuh.",
                },
            ],
        }
    }
    make, client = _factory([first_verdict, repaired, VERDICT_PAYLOAD])

    result = await verify_draft(draft, [], client_factory=make)

    assert result.verdict == "layak"
    assert result.auto_repaired is True
    assert result.draft is not None
    assert len(result.draft.steps) == 2
    assert "sarung tangan" in (result.draft.steps[1].warning or "")
    assert client.post_calls == 3


async def test_verify_draft_fails_when_repair_changes_identity():
    draft = SkillProposal.model_validate(VALID_PROPOSAL)
    first_verdict = {
        "verdict": "perbaiki",
        "feedback": ["Langkah belum aman."],
        "suggestions": ["Tambahkan warning."],
    }
    invalid_repair = {"proposal": {**VALID_PROPOSAL, "title": "Ide yang berbeda"}}
    make, client = _factory([first_verdict, invalid_repair])

    with pytest.raises(SkillGenUnavailable, match="changed the original skill identity"):
        await verify_draft(draft, [], client_factory=make)

    assert client.post_calls == 2


async def test_verify_draft_repeats_repair_until_layak():
    draft = SkillProposal.model_validate(VALID_PROPOSAL)
    needs_repair = {
        "verdict": "perbaiki",
        "feedback": ["Langkah belum aman."],
        "suggestions": ["Tambahkan warning yang spesifik."],
    }
    first_repair = {"proposal": VALID_PROPOSAL}
    second_repair = {
        "proposal": {
            **VALID_PROPOSAL,
            "steps": [
                {
                    "order": 1,
                    "instruction": "Cuci botol hingga bersih",
                    "warning": "Gunakan sarung tangan selama proses pembersihan.",
                }
            ],
        }
    }
    make, client = _factory(
        [needs_repair, first_repair, needs_repair, second_repair, VERDICT_PAYLOAD]
    )

    result = await verify_draft(draft, [], client_factory=make)

    assert result.verdict == "layak"
    assert result.auto_repaired is True
    assert result.draft == SkillProposal.model_validate(second_repair["proposal"])
    assert client.post_calls == 5


async def test_verify_draft_fails_instead_of_returning_perbaiki_after_repair_limit():
    draft = SkillProposal.model_validate(VALID_PROPOSAL)
    needs_repair = {
        "verdict": "perbaiki",
        "feedback": ["Langkah belum aman."],
        "suggestions": ["Tambahkan warning yang spesifik."],
    }
    unchanged_repair = {"proposal": VALID_PROPOSAL}
    make, client = _factory(
        [
            needs_repair,
            unchanged_repair,
            needs_repair,
            unchanged_repair,
            needs_repair,
            unchanged_repair,
            needs_repair,
        ]
    )

    with pytest.raises(SkillGenUnavailable, match="automatic repairs"):
        await verify_draft(draft, [], client_factory=make)

    assert client.post_calls == 7


def _proposal_with_steps(steps):
    return SkillProposal.model_validate({**VALID_PROPOSAL, "steps": steps})


def test_find_missing_prerequisites_flags_closed_container():
    from app.agent.tools.skill_proposals import find_missing_prerequisites

    p = _proposal_with_steps(
        [
            {"order": 1, "instruction": "Cuci kaleng hingga bersih", "warning": None},
            {"order": 2, "instruction": "Lubangi dasar kaleng untuk drainase", "warning": None},
            {"order": 3, "instruction": "Cat permukaan kaleng", "warning": None},
            {"order": 4, "instruction": "Isi kaleng dengan tanah hingga 2/3", "warning": None},
        ]
    )
    issues = find_missing_prerequisites(p)
    assert any("bagian atas wadah" in i.missing_prerequisite for i in issues)
    assert issues[0].order == 4


def test_find_missing_prerequisites_ok_when_top_opened():
    from app.agent.tools.skill_proposals import find_missing_prerequisites

    p = _proposal_with_steps(
        [
            {"order": 1, "instruction": "Cuci kaleng hingga bersih", "warning": None},
            {
                "order": 2,
                "instruction": "Buka bagian atas kaleng dengan pembuka kaleng",
                "warning": None,
            },
            {"order": 3, "instruction": "Lubangi dasar kaleng untuk drainase", "warning": None},
            {"order": 4, "instruction": "Isi kaleng dengan tanah hingga 2/3", "warning": None},
        ]
    )
    assert find_missing_prerequisites(p) == []


def test_find_missing_prerequisites_tali_without_lubang():
    from app.agent.tools.skill_proposals import find_missing_prerequisites

    p = _proposal_with_steps(
        [
            {"order": 1, "instruction": "Potong botol jadi dua", "warning": None},
            {"order": 2, "instruction": "Ikatkan tali pada bagian atas", "warning": None},
        ]
    )
    issues = find_missing_prerequisites(p)
    assert any("tali/pengait" in i.missing_prerequisite for i in issues)


def test_find_missing_prerequisites_cat_after_kering_ok():
    from app.agent.tools.skill_proposals import find_missing_prerequisites

    p = _proposal_with_steps(
        [
            {"order": 1, "instruction": "Cuci dan keringkan permukaan", "warning": None},
            {"order": 2, "instruction": "Cat permukaan dengan cat akrilik", "warning": None},
        ]
    )
    assert find_missing_prerequisites(p) == []


def test_find_missing_prerequisites_ignores_open_top_for_open_materials():
    from app.agent.tools.skill_proposals import find_missing_prerequisites

    p = SkillProposal.model_validate(
        {
            **VALID_PROPOSAL,
            "material": "kardus",
            "steps": [
                {"order": 1, "instruction": "Isi kotak kardus dengan tanah", "warning": None},
            ],
        }
    )
    issues = find_missing_prerequisites(p)
    assert not any("bagian atas wadah" in i.missing_prerequisite for i in issues)


# ---- Two-phase: ideas (ringkas) lalu expand (detail) ----


def test_parse_ideas_keeps_matching_material_only():
    result = _parse_ideas({"ideas": [IDEA, {**IDEA, "material": "kaca"}]}, "plastik_pet")
    assert len(result) == 1
    assert isinstance(result[0], SkillIdea)
    assert result[0].title == "Pot Gantung dari Botol PET"


def test_parse_ideas_skips_invalid_items():
    result = _parse_ideas({"ideas": [IDEA, {"title": "x"}]}, "plastik_pet")
    assert len(result) == 1


def test_parse_ideas_empty_when_none():
    assert _parse_ideas({"ideas": []}, "plastik_pet") == []


async def test_generate_ideas_single_llm_call_no_repair_loop():
    make, client = _factory([IDEAS_PAYLOAD])
    result = await generate_ideas("plastik_pet", "bersih", client_factory=make)
    assert len(result) == 2
    assert isinstance(result[0], SkillIdea)
    assert client.post_calls == 1  # satu panggilan ringkas, tanpa kritik/repair


async def test_generate_ideas_falls_back_to_next_model():
    make, client = _factory([IDEAS_PAYLOAD, IDEAS_PAYLOAD], failures=1)
    result = await generate_ideas("plastik_pet", "bersih", client_factory=make)
    assert len(result) == 2
    assert client.post_calls == 2


async def test_expand_proposal_single_llm_call_deterministic_fix():
    """expand_proposal now uses exactly 1 LLM call + deterministic fixes."""
    make, client = _factory([EXPAND_PAYLOAD])
    idea = SkillIdea.model_validate(IDEA)
    result = await expand_proposal("plastik_pet", "bersih", idea, client_factory=make)
    assert result.title == "Pot Gantung dari Botol PET"
    assert len(result.steps) >= 1
    assert client.post_calls == 1  # single LLM call, no critique/repair loop


async def test_expand_proposal_auto_inserts_missing_prerequisite_steps():
    """When steps mention soil/planting without drainage, a drainage step is auto-inserted."""
    payload_missing_drainage = {
        "proposal": {
            **VALID_PROPOSAL,
            "material": "kaleng",
            "steps": [
                {"order": 1, "instruction": "Cuci kaleng hingga bersih", "warning": None},
                {
                    "order": 2,
                    "instruction": "Isi kaleng dengan tanah dan tanam bibit",
                    "warning": None,
                },
            ],
        }
    }
    make, client = _factory([payload_missing_drainage])
    idea = SkillIdea.model_validate({**IDEA, "material": "kaleng"})
    result = await expand_proposal("kaleng", "bersih", idea, client_factory=make)
    assert client.post_calls == 1  # no extra LLM calls for repair
    instructions = [s.instruction for s in result.steps]
    assert any("drainase" in inst.lower() for inst in instructions)
    assert len(result.steps) > 2  # at least one step was auto-inserted


# ---- Deterministic material auto-add (B+D) ----


def test_find_missing_materials_detects_undeclared_step_material():
    from app.agent.tools.skill_proposals import find_missing_materials

    p = SkillProposal.model_validate(
        {
            **VALID_PROPOSAL,
            "steps": [
                {
                    "order": 1,
                    "instruction": "Bersihkan dengan alkohol lalu keringkan",
                    "warning": None,
                },
            ],
            "additional_materials": [],
        }
    )
    missing = find_missing_materials(p)
    assert any(m.name == "alkohol" for m in missing)


def test_find_missing_materials_ignores_declared_material():
    from app.agent.tools.skill_proposals import find_missing_materials

    p = SkillProposal.model_validate(
        {
            **VALID_PROPOSAL,
            "steps": [
                {
                    "order": 1,
                    "instruction": "Bersihkan dengan alkohol lalu keringkan",
                    "warning": None,
                },
            ],
            "additional_materials": [
                {
                    "name": "alkohol",
                    "category": "lainnya",
                    "est_cost_idr": 5000,
                    "purpose": "membersihkan permukaan",
                }
            ],
        }
    )
    assert find_missing_materials(p) == []


def test_find_missing_materials_ignores_tool_not_material():
    from app.agent.tools.skill_proposals import find_missing_materials

    p = SkillProposal.model_validate(
        {
            **VALID_PROPOSAL,
            "steps": [
                {"order": 1, "instruction": "Gunting botol dengan gunting logam", "warning": None},
            ],
            "tools": [{"name": "gunting"}],
            "additional_materials": [],
        }
    )
    assert find_missing_materials(p) == []


def test_find_missing_materials_matches_warning_too():
    from app.agent.tools.skill_proposals import find_missing_materials

    p = SkillProposal.model_validate(
        {
            **VALID_PROPOSAL,
            "steps": [
                {
                    "order": 1,
                    "instruction": "Potong kaleng",
                    "warning": "Pakai sarung tangan dan amplas tepi",
                },
            ],
            "additional_materials": [],
        }
    )
    missing = find_missing_materials(p)
    assert any(m.name == "amplas" for m in missing)


async def test_expand_proposal_auto_adds_undeclared_step_materials():
    make, client = _factory(
        [
            {
                "proposal": {
                    **VALID_PROPOSAL,
                    "steps": [
                        {
                            "order": 1,
                            "instruction": "Bersihkan dengan alkohol lalu keringkan",
                            "warning": None,
                        },
                    ],
                    "additional_materials": [],
                }
            },
        ]
    )
    idea = SkillIdea.model_validate(IDEA)
    result = await expand_proposal("plastik_pet", "bersih", idea, client_factory=make)
    assert any(m.name == "alkohol" for m in result.additional_materials)
    assert client.post_calls == 1  # single LLM call; auto-add is deterministic
