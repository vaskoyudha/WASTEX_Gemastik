"""Seed bootstrap: draft skills per (material x difficulty) from sources.yaml (spec §6)."""

from pathlib import Path

import yaml

SOURCES_PATH = Path(__file__).resolve().parents[2] / "sources.yaml"


def load_sources() -> list[dict]:
    if not SOURCES_PATH.exists():
        return []
    data = yaml.safe_load(SOURCES_PATH.read_text()) or {}
    return data.get("sources", [])


async def draft_seed_skills() -> None:
    sources = load_sources()
    if not sources:
        raise SystemExit("sources.yaml is empty - curate sources before bootstrapping (spec §6)")
    raise NotImplementedError("TODO: LLM-draft skills per (material x difficulty) cell as status=draft, origin=seed")


if __name__ == "__main__":
    import asyncio

    asyncio.run(draft_seed_skills())
