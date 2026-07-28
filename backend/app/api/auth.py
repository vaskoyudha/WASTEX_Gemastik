from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from uuid import uuid4

from app.auth import get_current_user
from app.deps import get_supabase
from app.schemas import (
    AuthLoginResponse,
    AuthRegisterResponse,
    LoginRequest,
    RegisterRequest,
    UserProfileResponse,
)


async def get_auth_supabase() -> Client:
    """Dependency that always returns fresh Supabase client."""
    return get_supabase()


router = APIRouter(tags=["auth"])


@router.post("/register", response_model=AuthRegisterResponse, status_code=201)
async def register(
    request: RegisterRequest,
    sb: Client = Depends(get_auth_supabase),
):
    """Register new user with email/password and create profile."""
    try:
        # Create user in auth.users
        user_creds = await sb.auth.sign_up(
            {
                "email": request.email,
                "password": request.password,
            }
        )
        if not user_creds.user or not user_creds.user.id:
            raise HTTPException(status_code=400, detail="Failed to create user")

        user_id = user_creds.user.id

        # Create profile
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

        # Access token is returned as part of sign_up response
        access_token = user_creds.access_token or ""

        return AuthRegisterResponse(
            access_token=access_token,
            user_id=user_id,
            profile=UserProfileResponse(**profile),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=AuthLoginResponse)
async def login(
    request: LoginRequest,
    sb: Client = Depends(get_auth_supabase),
):
    """Login with email/password."""
    try:
        user_creds = await sb.auth.sign_in_with_password(
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
        access_token = user_creds.access_token or ""

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
