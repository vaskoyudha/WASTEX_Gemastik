from unittest.mock import AsyncMock, patch

import httpx

from app.rag.reranker import rerank


def _failing_client():
    client = AsyncMock()
    client.post.side_effect = httpx.ConnectError("DeepInfra down")
    client.__aenter__.return_value = client
    return client


async def test_reranker_fallback_when_provider_down():
    docs = ["botol plastik jadi pot", "kardus bekas", "lampu dari kaca"]
    with patch("app.rag.reranker.httpx.AsyncClient", return_value=_failing_client()):
        scores = await rerank("pot dari botol plastik", docs)
    assert len(scores) == len(docs)
    assert scores[0] > scores[1]


async def test_reranker_empty_documents():
    assert await rerank("query", []) == []
