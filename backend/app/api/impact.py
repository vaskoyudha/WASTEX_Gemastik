from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.deps import get_optional_user_id, get_supabase
from app.schemas import ImpactEventIn, ImpactSummary
from supabase import Client

router = APIRouter()


@router.post("", status_code=201)
def log_impact(
    event: ImpactEventIn,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> dict:
    row = (
        sb.table("impact_events")
        .insert(
            {
                "user_id": user_id,
                "skill_id": str(event.skill_id) if event.skill_id else None,
                "material": event.material.value,
                "waste_kg": event.waste_kg,
                "est_value_idr": event.est_value_idr,
            }
        )
        .execute()
        .data[0]
    )
    return {"id": row["id"]}


@router.get("/summary", response_model=ImpactSummary)
def impact_summary(
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> ImpactSummary:
    res = sb.table("impact_events").select("*").eq("user_id", user["user_id"]).execute()
    rows = [r for r in (res.data or []) if r.get("user_id") == user["user_id"]]
    return ImpactSummary(
        total_projects=len(rows),
        total_waste_kg=round(sum(float(r.get("waste_kg") or 0) for r in rows), 3),
        total_value_idr=sum(int(r.get("est_value_idr") or 0) for r in rows),
    )
