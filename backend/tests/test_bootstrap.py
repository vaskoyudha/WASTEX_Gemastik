import pytest

import app.rag.bootstrap as bootstrap_module
from app.schemas import Material, SkillDraft
from tests.fakes import FakeSupabase


class FakeAgentResult:
    def __init__(self, output):
        self.output = output


class FakeAgent:
    def __init__(self, output):
        self._output = output
        self.prompts = []

    async def run(self, prompt):
        self.prompts.append(prompt)
        return FakeAgentResult(self._output)


async def test_drafts_one_skill_per_material_difficulty_cell(monkeypatch):
    fake_sb = FakeSupabase()
    draft = SkillDraft(title="Contoh", material=Material.kardus, difficulty="pemula")
    agent = FakeAgent(draft)
    monkeypatch.setattr(bootstrap_module, "load_sources", lambda: [{"id": "src-1"}])
    monkeypatch.setattr(bootstrap_module, "get_supabase", lambda: fake_sb)
    monkeypatch.setattr(bootstrap_module, "_seed_drafter", lambda: agent)

    count = await bootstrap_module.draft_seed_skills()

    assert count == 18  # 6 materials x 3 difficulties
    inserted = fake_sb.table("skills").inserted
    assert len(inserted) == 18
    assert all(row["status"] == "draft" and row["origin"] == "seed" for row in inserted)
    assert "plastik_pet" in agent.prompts[0]


async def test_refuses_to_run_without_sources(monkeypatch):
    monkeypatch.setattr(bootstrap_module, "load_sources", list)
    with pytest.raises(SystemExit):
        await bootstrap_module.draft_seed_skills()
