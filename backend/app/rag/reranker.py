import httpx

from app.config import get_settings


async def rerank(query: str, documents: list[str]) -> list[float]:
    if not documents:
        return []
    s = get_settings()
    url = f"https://api.deepinfra.com/v1/inference/{s.rerank_model}"
    async with httpx.AsyncClient(timeout=30) as client:
        for _ in range(2):
            try:
                r = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {s.deepinfra_api_key}"},
                    json={"queries": [query] * len(documents), "documents": documents},
                )
                r.raise_for_status()
                return r.json()["scores"]
            except httpx.HTTPError:
                continue
    return _keyword_scores(query, documents)


def _keyword_scores(query: str, documents: list[str]) -> list[float]:
    """Degraded-mode scoring by keyword overlap when the provider is down."""
    query_words = set(query.lower().split())
    if not query_words:
        return [0.0] * len(documents)
    return [len(query_words & set(doc.lower().split())) / len(query_words) for doc in documents]
