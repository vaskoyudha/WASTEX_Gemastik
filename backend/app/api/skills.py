from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.agent.tools.skill_proposals import SkillGenUnavailable, generate_proposals, verify_draft
from app.api.visuals import generate_all_visuals
from app.auth import get_current_user
from app.deps import get_optional_user_id, get_supabase, require_expert_or_service
from app.rag.ingest import ingest_skill
from app.schemas import (
    SkillCreateRequest,
    SkillFlagIn,
    SkillProposal,
    SkillProposalRequest,
    SkillStatus,
    SkillStatusUpdate,
    SkillVerifyRequest,
    SkillVerifyResponse,
)
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


@router.post("/proposals", response_model=list[SkillProposal])
async def skill_proposals(
    body: SkillProposalRequest,
    user: dict = Depends(get_current_user),
) -> list[SkillProposal]:
    try:
        return await generate_proposals(body.material.value, body.condition)
    except SkillGenUnavailable:
        raise HTTPException(status_code=503, detail="AI unavailable")


@router.post("/verify", response_model=SkillVerifyResponse)
async def verify_skill(
    body: SkillVerifyRequest,
    user: dict = Depends(get_current_user),
) -> SkillVerifyResponse:
    try:
        return await verify_draft(body.draft, body.chat_history)
    except SkillGenUnavailable:
        raise HTTPException(status_code=503, detail="AI unavailable")


@router.get("")
def list_skills(
    status: SkillStatus | None = None,
    material: str | None = None,
    mine: bool = False,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> list[dict]:
    q = sb.table("skills").select("*")
    if status:
        q = q.eq("status", status.value)
    if material:
        q = q.eq("material", material)
    if mine:
        if not user_id:
            raise HTTPException(status_code=401, detail="login required")
        q = q.eq("created_by", user_id)
    return q.order("created_at", desc=True).execute().data


@router.post("", status_code=201)
def create_skill(
    body: SkillCreateRequest,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> dict:
    dup = (
        sb.table("skills")
        .select("id")
        .eq("title", body.title)
        .eq("material", body.material.value)
        .eq("created_by", user["user_id"])
        .execute()
    )
    # FakeSupabase eq() is a no-op; filter created_by client-side to match prod semantics.
    if any(str(row.get("created_by")) == user["user_id"] for row in dup.data):
        raise HTTPException(status_code=409, detail="skill serupa sudah pernah dibuat")

    reference_image_path = None
    if body.reference_scan_id is not None:
        scans = (
            sb.table("scans")
            .select("id, user_id, image_url")
            .eq("id", str(body.reference_scan_id))
            .limit(1)
            .execute()
        )
        scan_row = next(
            (
                r
                for r in (scans.data or [])
                if r.get("id") == str(body.reference_scan_id) and r.get("image_url")
            ),
            None,
        )
        if scan_row is not None and str(scan_row.get("user_id", "")) == user["user_id"]:
            reference_image_path = scan_row["image_url"]

    payload = body.model_dump(mode="json")
    payload.pop("reference_scan_id", None)
    payload["additional_materials_cost_idr"] = sum(
        m.est_cost_idr for m in body.additional_materials
    )
    payload.update(
        {
            "status": "pending",
            "origin": "user",
            "created_by": user["user_id"],
            "reference_image_path": reference_image_path,
        }
    )
    res = sb.table("skills").insert(payload).execute()
    return res.data[0]


@router.patch("/{skill_id}/status", dependencies=[Depends(require_expert_or_service)])
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
        background_tasks.add_task(generate_all_visuals, sb, skill_id)
    return res.data[0]
