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
    cached = sb.table("generated_visuals").select("*").eq("skill_id", skill_id).execute()
    hit = next(
        (
            row
            for row in (cached.data or [])
            if row.get("skill_id") == skill_id
            and row.get("kind") == kind
            and row.get("step_order") == step_order
        ),
        None,
    )
    if hit:
        return {
            "skill_id": skill_id,
            "kind": kind,
            "step": step_order,
            "image_path": hit["image_path"],
            "cached": True,
        }

    if kind == "storyboard":
        steps = skill.get("steps") or []
        target = next((st for st in steps if st.get("order") == step), None)
        if target is None:
            raise HTTPException(status_code=404, detail="step not found")
        prompt = build_storyboard_prompt(skill, target)
    elif kind == "before_after":
        prompt = build_before_after_prompt(skill)
    else:
        prompt = build_mockup_prompt(skill)

    try:
        image = await generate_image(prompt)
    except ImageGenUnavailable:
        raise HTTPException(status_code=503, detail="image provider unavailable")

    path = _cache_key(skill_id, kind, step_order)
    sb.storage.from_("visuals").upload(path, image, {"content-type": "image/png"})
    sb.table("generated_visuals").insert(
        {
            "skill_id": skill_id,
            "kind": kind,
            "step_order": step_order,
            "image_path": path,
            "prompt": prompt,
        }
    ).execute()
    return {
        "skill_id": skill_id,
        "kind": kind,
        "step": step_order,
        "image_path": path,
        "cached": False,
    }
