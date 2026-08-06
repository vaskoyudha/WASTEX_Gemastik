import asyncio, json
from pathlib import Path

from app.agent.tools.vision import scan_material, extract_object_identity
from app.agent.tools.skill_proposals import generate_proposals, verify_draft

IMG = Path("/home/vyns/Documents/github/WASTEX_Gemastik/visuals/manual-generation/coke_can.jpg")

async def main():
    img_bytes = IMG.read_bytes()
    scan = await scan_material(img_bytes)
    identity = await extract_object_identity(img_bytes)
    proposals = await generate_proposals(scan.material, scan.condition)

    chosen, verdict = None, None
    for i, p in enumerate(proposals):
        v = await verify_draft(p, [])
        print(f"proposal[{i}] {p.title!r} ({len(p.steps)} steps) -> {v.verdict}")
        if v.verdict == "layak" and chosen is None:
            chosen, verdict = p, v

    if chosen is None:
        chosen, verdict = proposals[0], None
        print("!! tidak ada layak, pakai proposal[0]")

    out = {
        "scan": scan.model_dump(),
        "identity": identity.model_dump(),
        "proposals": [p.model_dump() for p in proposals],
        "chosen": chosen.model_dump(),
        "verdict": verdict.model_dump() if verdict else None,
    }
    json.dump(out, open('/tmp/opencode/coke_flow3.json', 'w'), indent=2, ensure_ascii=False)
    print("chosen:", chosen.title, "| verdict:", verdict.verdict if verdict else None)
    for s in chosen.steps:
        print(f"   {s.order}. {s.instruction[:100]}")

asyncio.run(main())
