from uuid import UUID

from app.rag.chunking import chunk_text
from app.rag.embeddings import embed_texts
from supabase import Client


def _skill_to_sections(skill: dict) -> list[tuple[str, str]]:
    steps = "\n".join(
        f"{s['order']}. {s['instruction']}" + (f" (Peringatan: {s['warning']})" if s.get("warning") else "")
        for s in skill.get("steps", [])
    )
    tools = ", ".join(
        t["name"] + (" (opsional)" if t.get("optional") else "") for t in skill.get("tools", [])
    )
    risks = "\n".join(f"- {r['hazard']}: {r['mitigation']}" for r in skill.get("risks", []))
    overview = (
        f"{skill['title']}. Material: {skill['material']}. Tingkat: {skill['difficulty']}. "
        f"Perkiraan biaya: Rp{skill.get('est_cost_idr') or '-'}, "
        f"perkiraan harga jual: Rp{skill.get('est_price_idr') or '-'}. Alat: {tools}."
    )
    sections = [("overview", overview)]
    if steps:
        sections.append(("steps", f"Langkah-langkah {skill['title']}:\n{steps}"))
    if risks:
        sections.append(("risks", f"Risiko dan mitigasi {skill['title']}:\n{risks}"))
    return sections


async def ingest_skill(sb: Client, skill_id: UUID | str) -> int:
    res = sb.table("skills").select("*").eq("id", str(skill_id)).single().execute()
    skill = res.data
    if skill["status"] != "approved":
        raise ValueError(f"skill {skill_id} is not approved (status={skill['status']})")

    sb.table("skill_chunks").delete().eq("skill_id", str(skill_id)).execute()

    chunks = []
    for section, text in _skill_to_sections(skill):
        meta = {"material": skill["material"], "difficulty": skill["difficulty"], "section": section}
        chunks.extend(chunk_text(text, metadata=meta))
    if not chunks:
        return 0

    embeddings = await embed_texts([c.content for c in chunks])
    rows = [
        {
            "skill_id": str(skill_id),
            "content": c.content,
            "embedding": e,
            "metadata": c.metadata,
        }
        for c, e in zip(chunks, embeddings)
    ]
    sb.table("skill_chunks").insert(rows).execute()
    return len(rows)
