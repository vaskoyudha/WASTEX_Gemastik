import base64

import httpx

from app.config import get_settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

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


async def generate_image(prompt: str) -> bytes:
    s = get_settings()
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            OPENROUTER_URL,
            headers={"Authorization": f"Bearer {s.openrouter_api_key}"},
            json={
                "model": s.image_model,
                "modalities": ["image", "text"],
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        r.raise_for_status()
        try:
            data_url = r.json()["choices"][0]["message"]["images"][0]["image_url"]["url"]
            return base64.b64decode(data_url.split(",", 1)[1])
        except (KeyError, IndexError) as e:
            raise ImageGenUnavailable("no image in provider response") from e
