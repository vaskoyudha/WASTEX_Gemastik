"""Seed bootstrap: draft skills per (material x difficulty) from sources.yaml (spec §6)."""

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic_ai import Agent

from app.config import get_settings
from app.deps import get_supabase
from app.schemas import Difficulty, Material, SkillDraft

SOURCES_PATH = Path(__file__).resolve().parents[2] / "sources.yaml"

SEED_PROMPT = """# Tugas
Kamu menyusun draft keterampilan upcycling untuk knowledge base WASTEX.

## Iron Law
GUNAKAN HANYA SUMBER DARI WHITELIST YANG DIBERIKAN. DILARANG MENGARANG.
Kutip setiap sumber di field sources. Jika whitelist tidak memuat informasi yang cukup,
buat draft konservatif dan aman - jangan mengisi kekosongan dengan dugaan.

## Aturan (MUST/NEVER)
1. Gunakan HANYA sumber dari whitelist yang diberikan - kutip di field sources.
2. Keterampilan harus aman, konkret, dengan alat terjangkau; setiap risiko wajib punya mitigasi.
3. Sesuaikan kompleksitas dengan tingkat kesulitan yang diminta.
4. JANGAN menambahkan langkah, teknik, atau bahan yang tidak ada di sumber.

## Red Flags (hati-hati bila ini terjadi)
- Draft mengandalkan pengetahuan di luar whitelist -> buang, ganti dengan sumber.
- Langkah berisiko tanpa mitigasi -> perbaiki.
- Kompleksitas tidak sesuai tingkat kesulitan yang diminta -> perbaiki.

## Self-Check (sebelum menjawab)
- Setiap klaim keterampilan ada di whitelist dan dikutip?
- Draft aman, konkret, alat terjangkau, risiko punya mitigasi?"""


def load_sources() -> list[dict]:
    if not SOURCES_PATH.exists():
        return []
    data = yaml.safe_load(SOURCES_PATH.read_text()) or {}
    return data.get("sources", [])


@lru_cache
def _seed_drafter() -> Agent:
    from app.agent.orchestrator import _openrouter_model

    return Agent(
        _openrouter_model(get_settings().chat_model),
        output_type=SkillDraft,
        system_prompt=SEED_PROMPT,
        retries=1,
    )


async def draft_seed_skills(per_cell: int = 1) -> int:
    sources = load_sources()
    if not sources:
        raise SystemExit("sources.yaml is empty - curate sources before bootstrapping (spec §6)")
    whitelist = yaml.safe_dump(sources, allow_unicode=True)
    sb = get_supabase()
    count = 0
    for material in Material:
        for difficulty in Difficulty:
            for _ in range(per_cell):
                result = await _seed_drafter().run(
                    f"Whitelist sumber:\n{whitelist}\n\n"
                    f"Material: {material.value}\nTingkat kesulitan: {difficulty.value}"
                )
                draft: SkillDraft = result.output
                sb.table("skills").insert(
                    {**draft.model_dump(mode="json"), "status": "draft", "origin": "seed"}
                ).execute()
                count += 1
    return count


if __name__ == "__main__":
    import asyncio

    print(f"inserted {asyncio.run(draft_seed_skills())} seed drafts")
