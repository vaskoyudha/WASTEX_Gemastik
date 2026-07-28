from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_supabase
from supabase import Client

router = APIRouter()

MATERIAL_COSTS = {
    "plastik_pet": 500,
    "plastik_hdpe": 600,
    "kardus": 300,
    "kaleng": 800,
    "kaca": 800,
    "sachet": 200,
}

LABOR_RATES = {
    "pemula": 15000,
    "menengah": 25000,
    "mahir": 40000,
}


@router.get("/{skill_id}")
async def calculate_pricing(skill_id: str, sb: Client = Depends(get_supabase)):
    resp = (
        sb.table("skills")
        .select("id, title, difficulty, materials, steps")
        .eq("id", skill_id)
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Skill not found")

    skill = resp.data
    materials = skill.get("materials", [])
    difficulty = skill.get("difficulty", "menengah")
    steps = skill.get("steps", [])

    material_cost = sum(MATERIAL_COSTS.get(m.lower(), 500) for m in materials)

    estimated_hours = len(steps) * 0.5
    labor_rate = LABOR_RATES.get(difficulty, 25000)
    labor_cost = int(estimated_hours * labor_rate)

    total_cost = material_cost + labor_cost
    profit_margin = 0.4
    suggested_price = int(total_cost * (1 + profit_margin))
    suggested_price = round(suggested_price / 1000) * 1000

    return {
        "skill_id": skill["id"],
        "title": skill["title"],
        "material_cost": material_cost,
        "labor_cost": labor_cost,
        "total_cost": total_cost,
        "profit_margin": profit_margin,
        "suggested_price": suggested_price,
        "currency": "IDR",
    }
