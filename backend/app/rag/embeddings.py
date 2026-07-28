import hashlib
import math

import httpx

from app.config import get_settings

EMBED_URL = "https://api.deepinfra.com/v1/openai/embeddings"
EMBED_DIM = 1024


async def embed_texts(texts: list[str]) -> list[list[float]]:
    s = get_settings()
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
            except httpx.HTTPError:
                continue
    return [_hash_embedding(t) for t in texts]


def _hash_embedding(text: str, dim: int = EMBED_DIM) -> list[float]:
    """Deterministic degraded-mode embedding used when the provider is down."""
    raw = hashlib.sha256(text.encode()).digest()
    extended = (raw * (dim // len(raw) + 1))[:dim]
    norm = math.sqrt(sum(b * b for b in extended)) or 1.0
    return [b / norm for b in extended]


async def embed_query(text: str) -> list[float]:
    return (await embed_texts([text]))[0]
