from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.deps import get_supabase
from supabase import Client

router = APIRouter()


class CreateListingRequest(BaseModel):
    skill_id: str
    price: int
    description: str = ""


class UpdateListingRequest(BaseModel):
    price: int | None = None
    description: str | None = None
    status: str | None = None


@router.get("")
async def list_marketplace(
    status: str = "available", limit: int = 20, sb: Client = Depends(get_supabase)
):
    resp = (
        sb.table("skills")
        .select("*, author_id")
        .eq("status", "approved")
        .limit(limit)
        .execute()
    )

    items = []
    for skill in (resp.data or []):
        items.append(
            {
                "id": skill["id"],
                "skill_id": skill["id"],
                "title": skill["title"],
                "description": skill.get("description", ""),
                "price": 50000,
                "seller_id": skill.get("author_id", "unknown"),
                "status": "available",
                "created_at": skill.get("created_at"),
            }
        )

    return items


@router.post("", status_code=201)
async def create_listing(
    request: CreateListingRequest,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
):
    skill_resp = (
        sb.table("skills").select("id").eq("id", request.skill_id).single().execute()
    )

    if not skill_resp.data:
        raise HTTPException(status_code=404, detail="Skill not found")

    listing = {
        "skill_id": request.skill_id,
        "seller_id": user["user_id"],
        "price": request.price,
        "description": request.description,
        "status": "available",
    }

    resp = sb.table("marketplace").insert(listing).execute()

    return resp.data[0] if resp.data else listing


@router.patch("/{listing_id}")
async def update_listing(
    listing_id: str,
    request: UpdateListingRequest,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
):
    resp = (
        sb.table("marketplace")
        .select("seller_id")
        .eq("id", listing_id)
        .single()
        .execute()
    )

    if not resp.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    if resp.data["seller_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    sb.table("marketplace").update(updates).eq("id", listing_id).execute()

    return {"message": "Listing updated"}
