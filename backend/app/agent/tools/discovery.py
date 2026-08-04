import logging
from difflib import SequenceMatcher
from functools import lru_cache

import yaml
from pydantic_ai import Agent

from app.agent.orchestrator import _openrouter_model
from app.config import get_settings
from app.deps import get_supabase
from app.rag.bootstrap import load_sources
from app.schemas import Material, SafetyVerdict, SkillDraft

logger = logging.getLogger(__name__)

DRAFT_PROMPT = """# Tugas
Kamu menyusun draft keterampilan upcycling untuk knowledge base WASTEX.

## Iron Law
GUNAKAN HANYA SUMBER DARI WHITELIST YANG DIBERIKAN. DILARANG MENGARANG.
Kutip setiap sumber di field sources. Jika whitelist tidak memuat informasi yang cukup,
buat draft konservatif dan aman - jangan mengisi kekosongan dengan dugaan.

## Aturan (MUST/NEVER)
1. Gunakan HANYA sumber dari whitelist yang diberikan - kutip di field sources.
2. Jika whitelist tidak memuat informasi yang cukup, buat draft konservatif dan aman.
3. Langkah harus konkret, alat terjangkau, risiko disertai mitigasi.
4. JANGAN menambahkan langkah, teknik, atau bahan yang tidak ada di sumber.

## Red Flags (hati-hati bila ini terjadi)
- Draft mengandalkan pengetahuan di luar whitelist -> buang, ganti dengan sumber.
- Langkah berisiko tanpa mitigasi -> perbaiki.
- Alat yang tidak terjangkau rumah tangga -> ganti.
- Sources kosong/tidak mengutip -> perbaiki.

## Self-Check (sebelum menjawab)
- Setiap klaim keterampilan ada di whitelist dan dikutip?
- Draft aman, konkret, alat terjangkau, risiko punya mitigasi?"""

SAFETY_RUBRIC = """# Tugas
Periksa draft keterampilan upcycling terhadap rubrik keselamatan.

## Iron Law
SAFE = FALSE JIKA ADA SATU PELANGGARAN PUN. Tidak ada keselamatan yang "hampir lolos".

## Aturan (WAJIB)
DILARANG (safe=false jika ada): melelehkan/membakar PVC atau plastik apa pun,
memotong kaca untuk tingkat pemula, api terbuka dekat aerosol/bahan mudah terbakar,
bahan kimia korosif tanpa APD, langkah tanpa mitigasi untuk bahaya tajam/panas.

## Red Flags (hati-hati bila ini terjadi)
- Langkah berbahaya tapi terloloskan -> jangan, WAJIB safe=false.
- Kaca/violation lain untuk pemula -> WAJIB safe=false.
- Daftar violations kosong saat draft mengandung risiko -> jangan.

## Self-Check (sebelum menjawab)
- Semua langkah diperiksa terhadap 5 larangan di atas?
- Violations mencantumkan semua pelanggaran yang ditemukan?

Kembalikan safe dan daftar violations."""


@lru_cache
def _drafter() -> Agent:
    return Agent(
        _openrouter_model(get_settings().chat_model),
        output_type=SkillDraft,
        system_prompt=DRAFT_PROMPT,
        retries=1,
    )


@lru_cache
def _safety_checker() -> Agent:
    return Agent(
        _openrouter_model(get_settings().chat_model),
        output_type=SafetyVerdict,
        system_prompt=SAFETY_RUBRIC,
        retries=1,
    )


def is_duplicate_title(title: str, existing_titles: list[str], threshold: float = 0.85) -> bool:
    norm = title.strip().lower()
    return any(
        SequenceMatcher(None, norm, t.strip().lower()).ratio() >= threshold for t in existing_titles
    )


async def discover_skill(material: Material, user_intent: str) -> None:
    """Background task fired on Gate 2 (knowledge gap). Never blocks the requesting user."""
    try:
        sources = load_sources()
        if not sources:
            logger.warning("discovery skipped: sources.yaml is empty")
            return
        whitelist = yaml.safe_dump(sources, allow_unicode=True)
        draft_result = await _drafter().run(
            f"Whitelist sumber:\n{whitelist}\n\nMaterial: {material.value}\nKebutuhan pengguna: {user_intent}"
        )
        draft: SkillDraft = draft_result.output

        verdict_result = await _safety_checker().run(draft.model_dump_json())
        verdict: SafetyVerdict = verdict_result.output

        # Gate 3: failed drafts are stored as rejected for audit and never ingested.
        status = "draft" if verdict.safe else "rejected"

        # Dedup check: skip inserting if title matches existing skill of same material
        sb = get_supabase()
        existing = (
            sb.table("skills").select("title, material").eq("material", material.value).execute()
        )
        titles = [
            row["title"]
            for row in (existing.data or [])
            if row.get("material") == material.value and row.get("title")
        ]
        if is_duplicate_title(draft.title, titles):
            logger.info("discovery skipped: duplicate of existing skill (%s)", draft.title)
            return

        sb.table("skills").insert(
            {
                **draft.model_dump(mode="json"),
                "status": status,
                "origin": "discovered",
            }
        ).execute()
        logger.info(
            "discovery for %s stored with status=%s violations=%s",
            material.value,
            status,
            verdict.violations,
        )
    except Exception:
        logger.exception("discover_skill failed for material=%s", material.value)
