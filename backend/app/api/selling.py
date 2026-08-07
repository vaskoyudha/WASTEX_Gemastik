import asyncio

from fastapi import APIRouter, Depends, HTTPException

from app.agent.selling import generate_selling_kit
from app.agent.tools.image_gen import (
    build_completion_mockup_master_prompt,
    build_mockup_prompt,
    build_story_mockup_prompt,
    generate_image,
)
from app.auth import get_current_user
from app.config import get_settings
from app.deps import get_supabase
from app.schemas import CompletionSellingKit, CompletionStoryAsset, SellingKit
from supabase import Client

router = APIRouter()


@router.get("/{skill_id}", response_model=SellingKit)
async def get_selling_kit(skill_id: str, sb: Client = Depends(get_supabase)) -> SellingKit:
    res = sb.table("skills").select("*").eq("id", skill_id).execute()
    skill = next((row for row in (res.data or []) if str(row.get("id")) == skill_id), None)
    if not skill or skill.get("status") != "approved":
        raise HTTPException(status_code=404, detail="skill not found")
    return await generate_selling_kit(skill)


async def _completion_promo_image(sb: Client, skill: dict, completion: dict) -> str | None:
    cached_path = completion.get("promo_image_path")
    if cached_path:
        return str(cached_path)

    photo_path = completion.get("photo_path")
    if not photo_path:
        return None
    photo = sb.storage.from_("completions").download(photo_path)
    photo_bytes = photo if isinstance(photo, bytes) else bytes(photo)
    if not photo_bytes:
        return None

    prompt = build_completion_mockup_master_prompt(build_mockup_prompt(skill))
    image = await generate_image(prompt, [photo_bytes])
    promo_path = f"promos/{completion['id']}.png"
    sb.storage.from_("completions").upload(
        promo_path,
        image,
        {"content-type": "image/png", "upsert": "true"},
    )
    return promo_path


async def _completion_story_image(sb: Client, skill: dict, completion: dict) -> str | None:
    cached_path = completion.get("story_image_path")
    if cached_path:
        return str(cached_path)

    photo_path = completion.get("photo_path")
    if not photo_path:
        return None
    photo = sb.storage.from_("completions").download(photo_path)
    photo_bytes = photo if isinstance(photo, bytes) else bytes(photo)
    if not photo_bytes:
        return None

    prompt = build_completion_mockup_master_prompt(build_story_mockup_prompt(skill))
    image = await generate_image(prompt, [photo_bytes], size="1K", aspect_ratio="9:16")
    story_path = f"promos/{completion['id']}-story.png"
    sb.storage.from_("completions").upload(
        story_path,
        image,
        {"content-type": "image/png", "upsert": "true"},
    )
    return story_path


def _approved_skill(sb: Client, skill_id: str) -> dict:
    skills = sb.table("skills").select("*").eq("id", skill_id).execute().data or []
    skill = next((row for row in skills if str(row.get("id")) == skill_id), None)
    if not skill or skill.get("status") != "approved":
        raise HTTPException(status_code=404, detail="skill not found")
    return skill


def _owned_completion(sb: Client, skill_id: str, completion_id: str, user_id: str) -> dict:
    rows = sb.table("skill_completions").select("*").eq("id", completion_id).execute().data or []
    completion = next(
        (
            row
            for row in rows
            if str(row.get("id")) == completion_id
            and str(row.get("skill_id")) == skill_id
            and str(row.get("user_id")) == user_id
        ),
        None,
    )
    if not completion:
        raise HTTPException(status_code=404, detail="completion not found")
    return completion


@router.get(
    "/{skill_id}/completions/{completion_id}",
    response_model=CompletionSellingKit,
)
async def get_completion_selling_kit(
    skill_id: str,
    completion_id: str,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> CompletionSellingKit:
    """Buat paket jual dari foto produk jadi milik pengguna dan cache hasilnya."""
    skill = _approved_skill(sb, skill_id)
    completion = _owned_completion(sb, skill_id, completion_id, user["user_id"])

    cached_kit = completion.get("selling_kit")

    async def load_kit() -> SellingKit:
        if isinstance(cached_kit, dict):
            return SellingKit.model_validate(cached_kit)
        return await generate_selling_kit(skill)

    kit_result, image_result = await asyncio.gather(
        load_kit(),
        _completion_promo_image(sb, skill, completion),
        return_exceptions=True,
    )
    if isinstance(kit_result, Exception):
        raise HTTPException(status_code=503, detail="materi promosi belum dapat dibuat")

    promo_path = None if isinstance(image_result, Exception) else image_result
    updates: dict = {}
    if not isinstance(cached_kit, dict):
        updates["selling_kit"] = kit_result.model_dump(mode="json")
    if promo_path and promo_path != completion.get("promo_image_path"):
        updates["promo_image_path"] = promo_path
    if updates:
        sb.table("skill_completions").update(updates).eq("id", completion_id).execute()

    promo_url = None
    if promo_path:
        base = get_settings().supabase_url.rstrip("/")
        promo_url = f"{base}/storage/v1/object/public/completions/{promo_path}"

    return CompletionSellingKit(
        **kit_result.model_dump(),
        completion_id=completion_id,
        promo_image_url=promo_url,
    )


@router.post(
    "/{skill_id}/completions/{completion_id}/story",
    response_model=CompletionStoryAsset,
)
async def get_completion_story_asset(
    skill_id: str,
    completion_id: str,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> CompletionStoryAsset:
    """Generate a vertical Story asset only when the user asks to share it."""
    skill = _approved_skill(sb, skill_id)
    completion = _owned_completion(sb, skill_id, completion_id, user["user_id"])
    try:
        story_path = await _completion_story_image(sb, skill, completion)
    except Exception:
        raise HTTPException(status_code=503, detail="template Story belum dapat dibuat")
    if not story_path:
        raise HTTPException(status_code=503, detail="template Story belum dapat dibuat")

    if story_path != completion.get("story_image_path"):
        sb.table("skill_completions").update({"story_image_path": story_path}).eq(
            "id", completion_id
        ).execute()

    base = get_settings().supabase_url.rstrip("/")
    return CompletionStoryAsset(
        completion_id=completion_id,
        story_image_url=f"{base}/storage/v1/object/public/completions/{story_path}",
    )
