import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            get_settings().supabase_jwt_secret,
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        # Real Supabase access tokens are ES256 and cannot be decoded with the
        # local HS256 secret. Fall back to Supabase's auth.get_user, which
        # validates tokens against Supabase's own keys. Lazy import avoids a
        # circular import: app.deps imports get_current_user from this module.
        try:
            from app.deps import get_supabase

            sb = get_supabase()
            user = sb.auth.get_user(token)
            user_id = user.user.id if user and user.user else None
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token")
            return {"user_id": user_id, "email": getattr(user.user, "email", None)}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no sub")
    return {"user_id": user_id, "email": payload.get("email")}


def create_test_token(payload: dict) -> str:
    """For testing only."""
    return jwt.encode(payload, get_settings().supabase_jwt_secret, algorithm="HS256")
