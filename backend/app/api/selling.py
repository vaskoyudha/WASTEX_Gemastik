from fastapi import APIRouter, Depends, HTTPException

from app.agent.selling import generate_selling_kit
from app.deps import get_supabase
from app.schemas import SellingKit
from supabase import Client

router = APIRouter()


@router.get("/{skill_id}", response_model=SellingKit)
async def get_selling_kit(skill_id: str, sb: Client = Depends(get_supabase)) -> SellingKit:
    res = sb.table("skills").select("*").eq("id", skill_id).execute()
    skill = next((row for row in (res.data or []) if str(row.get("id")) == skill_id), None)
    if not skill or skill.get("status") != "approved":
        raise HTTPException(status_code=404, detail="skill not found")
    return await generate_selling_kit(skill)
