from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.config import get_settings
from app.schemas import (
    AuthLoginResponse,
    AuthRegisterResponse,
    LoginRequest,
    RegisterRequest,
    UserProfileResponse,
)
from supabase import Client, create_client


async def get_auth_supabase() -> Client:
    """Dependency that always returns fresh Supabase client."""
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


router = APIRouter(tags=["auth"])


def _extract_access_token(creds) -> str:
    """Pull a JWT from a sign_up/sign_in response, tolerating both shapes."""
    session = getattr(creds, "session", None)
    return (
        getattr(creds, "access_token", None)
        or (getattr(session, "access_token", None) if session else None)
        or ""
    )


def _resolve_auth_user(sb: Client, email: str, password: str) -> tuple[str, str]:
    """Return (auth_user_id, access_token) for the given credentials.

    The client-side ``supabase.auth.signUp`` usually creates the auth user
    BEFORE this endpoint runs, so a second ``sign_up`` fails with
    "User already registered". Treat that case as success and sign in instead,
    which keeps registration idempotent and safe to retry.
    """
    try:
        creds = sb.auth.sign_up({"email": email, "password": password})
    except Exception as e:
        if "already" not in str(e).lower():
            raise
        creds = sb.auth.sign_in_with_password({"email": email, "password": password})

    if not creds.user or not creds.user.id:
        raise HTTPException(status_code=400, detail="Failed to create user")
    return creds.user.id, _extract_access_token(creds)


@router.post("/register", response_model=AuthRegisterResponse, status_code=201)
async def register(
    request: RegisterRequest,
    sb: Client = Depends(get_auth_supabase),
):
    """Register new user with email/password and create profile."""
    try:
        user_id, access_token = _resolve_auth_user(sb, request.email, request.password)

        # Reuse an existing profile when present (idempotent re-registration),
        # otherwise create one.
        existing = sb.table("profiles").select("*").eq("auth_user_id", user_id).execute()
        profile = existing.data[0] if existing.data else None
        if not profile:
            profile_data = {
                "id": str(uuid4()),
                "auth_user_id": user_id,
                "display_name": request.display_name,
                "first_name": request.first_name,
                "last_name": request.last_name,
                "bio": request.bio,
                "phone": request.phone,
                "avatar_url": None,
            }
            inserted = sb.table("profiles").insert(profile_data).execute()
            profile = inserted.data[0] if inserted.data else None
        if not profile:
            raise HTTPException(status_code=500, detail="Failed to create profile")

        return AuthRegisterResponse(
            access_token=access_token,
            user_id=user_id,
            profile=UserProfileResponse(**profile),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=AuthLoginResponse)
async def login(
    request: LoginRequest,
    sb: Client = Depends(get_auth_supabase),
):
    """Login with email/password."""
    try:
        user_creds = sb.auth.sign_in_with_password(
            {
                "email": request.email,
                "password": request.password,
            }
        )
        if not user_creds.user or not user_creds.user.id:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        user_id = user_creds.user.id

        # Fetch profile
        profile_result = (
            sb.table("profiles").select("*").eq("auth_user_id", user_id).single().execute()
        )
        if not profile_result.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        profile = profile_result.data
        session = getattr(user_creds, "session", None)
        access_token = (
            user_creds.access_token
            if getattr(user_creds, "access_token", None)
            else (session.access_token if session else "")
        ) or ""

        return AuthLoginResponse(
            access_token=access_token,
            user_id=user_id,
            profile=UserProfileResponse(**profile),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_auth_supabase),
):
    """Return current user's profile."""
    user_id = user["user_id"]
    profile_result = sb.table("profiles").select("*").eq("auth_user_id", user_id).single().execute()
    if not profile_result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return UserProfileResponse(**profile_result.data)
