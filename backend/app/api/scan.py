import hashlib
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.agent.tools.vision import VisionUnavailable, scan_material
from app.auth import get_current_user
from app.config import get_settings
from app.deps import get_optional_user_id, get_supabase
from app.schemas import Material, MaterialIdentification, ScanResponse
from supabase import Client

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]


@router.post("", response_model=ScanResponse)
async def scan(
    file: UploadFile,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> ScanResponse:
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG, PNG, or HEIC.",
        )

    # Read file content
    image = await file.read()

    # Validate file size
    if len(image) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large: {len(image)} bytes. Maximum is 10MB.",
        )

    if not image:
        raise HTTPException(status_code=400, detail="empty image")
    content_type = file.content_type or "image/jpeg"

    # Check for cached result based on image hash
    image_hash = hashlib.sha256(image).hexdigest()
    ident: MaterialIdentification | None = None
    prev = sb.table("scans").select("*").eq("image_hash", image_hash).limit(1).execute()
    hit = next(
        (r for r in (prev.data or []) if r.get("image_hash") == image_hash and r.get("raw_json")),
        None,
    )
    if hit:
        ident = MaterialIdentification.model_validate(hit["raw_json"])
    else:
        try:
            ident = await scan_material(image, content_type)
        except VisionUnavailable:
            raise HTTPException(status_code=503, detail="vision providers unavailable")

    scan_id = str(uuid4())
    object_path = f"{scan_id}.{content_type.split('/')[-1]}"
    image_url: str | None = object_path
    if hit:
        image_url = hit.get("image_url")
    else:
        try:
            sb.storage.from_("scans").upload(object_path, image, {"content-type": content_type})
        except Exception:
            logger.exception("scan image upload failed; storing scan without image_url")
            image_url = None

    row = (
        sb.table("scans")
        .insert(
            {
                "id": scan_id,
                "user_id": user_id,
                "image_url": image_url,
                "image_hash": image_hash,
                "material": ident.material.value,
                "condition": ident.condition,
                "confidence": ident.confidence,
                "raw_json": ident.model_dump(mode="json"),
            }
        )
        .execute()
        .data[0]
    )

    # Gate 1: low confidence -> user picks material manually.
    if ident.confidence < get_settings().vision_confidence_threshold:
        return ScanResponse(
            scan_id=row["id"],
            status="needs_manual_verification",
            identification=ident,
            material_options=list(Material),
        )
    return ScanResponse(scan_id=row["id"], status="identified", identification=ident)


@router.delete("/{scan_id}", status_code=204)
def delete_scan(
    scan_id: str,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> None:
    res = sb.table("scans").select("*").eq("id", scan_id).execute()
    row = next((r for r in (res.data or []) if str(r.get("id")) == scan_id), None)
    # UU PDP: return 404 (not 403) for non-owners to avoid leaking scan existence.
    if not row or row.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=404, detail="scan not found")
    if row.get("image_url"):
        try:
            sb.storage.from_("scans").remove([row["image_url"]])
        except Exception:
            logger.exception("failed to remove scan image %s", row["image_url"])
    sb.table("scans").delete().eq("id", scan_id).execute()
