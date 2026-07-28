from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.agent.tools.vision import VisionUnavailable, scan_material
from app.config import get_settings
from app.deps import get_optional_user_id, get_supabase
from app.schemas import Material, ScanResponse
from supabase import Client

router = APIRouter()


@router.post("", response_model=ScanResponse)
async def scan(
    file: UploadFile,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> ScanResponse:
    image = await file.read()
    if not image:
        raise HTTPException(status_code=400, detail="empty image")
    try:
        ident = await scan_material(image, file.content_type or "image/jpeg")
    except VisionUnavailable:
        raise HTTPException(status_code=503, detail="vision providers unavailable")

    # TODO(spec §10): upload image to Supabase Storage and store image_url.
    row = (
        sb.table("scans")
        .insert(
            {
                "user_id": user_id,
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
