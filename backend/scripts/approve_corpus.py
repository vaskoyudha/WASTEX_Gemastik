"""Approve seed drafts in batch and ingest them into the RAG corpus.

Usage (from backend/):
    uv run python scripts/approve_corpus.py <skill-id>... [--reject <id>...]
    uv run python scripts/approve_corpus.py --all-lolos
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import corpus_common as cc

from app.agent.tools.discovery import _safety_checker
from app.deps import get_supabase
from app.schemas import SkillDraft


async def _is_safe(sb, skill_id: str) -> bool:
    res = sb.table("skills").select("*").eq("id", skill_id).limit(1).execute()
    row = next((r for r in (res.data or []) if str(r.get("id")) == skill_id), None)
    if not row:
        return False
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
    return result.output.safe


async def main(ids: list[str], reject: list[str], all_lolos: bool) -> int:
    sb = get_supabase()
    failed = 0
    if all_lolos:
        rows = (
            sb.table("skills")
            .select("id")
            .eq("origin", "seed")
            .eq("status", "draft")
            .execute()
            .data
        )
        ids = [str(r["id"]) for r in rows]
    for skill_id in ids:
        if all_lolos and not await _is_safe(sb, skill_id):
            print(f"SKIP {skill_id}: tidak lolos safety check")
            continue
        result = await cc.approve_skill(sb, skill_id)
        if result.get("skipped"):
            print(f"SKIP {skill_id}: bukan draft")
        elif "error" in result:
            failed += 1
            print(f"FAIL {skill_id}: {result['error']}")
        else:
            print(f"OK {skill_id}: approved, {result['chunks']} chunks")
    for skill_id in reject:
        sb.table("skills").update({"status": "rejected"}).eq("id", skill_id).execute()
        print(f"REJECT {skill_id}: rejected")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("ids", nargs="*")
    parser.add_argument("--reject", nargs="*", default=[])
    parser.add_argument("--all-lolos", action="store_true")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.ids, args.reject, args.all_lolos)))
