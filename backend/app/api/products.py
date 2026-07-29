from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_supabase
from supabase import Client

router = APIRouter()


@router.get("")
async def list_products(limit: int = 20, offset: int = 0, sb: Client = Depends(get_supabase)):
    resp = (
        sb.table("skills")
        .select("*")
        .eq("status", "approved")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return resp.data or []


@router.get("/{product_id}")
async def get_product(product_id: str, sb: Client = Depends(get_supabase)):
    resp = sb.table("skills").select("*").eq("id", product_id).single().execute()

    if not resp.data:
        raise HTTPException(status_code=404, detail="Product not found")

    return resp.data


@router.get("/{product_id}/recommendations")
async def get_recommendations(product_id: str, limit: int = 5, sb: Client = Depends(get_supabase)):
    product_resp = sb.table("skills").select("*").eq("id", product_id).single().execute()

    if not product_resp.data:
        raise HTTPException(status_code=404, detail="Product not found")

    material = product_resp.data.get("material")
    if not material:
        return []

    resp = (
        sb.table("skills")
        .select("*")
        .eq("status", "approved")
        .eq("material", material)
        .neq("id", product_id)
        .limit(limit)
        .execute()
    )

    return resp.data or []
