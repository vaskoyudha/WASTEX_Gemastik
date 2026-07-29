"""Manual retrieval eval: uv run python scripts/eval_retrieval.py (needs real env vars)."""

import asyncio
import json
from pathlib import Path

from app.agent.tools.retrieval import search_skills
from app.deps import get_supabase
from app.eval.metrics import hit_at_k, mean_reciprocal_rank

DATASET = Path(__file__).resolve().parent.parent / "eval" / "golden_dataset.jsonl"
K = 5


async def main() -> None:
    sb = get_supabase()
    skills = sb.table("skills").select("id, title").execute().data or []
    title_by_id = {str(s["id"]): (s.get("title") or "").lower() for s in skills}

    cases: list[tuple[list[str], list[str]]] = []
    hits = 0
    lines = [ln for ln in DATASET.read_text().splitlines() if ln.strip()]
    for line in lines:
        case = json.loads(line)
        chunks = await search_skills(sb, case["query"], case["material"])
        retrieved_ids = []
        for c in chunks:
            if c.skill_id not in retrieved_ids:
                retrieved_ids.append(c.skill_id)
        expected_ids = [
            sid
            for sid, title in title_by_id.items()
            if any(t.lower() in title for t in case["expected_titles"])
        ]
        cases.append((expected_ids, retrieved_ids))
        if hit_at_k(expected_ids, retrieved_ids, K):
            hits += 1

    print(f"cases: {len(cases)}")
    print(f"hit@{K}: {hits / len(cases):.2%}")
    print(f"MRR: {mean_reciprocal_rank(cases):.3f}")


if __name__ == "__main__":
    asyncio.run(main())
