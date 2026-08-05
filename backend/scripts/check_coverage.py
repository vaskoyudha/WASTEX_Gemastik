"""Verify retrieval coverage: every material must return a relevant chunk.

Usage (from backend/):
    uv run python scripts/check_coverage.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import corpus_common as cc

from app.agent.tools.retrieval import search_corpus
from app.deps import get_supabase


async def main() -> int:
    sb = get_supabase()
    results = []
    for material, query in cc.MATERIAL_QUERIES.items():
        chunks = await search_corpus(sb, query, material)
        scores = [c.rerank_score for c in chunks]
        top = chunks[0] if chunks else None
        results.append(
            {
                "material": material,
                "chunks": len(chunks),
                "top_source": top.source_type if top else None,
                "top_score": round(top.rerank_score, 2) if top else None,
                "pass": cc.coverage_pass(scores),
            }
        )
    print(cc.format_coverage_report(results))

    skills = sb.table("skills").select("id").eq("status", "approved").execute().data
    chunks = sb.table("skill_chunks").select("id").execute().data
    docs = sb.table("documents").select("id").execute().data
    doc_chunks = sb.table("document_chunks").select("id").execute().data
    print(
        f"\nkorpus: {len(skills)} skills approved, {len(chunks)} skill_chunks, "
        f"{len(docs)} dokumen, {len(doc_chunks)} document_chunks"
    )

    return 0 if all(r["pass"] for r in results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
