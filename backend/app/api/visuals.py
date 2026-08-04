from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from app.agent.tools.image_gen import (
    ImageGenUnavailable,
    build_before_after_prompt,
    build_mockup_prompt,
    build_storyboard_prompt,
    generate_image,
)
from app.deps import get_supabase
from supabase import Client

router = APIRouter()

Kind = Literal["storyboard", "before_after", "mockup"]


def _cache_key(skill_id: str, kind: str, step: int | None) -> str:
    suffix = f"-{step}" if step is not None else ""
    return f"{skill_id}-{kind}{suffix}.png"


def _step_by_order(skill: dict, step: int | None) -> dict | None:
    if step is None:
        return None
    return next((st for st in (skill.get("steps") or []) if st.get("order") == step), None)


def _cached_visual(sb: Client, skill_id: str, kind: str, step: int | None) -> dict | None:
    cached = sb.table("generated_visuals").select("*").eq("skill_id", skill_id).execute()
    return next(
        (
            row
            for row in (cached.data or [])
            if row.get("skill_id") == skill_id
            and row.get("kind") == kind
            and row.get("step_order") == step
        ),
        None,
    )


async def _generate_visual(sb: Client, skill: dict, kind: Kind, step: int | None) -> dict:
    if kind == "storyboard":
        target = _step_by_order(skill, step)
        if target is None:
            raise KeyError(f"step {step} not found")
        prompt = build_storyboard_prompt(skill, target)
    elif kind == "before_after":
        prompt = build_before_after_prompt(skill)
    else:
        prompt = build_mockup_prompt(skill)

    image = await generate_image(prompt)

    path = _cache_key(skill["id"], kind, step)
    sb.storage.from_("visuals").upload(path, image, {"content-type": "image/png"})
    sb.table("generated_visuals").insert(
        {
            "skill_id": skill["id"],
            "kind": kind,
            "step_order": step,
            "image_path": path,
            "prompt": prompt,
        }
    ).execute()
    return {
        "skill_id": skill["id"],
        "kind": kind,
        "step": step,
        "image_path": path,
        "cached": False,
    }


async def generate_all_visuals(sb: Client, skill_id: str) -> None:
    """Pre-generate every visual for a skill, in sequence: each step's
    storyboard (in step order), then before/after, then mockup. Already-cached
    visuals are skipped; a single failed image does not abort the batch."""
    res = sb.table("skills").select("*").eq("id", skill_id).execute()
    skill = next((row for row in (res.data or []) if str(row.get("id")) == skill_id), None)
    if not skill or skill.get("status") != "approved":
        return

    cached = sb.table("generated_visuals").select("*").eq("skill_id", skill_id).execute()
    have = {(row.get("kind"), row.get("step_order")) for row in (cached.data or [])}

    orders = sorted(
        st.get("order") for st in (skill.get("steps") or []) if st.get("order") is not None
    )
    for order in orders:
        if ("storyboard", order) in have:
            continue
        try:
            await _generate_visual(sb, skill, "storyboard", order)
        except ImageGenUnavailable:
            continue

    extra: list[tuple[Kind, None]] = [("before_after", None), ("mockup", None)]
    for kind, step in extra:
        if (kind, step) in have:
            continue
        try:
            await _generate_visual(sb, skill, kind, step)
        except ImageGenUnavailable:
            continue


@router.get("/{skill_id}/{kind}")
async def get_visual(
    skill_id: str,
    kind: Kind,
    step: int | None = None,
    sb: Client = Depends(get_supabase),
) -> dict:
    res = sb.table("skills").select("*").eq("id", skill_id).execute()
    skill = next((row for row in (res.data or []) if str(row.get("id")) == skill_id), None)
    if not skill or skill.get("status") != "approved":
        raise HTTPException(status_code=404, detail="skill not found")

    step_order = step if kind == "storyboard" else None
    hit = _cached_visual(sb, skill_id, kind, step_order)
    if hit:
        return {
            "skill_id": skill_id,
            "kind": kind,
            "step": step_order,
            "image_path": hit["image_path"],
            "cached": True,
        }

    if kind == "storyboard" and _step_by_order(skill, step) is None:
        raise HTTPException(status_code=404, detail="step not found")

    try:
        return await _generate_visual(sb, skill, kind, step_order)
    except ImageGenUnavailable:
        raise HTTPException(status_code=503, detail="image provider unavailable")
