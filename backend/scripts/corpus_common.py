"""Shared helpers for the corpus seeding scripts (unit-tested hermetically)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

from app.rag.document_ingest import ingest_document
from app.rag.ingest import ingest_skill

MATERIAL_QUERIES = {
    "plastik_pet": "cara membuat pot tanaman dari botol plastik",
    "plastik_hdpe": "kerajinan dari galon atau kantong plastik bekas",
    "kardus": "buat rak atau kotak dari kardus bekas",
    "kaleng": "kerajinan dari kaleng bekas",
    "kaca": "kerajinan aman dari botol kaca",
    "sachet": "membuat dompet dari bungkus sachet",
}
PASS_THRESHOLD = 0.40


def should_skip_seed(existing_drafts: list, force: bool) -> bool:
    return bool(existing_drafts) and not force


def coverage_pass(rerank_scores: list[float], threshold: float = PASS_THRESHOLD) -> bool:
    return any(s >= threshold for s in rerank_scores)


def format_seed_review(items: list[dict]) -> str:
    from datetime import date

    safe = [i for i in items if i["safe"]]
    unsafe = [i for i in items if not i["safe"]]
    lines = [f"# Seed Review — {date.today().isoformat()}", ""]  # noqa: DTZ011
    lines.append(f"## Lolos ({len(safe)}/{len(items)})")
    for i in safe:
        srcs = ", ".join(i["sources"]) or "-"
        lines.append(
            f"- [{i['id']}] {i['title']} — {i['material']}/{i['difficulty']} — safe — sumber: [{srcs}]"
        )
    lines.append("")
    lines.append(f"## Perlu perhatian ({len(unsafe)}/{len(items)})")
    for i in unsafe:
        violations = "; ".join(i["violations"] or [])
        lines.append(f'- [{i["id"]}] {i["title"]} — UNSAFE: "{violations}" — jangan approve')
    return "\n".join(lines)


def format_coverage_report(results: list[dict]) -> str:
    lines = ["# Coverage Report", ""]
    for r in results:
        if r["pass"]:
            lines.append(
                f"[PASS] {r['material']}: {r['chunks']} chunks, top={r['top_source']} ({r['top_score']})"
            )
        else:
            lines.append(
                f"[FAIL] {r['material']}: {r['chunks']} chunks — korpus belum punya konten {r['material']}!"
            )
    return "\n".join(lines)


async def approve_skill(sb, skill_id: str, reviewed_by: str = "seed-pipeline") -> dict:
    # .single() raises 406 on 0 rows against real PostgREST — use limit(1) +
    # next(..., None) (the repo's own pattern in skills.py flag_skill).
    res = sb.table("skills").select("id").eq("id", skill_id).limit(1).execute()
    row = next((r for r in (res.data or []) if str(r.get("id")) == skill_id), None)
    if not row:
        return {"id": skill_id, "skipped": True}
    status_row = sb.table("skills").select("status").eq("id", skill_id).limit(1).execute()
    status = next((r.get("status") for r in (status_row.data or [])), None)
    if status != "draft":
        return {"id": skill_id, "skipped": True}
    sb.table("skills").update({"status": "approved", "reviewed_by": reviewed_by}).eq(
        "id", skill_id
    ).execute()
    try:
        chunks = await ingest_skill(sb, skill_id)
        return {"id": skill_id, "status": "approved", "chunks": chunks}
    except Exception as exc:
        # Revert to draft so a later run can retry; otherwise the skill stays
        # approved-with-0-chunks and approve_corpus.py forever SKIPs it.
        sb.table("skills").update({"status": "draft"}).eq("id", skill_id).execute()
        return {"id": skill_id, "status": "approved", "error": str(exc)}


async def ingest_document_source(sb, source: dict) -> dict:
    existing = sb.table("documents").select("id").eq("url", source["url"]).execute()
    if existing.data:
        return {"id": source["id"], "skipped": True}
    # sources.yaml entries have no source_type key — derive it from the URL.
    source_type = source.get("source_type") or (
        "pdf" if source["url"].lower().endswith(".pdf") else "url"
    )
    if source_type == "pdf":
        async with httpx.AsyncClient(
            timeout=60,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
                )
            },
        ) as client:
            r = await client.get(source["url"])
            r.raise_for_status()
        from uuid import uuid4

        doc_id = str(uuid4())
        path = f"documents/{doc_id}.pdf"
        sb.storage.from_("documents").upload(path, r.content)
        sb.table("documents").insert(
            {
                "id": doc_id,
                "title": source["title"],
                "source_type": "pdf",
                "url": source["url"],
                "file_path": path,
                "materials": source["materials"],
                "status": "approved",
            }
        ).execute()
    else:
        res = (
            sb.table("documents")
            .insert(
                {
                    "title": source["title"],
                    "source_type": "url",
                    "url": source["url"],
                    "materials": source["materials"],
                    "status": "approved",
                }
            )
            .execute()
        )
        doc_id = res.data[0]["id"]
    try:
        chunks = await ingest_document(sb, doc_id)
        return {"id": source["id"], "chunks": chunks}
    except Exception as exc:
        return {"id": source["id"], "error": str(exc)}
