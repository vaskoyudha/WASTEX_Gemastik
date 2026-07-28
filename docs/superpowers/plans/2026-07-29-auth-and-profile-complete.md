# Auth and Profile Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete login/register flow, editable user profile, account settings (change password, logout, delete account), and database sync with Supabase. The app works in guest mode by default; login enables real profile sync.

**Architecture:** Frontend uses `@supabase/supabase-js` directly for auth (register/login/password management) while backend continues to verify HS256 JWTs via existing `get_current_user()` in `app/auth.py`. A new `profiles` table is created in Supabase migrations, synced from `auth.users.id` on registration. The service layer gets an `AuthService` that persists tokens locally; UI screens import services only (never mocks).

**Tech Stack:** Expo React Native 57, Supabase JS client v2, FastAPI + Pydantic, pytest + FastAPI TestClient, @testing-library/react-native

## Global Constraints

- Version floors: `@supabase/supabase-js>=2.39`, `supabase>=2.6`, `PyJWT>=2.8`, `jest-expo~57`, `@testing-library/react-native^14`
- Naming rules: Backend schemas use snake_case (`first_name`, `updated_at`); profiles table column `auth_user_id uuid references auth.users(id)`
- Architecture: `app/` must not import from `src/mocks`; screens only consume services from `src/services`
- Platform requirements: Android/iOS/web-compatible; AsyncStorage for token persistence
- Code style: TDD first (write failing test before implementation), DRY, YAGNI, frequent commits

---

### Task 1: Set up frontend Supabase client and environment

**Files:**
- Create: `.env.example` (frontend) with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Modify: `package.json` add `@supabase/supabase-js@^2.39.0` to dependencies
- Create: `src/services/supabase/client.ts` (exports `createSupabaseClient` singleton factory)

**Interfaces:**
- Consumes: nothing new
- Produces: `supabaseClient` with `from()`, `auth.signUp()`, `auth.signInWithPassword()`, `auth.signOut()`, `auth.getUser()` methods

- [ ] **Step 1: Write the failing test**

```tsx
// src/services/supabase/__tests__/client.test.ts
import { createSupabaseClient } from "../client";

describe("Supabase client", () => {
  it("creates a client with configured url and key", async () => {
    const client = createSupabaseClient();
    // We don't call Supabase — we just check the factory exists
    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/services/supabase/__tests__/client.test.ts -v`
Expected: FAIL with "cannot find module" or "module not installed"

- [ ] **Step 3: Install the supabase library**

```bash
export PATH=$HOME/.local/node/bin:$PATH
npm install --save @supabase/supabase-js@^2.39.0
```

- [ ] **Step 4: Write minimal implementation**

```ts
// src/services/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";

let _client: ReturnType<typeof createClient> | null = null;

export function createSupabaseClient(): ReturnType<typeof createClient> {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}

export const supabase = createSupabaseClient();
```

- [ ] **Step 5: Commit**

```bash
git add package.json src/services/supabase/client.ts
git commit -m "build: add Supabase JS client for auth"
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test src/services/supabase/__tests__/client.test.ts -v`
Expected: PASS

---

### Task 2: Create backend profiles table migration and schemas

**Files:**
- Create: `backend/supabase/migrations/YYYYMMDDHHMMSS_add_profiles.sql` (current timestamp)
- Modify: `backend/app/schemas.py` add `UserProfileCreate`, `UserProfileUpdate`, `UserProfileResponse` models

**Interfaces:**
- Consumes: `uuid`, `datetime`
- Produces: SQL migration that creates `profiles` table with columns: `id uuid PK`, `auth_user_id uuid UNIQUE NOT NULL references auth.users(id)`, `display_name varchar(64) NOT NULL`, `first_name varchar(64)`, `last_name varchar(64)`, `bio text`, `phone varchar(24)`, `avatar_url varchar(512)`, `updated_at timestamptz`, plus triggers to keep updated_at current. Also creates RLS policies: select/update/delete allowed for `auth.uid() = auth_user_id`, insert allowed for authenticated users via trigger or direct (service role).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_profiles_migrations.py
import pytest

def test_profiles_table_exists(pg):
    """Migration should create profiles table."""
    result = pg.execute("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='profiles')")
    assert result.scalar() is True

def test_profiles_has_required_columns(pg):
    """Profiles should have auth_user_id, display_name, first_name, last_name, bio, phone columns."""
    cols = pg.columns("profiles")
    expected = {"auth_user_id", "display_name", "first_name", "last_name", "bio", "phone"}
    assert set(cols.keys()) >= expected

def test_profiles_auth_user_id_fk(pg):
    """auth_user_id should reference auth.users(id)."""
    fk = pg.fk("profiles")["auth_user_id"]
    assert fk.ref_table == "auth.users" and fk.ref_column == "id"
```
(Note: `pg` fixture assumes a temp PostgreSQL instance for integration tests; simpler unit-test alternative below.)

Alternative unit-test approach (easier without full DB):

```python
# backend/tests/test_profiles_schemas.py
from app.schemas import UserProfileCreate, UserProfileUpdate, UserProfileResponse

def test_user_profile_create_model_validates_fields():
    data = {
        "auth_user_id": "123e4567-e89b-12d3-a456-426614174000",
        "display_name": "John Doe",
        "first_name": "John",
        "last_name": "Doe",
        "bio": "Waste upcycler enthusiast",
        "phone": "+62812345678",
        "avatar_url": "https://example.com/avatar.jpg",
    }
    profile = UserProfileCreate(**data)
    assert profile.display_name == "John Doe"
    assert profile.first_name == "John"

def test_user_profile_update_can_be_partial():
    data = {"display_name": "Updated Name"}
    update = UserProfileUpdate(**data)
    assert "first_name" not in update.model_dump(exclude_unset=True)

def test_user_profile_response_includes_uuid():
    data = {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "auth_user_id": "123e4567-e89b-12d3-a456-426614174000",
        "display_name": "Jane Smith",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    profile = UserProfileResponse(**data)
    assert str(profile.id) == "123e4567-e89b-12d3-a456-426614174000"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_profiles_schemas.py -v`
Expected: FAIL with "cannot import name UserProfileCreate"

- [ ] **Step 3: Write the schema classes**

Add to `backend/app/schemas.py`:

```python
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID

class UserProfileCreate(BaseModel):
    auth_user_id: UUID = Field(..., description="UUID from auth.users")
    display_name: str = Field(..., min_length=1, max_length=64)
    first_name: str | None = Field(None, max_length=64)
    last_name: str | None = Field(None, max_length=64)
    bio: str | None = Field(None, max_length=500)
    phone: str | None = Field(None, max_length=24)
    avatar_url: str | None = Field(None, max_length=512)

class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=64)
    first_name: str | None = Field(None, max_length=64)
    last_name: str | None = Field(None, max_length=64)
    bio: str | None = Field(None, max_length=500)
    phone: str | None = Field(None, max_length=24)
    avatar_url: str | None = Field(None, max_length=512)

class UserProfileResponse(BaseModel):
    id: UUID
    auth_user_id: UUID
    display_name: str
    first_name: str | None
    last_name: str | None
    bio: str | None
    phone: str | None
    avatar_url: str | None
    created_at: datetime
    updated_at: datetime | None
```

- [ ] **Step 4: Write the migration SQL**

Create `backend/supabase/migrations/20260729000003_add_profiles.sql`:

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(64) NOT NULL,
    first_name VARCHAR(64),
    last_name VARCHAR(64),
    bio TEXT,
    phone VARCHAR(24),
    avatar_url VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at trigger (reuse existing if available, else define)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles can be read by anyone authenticated (for discoverability), but writes are restricted
-- Allow authenticated users to read their own profile
CREATE POLICY "authenticated_users_read_own_profile" ON profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = auth_user_id);

-- Allow any authenticated user to insert their own profile (triggered after signup or explicit creation)
CREATE POLICY "authenticated_users_create_own_profile" ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = auth_user_id);

-- Users can update their own profile
CREATE POLICY "authenticated_users_update_own_profile" ON profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

-- Users can delete their own profile (cascade deletes row when auth.user deleted via cascade above)
CREATE POLICY "authenticated_users_delete_own_profile" ON profiles
    FOR DELETE
    TO authenticated
    USING (auth.uid() = auth_user_id);

-- Service role bypasses RLS (existing pattern: use service key in headers)
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/supabase/migrations/20260729000003_add_profiles.sql
git commit -m "feat: add profiles table migration and pydantic schemas"
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pytest backend/tests/test_profiles_schemas.py -v`
Expected: PASS

---

### Task 3: Build backend /auth/register and /auth/login endpoints

**Files:**
- Create: `backend/app/api/auth.py` (router with `/register`, `/login`, `/me` GET)
- Modify: `backend/app/main.py` include router at prefix `/auth`

**Interfaces:**
- Consumes: `supabase.Client` (via `get_supabase()`), `UserProfileCreate`, `UserProfileResponse`
- Produces: Endpoints:
  - `POST /auth/register(data: RegisterRequest)` → `AuthRegisterResponse` with `access_token` (user's Supabase JWT), `user_id`, `profile: UserProfileResponse`
  - `POST /auth/login(data: LoginRequest)` → `AuthLoginResponse` with `access_token`, `user_id`, `profile: UserProfileResponse`
  - `GET /auth/me` → `UserProfileResponse` (requires bearer token, returns profile by `auth_user_id`)

**DTOS for these routes** (add to `schemas.py` too):

```python
class RegisterRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1, max_length=64)
    first_name: str | None = Field(None, max_length=64)
    last_name: str | None = Field(None, max_length=64)
    bio: str | None = Field(None, max_length=500)
    phone: str | None = Field(None, max_length=24)

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthRegisterResponse(BaseModel):
    access_token: str
    user_id: str
    profile: UserProfileResponse

class AuthLoginResponse(BaseModel):
    access_token: str
    user_id: str
    profile: UserProfileResponse
```

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_auth_endpoints.py
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_test_token

def test_register_success(client, fake_supabase):
    """Valid register should create user + profile."""
    fake_supabase.tables["users"].inserted_rows = [{"id": "user-123"}]
    fake_supabase.tables["profiles"].inserted_rows = [{
        "id": "prof-123",
        "auth_user_id": "user-123",
        "display_name": "Test User",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }]
    
    app.dependency_overrides[get_supabase] = lambda: fake_supabase
    client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "password123",
        "display_name": "Test User",
    })
    # Check that insertion happened (exact assertions omitted for brevity)
```

Full test suite:

```python
# backend/tests/test_auth_endpoints.py
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_test_token
from app.deps import get_supabase
from tests.fakes import FakeSupabase
from uuid import uuid4

def test_register_success():
    """Valid register should create user + profile and return JWT."""
    client = TestClient(app)
    fake = FakeSupabase()
    fake.tables["profiles"].rows.append({
        "id": str(uuid4()),
        "auth_user_id": "user-123",
        "display_name": "Test User",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    })
    fake.tables["auth.users"].rows.append({"id": "user-123"})
    app.dependency_overrides[get_supabase] = lambda: fake
    
    response = client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "password123",
        "display_name": "Test User",
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user_id"] == "user-123"
    assert data["profile"]["display_name"] == "Test User"

def test_login_success():
    """Valid login should return JWT + profile."""
    client = TestClient(app)
    fake = FakeSupabase()
    fake.tables["profiles"].rows.append({
        "id": str(uuid4()),
        "auth_user_id": "user-123",
        "display_name": "Test User",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    })
    app.dependency_overrides[get_supabase] = lambda: fake
    
    response = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "password123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["profile"]["display_name"] == "Test User"

def test_me_requires_auth(client):
    """Unauthenticated /me should return 401."""
    response = client.get("/auth/me")
    assert response.status_code == 401

def test_me_returns_profile(client):
    """Authenticated /me should return profile."""
    token = create_test_token({"sub": "user-123", "email": "test@example.com"})
    fake = FakeSupabase()
    fake.tables["profiles"].rows.append({
        "id": str(uuid4()),
        "auth_user_id": "user-123",
        "display_name": "Test User",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    })
    app.dependency_overrides[get_supabase] = lambda: fake
    
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["display_name"] == "Test User"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_auth_endpoints.py -v`
Expected: FAIL with endpoint not found (404) or "module not defined"

- [ ] **Step 3: Write the auth router**

Create `backend/app/api/auth.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client, create_client
from typing import Annotated
from uuid import uuid4

from app.config import get_settings
from app.deps import get_supabase
from app.schemas import RegisterRequest, LoginRequest, AuthRegisterResponse, AuthLoginResponse, UserProfileResponse

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=AuthRegisterResponse, status_code=201)
async def register(request: RegisterRequest):
    """Register new user with email/password and create profile."""
    sb: Client = Depends(get_supabase)()
    try:
        # Create user in auth.users
        user_creds = await sb.auth.sign_up({
            "email": request.email,
            "password": request.password,
        })
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
async def login(request: LoginRequest):
    """Login with email/password."""
    sb: Client = Depends(get_supabase)()
    try:
        user_creds = await sb.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
        if not user_creds.user or not user_creds.user.id:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        user_id = user_creds.user.id
        
        # Fetch profile
        profile_result = sb.table("profiles").select("*").eq("auth_user_id", user_id).single().execute()
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
async def get_me(user: dict = Depends(get_current_user)):
    """Return current user's profile."""
    sb: Client = Depends(get_supabase)()
    user_id = user["user_id"]
    profile_result = sb.table("profiles").select("*").eq("auth_user_id", user_id).single().execute()
    if not profile_result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return UserProfileResponse(**profile_result.data)
```

Note: This requires importing `get_current_user` from `app.auth`. Full code:

```python
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.config import get_settings
from app.deps import get_supabase
from app.auth import get_current_user
from app.schemas import RegisterRequest, LoginRequest, AuthRegisterResponse, AuthLoginResponse, UserProfileResponse
from uuid import uuid4

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=AuthRegisterResponse, status_code=201)
async def register(request: RegisterRequest):
    """Register new user with email/password and create profile."""
    sb: Client = get_supabase()
    try:
        user_creds = await sb.auth.sign_up({
            "email": request.email,
            "password": request.password,
        })
        if not user_creds.user or not user_creds.user.id:
            raise HTTPException(status_code=400, detail="Failed to create user")
        
        user_id = user_creds.user.id
        
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
        
        access_token = user_creds.access_token or ""
        
        return AuthRegisterResponse(
            access_token=access_token,
            user_id=user_id,
            profile=UserProfileResponse(**profile),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login", response_model=AuthLoginResponse)
async def login(request: LoginRequest):
    """Login with email/password."""
    sb: Client = get_supabase()
    try:
        user_creds = await sb.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
        if not user_creds.user or not user_creds.user.id:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        user_id = user_creds.user.id
        
        profile_result = sb.table("profiles").select("*").eq("auth_user_id", user_id).single().execute()
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
async def get_me(user: dict = Depends(get_current_user)):
    """Return current user's profile."""
    sb: Client = get_supabase()
    user_id = user["user_id"]
    profile_result = sb.table("profiles").select("*").eq("auth_user_id", user_id).single().execute()
    if not profile_result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return UserProfileResponse(**profile_result.data)
```

- [ ] **Step 4: Wire router in main.py**

Modify `backend/app/main.py`:

```python
# Add import:
from app.api import ingest, pricing, products, recommend, scan, selling, skills, tutorial, auth

# Add include_router near end:
app.include_router(auth.router, prefix="/auth", tags=["auth"])
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/auth.py backend/app/main.py backend/app/schemas.py
git commit -m "feat: add /auth/register, /auth/login, /auth/me endpoints"
```

- [ ] **Step 6: Run tests**

Run: `pytest backend/tests/test_auth_endpoints.py -v`
Expected: PASS

---

### Task 4: Add frontend AuthService and token persistence

**Files:**
- Create: `src/services/auth/index.ts` (implements `AuthService` interface, stores token in AsyncStorage)
- Modify: `src/services/types.ts` add `User`, `AuthService` type definitions
- Create: `src/services/auth/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `supabase` client from `src/services/supabase/client.ts`, `AsyncStorage`
- Produces: `AuthService` with methods:
  - `signUp(email, password, displayName, ...) → { accessToken, userId, profile }`
  - `signIn(email, password) → { accessToken, userId, profile }`
  - `signOut() → Promise<void>`
  - `getUser() → User | null` (reads from in-memory state + localStorage)
  - `isLoggedIn() → boolean`
  - `getAccessToken() → string | null`
  - `updateProfile(data: UpdateProfileRequest) → Promise<UserProfileResponse>`
  - `deleteAccount() → Promise<void>`

**Types to add to `types.ts`:**

```ts
export interface User {
  id: string;
  email: string;
  accessToken: string | null;
  profile: UserProfile | null;
}

export interface UserProfile {
  id: string;
  authUserId: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface UpdateProfileRequest {
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface AuthResult {
  accessToken: string;
  userId: string;
  profile: UserProfile;
}

export interface AuthService {
  signUp(email: string, password: string, displayName: string, data?: UpdateProfileRequest): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  getUser(): User | null;
  isLoggedIn(): boolean;
  getAccessToken(): string | null;
  updateProfile(data: UpdateProfileRequest): Promise<UserProfile>;
  deleteAccount(): Promise<void>;
}
```

**Service implementation pattern (matches existing service pattern like `ImpactService`):**

```ts
// src/services/auth/index.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase/client";
import { AuthResult, User, UserProfile, UpdateProfileRequest, AuthService } from "../types";

const USER_STORAGE_KEY = "wastex.user.v1";

export class LocalAuthService implements AuthService {
  private user: User | null = null;

  constructor() {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    try {
      const stored = AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.user = parsed as User;
      }
    } catch {
      this.user = null;
    }
  }

  private saveUserToStorage(user: User): void {
    try {
      AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {}
  }

  private clearUserStorage(): void {
    try {
      AsyncStorage.removeItem(USER_STORAGE_KEY);
    } catch {}
  }

  async signUp(
    email: string,
    password: string,
    displayName: string,
    data?: UpdateProfileRequest
  ): Promise<AuthResult> {
    const response = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          ...(data?.firstName && { first_name: data.firstName }),
          ...(data?.lastName && { last_name: data.lastName }),
        },
      },
    });

    if (!response.data.user) {
      throw new Error(response.error?.message || "Sign up failed");
    }

    // Fetch profile immediately after sign up (it might have been auto-created by trigger, or we fetch later)
    // For now, create profile by calling the backend API directly via apiClient
    const apiClient = await import("../api").then((m) => m.apiClient);
    const profileResponse = await apiClient.register({
      email,
      password,
      display_name: displayName,
      first_name: data?.firstName ?? null,
      last_name: data?.lastName ?? null,
      bio: data?.bio ?? null,
      phone: data?.phone ?? null,
    } as any);

    const userProfile: UserProfile = {
      id: profileResponse.profile.id,
      authUserId: response.data.user.id,
      displayName: profileResponse.profile.display_name,
      firstName: profileResponse.profile.first_name,
      lastName: profileResponse.profile.last_name,
      bio: profileResponse.profile.bio,
      phone: profileResponse.profile.phone,
      avatarUrl: profileResponse.profile.avatar_url,
      createdAt: profileResponse.profile.created_at,
      updatedAt: profileResponse.profile.updated_at,
    };

    const user: User = {
      id: response.data.user.id,
      email,
      accessToken: response.data.session?.access_token ?? profileResponse.access_token ?? null,
      profile: userProfile,
    };
    this.user = user;
    this.saveUserToStorage(user);

    return {
      accessToken: user.accessToken!,
      userId: user.id,
      profile: userProfile,
    };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const response = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!response.data.user) {
      throw new Error(response.error?.message || "Sign in failed");
    }

    // Fetch profile from backend API
    const apiClient = await import("../api").then((m) => m.apiClient);
    const profileResponse = await apiClient.login({ email, password } as any);

    const userProfile: UserProfile = {
      id: profileResponse.profile.id,
      authUserId: response.data.user.id,
      displayName: profileResponse.profile.display_name,
      firstName: profileResponse.profile.first_name,
      lastName: profileResponse.profile.last_name,
      bio: profileResponse.profile.bio,
      phone: profileResponse.profile.phone,
      avatarUrl: profileResponse.profile.avatar_url,
      createdAt: profileResponse.profile.created_at,
      updatedAt: profileResponse.profile.updated_at,
    };

    const user: User = {
      id: response.data.user.id,
      email,
      accessToken: response.data.session?.access_token ?? profileResponse.access_token ?? null,
      profile: userProfile,
    };
    this.user = user;
    this.saveUserToStorage(user);

    return {
      accessToken: user.accessToken!,
      userId: user.id,
      profile: userProfile,
    };
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    this.user = null;
    this.clearUserStorage();
  }

  getUser(): User | null {
    return this.user;
  }

  isLoggedIn(): boolean {
    return this.user !== null;
  }

  getAccessToken(): string | null {
    return this.user?.accessToken ?? null;
  }

  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    if (!this.user) {
      throw new Error("Not logged in");
    }

    const apiClient = await import("../api").then((m) => m.apiClient);
    const response = await apiClient.updateProfile(this.user.id, data) as any;

    const userProfile: UserProfile = {
      id: response.id,
      authUserId: this.user.id,
      displayName: response.display_name,
      firstName: response.first_name,
      lastName: response.last_name,
      bio: response.bio,
      phone: response.phone,
      avatarUrl: response.avatar_url,
      createdAt: response.created_at,
      updatedAt: response.updated_at,
    };

    this.user.profile = userProfile;
    this.saveUserToStorage(this.user);

    return userProfile;
  }

  async deleteAccount(): Promise<void> {
    if (!this.user) {
      throw new Error("Not logged in");
    }

    // Delete Supabase user
    await supabase.auth.admin.deleteUser(this.user.id);
    await this.signOut();
  }
}

// Factory and singleton
export function createAuthService(): AuthService {
  return new LocalAuthService();
}

export const auth = createAuthService();
```

**Need to add to `src/services/api.ts`:**

```ts
  async register(data: {
    email: string;
    password: string;
    display_name: string;
    first_name?: string | null;
    last_name?: string | null;
    bio?: string | null;
    phone?: string | null;
  }) {
    return request('/auth/register', { method: 'POST', body: data });
  },

  async login(data: { email: string; password: string }) {
    return request('/auth/login', { method: 'POST', body: data });
  },

  async updateProfile(userId: string, data: {
    display_name?: string;
    first_name?: string | null;
    last_name?: string | null;
    bio?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  }) {
    return request(`/auth/profile/${userId}`, { method: 'PATCH', body: data });
  },
```

**Test file:**

```ts
// src/services/auth/__tests__/index.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAuthService } from "..";
import { supabase } from "../../supabase/client";

const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@react-native-async-storage/async-storage");
jest.mock("../../supabase/client", () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  },
}));

jest.mock("../../api", () => ({
  apiClient: {
    register: jest.fn(),
    login: jest.fn(),
    updateProfile: jest.fn(),
  },
}));

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(true);
  });

  it("signs up and stores user", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" }, session: { access_token: "abc123" } },
      error: null,
    });

    (await import("../../api")).apiClient.register.mockResolvedValue({
      access_token: "abc123",
      user_id: "user-123",
      profile: {
        id: "prof-123",
        auth_user_id: "user-123",
        display_name: "Test User",
        first_name: null,
        last_name: null,
        bio: null,
        phone: null,
        avatar_url: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
      },
    });

    const authService = createAuthService();
    const result = await authService.signUp("test@example.com", "password123", "Test User");

    expect(result.userId).toBe("user-123");
    expect(result.profile.displayName).toBe("Test User");
    expect(authService.isLoggedIn()).toBe(true);
  });

  it("signs in successfully", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "user-123" }, session: { access_token: "xyz789" } },
      error: null,
    });

    (await import("../../api")).apiClient.login.mockResolvedValue({
      access_token: "xyz789",
      user_id: "user-123",
      profile: {
        id: "prof-123",
        auth_user_id: "user-123",
        display_name: "Test User",
        first_name: null,
        last_name: null,
        bio: null,
        phone: null,
        avatar_url: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
      },
    });

    const authService = createAuthService();
    const result = await authService.signIn("test@example.com", "password123");

    expect(result.userId).toBe("user-123");
    expect(authService.isLoggedIn()).toBe(true);
  });

  it("signs out and clears storage", async () => {
    const authService = createAuthService();
    await authService.signUp("test@example.com", "password123", "Test User");
    expect(authService.isLoggedIn()).toBe(true);
    await authService.signOut();
    expect(authService.isLoggedIn()).toBe(false);
    expect(mockSignOut).toHaveBeenCalledWith();
  });
});
```

- [ ] **Step 1: Write the failing test** (above)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/services/auth/__tests__/index.test.ts -v`
Expected: FAIL with "cannot find module" or types missing

- [ ] **Step 3: Implement the service** (code block above in interfaces section)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/services/auth/__tests__/index.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/types.ts src/services/api.ts src/services/auth/index.ts
git commit -m "feat: add AuthService with Supabase auth integration and AsyncStorage persistence"
```

---

### Task 5: Login/Register screens

**Files:**
- Create: `app/(tabs)/login.tsx` (login form with email/password)
- Create: `app/(tabs)/register.tsx` (register form with email/password + extended fields)
- Modify: `app/_layout.tsx` add these two new stack routes

**Components needed:**
- Create: `src/components/ui/Input.tsx` (TextInput wrapper with label, error state, variant prop) — reuse Card/Button patterns

**Input component design (matches Button/Card patterns):**

```tsx
// src/components/ui/Input.tsx
import React from "react";
import { View, Text, TextInput as RNTextInput, TextInputProps as Props } from "react-native";
import { Card } from "./Card";

type InputVariant = "default" | "error" | "success";
type InputSize = "sm" | "md" | "lg";

interface InputProps extends Props {
  label?: string;
  error?: string | null;
  variant?: InputVariant;
  size?: InputSize;
}

export function Input({ label, error, variant = "default", size = "md", ...props }: InputProps) {
  const borderColor = error === true || error ? "#dc2626" : variant === "success" ? "#16a34a" : "#e2e8f0";
  
  return (
    <View className="mb-5">
      {label && <Text className="text-sm font-semibold text-slate-700 mb-2">{label}</Text>}
      <RNTextInput
        className={`bg-white border-2 rounded-xl px-4 py-3 ${size === "sm" ? "text-xs" : size === "lg" ? "text-lg" : "text-base"}`}
        style={{ borderColor }}
        {...props}
      />
      {error && <Text className="text-xs text-red-600 mt-1">{error}</Text>}
    </View>
  );
}
```

**Login screen:**

```tsx
// app/(tabs)/login.tsx
import React, { useState } from "react";
import { View, Text, Alert, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Header, Button, Card } from "../../src/components/ui";
import { auth } from "../../src/services/auth";
import { Input } from "../../src/components/ui/Input";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError("Email dan kata sandi harus diisi");
      return;
    }

    setLoading(true);
    try {
      const result = await auth.signIn(email, password);
      Alert.alert("Berhasil", `Selamat datang, ${result.profile.displayName}!`);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Header title="Masuk" subtitle="Masukkan kredensial untuk WASTEX" />
        <View className="px-6 pt-6">
          <Card className="p-6">
            <Input
              label="Email"
              placeholder="nama@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={error && email ? null : null}
            />
            <Input
              label="Kata Sandi"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              error={error && !password ? "Kata sandi diperlukan" : null}
            />
            {error && !password && <Text className="text-xs text-red-600 mb-4">{error}</Text>}
            <Button
              title="Masuk"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              className="mt-4"
            />
            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-slate-600">Belum punya akun? </Text>
              <Text className="text-sm text-brand font-semibold" onPress={() => router.push("/(tabs)/register")}>
                Daftar sekarang
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

**Register screen:**

```tsx
// app/(tabs)/register.tsx
import React, { useState } from "react";
import { View, Text, Alert, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Header, Button, Card } from "../../src/components/ui";
import { auth } from "../../src/services/auth";
import { Input } from "../../src/components/ui/Input";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    if (!email || !password || !displayName) {
      setError("Email, kata sandi, dan nama tampilan harus diisi");
      return;
    }
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter");
      return;
    }

    setLoading(true);
    try {
      await auth.signUp(email, password, displayName, {
        firstName: firstName || null,
        lastName: lastName || null,
        bio: bio || null,
        phone: phone || null,
      });
      Alert.alert("Berhasil", "Akun berhasil dibuat!");
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Pendaftaran gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Header title="Daftar" subtitle="Buat akun WASTEX baru" />
        <View className="px-6 pt-6">
          <Card className="p-6">
            <Input label="Email" placeholder="nama@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Input label="Nama Tampilan" placeholder="Nama Anda" value={displayName} onChangeText={setDisplayName} />
            <Input label="Nama Depan" placeholder="Opsional" value={firstName} onChangeText={setFirstName} />
            <Input label="Nama Belakang" placeholder="Opsional" value={lastName} onChangeText={setLastName} />
            <Input label="Bio" placeholder="Ceritakan tentang Anda (opsional)" value={bio} onChangeText={setBio} multiline numberOfLines={3} />
            <Input label="Nomor Telepon" placeholder="+62..." value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Input label="Kata Sandi" placeholder="Minimal 8 karakter" secureTextEntry value={password} onChangeText={setPassword} error={error && password ? null : (password.length > 0 && password.length < 8 ? "Kata sandi minimal 8 karakter" : null)} />
            {error && !password && <Text className="text-xs text-red-600 mb-4">{error}</Text>}
            <Button title="Daftar" onPress={handleRegister} loading={loading} fullWidth className="mt-4" />
            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-slate-600">Sudah punya akun? </Text>
              <Text className="text-sm text-brand font-semibold" onPress={() => router.push("/(tabs)/login")}>Masuk</Text>
            </View>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 1: Write tests** for both screens (use similar mocking pattern as profil.test.tsx)

```tsx
// app/(tabs)/login.test.tsx
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import LoginScreen from "./login";

const mockSignIn = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("../../src/services/auth", () => ({ auth: { signIn: mockSignIn } }));
jest.mock("../../src/components/ui/Input", ({ label, ...props }: any) => <input data-testid={`input-${label}`} {...props} />);
jest.mock("../../src/components/ui/Button", ({ title, onPress, loading }: any) => (
  <button data-testid={`button-${title}`} disabled={loading} onPress={onPress}>{title}</button>
));
jest.mock("../../src/components/ui", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1>, Card: ({ children }: any) => <div>{children}</div> }));

describe("LoginScreen", () => {
  it("calls signIn and navigates on success", async () => {
    mockSignIn.mockResolvedValue({ userId: "user-123", profile: { displayName: "Test User" } });
    const { getByText, getByTestId } = await render(<LoginScreen />);
    fireEvent.changeText(getByTestId("input-Email"), "test@example.com");
    fireEvent.changeText(getByTestId("input-Kata Sandi"), "password123");
    fireEvent.press(getByText("Masuk"));
    expect(mockSignIn).toHaveBeenCalledWith("test@example.com", "password123");
  });
});
```

Similar test for register screen.

- [ ] **Step 2: Run test to verify it fails** (component not yet implemented)

- [ ] **Step 3: Implement Input component and login/register screens** (code blocks above)

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Input.tsx app/(tabs)/login.tsx app/(tabs)/register.tsx
git commit -m "feat: add login and register screens with extended profile fields"
```

---

### Task 6: Update Profil screen to show real user profile and allow editing

**Files:**
- Modify: `app/(tabs)/profil.tsx` (replace hard-coded identity with real profile data from auth store)
- Add: Edit Profile modal/sheet (reuse Input component, same pattern as existing screens)
- Modify: `app/(tabs)/profil.tsx` also includes logout and delete account actions

**Modified Profil screen design:**

```tsx
// app/(tabs)/profil.tsx (modified version)
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header, Card, Button } from "../../src/components/ui";
import { impact } from "../../src/services";
import { auth } from "../../src/services/auth";
import { Award, Info, Shield, Trash2, User, LogOut, Edit } from "lucide-react-native";
import { Input } from "../../src/components/ui/Input";

export default function ProfilScreen() {
  const router = useRouter();
  const user = auth.getUser();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.profile?.displayName ?? "");
  const [firstName, setFirstName] = useState(user?.profile?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.profile?.lastName ?? "");
  const [bio, setBio] = useState(user?.profile?.bio ?? "");
  const [phone, setPhone] = useState(user?.profile?.phone ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.profile) {
      setDisplayName(user.profile.displayName);
      setFirstName(user.profile.firstName ?? "");
      setLastName(user.profile.lastName ?? "");
      setBio(user.profile.bio ?? "");
      setPhone(user.profile.phone ?? "");
    }
  }, [user]);

  const handleClearData = () => {
    Alert.alert(
      "Hapus Semua Data",
      "Semua data proyek dan impact lokal akan dihapus permanen sesuai kebijakan privasi (UU PDP).",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Semua",
          style: "destructive",
          onPress: async () => {
            try {
              await impact.clearAll();
              Alert.alert("Berhasil", "Data telah dibersihkan.");
            } catch {
              Alert.alert("Gagal", "Data belum bisa dibersihkan saat ini.");
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert("Keluar", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: async () => {
          try {
            await auth.signOut();
            Alert.alert("Berhasil", "Anda telah keluar.");
            router.replace("/(tabs)/login");
          } catch {
            Alert.alert("Gagal", "Logout gagal.");
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Hapus Akun",
      "Semua data Anda termasuk profile, riwayat scan, dan proyek akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Akun",
          style: "destructive",
          onPress: async () => {
            try {
              await auth.deleteAccount();
              Alert.alert("Berhasil", "Akun telah dihapus.");
              router.replace("/(tabs)/login");
            } catch {
              Alert.alert("Gagal", "Penghapusan akun gagal.");
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await auth.updateProfile({
        displayName,
        firstName: firstName || null,
        lastName: lastName || null,
        bio: bio || null,
        phone: phone || null,
      });
      setEditing(false);
      Alert.alert("Berhasil", "Profil diperbarui.");
    } catch {
      Alert.alert("Gagal", "Perubahan profil gagal disimpan.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 32 }}>
        <Header title="Profil & Pengaturan" subtitle="Kelola akun dan preferensi aplikasi" />
        <View className="px-6 pt-6">
          <Card className="p-6 items-center">
            <Text className="text-slate-600 mb-4">Silakan masuk untuk melihat profil Anda</Text>
            <Button title="Masuk" onPress={() => router.push("/(tabs)/login")} fullWidth />
            <Button title="Daftar" onPress={() => router.push("/(tabs)/register")} variant="outline" fullWidth className="mt-3" />
          </Card>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 32 }}>
      <Header title="Profil & Pengaturan" subtitle="Kelola akun dan preferensi aplikasi" rightElement={
        editing ? <Button title="Simpan" onPress={handleSaveProfile} loading={loading} size="sm" /> :
        <TouchableOpacity onPress={() => setEditing(true)}><Edit size={20} color="#16a34a" /></TouchableOpacity>
      } />
      <View className="px-6 pt-6">
        {editing ? (
          <>
            <Input label="Nama Tampilan" value={displayName} onChangeText={setDisplayName} />
            <Input label="Nama Depan" value={firstName} onChangeText={setFirstName} />
            <Input label="Nama Belakang" value={lastName} onChangeText={setLastName} />
            <Input label="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={3} />
            <Input label="Nomor Telepon" value={phone} onChangeText={setPhone} />
          </>
        ) : (
          <Card className="p-5 flex-row items-center mb-6">
            <View className="w-16 h-16 rounded-full bg-brand-light items-center justify-center mr-4">
              <User size={32} color="#16a34a" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-slate-900">{user.profile.displayName}</Text>
              <Text className="text-xs text-slate-500">{user.profile.firstName || "-"} {user.profile.lastName || ""}{user.profile.lastName || user.profile.firstName ? " • " : ""}{user.email.replace(/@.*$/, "")}</Text>
            </View>
          </Card>
        )}

        <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Mode Ahli</Text>
        <Card className="p-4 mb-6">
          <TouchableOpacity
            onPress={() => router.push("/expert-dashboard")}
            className="flex-row items-center justify-between py-2"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Award size={20} color="#16a34a" />
              <Text className="text-slate-800 font-medium ml-3 text-sm">Expert Dashboard</Text>
            </View>
          </TouchableOpacity>
        </Card>

        <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
          Privasi & Keamanan Data
        </Text>
        <Card className="p-4 mb-6">
          <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
            <View className="flex-row items-center">
              <Shield size={20} color="#16a34a" />
              <Text className="text-slate-800 font-medium ml-3 text-sm">Enkripsi & Consent (UU PDP)</Text>
            </View>
            <Text className="text-xs text-emerald-600 font-semibold">Aktif</Text>
          </View>
          <TouchableOpacity
            onPress={handleClearData}
            className="flex-row items-center justify-between py-3"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Trash2 size={20} color="#dc2626" />
              <Text className="text-red-600 font-medium ml-3 text-sm">Hapus Data Proyek & Reset</Text>
            </View>
          </TouchableOpacity>
        </Card>

        <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
          Akun
        </Text>
        <Card className="p-4 mb-6">
          <TouchableOpacity
            onPress={handleLogout}
            className="flex-row items-center justify-between py-3"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <LogOut size={20} color="#ea580c" />
              <Text className="text-orange-600 font-medium ml-3 text-sm">Keluar</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            className="flex-row items-center justify-between py-3"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Trash2 size={20} color="#dc2626" />
              <Text className="text-red-600 font-medium ml-3 text-sm">Hapus Akun Permanen</Text>
            </View>
          </TouchableOpacity>
        </Card>

        <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
          Tentang Aplikasi
        </Text>
        <Card className="p-4 mb-6">
          <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
            <View className="flex-row items-center">
              <Info size={20} color="#64748b" />
              <Text className="text-slate-800 font-medium ml-3 text-sm">Versi Aplikasi</Text>
            </View>
            <Text className="text-xs text-slate-500 font-medium">1.0.0 (Gemastik XVIII)</Text>
          </View>
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <User size={20} color="#64748b" />
              <Text className="text-slate-800 font-medium ml-3 text-sm">Tim Pengembang</Text>
            </View>
            <Text className="text-xs text-slate-500 font-medium">Vasco, Falih, Kiral</Text>
          </View>
        </Card>

        {!editing && <Button title="Kembali ke Beranda" onPress={() => router.replace("/(tabs)")} variant="outline" />}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 1: Write tests** (similar to profil.test.tsx, verify edit mode toggles, logout/delete actions)

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement changes** (code block above)

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Input.tsx app/(tabs)/profil.tsx
git commit -m "feat: update Profil screen to show real profile, allow editing, logout, and delete account"
```

---

### Task 7: Backend update profile endpoint

**Files:**
- Modify: `backend/app/api/auth.py` add `PATCH /auth/profile/{user_id}`
- Modify: `backend/app/main.py` (already wired)

**Interface:**
- Consumes: `auth_user_id` from JWT (get_current_user), `UserProfileUpdate` schema
- Produces: `UserProfileResponse` with updated values

```python
@router.patch("/profile/{user_id}", response_model=UserProfileResponse)
async def update_profile(user_id: str, update: UserProfileUpdate, user: dict = Depends(get_current_user)):
    """Current user updates their own profile."""
    if user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    sb: Client = get_supabase()
    result = sb.table("profiles").update(update.model_dump(exclude_unset=True)).eq("auth_user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return UserProfileResponse(**result.data[0])
```

- [ ] **Steps**: Write test, run it to fail, implement code, commit

---

### Task 8: End-to-end tests and integration verification

**Files:**
- Create: `backend/tests/e2e/test_auth_flow.py` (full register→login→update profile→logout flow)
- Create: `app/(tabs)/__e2e__/auth-flow.test.tsx` (simulate login→view/edit profile→logout→login again)

**E2E test (backend):**

```python
# backend/tests/e2e/test_auth_flow.py
from fastapi.testclient import TestClient
from app.main import app
from uuid import uuid4

def test_full_registration_and_login():
    client = TestClient(app)
    # Register
    resp = client.post("/auth/register", json={
        "email": "e2e@test.com",
        "password": "password123",
        "display_name": "E2E User",
    })
    assert resp.status_code == 201
    reg_data = resp.json()
    assert "access_token" in reg_data
    
    # Login
    resp = client.post("/auth/login", json={"email": "e2e@test.com", "password": "password123"})
    assert resp.status_code == 200
    login_data = resp.json()
    assert login_data["user_id"] == reg_data["user_id"]
    
    # Get /me
    token = login_data["access_token"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "E2E User"
    
    # Update profile
    resp = client.patch(f"/auth/profile/{reg_data['user_id']}",
                        json={"first_name": "E2E", "last_name": "User"},
                        headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "E2E"
    
    # Logout simulated by re-login with different credentials — no logout endpoint yet, handled client-side
```

Frontend e2e simulation:

```tsx
// app/(tabs)/__e2e__/auth-flow.test.tsx
import { auth } from "../../../src/services/auth";
import * as api from "../../../src/services/api";

describe("Auth flow E2E simulation", () => {
  it("registers → logs in → updates profile → logs out → logs in again", async () => {
    // Skip in CI unless EXPO_PUBLIC_USE_MOCK=false and real Supabase configured
    if (process.env.EXPO_PUBLIC_USE_MOCK !== "false") return;

    const testEmail = `e2e-${Date.now()}@test.local`;
    
    // Register
    await auth.signUp(testEmail, "password123", "E2E User", { firstName: "E2E" });
    
    // Verify profile shows
    const user = auth.getUser();
    expect(user?.profile?.displayName).toBe("E2E User");
    
    // Logout
    await auth.signOut();
    expect(auth.isLoggedIn()).toBe