import asyncio, sys
from pathlib import Path

from app.agent.tools.vision import scan_material
from app.agent.tools.skill_proposals import generate_proposals, verify_draft

IMG = Path("/home/vyns/Documents/github/WASTEX_Gemastik/visuals/manual-generation/coke_can.jpg")

async def main():
    print(">>> scan...", flush=True)
    scan = await scan_material(IMG.read_bytes())
    print(">>> scan done:", scan.material, scan.confidence, flush=True)
    print(">>> generate_proposals (kritik+repair loop)...", flush=True)
    proposals = await generate_proposals(scan.material, scan.condition)
    print(">>> proposals:", len(proposals), flush=True)
    for i, p in enumerate(proposals):
        print(f"[{i}] {p.title} | {len(p.steps)} steps", flush=True)
        for s in p.steps:
            print(f"    {s.order}. {s.instruction[:100]}", flush=True)
    print(">>> verify proposal[0]...", flush=True)
    v = await verify_draft(proposals[0], [])
    print(">>> verdict[0]:", v.verdict, flush=True)
    for f in v.feedback:
        print("    FEEDBACK:", f[:180], flush=True)

asyncio.run(main())
