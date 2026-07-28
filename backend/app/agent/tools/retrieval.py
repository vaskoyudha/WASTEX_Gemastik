from dataclasses import dataclass

from app.config import get_settings
from app.rag.embeddings import embed_query
from app.rag.reranker import rerank
from supabase import Client


@dataclass
class RetrievedChunk:
    chunk_id: str
    skill_id: str
    content: str
    metadata: dict
    rrf_score: float
    rerank_score: float = 0.0


async def search_skills(sb: Client, query: str, material: str | None = None) -> list[RetrievedChunk]:
    s = get_settings()
    embedding = await embed_query(query)
    res = sb.rpc(
        "hybrid_search",
        {
            "query_embedding": embedding,
            "query_text": query,
            "material_filter": material,
            "match_count": s.retrieval_top_k,
        },
    ).execute()
    rows = res.data or []
    chunks = [
        RetrievedChunk(
            chunk_id=r["chunk_id"],
            skill_id=r["skill_id"],
            content=r["content"],
            metadata=r["metadata"],
            rrf_score=r["score"],
        )
        for r in rows
    ]
    if not chunks:
        return []
    scores = await rerank(query, [c.content for c in chunks])
    for c, score in zip(chunks, scores):
        c.rerank_score = score
    chunks.sort(key=lambda c: c.rerank_score, reverse=True)
    return chunks[: s.rerank_top_k]
