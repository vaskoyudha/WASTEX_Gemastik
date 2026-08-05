from app.agent.tools.retrieval import search_corpus
from tests.fakes import FakeResult, FakeSupabase


def _rows():
    return [
        {
            "chunk_id": "c1",
            "source_type": "skill",
            "source_id": "s1",
            "content": "pot dari botol",
            "metadata": {"material": "plastik_pet"},
            "score": 0.5,
        },
        {
            "chunk_id": "c2",
            "source_type": "document",
            "source_id": "d1",
            "content": "cuci botol dahulu",
            "metadata": {"materials": ["plastik_pet"]},
            "score": 0.4,
        },
    ]


async def _embed(query):
    return [0.1] * 1024


async def _rerank(query, documents):
    return list(range(len(documents)))


def test_search_corpus_maps_source_type_and_id(monkeypatch):
    fake = FakeSupabase()
    fake.rpc = lambda name, params: FakeResult(_rows())
    monkeypatch.setattr("app.agent.tools.retrieval.embed_query", _embed)
    monkeypatch.setattr("app.agent.tools.retrieval.rerank", _rerank)
    chunks = asyncio_run(search_corpus(fake, "pot botol"))
    assert [c.source_type for c in chunks] == ["document", "skill"]
    assert chunks[0].source_id == "d1"
    assert chunks[1].source_id == "s1"


def test_search_corpus_empty_when_embedding_fails(monkeypatch):
    fake = FakeSupabase()

    async def boom(query):
        raise RuntimeError("provider down")

    monkeypatch.setattr("app.agent.tools.retrieval.embed_query", boom)
    assert asyncio_run(search_corpus(fake, "pot")) == []


def test_search_corpus_truncates_to_rerank_top_k(monkeypatch):
    fake = FakeSupabase()
    fake.rpc = lambda name, params: FakeResult(
        [
            {
                "chunk_id": f"c{i}",
                "source_type": "skill",
                "source_id": f"s{i}",
                "content": f"teks {i}",
                "metadata": {},
                "score": 0.1,
            }
            for i in range(8)
        ]
    )
    monkeypatch.setattr("app.agent.tools.retrieval.embed_query", _embed)
    monkeypatch.setattr("app.agent.tools.retrieval.rerank", _rerank)
    chunks = asyncio_run(search_corpus(fake, "pot"))
    assert len(chunks) == 5  # settings.rerank_top_k default


def asyncio_run(coro):
    import asyncio

    return asyncio.new_event_loop().run_until_complete(coro)
