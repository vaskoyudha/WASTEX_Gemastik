import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.agent.fallback import generic_safe_procedure
from app.agent.orchestrator import build_query, generate_solution
from app.agent.tools.discovery import discover_skill
from app.agent.tools.retrieval import search_skills
from app.config import get_settings
from app.deps import get_supabase
from app.schemas import Material, RecommendRequest, RecommendResponse
from supabase import Client

router = APIRouter()


@router.post("", response_model=RecommendResponse)
async def recommend(
    req: RecommendRequest,
    background_tasks: BackgroundTasks,
    sb: Client = Depends(get_supabase),
) -> RecommendResponse:
    started = time.monotonic()
    gate_path: list[str] = []

    material, condition = req.material, req.condition
    if req.scan_id is not None:
        res = sb.table("scans").select("*").eq("id", str(req.scan_id)).single().execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="scan not found")
        material = material or (Material(res.data["material"]) if res.data["material"] else None)
        condition = condition or (res.data["condition"] or "")
    if material is None:
        raise HTTPException(status_code=422, detail="material or scan_id with identified material required")
    gate_path.append("vision_ok")

    query = build_query(material.value, condition, req.user_intent)
    chunks = await search_skills(sb, query, material.value)

    # Gate 2: knowledge gap -> fire discovery, answer with generic safe procedure.
    threshold = get_settings().rerank_score_threshold
    if not chunks or chunks[0].rerank_score < threshold:
        gate_path += ["gap_detected", "fallback"]
        background_tasks.add_task(discover_skill, material, req.user_intent)
        package = generic_safe_procedure(material)
        _log_run(sb, req, query, [], gate_path, package.recommendation, started)
        return RecommendResponse(status="generic_safe_procedure", package=package, gate_path=gate_path)

    gate_path.append("retrieval_ok")
    package = await generate_solution(query, chunks)
    gate_path.append("generation_ok")
    _log_run(sb, req, query, [c.chunk_id for c in chunks], gate_path, package.recommendation, started)
    return RecommendResponse(status="grounded", package=package, gate_path=gate_path)


def _log_run(
    sb: Client,
    req: RecommendRequest,
    query: str,
    chunk_ids: list[str],
    gate_path: list[str],
    answer: str,
    started: float,
) -> None:
    sb.table("agent_runs").insert(
        {
            "scan_id": str(req.scan_id) if req.scan_id else None,
            "query": query,
            "retrieved_chunk_ids": chunk_ids,
            "gate_path": gate_path,
            "answer": answer,
            "latency_ms": int((time.monotonic() - started) * 1000),
        }
    ).execute()
