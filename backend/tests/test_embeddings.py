from unittest.mock import AsyncMock, patch

import httpx

from app.rag.embeddings import EMBED_DIM, embed_query, embed_texts


def _failing_client():
    client = AsyncMock()
    client.post.side_effect = httpx.ConnectError("DeepInfra down")
    client.__aenter__.return_value = client
    return client


async def test_embedding_fallback_when_provider_down():
    with patch("app.rag.embeddings.httpx.AsyncClient", return_value=_failing_client()):
        result = await embed_texts(["test text", "lain"])
    assert len(result) == 2
    assert all(len(v) == EMBED_DIM for v in result)


async def test_embedding_fallback_is_deterministic_and_normalized():
    with patch("app.rag.embeddings.httpx.AsyncClient", return_value=_failing_client()):
        a = await embed_query("test text")
        b = await embed_query("test text")
    assert a == b
    norm = sum(x * x for x in a)
    assert abs(norm - 1.0) < 1e-6
