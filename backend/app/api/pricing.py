import math

from fastapi import APIRouter, Depends, HTTPException

from app.deps import ensure_uuid, get_supabase
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

# Tarif tenaga kerja kerajinan rumahan (bukan workshop profesional): harga
# jual produk daur ulang harus tetap terjangkau.
LABOR_RATES = {
    "pemula": 10000,
    "menengah": 15000,
    "mahir": 20000,
}

DEFAULT_MARGIN = 0.4
# Waktu pengerjaan per langkah: rata-rata 9 menit (bukan 15 menit).
HOURS_PER_STEP = 0.15

# Plafon harga jual per material: kerajinan daur ulang rumahan tidak boleh
# dijual dengan harga fantastis. Berlaku bila est_price LLM tidak wajar.
PRICE_CEILINGS = {
    "plastik_pet": 30000,
    "plastik_hdpe": 30000,
    "kardus": 30000,
    "kaleng": 40000,
    "kaca": 50000,
    "sachet": 30000,
}


def _price_ceiling(material: str | None, difficulty: str | None) -> int:
    """Plafon harga jual per material, naik sedikit untuk difficulty mahir."""
    base = PRICE_CEILINGS.get(material or "", 30000)
    if difficulty == "mahir":
        return base + 10000
    if difficulty == "menengah":
        return base + 5000
    return base


@router.get("/{skill_id}")
async def calculate_pricing(skill_id: str, sb: Client = Depends(get_supabase)):
    ensure_uuid(skill_id, "Skill not found")
    resp = (
        sb.table("skills")
        .select(
            "id, title, material, difficulty, steps, est_cost_idr, est_price_idr, "
            "additional_materials, additional_materials_cost_idr"
        )
        .eq("id", skill_id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Skill not found")
    skill = resp.data

    return compute_pricing(skill)


def compute_pricing(skill: dict) -> dict:
    steps = skill.get("steps") or []
    labor_rate = LABOR_RATES.get(skill.get("difficulty") or "menengah", 25000)
    labor_cost = int(len(steps) * HOURS_PER_STEP * labor_rate)

    # est_cost_idr is the LLM's aggregate estimate and already includes the
    # additional materials listed below. Using it here would count those costs
    # twice, so the primary recycled material always uses the deterministic
    # lookup instead.
    material_cost = MATERIAL_COSTS.get(skill.get("material"), 500)

    additional_items = skill.get("additional_materials") or []
    stored_additional_cost = skill.get("additional_materials_cost_idr")
    additional_materials_cost = stored_additional_cost or sum(
        int(item.get("est_cost_idr") or 0) for item in additional_items
    )
    total_cost = material_cost + labor_cost + additional_materials_cost

    if skill.get("est_price_idr"):
        suggested_price = skill["est_price_idr"]
        profit_margin = round((suggested_price - total_cost) / total_cost, 2) if total_cost else 0
    else:
        profit_margin = DEFAULT_MARGIN
        suggested_price = round(int(total_cost * (1 + profit_margin)) / 1000) * 1000

    # Floor: margin tidak boleh negatif. Bila est_price < total_cost, naikkan
    # suggested_price ke biaya (break-even) saja, BUKAN biaya + margin default —
    # memaksakan margin default justru menggelembungkan harga jual kerajinan
    # (mis. organizer botol PET mahir: biaya Rp70.500 -> dipaksa Rp99.000).
    if suggested_price < total_cost:
        profit_margin = 0
        suggested_price = math.ceil(total_cost / 1000) * 1000

    # Ceiling: harga jual kerajinan daur ulang rumahan tidak boleh gila-gilaan.
    # Bila est_price LLM di atas plafon material, patok ke plafon.
    price_ceiling = _price_ceiling(skill.get("material"), skill.get("difficulty"))
    if suggested_price > price_ceiling:
        suggested_price = price_ceiling
        profit_margin = round((suggested_price - total_cost) / total_cost, 2) if total_cost else 0

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
