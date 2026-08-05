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

DEFAULT_MARGIN = 0.4


@router.get("/{skill_id}")
async def calculate_pricing(skill_id: str, sb: Client = Depends(get_supabase)):
    resp = (
        sb.table("skills")
        .select(
            "id, title, material, difficulty, steps, est_cost_idr, est_price_idr, "
            "additional_materials, additional_materials_cost_idr"
        )
        .eq("id", skill_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Skill not found")
    skill = resp.data

    steps = skill.get("steps") or []
    labor_rate = LABOR_RATES.get(skill.get("difficulty") or "menengah", 25000)
    labor_cost = int(len(steps) * 0.5 * labor_rate)

    material_cost = skill.get("est_cost_idr") or MATERIAL_COSTS.get(skill.get("material"), 500)

    additional_items = skill.get("additional_materials") or []
    additional_materials_cost = skill.get("additional_materials_cost_idr") or sum(
        int(item.get("est_cost_idr") or 0) for item in additional_items
    )
    total_cost = material_cost + labor_cost + additional_materials_cost

    if skill.get("est_price_idr"):
        suggested_price = skill["est_price_idr"]
        profit_margin = round((suggested_price - total_cost) / total_cost, 2) if total_cost else 0
    else:
        profit_margin = DEFAULT_MARGIN
        suggested_price = round(int(total_cost * (1 + profit_margin)) / 1000) * 1000

    return {
        "skill_id": skill["id"],
        "title": skill["title"],
        "material_cost": material_cost,
        "additional_materials": additional_items,
        "additional_materials_cost": additional_materials_cost,
        "labor_cost": labor_cost,
        "total_cost": total_cost,
        "profit_margin": profit_margin,
        "suggested_price": suggested_price,
        "currency": "IDR",
    }
