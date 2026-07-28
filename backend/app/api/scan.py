import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.agent.tools.vision import VisionUnavailable, scan_material
from app.config import get_settings
from app.deps import get_optional_user_id, get_supabase
from app.schemas import Material, ScanResponse
from supabase import Client

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"]


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
    try:
        ident = await scan_material(image, content_type)
    except VisionUnavailable:
        raise HTTPException(status_code=503, detail="vision providers unavailable")

    scan_id = str(uuid4())
    object_path = f"{scan_id}.{content_type.split('/')[-1]}"
    image_url: str | None = object_path
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
