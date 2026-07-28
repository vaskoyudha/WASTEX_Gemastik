from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.auth import get_current_user
from app.deps import get_supabase, require_service_role
from app.rag.ingest import ingest_skill
from app.schemas import SkillFlagIn, SkillStatus, SkillStatusUpdate
from supabase import Client

router = APIRouter()


FLAG_THRESHOLD = 3


@router.post("/{skill_id}/flag", status_code=201)
def flag_skill(
    skill_id: str,
    flag: SkillFlagIn,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> dict:
    res = sb.table("skills").select("*").eq("id", skill_id).execute()
    skill = next((row for row in (res.data or []) if str(row.get("id")) == skill_id), None)
    if not skill:
        raise HTTPException(status_code=404, detail="skill not found")

    sb.table("skill_flags").insert(
        {"skill_id": skill_id, "user_id": user["user_id"], "reason": flag.reason}
    ).execute()

    flags = sb.table("skill_flags").select("*").eq("skill_id", skill_id).execute()
    count = len([f for f in (flags.data or []) if str(f.get("skill_id")) == skill_id])

    status = skill.get("status")
    if count >= FLAG_THRESHOLD and status == "approved":
        status = "needs_revision"
        sb.table("skills").update({"status": status}).eq("id", skill_id).execute()
    return {"flag_count": count, "status": status}


@router.get("")
def list_skills(
    status: SkillStatus | None = None,
    material: str | None = None,
    sb: Client = Depends(get_supabase),
) -> list[dict]:
    q = sb.table("skills").select("*")
    if status:
        q = q.eq("status", status.value)
    if material:
        q = q.eq("material", material)
    return q.order("created_at", desc=True).execute().data


@router.patch("/{skill_id}/status", dependencies=[Depends(require_service_role)])
async def update_status(
    skill_id: UUID,
    body: SkillStatusUpdate,
    background_tasks: BackgroundTasks,
    sb: Client = Depends(get_supabase),
) -> dict:
    res = (
        sb.table("skills")
        .update({"status": body.status.value, "reviewed_by": body.reviewed_by})
        .eq("id", str(skill_id))
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="skill not found")
    # Gate 4: approval triggers chunk+embed; only then is the skill retrievable.
    if body.status == SkillStatus.approved:
        background_tasks.add_task(ingest_skill, sb, skill_id)
    return res.data[0]
