"""RAGAS evaluation runner (spec §7).

Targets: faithfulness >=90%, context precision >=85%, context recall >=80%, answer relevancy >=80%.
Uses LLM-as-judge via OpenRouter to score each metric independently.
"""

import asyncio
import json
import os
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import Settings

GOLDEN_PATH = Path(__file__).parent / "golden.jsonl"
RESULTS_DIR = Path(__file__).parent / "results"

# ---- thresholds (spec §7) ----
THRESHOLDS = {
    "faithfulness": 0.90,
    "context_precision": 0.85,
    "context_recall": 0.80,
    "answer_relevancy": 0.80,
}


def load_golden() -> list[dict]:
    return [json.loads(line) for line in GOLDEN_PATH.read_text().splitlines() if line.strip()]


# ---- judge prompts -----------------------------------------------------------

FAITHFULNESS_PROMPT = """\
You are evaluating faithfulness of an answer to the provided context.

Context:
{context}

Answer:
{answer}

Score how much of the answer is supported by the context (0.0 to 1.0).
Reply with ONLY a JSON object: {{"score": <float>, "reasoning": "<brief>"}}
"""

CONTEXT_PRECISION_PROMPT = """\
You are evaluating context precision — whether the retrieved context is relevant.

Question:
{question}

Context:
{context}

Score how relevant the context is to the question (0.0 to 1.0).
Reply with ONLY a JSON object: {{"score": <float>, "reasoning": "<brief>"}}
"""

CONTEXT_RECALL_PROMPT = """\
You are evaluating context recall — whether the context contains info to answer the question.

Question:
{question}

Ground Truth:
{ground_truth}

Context:
{context}

Score how much of the ground truth is covered by the context (0.0 to 1.0).
Reply with ONLY a JSON object: {{"score": <float>, "reasoning": "<brief>"}}
"""

ANSWER_RELEVANCY_PROMPT = """\
You are evaluating answer relevancy — whether the answer directly addresses the question.

Question:
{question}

Answer:
{answer}

Score how well the answer addresses the question (0.0 to 1.0).
Reply with ONLY a JSON object: {{"score": <float>, "reasoning": "<brief>"}}
"""


async def judge_score(client: httpx.AsyncClient, settings: Settings, prompt: str) -> dict:
    """Call OpenRouter chat to score a single metric."""
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.chat_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 256,
    }
    r = await client.post(url, headers=headers, json=payload, timeout=60)
    r.raise_for_status()
    text = r.json()["choices"][0]["message"]["content"].strip()
    # strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


async def score_sample(
    client: httpx.AsyncClient,
    settings: Settings,
    sample: dict,
    result: dict,
) -> dict:
    """Score a single sample across all four RAGAS metrics."""
    context = result.get("context", "")
    answer = result.get("answer", "")
    question = sample["question"]
    ground_truth = sample.get("ground_truth", "")

    prompts = {
        "faithfulness": FAITHFULNESS_PROMPT.format(context=context, answer=answer),
        "context_precision": CONTEXT_PRECISION_PROMPT.format(question=question, context=context),
        "context_recall": CONTEXT_RECALL_PROMPT.format(
            question=question, ground_truth=ground_truth, context=context
        ),
        "answer_relevancy": ANSWER_RELEVANCY_PROMPT.format(question=question, answer=answer),
    }

    scores = {}
    for metric, prompt in prompts.items():
        try:
            res = await judge_score(client, settings, prompt)
            scores[metric] = {"score": res.get("score", 0.0), "reasoning": res.get("reasoning", "")}
        except Exception as e:
            scores[metric] = {"score": 0.0, "reasoning": f"judge error: {e}"}

    return {
        "question": question,
        "type": sample.get("type", ""),
        "material": sample.get("material", ""),
        "answer": answer,
        "context_preview": context[:500],
        "scores": scores,
    }


async def run_recommend_local(sample: dict) -> dict:
    """Run /recommend against a local TestClient (no live server needed)."""
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    payload = {
        "material": sample.get("material", "plastik_pet"),
        "user_intent": sample["question"],
    }
    r = client.post("/recommend", json=payload)
    body = r.json()
    pkg = body.get("package", {})
    # gather context from chunks if available; fallback to recommendation text
    context = pkg.get("recommendation", "")
    return {
        "answer": pkg.get("recommendation", ""),
        "context": context,
        "status": body.get("status", ""),
    }


async def run_evaluate_live(base_url: str, golden: list[dict]) -> list[dict]:
    """Run /recommend against a live server and score each sample."""

    settings = Settings(
        openrouter_api_key=os.environ["OPENROUTER_API_KEY"],
        deepinfra_api_key=os.environ.get("DEEPINFRA_API_KEY", ""),
        supabase_url=os.environ.get("SUPABASE_URL", "http://localhost"),
        supabase_service_key=os.environ.get("SUPABASE_SERVICE_KEY", ""),
    )
    results = []
    async with httpx.AsyncClient(base_url=base_url, timeout=60) as client:
        for sample in golden:
            payload = {
                "material": sample.get("material", "plastik_pet"),
                "user_intent": sample["question"],
            }
            r = await client.post("/recommend", json=payload)
            body = r.json()
            pkg = body.get("package", {})
            result = {
                "answer": pkg.get("recommendation", ""),
                "context": pkg.get("recommendation", ""),
            }
            scored = await score_sample(client, settings, sample, result)
            results.append(scored)
    return results


async def run_evaluate_local(golden: list[dict]) -> list[dict]:
    """Run /recommend via TestClient and score each sample."""

    settings = Settings(
        openrouter_api_key=os.environ["OPENROUTER_API_KEY"],
        deepinfra_api_key=os.environ.get("DEEPINFRA_API_KEY", ""),
        supabase_url=os.environ.get("SUPABASE_URL", "http://localhost"),
        supabase_service_key=os.environ.get("SUPABASE_SERVICE_KEY", ""),
    )
    results = []
    async with httpx.AsyncClient(timeout=60) as client:
        for sample in golden:
            result = await run_recommend_local(sample)
            scored = await score_sample(client, settings, sample, result)
            results.append(scored)
    return results


def summarise(results: list[dict]) -> dict:
    """Compute aggregate scores and pass/fail per metric."""
    metrics = list(THRESHOLDS.keys())
    agg = {m: [] for m in metrics}
    for r in results:
        for m in metrics:
            agg[m].append(r["scores"].get(m, {}).get("score", 0.0))

    summary = {}
    for m in metrics:
        vals = agg[m]
        avg = sum(vals) / len(vals) if vals else 0.0
        summary[m] = {
            "mean": round(avg, 4),
            "min": round(min(vals), 4) if vals else 0.0,
            "max": round(max(vals), 4) if vals else 0.0,
            "threshold": THRESHOLDS[m],
            "pass": avg >= THRESHOLDS[m],
        }
    summary["total_samples"] = len(results)
    summary["overall_pass"] = all(s["pass"] for s in summary.values() if isinstance(s, dict))
    return summary


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="RAGAS evaluation runner")
    parser.add_argument(
        "--live-url", help="Base URL of running backend (e.g. http://localhost:8000)"
    )
    parser.add_argument("--golden", default=str(GOLDEN_PATH), help="Path to golden.jsonl")
    parser.add_argument("--out", default=None, help="Output JSON path")
    args = parser.parse_args()

    golden = [
        json.loads(line) for line in Path(args.golden).read_text().splitlines() if line.strip()
    ]
    print(f"loaded {len(golden)} golden samples")

    if args.live_url:
        results = asyncio.run(run_evaluate_live(args.live_url, golden))
    else:
        results = asyncio.run(run_evaluate_local(golden))

    summary = summarise(results)
    output = {"results": results, "summary": summary}

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    out_path = args.out or str(RESULTS_DIR / f"ragas_{ts}.json")
    Path(out_path).write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"results written to {out_path}")

    print("\n=== RAGAS Summary ===")
    for metric, data in summary.items():
        if isinstance(data, dict):
            status = "PASS" if data["pass"] else "FAIL"
            print(f"  {metric}: {data['mean']:.2%} (threshold {data['threshold']:.0%}) [{status}]")

    if not summary.get("overall_pass", False):
        print("\nOverall: FAIL")
        raise SystemExit(1)
    print("\nOverall: PASS")


if __name__ == "__main__":
    main()
