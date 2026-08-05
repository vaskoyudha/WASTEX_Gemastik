"""Ingest the 3 key whitelist documents into the RAG corpus.

Usage (from backend/):
    uv run python scripts/ingest_documents.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import corpus_common as cc

from app.deps import get_supabase
from app.rag.bootstrap import load_sources

DOC_IDS = [
    "dlhk-banten-limbah-anorganik",
    "identif-tas-dompet-sachet",
    "bisnisukm-tas-dompet-daur-ulang",
]


async def main() -> int:
    sb = get_supabase()
    sources = {s["id"]: s for s in load_sources()}
    failed = 0
    for doc_id in DOC_IDS:
        source = sources.get(doc_id)
        if not source:
            print(f"SKIP {doc_id}: tidak ada di sources.yaml")
            continue
        result = await cc.ingest_document_source(sb, source)
        if result.get("skipped"):
            print(f"SKIP {doc_id}: URL sudah ada")
        elif "error" in result:
            failed += 1
            print(f"FAIL {doc_id}: {result['error']}")
        else:
            print(f"OK {doc_id}: {result['chunks']} chunks")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
