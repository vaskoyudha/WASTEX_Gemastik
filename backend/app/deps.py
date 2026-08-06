from functools import lru_cache
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import get_current_user
from app.config import get_settings
from supabase import Client, create_client


def ensure_uuid(value: str, detail: str = "not found") -> None:
    """404 bila value bukan UUID valid.

    Kolom id bertipe uuid di PostgREST menolak nilai non-uuid dengan error
    22P02 yang tanpa guard ini bocor sebagai HTTP 500.
    """
    try:
        UUID(value)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=404, detail=detail)


@lru_cache
def get_supabase() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


def _bearer_token(authorization: str) -> str:
    return authorization.removeprefix("Bearer ").strip()


def require_service_role(authorization: str = Header(default="")) -> None:
    # TODO(spec §10): replace shared service key with per-expert JWT role/claim.
    if _bearer_token(authorization) != get_settings().supabase_service_key:
        raise HTTPException(status_code=403, detail="service role required")


def get_optional_user_id(
    authorization: str = Header(default=""),
    sb: Client = Depends(get_supabase),
) -> str | None:
    token = _bearer_token(authorization)
    if not token:
        return None
    try:
        user = sb.auth.get_user(token)
        return user.user.id if user and user.user else None
    except Exception:
        return None


def require_expert_or_service(
    authorization: str = Header(default=""),
    sb: Client = Depends(get_supabase),
) -> None:
    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=403, detail="service role or expert required")
    if token == get_settings().supabase_service_key:
        return
    try:
        user = get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    except HTTPException:
        raise HTTPException(status_code=403, detail="service role or expert required")
    rows = (
        sb.table("profiles")
        .select("role, auth_user_id")
        .eq("auth_user_id", user["user_id"])
        .execute()
    )
    profile = next(
        (row for row in (rows.data or []) if row.get("auth_user_id") == user["user_id"]),
        None,
    )
    if profile and profile.get("role") in ("expert", "admin"):
        return
    raise HTTPException(status_code=403, detail="expert role required")
