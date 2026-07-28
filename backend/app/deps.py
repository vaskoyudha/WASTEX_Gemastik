from functools import lru_cache

from fastapi import Header, HTTPException

from app.config import get_settings
from supabase import Client, create_client


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


def get_optional_user_id(authorization: str = Header(default="")) -> str | None:
    token = _bearer_token(authorization)
    if not token:
        return None
    try:
        user = get_supabase().auth.get_user(token)
        return user.user.id if user and user.user else None
    except Exception:
        return None
