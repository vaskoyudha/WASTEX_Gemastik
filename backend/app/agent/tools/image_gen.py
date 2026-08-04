import base64 as b64

import httpx

from app.config import get_settings

_MATERIAL_EN = {
    "plastik_pet": "clear PET plastic bottle",
    "plastik_hdpe": "HDPE plastic container",
    "kardus": "corrugated cardboard",
    "kaleng": "aluminum/tin can",
    "kaca": "glass bottle or jar",
    "sachet": "multilayer plastic sachet",
}

_STYLE_STORYBOARD = (
    "Simple flat illustration style, clean pastel colors, thick outlines, "
    "instructional diagram look, plain light background, no text, no watermark, "
    "no human faces, hands only when needed to show the action."
)

_STYLE_PHOTO = (
    "Photorealistic product photography, soft natural window light, neutral "
    "background, shallow depth of field, high detail, no text, no watermark."
)


def build_storyboard_prompt(skill: dict, step: dict) -> str:
    material = _MATERIAL_EN.get(skill.get("material", ""), "recycled household waste")
    warning = step.get("warning")
    safety = f" Emphasize safe handling: {warning}." if warning else ""
    return (
        f"Instructional storyboard panel for an upcycling craft tutorial, step "
        f"{step.get('order')}. Project: {skill.get('title')} made from {material}. "
        f"Show this action clearly: {step.get('instruction')}.{safety} {_STYLE_STORYBOARD}"
    )


def build_before_after_prompt(skill: dict) -> str:
    material = _MATERIAL_EN.get(skill.get("material", ""), "recycled household waste")
    return (
        f"Side-by-side before and after comparison image. Left (before): dirty used "
        f"{material} as household waste. Right (after): the finished upcycled product "
        f"'{skill.get('title')}', clean and attractive. Same lighting both sides, "
        f"divided by a thin vertical line. {_STYLE_PHOTO}"
    )


def build_mockup_prompt(skill: dict) -> str:
    material = _MATERIAL_EN.get(skill.get("material", ""), "recycled household waste")
    return (
        f"Product photography mockup of '{skill.get('title')}', a handmade upcycled "
        f"product crafted from {material}, styled on a wooden table with a small "
        f"plant, ready for an online catalog. Photorealistic. {_STYLE_PHOTO}"
    )


class ImageGenUnavailable(Exception):
    pass


_REFERENCE_FIELD_NAMES = {
    "codex": "image",  # codex accepts images[]; single primary ref via "image" for now
}

_MASTER_PROMPT = (
    "Helpful, objective illustrator of a single DIY upcycling tutorial panel. "
    "Rules: draw ONLY the action the step describes; never render text, letters, "
    "numbers or watermarks in the image; single object centered, front-left 3/4 "
    "view; composition and item must stay consistent across all panels that "
    "share a reference image."
)

_REFERENCE_POLICY = (
    " The previous panel is the truth for the item's look and style - match it. "
    "The scan photo keeps the real object's shape/color/material accurate."
)


def build_master_prompt(step_prompt: str, has_references: bool) -> str:
    policy = _REFERENCE_POLICY if has_references else ""
    return f"{_MASTER_PROMPT}{policy}\n\n{step_prompt}"


async def generate_image(prompt: str, reference_images: list[bytes] | None = None) -> bytes:
    s = get_settings()

    payload: dict = {
        "model": s.image_model,
        "prompt": prompt,
        "size": "1024x1024",
    }
    primary = reference_images[0] if reference_images else None
    if primary is not None:
        field = _REFERENCE_FIELD_NAMES.get(s.image_model.split("/")[0], "image")
        payload[field] = b64.b64encode(primary).decode()
        if field == "image" and s.image_model.split("/")[0] == "codex":
            payload["image_detail"] = "high"

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{s.openrouter_base_url}/images/generations?response_format=binary",
            headers={"Authorization": f"Bearer {s.openrouter_api_key}"},
            json=payload,
        )
        r.raise_for_status()
        return r.content
