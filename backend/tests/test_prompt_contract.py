"""Every LLM prompt follows the same behavioral contract:

- Iron Law: a hard, non-negotiable rule.
- MUST/NEVER style rules.
- Red Flags: conditions the model must guard against.
- Self-Check: verification before answering.
"""

from app.agent.orchestrator import GROUNDING_PROMPT
from app.agent.selling import SELLING_PROMPT
from app.agent.tools.discovery import DRAFT_PROMPT, SAFETY_RUBRIC
from app.agent.tools.skill_proposals import (
    SKILL_EXPAND_PROMPT,
    SKILL_IDEA_PROMPT,
    SKILL_PROPOSAL_PROMPT,
    SKILL_VERIFY_PROMPT,
    SKILL_VERIFY_REPAIR_PROMPT,
)
from app.agent.tools.vision import IDENTITY_PROMPT, VISION_PROMPT
from app.rag.bootstrap import SEED_PROMPT

ALL_PROMPTS = {
    "GROUNDING_PROMPT": GROUNDING_PROMPT,
    "SELLING_PROMPT": SELLING_PROMPT,
    "DRAFT_PROMPT": DRAFT_PROMPT,
    "SAFETY_RUBRIC": SAFETY_RUBRIC,
    "SKILL_PROPOSAL_PROMPT": SKILL_PROPOSAL_PROMPT,
    "SKILL_IDEA_PROMPT": SKILL_IDEA_PROMPT,
    "SKILL_EXPAND_PROMPT": SKILL_EXPAND_PROMPT,
    "SKILL_VERIFY_PROMPT": SKILL_VERIFY_PROMPT,
    "SEED_PROMPT": SEED_PROMPT,
    "VISION_PROMPT": VISION_PROMPT,
    "IDENTITY_PROMPT": IDENTITY_PROMPT,
}


def test_all_prompts_have_iron_law():
    for name, prompt in ALL_PROMPTS.items():
        assert "Iron Law" in prompt, name


def test_all_prompts_have_must_or_never_rules():
    for name, prompt in ALL_PROMPTS.items():
        assert "MUST" in prompt or "NEVER" in prompt or "WAJIB" in prompt, name


def test_all_prompts_have_red_flags():
    for name, prompt in ALL_PROMPTS.items():
        assert "Red Flags" in prompt, name


def test_all_prompts_have_self_check():
    for name, prompt in ALL_PROMPTS.items():
        assert "Self-Check" in prompt, name


def test_idea_prompt_forbids_step_details():
    # Format output fase 1 tidak boleh memuat kunci detail (steps/tools),
    # meskipun aturan boleh menyebut kata-kata itu untuk melarangnya.
    assert '"steps"' not in SKILL_IDEA_PROMPT
    assert '"tools"' not in SKILL_IDEA_PROMPT
    assert "visual_description" not in SKILL_IDEA_PROMPT


def test_idea_prompt_asks_three_ideas():
    assert "3 ide" in SKILL_IDEA_PROMPT


def test_expand_prompt_keeps_idea_fields():
    assert "idea_json" in SKILL_EXPAND_PROMPT
    assert "Judul dan description WAJIB TETAP SAMA PERSIS" in SKILL_EXPAND_PROMPT


def test_skill_prompts_require_tool_descriptions():
    for prompt in (SKILL_EXPAND_PROMPT, SKILL_PROPOSAL_PROMPT, SKILL_VERIFY_REPAIR_PROMPT):
        assert '"description": "..."' in prompt
        assert "tools" in prompt
    assert "tools.description kosong" in SKILL_VERIFY_PROMPT
