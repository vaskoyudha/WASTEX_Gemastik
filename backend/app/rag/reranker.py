import httpx

from app.config import get_settings


async def rerank(query: str, documents: list[str]) -> list[float]:
    if not documents:
        return []
    s = get_settings()
    url = f"https://api.deepinfra.com/v1/inference/{s.rerank_model}"
    last_err: Exception | None = None
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
            except httpx.HTTPError as e:
                last_err = e
    raise RuntimeError("rerank provider unavailable") from last_err
