"""Seed the RAG corpus: draft skills per (material x difficulty) from the
sources.yaml whitelist, safety-check each draft, and emit a review report.

Usage (from backend/):
    uv run python scripts/seed_corpus.py [--force] [--out FILE]
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import corpus_common as cc

from app.agent.tools.discovery import _safety_checker
from app.deps import get_supabase
from app.rag.bootstrap import draft_seed_skills
from app.schemas import SkillDraft


async def main(force: bool, out: str | None) -> int:
    sb = get_supabase()
    existing = (
        sb.table("skills").select("id").eq("origin", "seed").eq("status", "draft").execute().data
    )
    if cc.should_skip_seed(existing, force):
        print(f"SKIP: {len(existing)} seed draft(s) already exist — use --force to add more")
        return 0

    count = await draft_seed_skills()
    print(f"inserted {count} seed drafts")

    rows = sb.table("skills").select("*").eq("origin", "seed").eq("status", "draft").execute().data
    items = []
    failed = 0
    for row in rows:
        try:
            draft = SkillDraft(
                **{
                    k: row[k]
                    for k in (
                        "title",
                        "material",
                        "difficulty",
                        "tools",
                        "steps",
                        "risks",
                        "est_cost_idr",
                        "est_price_idr",
                        "sources",
                    )
                }
            )
            result = await _safety_checker().run(draft.model_dump_json())
            verdict = result.output
            items.append(
                {
                    "id": str(row["id"]),
                    "title": draft.title,
                    "material": draft.material.value,
                    "difficulty": draft.difficulty.value,
                    "safe": verdict.safe,
                    "violations": verdict.violations,
                    "sources": [s.url or s.citation or "" for s in draft.sources],
                }
            )
        except Exception as exc:
            failed += 1
            items.append(
                {
                    "id": str(row["id"]),
                    "title": row.get("title", "?"),
                    "material": row.get("material", "?"),
                    "difficulty": row.get("difficulty", "?"),
                    "safe": False,
                    "violations": [f"check gagal: {exc}"],
                    "sources": [],
                }
            )

    report = cc.format_seed_review(items)
    print(report)
    if out:
        Path(out).write_text(report)
        print(f"\nreport saved to {out}")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="seed even if drafts exist")
    parser.add_argument("--out", default=None, help="write report to FILE")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.force, args.out)))
