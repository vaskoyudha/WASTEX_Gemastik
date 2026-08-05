from dataclasses import dataclass, field

from app.config import get_settings
from app.rag.embeddings import embed_query
from app.rag.reranker import rerank
from supabase import Client


@dataclass
class RetrievedChunk:
    chunk_id: str
    source_type: str = "skill"
    source_id: str = ""
    content: str = ""
    metadata: dict = field(default_factory=dict)
    rrf_score: float = 0.0
    rerank_score: float = 0.0


async def search_corpus(
    sb: Client, query: str, material: str | None = None
) -> list[RetrievedChunk]:
    s = get_settings()
    try:
        embedding = await embed_query(query)
    except Exception:
        return []
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
            source_type=r.get("source_type", "skill"),
            source_id=r.get("source_id", r.get("skill_id", "")),
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
