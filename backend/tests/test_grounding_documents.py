from app.agent.orchestrator import GROUNDING_PROMPT, generate_solution
from app.agent.tools.retrieval import RetrievedChunk
from app.schemas import SolutionPackage


class FakeAgentResult:
    def __init__(self, output):
        self.output = output


class FakeAgent:
    def __init__(self):
        self.prompt = None

    async def run(self, prompt):
        self.prompt = prompt
        return FakeAgentResult(SolutionPackage(recommendation="Buat pot.", sources=["skill:s1"]))


def test_generate_solution_labels_document_chunks(monkeypatch):
    agent = FakeAgent()
    monkeypatch.setattr("app.agent.orchestrator.generation_agent", lambda: agent)
    chunks = [
        RetrievedChunk(chunk_id="c1", source_type="skill", source_id="s1", content="langkah a"),
        RetrievedChunk(
            chunk_id="c2", source_type="document", source_id="d1", content="panduan cuci"
        ),
    ]
    out = asyncio_run(generate_solution("pot", chunks))
    assert out.recommendation == "Buat pot."
    assert "[skill_id: s1]" in agent.prompt
    assert "[document_id: d1]" in agent.prompt


def test_grounding_prompt_mentions_document_citation():
    assert "document_id" in GROUNDING_PROMPT


def asyncio_run(coro):
    import asyncio

    return asyncio.new_event_loop().run_until_complete(coro)
