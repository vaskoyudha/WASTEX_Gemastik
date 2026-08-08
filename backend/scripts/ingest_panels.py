"""Ingest ChatGPT-generated panels into Supabase for one skill.

Meniru persis apa yang dilakukan generate_all_visuals() (backend/app/api/visuals.py):
- nama file via _cache_key: {skill_id}-{kind}{-step}.png, mockup -> -mockup-sales-v2.png
- prompt final = build_master_prompt / build_mockup_master_prompt
- kirim ke storage bucket "visuals" lalu insert baris ke generated_visuals.

Jalankan dari backend/: uv run python scripts/ingest_panels.py <skill-id> <dir-png>
"""

import argparse
import asyncio
from pathlib import Path

from app.agent.tools.image_gen import (
    MOCKUP_PROMPT_REVISION,
    build_before_after_prompt,
    build_master_prompt,
    build_materials_panel_prompt,
    build_mockup_master_prompt,
    build_mockup_prompt,
    build_storyboard_prompt,
)
from app.schemas import ObjectIdentity


def cache_key(skill_id: str, kind: str, step: int | None) -> str:
    if kind == "mockup":
        return f"{skill_id}-{kind}-{MOCKUP_PROMPT_REVISION}.png"
    suffix = f"-{step}" if step is not None else ""
    return f"{skill_id}-{kind}{suffix}.png"


def build_slots(skill: dict, identity: ObjectIdentity) -> list[tuple[str, int | None, str, str]]:
    """Return [(kind, step, final_prompt, cache_filename)] dalam urutan generate."""
    refs_hint = True  # panel manual selalu punya refs (foto scan / panel sebelumnya)
    slots: list[tuple[str, int | None, str, str]] = []
    mat = build_materials_panel_prompt(skill, identity)
    slots.append(
        (
            "materials",
            None,
            build_master_prompt(mat, refs_hint),
            cache_key(skill["id"], "materials", None),
        )
    )
    orders = sorted(st.get("order") for st in skill["steps"] if st.get("order") is not None)
    for order in orders:
        step = next(st for st in skill["steps"] if st["order"] == order)
        raw = build_storyboard_prompt(skill, step, identity=identity, step_count=len(orders))
        slots.append(
            (
                "storyboard",
                order,
                build_master_prompt(raw, refs_hint),
                cache_key(skill["id"], "storyboard", order),
            )
        )
    ba = build_before_after_prompt(skill)
    slots.append(
        (
            "before_after",
            None,
            build_master_prompt(ba, refs_hint),
            cache_key(skill["id"], "before_after", None),
        )
    )
    mock = build_mockup_master_prompt(build_mockup_prompt(skill), refs_hint)
    slots.append(("mockup", None, mock, cache_key(skill["id"], "mockup", None)))
    return slots


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("skill_id")
    parser.add_argument(
        "panel_dir", help="dir berisi 10 png berurut: materials, step1..N, before_after, mockup"
    )
    parser.add_argument(
        "--identity", help="path file JSON identity (opsional; default ObjectIdentity kosong)"
    )
    args = parser.parse_args()

    import os

    from dotenv import load_dotenv

    from supabase import create_client

    load_dotenv()
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    rows = sb.table("skills").select("*").eq("id", args.skill_id).execute().data
    skill = next((r for r in rows if str(r.get("id")) == args.skill_id), None)
    if not skill:
        raise SystemExit(f"skill {args.skill_id} tidak ditemukan")
    print(f"skill: {skill['title']} ({skill['status']}), steps={len(skill['steps'])}", flush=True)

    if args.identity:
        identity = ObjectIdentity.model_validate_json(Path(args.identity).read_text())
    else:
        identity = ObjectIdentity(
            shape="unknown", dominant_colors=["unknown"], material=skill.get("material", "unknown")
        )

    slots = build_slots(skill, identity)
    if len(slots) != 10:
        raise SystemExit(f"slot tidak 10 (={len(slots)}), periksa jumlah steps")

    pngs = sorted(p for p in Path(args.panel_dir).glob("*.png"))
    if len(pngs) != len(slots):
        raise SystemExit(f"ditemukan {len(pngs)} png, butuh {len(slots)}")
    pairs = list(zip(slots, pngs))

    ref_path = skill.get("reference_image_path")
    for (kind, step, prompt, fname), png in pairs:
        image = png.read_bytes()
        sb.storage.from_("visuals").upload(fname, image, {"content-type": "image/png"})
        sb.table("generated_visuals").insert(
            {
                "skill_id": skill["id"],
                "kind": kind,
                "step_order": step,
                "image_path": fname,
                "prompt": prompt,
                "reference_image_path": ref_path,
            }
        ).execute()
        print(f"  uploaded + row: {fname}  <- {png.name}  ({len(image)} bytes)", flush=True)

    print("done")


if __name__ == "__main__":
    asyncio.run(main())
