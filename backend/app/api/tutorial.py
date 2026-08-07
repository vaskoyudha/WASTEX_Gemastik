import re

from fastapi import APIRouter, Depends, HTTPException

from app.deps import ensure_uuid, get_supabase
from supabase import Client

router = APIRouter()


@router.get("/{skill_id}")
async def get_tutorial(skill_id: str, sb: Client = Depends(get_supabase)):
    ensure_uuid(skill_id, "Skill not found")
    resp = (
        sb.table("skills")
        .select("id, title, description, steps, additional_materials, tools, difficulty")
        .eq("id", skill_id)
        .maybe_single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Skill not found")

    skill = resp.data
    if not skill.get("steps"):
        raise HTTPException(status_code=404, detail="Tutorial not available for this skill")

    tools = _enrich_legacy_tools(skill.get("tools", []), skill["steps"])

    return {
        "skill_id": skill["id"],
        "title": skill["title"],
        "description": skill["description"],
        "difficulty": skill["difficulty"],
        "additional_materials": skill.get("additional_materials", []),
        "tools": tools,
        "steps": skill["steps"],
        "estimated_time": _estimate_time(skill["difficulty"], len(skill["steps"])),
    }


def _enrich_legacy_tools(tools: list, steps: list[dict]) -> list[dict]:
    """Isi kegunaan alat pada skill lama tanpa menulis ulang data di database."""
    enriched = []
    for raw_tool in tools:
        if isinstance(raw_tool, str):
            tool = {"name": raw_tool}
        elif isinstance(raw_tool, dict):
            tool = dict(raw_tool)
        else:
            continue
        tool.setdefault("optional", False)
        if str(tool.get("description", "")).strip():
            enriched.append(tool)
            continue

        name = str(tool.get("name", "")).strip()
        keywords = [word.lower() for word in name.split() if len(word) >= 3]
        matching_step = next(
            (
                step
                for step in steps
                if any(
                    re.search(
                        rf"\b{re.escape(word)}\b",
                        str(step.get("instruction", "")).lower(),
                    )
                    for word in keywords
                )
            ),
            None,
        )
        if matching_step:
            tool["description"] = (
                f"Digunakan pada langkah {matching_step.get('order')}: "
                f"{matching_step.get('instruction')}"
            )
        else:
            tool["description"] = "Alat pendukung untuk proses pembuatan."
        enriched.append(tool)
    return enriched


def _estimate_time(difficulty: str, num_steps: int) -> str:
    base_minutes = {"pemula": 15, "menengah": 30, "mahir": 60}
    minutes = base_minutes.get(difficulty, 30) + (num_steps * 5)
    if minutes < 60:
        return f"{minutes} menit"
    hours = minutes // 60
    remaining = minutes % 60
    return f"{hours} jam {remaining} menit" if remaining else f"{hours} jam"
