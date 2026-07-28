from fastapi import APIRouter, Depends

from app.deps import get_supabase, require_service_role
from app.rag.ingest import ingest_skill
from app.schemas import IngestRequest
from supabase import Client

router = APIRouter(dependencies=[Depends(require_service_role)])


@router.post("")
async def ingest(body: IngestRequest, sb: Client = Depends(get_supabase)) -> dict:
    if body.skill_ids:
        ids = [str(i) for i in body.skill_ids]
    else:
        rows = sb.table("skills").select("id").eq("status", "approved").execute().data
        ids = [r["id"] for r in rows]

    results: dict[str, int | str] = {}
    for skill_id in ids:
        try:
            results[skill_id] = await ingest_skill(sb, skill_id)
        except ValueError as e:
            results[skill_id] = str(e)
    return {"ingested": results}
