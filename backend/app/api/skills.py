import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from app.agent.tools.skill_proposals import (
    SkillGenUnavailable,
    expand_proposal,
    generate_ideas,
    verify_draft,
)
from app.api.visuals import generate_all_visuals
from app.auth import get_current_user
from app.config import get_settings
from app.deps import get_optional_user_id, get_supabase, require_expert_or_service
from app.rag.ingest import ingest_skill
from app.schemas import (
    CompletionGalleryItem,
    SkillCompletion,
    SkillCompletionsSummary,
    SkillCreateRequest,
    SkillExpandRequest,
    SkillFlagIn,
    SkillIdea,
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

logger = logging.getLogger(__name__)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"]


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


@router.post("/proposals", response_model=list[SkillIdea])
async def skill_proposals(
    body: SkillProposalRequest,
    user: dict = Depends(get_current_user),
) -> list[SkillIdea]:
    try:
        return await generate_ideas(body.material.value, body.condition)
    except SkillGenUnavailable:
        raise HTTPException(status_code=503, detail="AI unavailable")


@router.post("/proposals/expand", response_model=SkillProposal)
async def skill_proposals_expand(
    body: SkillExpandRequest,
    user: dict = Depends(get_current_user),
) -> SkillProposal:
    try:
        return await expand_proposal(body.material.value, body.condition, body.idea)
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
        .select("id, created_by")
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


@router.post("/{skill_id}/complete", status_code=201, response_model=SkillCompletion)
async def complete_skill(
    skill_id: str,
    file: UploadFile = File(...),
    rating: int = Form(..., ge=1, le=5),
    comment: str | None = Form(None),
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> SkillCompletion:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {file.content_type}")
    image = await file.read()
    if len(image) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")
    if not image:
        raise HTTPException(status_code=400, detail="empty image")

    if not sb.table("skills").select("id").eq("id", skill_id).execute().data:
        raise HTTPException(status_code=404, detail="skill not found")

    existing = (
        sb.table("skill_completions").select("*").eq("skill_id", skill_id).execute().data or []
    )
    if any(c.get("skill_id") == skill_id and c.get("user_id") == user["user_id"] for c in existing):
        raise HTTPException(status_code=409, detail="Anda sudah mengirimkan hasil untuk skill ini")

    completion_id = str(uuid4())
    photo_path = f"{completion_id}.{file.content_type.split('/')[-1]}"
    try:
        sb.storage.from_("completions").upload(
            photo_path, image, {"content-type": file.content_type}
        )
    except Exception:
        logger.exception("completion photo upload failed")
        raise HTTPException(status_code=502, detail="photo upload failed")

    row = (
        sb.table("skill_completions")
        .insert(
            {
                "id": completion_id,
                "user_id": user["user_id"],
                "skill_id": skill_id,
                "photo_path": photo_path,
                "rating": rating,
                "comment": comment,
            }
        )
        .execute()
        .data[0]
    )
    return SkillCompletion(
        id=row["id"],
        user_id=row["user_id"],
        skill_id=row["skill_id"],
        photo_path=row["photo_path"],
        rating=row["rating"],
        comment=row.get("comment"),
        created_at=row["created_at"],
    )


def _display_names(sb: Client, user_ids: list) -> dict:
    ids = [u for u in set(user_ids) if u]
    if not ids:
        return {}
    try:
        profs = sb.table("profiles").select("auth_user_id,display_name").execute().data or []
        return {p["auth_user_id"]: p["display_name"] for p in profs if p.get("auth_user_id") in ids}
    except Exception:
        return {}


@router.get("/{skill_id}/completions", response_model=SkillCompletionsSummary)
def get_skill_completions(
    skill_id: str, sb: Client = Depends(get_supabase)
) -> SkillCompletionsSummary:
    if not sb.table("skills").select("id").eq("id", skill_id).execute().data:
        raise HTTPException(status_code=404, detail="skill not found")

    rows = sb.table("skill_completions").select("*").eq("skill_id", skill_id).execute().data or []
    rows = [r for r in rows if r.get("skill_id") == skill_id]
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)

    count = len(rows)
    avg_rating = round(sum(r["rating"] for r in rows) / count, 1) if count else 0.0
    names = _display_names(sb, [r.get("user_id") for r in rows])
    base = get_settings().supabase_url.rstrip("/")
    gallery = [
        CompletionGalleryItem(
            photo_url=f"{base}/storage/v1/object/public/completions/{r['photo_path']}",
            rating=r["rating"],
            comment=r.get("comment"),
            created_at=r.get("created_at", ""),
            user_display_name=names.get(r.get("user_id"), ""),
        )
        for r in rows
    ]
    return SkillCompletionsSummary(
        skill_id=skill_id, avg_rating=avg_rating, count=count, gallery=gallery
    )


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
