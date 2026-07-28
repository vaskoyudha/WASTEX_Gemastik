"""RAGAS evaluation runner skeleton (spec §7).

Targets: faithfulness >=90%, context precision >=85%, context recall >=80%, answer relevancy >=80%.
NOTE: RAGAS needs a judge LLM + embeddings config pointed at OpenRouter/DeepInfra (spec §10).
"""

import json
from pathlib import Path

GOLDEN_PATH = Path(__file__).parent / "golden.jsonl"


def load_golden() -> list[dict]:
    return [json.loads(line) for line in GOLDEN_PATH.read_text().splitlines() if line.strip()]


def main() -> None:
    golden = load_golden()
    print(f"loaded {len(golden)} golden samples from {GOLDEN_PATH}")
    raise SystemExit(
        "TODO: run /recommend per sample, collect contexts/answers, "
        "score with RAGAS (judge via OpenRouter), commit JSON results"
    )


if __name__ == "__main__":
    main()
