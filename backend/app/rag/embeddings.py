import httpx

from app.config import get_settings

EMBED_URL = "https://api.deepinfra.com/v1/openai/embeddings"


async def embed_texts(texts: list[str]) -> list[list[float]]:
    s = get_settings()
    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=30) as client:
        for _ in range(2):
            try:
                r = await client.post(
                    EMBED_URL,
                    headers={"Authorization": f"Bearer {s.deepinfra_api_key}"},
                    json={"model": s.embedding_model, "input": texts, "encoding_format": "float"},
                )
                r.raise_for_status()
                return [d["embedding"] for d in r.json()["data"]]
            except httpx.HTTPError as e:
                last_err = e
    raise RuntimeError("embedding provider unavailable") from last_err


async def embed_query(text: str) -> list[float]:
    return (await embed_texts([text]))[0]
