from app.agent.orchestrator import GROUNDING_PROMPT, generate_solution
from app.agent.tools.retrieval import RetrievedChunk
from app.schemas import SolutionPackage


def test_generate_solution_labels_document_chunks(monkeypatch):
    captured = {}

    async def fake_chat_json(system, user, model, client_factory=None):
        captured["user"] = user
        return SolutionPackage(recommendation="Buat pot.", sources=["skill:s1"])

    monkeypatch.setattr("app.agent.orchestrator.chat_json", fake_chat_json)
    chunks = [
        RetrievedChunk(chunk_id="c1", source_type="skill", source_id="s1", content="langkah a"),
        RetrievedChunk(
            chunk_id="c2", source_type="document", source_id="d1", content="panduan cuci"
        ),
    ]
    out = asyncio_run(generate_solution("pot", chunks))
    assert out.recommendation == "Buat pot."
    assert "[skill_id: s1]" in captured["user"]
    assert "[document_id: d1]" in captured["user"]


def test_grounding_prompt_mentions_document_citation():
    assert "document_id" in GROUNDING_PROMPT


def test_generate_solution_uses_chat_json(monkeypatch):
    captured = {}

    async def fake_chat_json(system, user, model, client_factory=None):
        captured["system"] = system
        captured["user"] = user
        return SolutionPackage(recommendation="Buat pot dari s1.", sources=["skill:s1"])

    monkeypatch.setattr("app.agent.orchestrator.chat_json", fake_chat_json)
    chunks = [
        RetrievedChunk(chunk_id="c1", source_type="skill", source_id="s1", content="langkah a"),
    ]
    out = asyncio_run(generate_solution("pot", chunks))
    assert out.recommendation == "Buat pot dari s1."
    assert "[skill_id: s1]" in captured["user"]
    assert captured["system"] == GROUNDING_PROMPT


def asyncio_run(coro):
    import asyncio

    return asyncio.new_event_loop().run_until_complete(coro)
