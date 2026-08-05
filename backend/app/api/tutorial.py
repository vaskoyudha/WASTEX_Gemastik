from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_supabase
from supabase import Client

router = APIRouter()


@router.get("/{skill_id}")
async def get_tutorial(skill_id: str, sb: Client = Depends(get_supabase)):
    resp = (
        sb.table("skills")
        .select("id, title, description, steps, additional_materials, tools, difficulty")
        .eq("id", skill_id)
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Skill not found")

    skill = resp.data
    if not skill.get("steps"):
        raise HTTPException(status_code=404, detail="Tutorial not available for this skill")

    return {
        "skill_id": skill["id"],
        "title": skill["title"],
        "description": skill["description"],
        "difficulty": skill["difficulty"],
        "additional_materials": skill.get("additional_materials", []),
        "tools": skill.get("tools", []),
        "steps": skill["steps"],
        "estimated_time": _estimate_time(skill["difficulty"], len(skill["steps"])),
    }


def _estimate_time(difficulty: str, num_steps: int) -> str:
    base_minutes = {"pemula": 15, "menengah": 30, "mahir": 60}
    minutes = base_minutes.get(difficulty, 30) + (num_steps * 5)
    if minutes < 60:
        return f"{minutes} menit"
    hours = minutes // 60
    remaining = minutes % 60
    return f"{hours} jam {remaining} menit" if remaining else f"{hours} jam"
