from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from app.deps import get_optional_user_id, get_supabase, require_expert_or_service
from app.rag.document_ingest import extract_pdf, extract_url, ingest_document
from app.schemas import DocumentCreateRequest, DocumentStatusUpdate
from supabase import Client

router = APIRouter()

MATERIALS = {"plastik_pet", "plastik_hdpe", "kardus", "kaleng", "kaca", "sachet"}
MAX_PDF_BYTES = 50 * 1024 * 1024


@router.post("", status_code=201, dependencies=[Depends(require_expert_or_service)])
async def create_document(
    body: DocumentCreateRequest,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> dict:
    materials = [m.value for m in body.materials]
    if body.source_type == "url":
        if not body.url:
            raise HTTPException(status_code=400, detail="url wajib untuk source_type=url")
        try:
            await extract_url(body.url)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"url tidak bisa dibaca: {exc}")
        payload = {
            "title": body.title,
            "source_type": "url",
            "url": body.url,
            "materials": materials,
        }
    else:
        raise HTTPException(status_code=400, detail="upload PDF via POST /documents/pdf")
    payload.update({"status": "pending", "created_by": user_id})
    res = sb.table("documents").insert(payload).execute()
    return res.data[0]


@router.post("/pdf", status_code=201, dependencies=[Depends(require_expert_or_service)])
async def create_document_pdf(
    file: UploadFile = File(...),
    title: str = Form(...),
    materials: str = Form(...),
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> dict:
    data = await file.read()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=400, detail="PDF melebihi 50MB")
    try:
        extract_pdf(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"PDF tidak bisa dibaca: {exc}")
    material_list = [m.strip() for m in materials.split(",") if m.strip()]
    invalid = [m for m in material_list if m not in MATERIALS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"material tidak dikenal: {invalid}")
    doc_id = str(uuid4())
    path = f"documents/{doc_id}.pdf"
    sb.storage.from_("documents").upload(path, data)
    res = (
        sb.table("documents")
        .insert(
            {
                "id": doc_id,
                "title": title,
                "source_type": "pdf",
                "file_path": path,
                "materials": material_list,
                "status": "pending",
                "created_by": user_id,
            }
        )
        .execute()
    )
    return res.data[0]


@router.get("", dependencies=[Depends(require_expert_or_service)])
def list_documents(
    status: str | None = None,
    sb: Client = Depends(get_supabase),
) -> list[dict]:
    q = sb.table("documents").select("*")
    if status:
        q = q.eq("status", status)
    rows = q.order("created_at", desc=True).execute().data
    # FakeSupabase eq() is a no-op; filter status client-side to match prod semantics.
    if status:
        rows = [r for r in rows if r.get("status") == status]
    return rows


@router.patch("/{document_id}/status", dependencies=[Depends(require_expert_or_service)])
async def update_status(
    document_id: UUID,
    body: DocumentStatusUpdate,
    background_tasks: BackgroundTasks,
    sb: Client = Depends(get_supabase),
) -> dict:
    res = (
        sb.table("documents")
        .update({"status": body.status, "reviewed_by": body.reviewed_by})
        .eq("id", str(document_id))
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="document not found")
    if body.status == "approved":
        background_tasks.add_task(ingest_document, sb, document_id)
    return res.data[0]


@router.post("/{document_id}/reingest", dependencies=[Depends(require_expert_or_service)])
async def reingest(
    document_id: UUID,
    sb: Client = Depends(get_supabase),
) -> dict:
    res = sb.table("documents").select("*").eq("id", str(document_id)).single().execute()
    if not res.data or res.data["status"] != "approved":
        raise HTTPException(status_code=400, detail="document must be approved first")
    try:
        count = await ingest_document(sb, document_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"reingest failed: {exc}")
    return {"ingested": count}


@router.delete("/{document_id}", dependencies=[Depends(require_expert_or_service)])
def delete_document(
    document_id: UUID,
    sb: Client = Depends(get_supabase),
) -> dict:
    res = sb.table("documents").select("*").eq("id", str(document_id)).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="document not found")
    if res.data.get("file_path"):
        sb.storage.from_("documents").remove([res.data["file_path"]])
    sb.table("documents").delete().eq("id", str(document_id)).execute()
    return {"deleted": str(document_id)}
