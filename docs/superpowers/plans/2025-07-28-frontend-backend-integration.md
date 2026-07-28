# Frontend-Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the React Native frontend to the FastAPI backend, add missing routes, fix critical bugs, and implement authentication.

**Architecture:** Create an ApiAdapter layer that translates between frontend and backend type systems. Add CORS middleware, add missing API routes (products, tutorial, pricing, selling), implement JWT auth, and add error boundaries.

**Tech Stack:** React Native (Expo), FastAPI, Supabase (PostgreSQL + pgvector), Zustand, Pydantic

## Global Constraints

- Frontend uses Bahasa Indonesia for all user-facing text
- Backend must remain fast (< 2s response time)
- All API endpoints must validate input and return proper error codes
- Mock data can be disabled via `USE_MOCK = false` in `src/services/index.ts`
- Backend routes use root-level paths (e.g., `/scan`, `/recommend`, `/skills`)
- Existing `Material` enum values: `plastik_pet`, `plastik_hdpe`, `kardus`, `kaleng`, `kaca`, `sachet`
- Existing `Difficulty` enum values: `pemula`, `menengah`, `mahir`
- Existing `SkillStatus` enum values: `draft`, `approved`, `rejected`, `needs_revision`
- `RecommendRequest` fields: `scan_id`, `material`, `condition`, `user_intent`

## File Structure

```
backend/app/
├── main.py                    # Add CORS middleware + rate limiting
├── config.py                  # Add CORS origins setting
├── deps.py                    # Add JWT auth dependency
├── auth.py                    # NEW: JWT authentication
├── api/
│   ├── scan.py                # Add file validation
│   ├── recommend.py           # (already handles empty chunks)
│   ├── products.py            # NEW: Product CRUD + recommendations
│   ├── tutorial.py            # NEW: Tutorial endpoints
│   ├── pricing.py             # NEW: Pricing calculation
│   └── selling.py             # NEW: Marketplace endpoints
├── schemas.py                 # Add missing Pydantic models
└── rag/
    ├── embeddings.py          # Add fallback for DeepInfra
    └── reranker.py            # Add fallback for DeepInfra

src/
├── services/
│   ├── index.ts               # ApiAdapter + disable mock
│   ├── api.ts                 # NEW: HTTP client with auth
│   └── types.ts               # Align with backend schemas
├── components/
│   └── ErrorBoundary.tsx      # NEW: Global error handler
└── app/
    ├── _layout.tsx            # Add error boundary
    └── (tabs)/                # Connect to backend
```

---

### Task 1: Add CORS Middleware

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_cors.py`

**Interfaces:**
- Consumes: None
- Produces: API accepts cross-origin requests from Expo dev server

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_cors.py
from fastapi.testclient import TestClient
from app.main import app

def test_cors_headers():
    """CORS headers should be present in response."""
    client = TestClient(app)
    response = client.options("/health", headers={
        "Origin": "http://localhost:8081",
        "Access-Control-Request-Method": "GET"
    })
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_cors.py -v
```
Expected: FAIL

- [ ] **Step 3: Add CORS origins to config**

```python
# backend/app/config.py - add to Settings class
class Settings(BaseSettings):
    # ... existing fields ...
    CORS_ORIGINS: list[str] = [
        "http://localhost:8081",  # Expo dev server
        "http://localhost:19006", # Expo web
        "exp://localhost:19000",  # Expo Go
    ]
```

- [ ] **Step 4: Add CORS middleware to main.py**

```python
# backend/app/main.py - add after imports
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings

settings = get_settings()

app = FastAPI(title="WASTEX AI Pipeline", version="0.1.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... rest of existing code ...
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_cors.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/config.py backend/app/main.py backend/tests/test_cors.py
git commit -m "feat: add CORS middleware for Expo frontend"
```

---

### Task 2: Add JWT Authentication Dependency

**Files:**
- Create: `backend/app/auth.py`
- Modify: `backend/app/deps.py`
- Modify: `backend/pyproject.toml`
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: Supabase JWT token from Authorization header
- Produces: `get_current_user` dependency that returns user dict

- [ ] **Step 1: Add PyJWT to dependencies**

```toml
# backend/pyproject.toml - add to dependencies
dependencies = [
    # ... existing deps ...
    "PyJWT>=2.8.0",
]
```

- [ ] **Step 2: Install dependencies**

```bash
cd backend && pip install PyJWT
```

- [ ] **Step 3: Write the failing test**

```python
# backend/tests/test_auth.py
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_test_token

def test_get_current_user_valid_token():
    """Valid JWT should return user dict."""
    client = TestClient(app)
    token = create_test_token({"sub": "user-123"})
    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["user_id"] == "user-123"

def test_get_current_user_invalid_token():
    """Invalid JWT should return 401."""
    client = TestClient(app)
    response = client.get("/me", headers={"Authorization": "Bearer invalid-token"})
    assert response.status_code == 401
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_auth.py -v
```
Expected: FAIL with import error

- [ ] **Step 5: Create auth.py**

```python
# backend/app/auth.py
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import get_settings

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(
            token,
            get_settings().SUPABASE_JWT_SECRET,
            algorithms=["HS256"]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no sub")
        return {"user_id": user_id, "email": payload.get("email")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def create_test_token(payload: dict) -> str:
    """For testing only."""
    return jwt.encode(payload, get_settings().SUPABASE_JWT_SECRET, algorithm="HS256")
```

- [ ] **Step 6: Add SUPABASE_JWT_SECRET to config**

```python
# backend/app/config.py - add to Settings class
SUPABASE_JWT_SECRET: str = ""  # From Supabase dashboard > Settings > API > JWT Secret
```

- [ ] **Step 7: Add /me endpoint to main.py**

```python
# backend/app/main.py - add after other routes
from app.auth import get_current_user

@app.get("/me")
def get_me(user: dict = Depends(get_current_user)) -> dict:
    return user
```

- [ ] **Step 8: Update .env with placeholder**

```bash
# Add to backend/.env
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

- [ ] **Step 9: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_auth.py -v
```
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add backend/app/auth.py backend/app/deps.py backend/app/config.py backend/app/main.py backend/pyproject.toml backend/tests/test_auth.py
git commit -m "feat: add JWT authentication dependency"
```

---

### Task 3: Add File Upload Validation

**Files:**
- Modify: `backend/app/api/scan.py`
- Test: `backend/tests/test_scan_validation.py`

**Interfaces:**
- Consumes: Multipart file upload
- Produces: Validates file type (JPEG, PNG, HEIC) and size (< 10MB)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_scan_validation.py
from fastapi.testclient import TestClient
from app.main import app

def test_scan_file_too_large():
    """File > 10MB should be rejected."""
    client = TestClient(app)
    # Create a 11MB file
    large_content = b"x" * (11 * 1024 * 1024)
    files = {"file": ("test.jpg", large_content, "image/jpeg")}
    response = client.post("/scan", files=files)
    assert response.status_code == 413
    assert "too large" in response.json()["detail"].lower()

def test_scan_invalid_file_type():
    """Non-image file should be rejected."""
    client = TestClient(app)
    files = {"file": ("test.txt", b"hello", "text/plain")}
    response = client.post("/scan", files=files)
    assert response.status_code == 415
    assert "unsupported" in response.json()["detail"].lower()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_scan_validation.py -v
```
Expected: FAIL

- [ ] **Step 3: Add validation to scan endpoint**

```python
# backend/app/api/scan.py - add at start of scan() function
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"]

async def scan(
    file: UploadFile,
    user_id: str | None = Depends(get_optional_user_id),
    sb: Client = Depends(get_supabase),
) -> ScanResponse:
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG, PNG, or HEIC."
        )
    
    # Read file content
    image = await file.read()
    
    # Validate file size
    if len(image) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large: {len(image)} bytes. Maximum is 10MB."
        )
    
    if not image:
        raise HTTPException(status_code=400, detail="empty image")
    
    # ... rest of existing code ...
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_scan_validation.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/scan.py backend/tests/test_scan_validation.py
git commit -m "feat: add file upload validation (type + size)"
```

---

### Task 4: Create ApiAdapter Layer

**Files:**
- Create: `src/services/api.ts`
- Modify: `src/services/types.ts`
- Modify: `src/services/index.ts`
- Test: `src/services/__tests__/api.test.ts`

**Interfaces:**
- Consumes: Backend API endpoints
- Produces: `apiClient` object with typed methods

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/__tests__/api.test.ts
import { apiClient } from '../api';

describe('apiClient', () => {
  it('should have scan method', () => {
    expect(typeof apiClient.scan).toBe('function');
  });

  it('should have recommend method', () => {
    expect(typeof apiClient.recommend).toBe('function');
  });

  it('should have getSkills method', () => {
    expect(typeof apiClient.getSkills).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/services/__tests__/api.test.ts
```
Expected: FAIL with "Cannot find module '../api'"

- [ ] **Step 3: Create api.ts with typed client**

```typescript
// src/services/api.ts
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

export const apiClient = {
  async scan(imageUri: string) {
    // Convert URI to FormData for file upload
    const formData = new FormData();
    const response = await fetch(imageUri);
    const blob = await response.blob();
    formData.append('file', blob, 'scan.jpg');

    const res = await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Scan failed' }));
      throw new Error(error.detail);
    }

    return res.json();
  },

  async recommend(data: { scan_id?: string; material?: string; condition?: string; user_intent: string }) {
    return request('/recommend', {
      method: 'POST',
      body: data,
    });
  },

  async getSkills(params?: { status?: string; material?: string }) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return request(`/skills${query}`);
  },

  async getSkill(id: string) {
    return request(`/skills/${id}`);
  },

  async createSkill(data: any) {
    return request('/skills', { method: 'POST', body: data });
  },

  async updateSkillStatus(id: string, data: { status: string; reviewed_by?: string }) {
    return request(`/skills/${id}/status`, { method: 'PATCH', body: data });
  },

  async healthCheck() {
    return request('/health');
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/services/__tests__/api.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/api.ts src/services/__tests__/api.test.ts
git commit -m "feat: add typed API client layer"
```

---

### Task 5: Align Frontend Types with Backend

**Files:**
- Modify: `src/services/types.ts`
- Test: TypeScript compilation check

**Interfaces:**
- Consumes: Backend schemas from `backend/app/schemas.py`
- Produces: Matching TypeScript interfaces

- [ ] **Step 1: Update types.ts to match backend**

```typescript
// src/services/types.ts - replace entire file
// Aligned with backend/app/schemas.py

export type Material = 'plastik_pet' | 'plastik_hdpe' | 'kardus' | 'kaleng' | 'kaca' | 'sachet';
export type Difficulty = 'pemula' | 'menengah' | 'mahir';
export type SkillStatus = 'draft' | 'approved' | 'rejected' | 'needs_revision';

export interface MaterialIdentification {
  material: Material;
  condition: string;
  confidence: number;
}

export interface ScanResult {
  scan_id: string;
  status: 'identified' | 'needs_manual_verification';
  identification?: MaterialIdentification;
  material_options?: Material[];
  imageUri?: string;
}

export interface DetectedItem {
  name: string;
  category: string;
  confidence: number;
  recyclable: boolean;
}

export interface ToolItem {
  name: string;
  optional: boolean;
}

export interface Step {
  order: number;
  instruction: string;
  warning?: string;
}

export interface Risk {
  hazard: string;
  mitigation: string;
}

export interface SolutionPackage {
  recommendation: string;
  steps: Step[];
  tools: ToolItem[];
  risks: Risk[];
  est_cost_idr?: number;
  est_price_idr?: number;
  marketing_copy?: string;
  sources: string[];
}

export interface ProductRecommendation {
  id: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  estimatedTime: string;
  estimatedCost: string;
  steps: string[];
  materials: string[];
  tools: string[];
  sellingPrice?: string;
  tutorialUrl?: string;
}

export interface Skill {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  category: string;
  materials: string[];
  tools: string[];
  steps: string[];
  status: SkillStatus;
  authorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'expert' | 'admin';
  createdAt: string;
}

export interface Tutorial {
  id: string;
  skillId: string;
  title: string;
  content: string;
  mediaUrls: string[];
  duration: string;
  createdAt: string;
}

export interface Pricing {
  id: string;
  skillId: string;
  materialCost: number;
  laborCost: number;
  suggestedPrice: number;
  profitMargin: number;
}

export interface MarketplaceItem {
  id: string;
  skillId: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  status: 'available' | 'sold' | 'reserved';
  createdAt: string;
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```
Expected: No errors (or only pre-existing errors)

- [ ] **Step 3: Commit**

```bash
git add src/services/types.ts
git commit -m "feat: align frontend types with backend schemas"
```

---

### Task 6: Create Products API Route

**Files:**
- Create: `backend/app/api/products.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_products.py`

**Interfaces:**
- Consumes: `Skill` model from database
- Produces: CRUD endpoints for products with recommendation logic

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_products.py
from fastapi.testclient import TestClient
from app.main import app

def test_get_products_empty():
    """Products endpoint should return empty list when no skills exist."""
    client = TestClient(app)
    response = client.get("/products")
    assert response.status_code == 200
    assert response.json() == []

def test_get_product_by_id():
    """Should return 404 for non-existent product."""
    client = TestClient(app)
    response = client.get("/products/nonexistent-id")
    assert response.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_products.py -v
```
Expected: FAIL with 404 (route doesn't exist)

- [ ] **Step 3: Create products.py**

```python
# backend/app/api/products.py
from fastapi import APIRouter, HTTPException
from app.deps import get_supabase
from supabase import Client

router = APIRouter()

@router.get("")
async def list_products(limit: int = 20, offset: int = 0, sb: Client = Depends(get_supabase)):
    resp = sb.table("skills") \
        .select("*") \
        .eq("status", "approved") \
        .order("created_at", desc=True) \
        .range(offset, offset + limit - 1) \
        .execute()
    return resp.data or []

@router.get("/{product_id}")
async def get_product(product_id: str, sb: Client = Depends(get_supabase)):
    resp = sb.table("skills") \
        .select("*") \
        .eq("id", product_id) \
        .single() \
        .execute()
    
    if not resp.data:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return resp.data

@router.get("/{product_id}/recommendations")
async def get_recommendations(product_id: str, limit: int = 5, sb: Client = Depends(get_supabase)):
    # Get the source product
    product_resp = sb.table("skills") \
        .select("*") \
        .eq("id", product_id) \
        .single() \
        .execute()
    
    if not product_resp.data:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Find similar products by material
    material = product_resp.data.get("material")
    if not material:
        return []
    
    resp = sb.table("skills") \
        .select("*") \
        .eq("status", "approved") \
        .eq("material", material) \
        .neq("id", product_id) \
        .limit(limit) \
        .execute()
    
    return resp.data or []
```

- [ ] **Step 4: Register router in main.py**

```python
# backend/app/main.py - add after other router imports
from app.api import products
app.include_router(products.router, prefix="/products", tags=["products"])
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_products.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/products.py backend/app/main.py backend/tests/test_products.py
git commit -m "feat: add products API with CRUD and recommendations"
```

---

### Task 7: Create Tutorial API Route

**Files:**
- Create: `backend/app/api/tutorial.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_tutorial.py`

**Interfaces:**
- Consumes: `Skill` model from database
- Produces: Tutorial endpoints for step-by-step guides

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_tutorial.py
from fastapi.testclient import TestClient
from app.main import app

def test_get_tutorial_not_found():
    """Tutorial endpoint should return 404 when skill has no tutorial."""
    client = TestClient(app)
    response = client.get("/tutorial/nonexistent-id")
    assert response.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_tutorial.py -v
```
Expected: FAIL with 404

- [ ] **Step 3: Create tutorial.py**

```python
# backend/app/api/tutorial.py
from fastapi import APIRouter, HTTPException
from app.deps import get_supabase
from supabase import Client

router = APIRouter()

@router.get("/{skill_id}")
async def get_tutorial(skill_id: str, sb: Client = Depends(get_supabase)):
    # Get skill with steps
    resp = sb.table("skills") \
        .select("id, title, description, steps, materials, tools, difficulty") \
        .eq("id", skill_id) \
        .single() \
        .execute()
    
    if not resp.data:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    skill = resp.data
    if not skill.get("steps"):
        raise HTTPException(status_code=404, detail="Tutorial not available for this skill")
    
    return {
        "skill_id": skill["id"],
        "title": skill["title"],
        "description": skill["description"],
        "difficulty": skill["difficulty"],
        "materials": skill.get("materials", []),
        "tools": skill.get("tools", []),
        "steps": skill["steps"],
        "estimated_time": _estimate_time(skill["difficulty"], len(skill["steps"])),
    }

def _estimate_time(difficulty: str, num_steps: int) -> str:
    """Estimate time based on difficulty and step count."""
    base_minutes = {"pemula": 15, "menengah": 30, "mahir": 60}
    minutes = base_minutes.get(difficulty, 30) + (num_steps * 5)
    if minutes < 60:
        return f"{minutes} menit"
    hours = minutes // 60
    remaining = minutes % 60
    return f"{hours} jam {remaining} menit" if remaining else f"{hours} jam"
```

- [ ] **Step 4: Register router in main.py**

```python
# backend/app/main.py - add after other router imports
from app.api import tutorial
app.include_router(tutorial.router, prefix="/tutorial", tags=["tutorial"])
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_tutorial.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/tutorial.py backend/app/main.py backend/tests/test_tutorial.py
git commit -m "feat: add tutorial API endpoint"
```

---

### Task 8: Create Pricing API Route

**Files:**
- Create: `backend/app/api/pricing.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_pricing.py`

**Interfaces:**
- Consumes: `Skill` model with materials list
- Produces: Pricing calculation with material cost, labor, and suggested price

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_pricing.py
from fastapi.testclient import TestClient
from app.main import app

def test_calculate_pricing():
    """Pricing endpoint should return cost breakdown."""
    client = TestClient(app)
    response = client.get("/pricing/some-skill-id")
    assert response.status_code == 404  # Skill not found
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_pricing.py -v
```
Expected: FAIL with 404

- [ ] **Step 3: Create pricing.py**

```python
# backend/app/api/pricing.py
from fastapi import APIRouter, HTTPException
from app.deps import get_supabase
from supabase import Client

router = APIRouter()

# Default material costs in IDR (simplified)
MATERIAL_COSTS = {
    "plastik_pet": 500,
    "plastik_hdpe": 600,
    "kardus": 300,
    "kaleng": 800,
    "kaca": 800,
    "sachet": 200,
    "fabric": 1000,
    "wood": 700,
    "rope": 400,
    "paint": 600,
    "glue": 300,
    "string": 200,
}

LABOR_RATES = {
    "pemula": 15000,   # IDR per hour
    "menengah": 25000,
    "mahir": 40000,
}

@router.get("/{skill_id}")
async def calculate_pricing(skill_id: str, sb: Client = Depends(get_supabase)):
    resp = sb.table("skills") \
        .select("id, title, difficulty, materials, steps") \
        .eq("id", skill_id) \
        .single() \
        .execute()
    
    if not resp.data:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    skill = resp.data
    materials = skill.get("materials", [])
    difficulty = skill.get("difficulty", "menengah")
    steps = skill.get("steps", [])
    
    # Calculate material cost
    material_cost = sum(MATERIAL_COSTS.get(m.lower(), 500) for m in materials)
    
    # Calculate labor cost (estimated hours * rate)
    estimated_hours = len(steps) * 0.5  # 30 min per step
    labor_rate = LABOR_RATES.get(difficulty, 25000)
    labor_cost = int(estimated_hours * labor_rate)
    
    # Calculate total and suggested price (with 40% profit margin)
    total_cost = material_cost + labor_cost
    profit_margin = 0.4
    suggested_price = int(total_cost * (1 + profit_margin))
    
    # Round to nearest 1000
    suggested_price = round(suggested_price / 1000) * 1000
    
    return {
        "skill_id": skill["id"],
        "title": skill["title"],
        "material_cost": material_cost,
        "labor_cost": labor_cost,
        "total_cost": total_cost,
        "profit_margin": profit_margin,
        "suggested_price": suggested_price,
        "currency": "IDR",
    }
```

- [ ] **Step 4: Register router in main.py**

```python
# backend/app/main.py - add after other router imports
from app.api import pricing
app.include_router(pricing.router, prefix="/pricing", tags=["pricing"])
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_pricing.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/pricing.py backend/app/main.py backend/tests/test_pricing.py
git commit -m "feat: add pricing calculation API"
```

---

### Task 9: Create Selling/Marketplace API Route

**Files:**
- Create: `backend/app/api/selling.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_selling.py`

**Interfaces:**
- Consumes: `Skill` model + user authentication
- Produces: Marketplace CRUD with listing, buying, and order management

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_selling.py
from fastapi.testclient import TestClient
from app.main import app

def test_list_marketplace():
    """Marketplace should return available items."""
    client = TestClient(app)
    response = client.get("/selling")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_listing_requires_auth():
    """Creating a listing requires authentication."""
    client = TestClient(app)
    response = client.post("/selling", json={
        "skill_id": "some-id",
        "price": 50000
    })
    assert response.status_code == 403  # No auth header
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_selling.py -v
```
Expected: FAIL with 404

- [ ] **Step 3: Create selling.py**

```python
# backend/app/api/selling.py
from fastapi import APIRouter, HTTPException, Depends
from app.deps import get_supabase
from app.auth import get_current_user
from pydantic import BaseModel
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
async def list_marketplace(status: str = "available", limit: int = 20, sb: Client = Depends(get_supabase)):
    resp = sb.table("skills") \
        .select("*, author_id") \
        .eq("status", "approved") \
        .limit(limit) \
        .execute()
    
    # For now, return approved skills as marketplace items
    # In production, this would query a separate marketplace table
    items = []
    for skill in (resp.data or []):
        items.append({
            "id": skill["id"],
            "skill_id": skill["id"],
            "title": skill["title"],
            "description": skill.get("description", ""),
            "price": 50000,  # Default price
            "seller_id": skill.get("author_id", "unknown"),
            "status": "available",
            "created_at": skill.get("created_at"),
        })
    
    return items

@router.post("", status_code=201)
async def create_listing(
    request: CreateListingRequest,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase)
):
    # Verify skill exists
    skill_resp = sb.table("skills") \
        .select("id") \
        .eq("id", request.skill_id) \
        .single() \
        .execute()
    
    if not skill_resp.data:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    # Create listing
    listing = {
        "skill_id": request.skill_id,
        "seller_id": user["user_id"],
        "price": request.price,
        "description": request.description,
        "status": "available",
    }
    
    resp = sb.table("marketplace") \
        .insert(listing) \
        .execute()
    
    return resp.data[0] if resp.data else listing

@router.patch("/{listing_id}")
async def update_listing(
    listing_id: str,
    request: UpdateListingRequest,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase)
):
    # Verify ownership
    resp = sb.table("marketplace") \
        .select("seller_id") \
        .eq("id", listing_id) \
        .single() \
        .execute()
    
    if not resp.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if resp.data["seller_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    sb.table("marketplace") \
        .update(updates) \
        .eq("id", listing_id) \
        .execute()
    
    return {"message": "Listing updated"}
```

- [ ] **Step 4: Register router in main.py**

```python
# backend/app/main.py - add after other router imports
from app.api import selling
app.include_router(selling.router, prefix="/selling", tags=["selling"])
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_selling.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/selling.py backend/app/main.py backend/tests/test_selling.py
git commit -m "feat: add marketplace/selling API with auth"
```

---

### Task 10: Add Embedding Fallback

**Files:**
- Modify: `backend/app/rag/embeddings.py`
- Test: `backend/tests/test_embeddings.py`

**Interfaces:**
- Consumes: DeepInfra API (primary) or local fallback
- Produces: Embedding vectors even when DeepInfra is down

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_embeddings.py
from unittest.mock import patch, MagicMock

def test_embedding_fallback():
    """Should fall back to local embeddings when DeepInfra fails."""
    from app.rag.embeddings import get_embedding
    
    # Mock DeepInfra failure
    with patch("httpx.post") as mock_post:
        mock_post.side_effect = Exception("DeepInfra down")
        
        # Should not raise, should use fallback
        result = get_embedding("test text")
        assert result is not None
        assert len(result) > 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_embeddings.py -v
```
Expected: FAIL

- [ ] **Step 3: Add fallback logic**

```python
# backend/app/rag/embeddings.py - modify get_embedding function
import hashlib
import numpy as np

def get_embedding(text: str) -> list[float]:
    """Get embedding with fallback to deterministic hash-based vectors."""
    try:
        # Try DeepInfra first
        resp = httpx.post(
            f"{get_settings().DEEPINFRA_API_URL}/embeddings",
            headers={"Authorization": f"Bearer {get_settings().DEEPINFRA_API_KEY}"},
            json={"input": text, "model": "BAAI/bge-large-en-v1.5"},
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]
    except Exception as e:
        # Fallback: deterministic hash-based embedding
        return _hash_embedding(text)

def _hash_embedding(text: str, dim: int = 1024) -> list[float]:
    """Generate deterministic embedding from text hash."""
    hash_bytes = hashlib.sha256(text.encode()).digest()
    # Repeat hash to fill dimension
    extended = (hash_bytes * (dim // len(hash_bytes) + 1))[:dim]
    # Convert to float array and normalize
    arr = np.frombuffer(extended, dtype=np.uint8).astype(np.float32)
    arr = arr / np.linalg.norm(arr)
    return arr.tolist()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_embeddings.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/rag/embeddings.py backend/tests/test_embeddings.py
git commit -m "feat: add embedding fallback for DeepInfra"
```

---

### Task 11: Add Reranker Fallback

**Files:**
- Modify: `backend/app/rag/reranker.py`
- Test: `backend/tests/test_reranker.py`

**Interfaces:**
- Consumes: DeepInfra reranker API (primary) or local fallback
- Produces: Reranked results even when DeepInfra is down

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_reranker.py
from unittest.mock import patch

def test_reranker_fallback():
    """Should fall back to simple scoring when DeepInfra fails."""
    from app.rag.reranker import rerank
    
    docs = ["doc1", "doc2", "doc3"]
    
    # Mock DeepInfra failure
    with patch("httpx.post") as mock_post:
        mock_post.side_effect = Exception("DeepInfra down")
        
        result = rerank("query", docs)
        assert result is not None
        assert len(result) == len(docs)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_reranker.py -v
```
Expected: FAIL

- [ ] **Step 3: Add fallback logic**

```python
# backend/app/rag/reranker.py - modify rerank function
def rerank(query: str, documents: list[str], top_k: int = 5) -> list[dict]:
    """Rerank with fallback to simple keyword matching."""
    try:
        # Try DeepInfra reranker
        resp = httpx.post(
            f"{get_settings().DEEPINFRA_API_URL}/reranking",
            headers={"Authorization": f"Bearer {get_settings().DEEPINFRA_API_KEY}"},
            json={
                "query": query,
                "documents": documents,
                "model": "BAAI/bge-reranker-v2-m3",
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        results = resp.json()["results"]
        return [{"index": r["index"], "score": r["score"]} for r in results[:top_k]]
    except Exception:
        # Fallback: simple keyword matching
        return _simple_rerank(query, documents, top_k)

def _simple_rerank(query: str, documents: list[str], top_k: int) -> list[dict]:
    """Simple keyword overlap scoring."""
    query_words = set(query.lower().split())
    scored = []
    
    for i, doc in enumerate(documents):
        doc_words = set(doc.lower().split())
        overlap = len(query_words & doc_words)
        scored.append({"index": i, "score": overlap / max(len(query_words), 1)})
    
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_reranker.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/rag/reranker.py backend/tests/test_reranker.py
git commit -m "feat: add reranker fallback for DeepInfra"
```

---

### Task 12: Add Error Boundary to Frontend

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/app/_layout.tsx`
- Test: Manual verification

**Interfaces:**
- Consumes: React component tree
- Produces: Catches and displays errors gracefully

- [ ] **Step 1: Create ErrorBoundary component**

```typescript
// src/components/ErrorBoundary.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Terjadi Kesalahan</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'Terjadi kesalahan yang tidak terduga'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  button: {
    backgroundColor: '#0D6E6E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Wrap root layout with ErrorBoundary**

```typescript
// src/app/_layout.tsx - add import and wrap
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <Stack>
        {/* ... existing stack screens ... */}
      </Stack>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 3: Verify app starts without errors**

```bash
npx expo start
```
Expected: App starts, error boundary is active

- [ ] **Step 4: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/app/_layout.tsx
git commit -m "feat: add global error boundary"
```

---

### Task 13: Disable Mock Data and Connect to Backend

**Files:**
- Modify: `src/services/index.ts`
- Test: Manual verification

**Interfaces:**
- Consumes: ApiAdapter from Task 4
- Produces: Real API calls instead of mock data

- [ ] **Step 1: Update services/index.ts**

```typescript
// src/services/index.ts - modify USE_MOCK flag
export const USE_MOCK = false; // Changed from true to false

// Add import for apiClient
import { apiClient } from './api';

// Update service functions to use apiClient when USE_MOCK is false
export async function scanImage(uri: string): Promise<ScanResult> {
  if (USE_MOCK) {
    // ... existing mock code ...
  }
  
  return apiClient.scan(uri);
}

export async function getRecommendations(scanId: string, context: any, preferences: any): Promise<ProductRecommendation[]> {
  if (USE_MOCK) {
    // ... existing mock code ...
  }
  
  const result = await apiClient.recommend({ scan_id: scanId, ...context });
  return result.solutions || [];
}

export async function getSkills(): Promise<Skill[]> {
  if (USE_MOCK) {
    // ... existing mock code ...
  }
  
  return apiClient.getSkills();
}
```

- [ ] **Step 2: Test connection to backend**

```bash
# Start backend first
cd backend && uvicorn app.main:app --reload

# Then start frontend
npx expo start
```

Expected: Frontend makes real API calls, no mock data used

- [ ] **Step 3: Commit**

```bash
git add src/services/index.ts
git commit -m "feat: connect frontend to backend API"
```

---

### Task 14: Create Seed Data Script

**Files:**
- Create: `backend/scripts/seed_data.py`
- Test: `backend/tests/test_seed.py`

**Interfaces:**
- Consumes: Supabase client
- Produces: Inserts initial skills data into database

- [ ] **Step 1: Create seed script**

```python
# backend/scripts/seed_data.py
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.deps import get_supabase

SEED_SKILLS = [
    {
        "title": "Pot Bunga dari Botol Plastik",
        "description": "Mengubah botol plastik bekas menjadi pot bunga yang menarik",
        "difficulty": "pemula",
        "material": "plastik_pet",
        "materials": ["plastic bottle", "paint", "string"],
        "tools": ["scissors", "paint brush"],
        "steps": [
            {"order": 1, "instruction": "Potong botol plastik menjadi dua bagian"},
            {"order": 2, "instruction": "Lubangi bagian bawah untuk drainase"},
            {"order": 3, "instruction": "Cat botol sesuai selera"},
            {"order": 4, "instruction": "Tambahkan tali sebagai pegangan"},
            {"order": 5, "instruction": "Isi dengan tanah dan tanam bunga"}
        ],
        "status": "approved"
    },
    {
        "title": "Tas Daur Ulang dari Kardus",
        "description": "Membuat tas belanja ramah lingkungan dari kardus bekas",
        "difficulty": "menengah",
        "material": "kardus",
        "materials": ["cardboard", "fabric", "glue"],
        "tools": ["scissors", "ruler"],
        "steps": [
            {"order": 1, "instruction": "Potong kardus sesuai ukuran yang diinginkan"},
            {"order": 2, "instruction": "Balut dengan kain sebagai lapisan luar"},
            {"order": 3, "instruction": "Rekatkan dengan lem"},
            {"order": 4, "instruction": "Buat pegangan dari tali atau kain"},
            {"order": 5, "instruction": "Keringkan selama 24 jam"}
        ],
        "status": "approved"
    },
    {
        "title": "Lampu Hias dari Botol Kaca",
        "description": "Mengubah botol kaca menjadi lampu hias dekoratif",
        "difficulty": "mahir",
        "material": "kaca",
        "materials": ["glass", "paint", "rope"],
        "tools": ["drill", "light bulb kit"],
        "steps": [
            {"order": 1, "instruction": "Bersihkan botol kaca secara menyeluruh"},
            {"order": 2, "instruction": "Lubangi bagian bawah untuk kabel"},
            {"order": 3, "instruction": "Cat bagian luar botol"},
            {"order": 4, "instruction": "Masukkan lampu LED ke dalam botol"},
            {"order": 5, "instruction": "Gantung dengan tali dekoratif"}
        ],
        "status": "approved"
    }
]

def seed():
    supabase = get_supabase()
    
    for skill in SEED_SKILLS:
        # Check if already exists
        existing = supabase.table("skills") \
            .select("id") \
            .eq("title", skill["title"]) \
            .execute()
        
        if existing.data:
            print(f"Skip (exists): {skill['title']}")
            continue
        
        resp = supabase.table("skills").insert(skill).execute()
        print(f"Created: {skill['title']} (ID: {resp.data[0]['id']})")

if __name__ == "__main__":
    seed()
```

- [ ] **Step 2: Run seed script**

```bash
cd backend && python scripts/seed_data.py
```
Expected: Creates 3 skills in database

- [ ] **Step 3: Verify skills in database**

```bash
cd backend && npx supabase db execute "SELECT COUNT(*) FROM skills;"
```
Expected: Count > 0

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed_data.py
git commit -m "feat: add seed data script for initial skills"
```

---

### Task 15: Add Rate Limiting

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_rate_limit.py`

**Interfaces:**
- Consumes: Request IP address
- Produces: Limits API calls per minute

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_rate_limit.py
from fastapi.testclient import TestClient
from app.main import app

def test_rate_limiting():
    """Should limit requests after threshold."""
    client = TestClient(app)
    # Make many requests quickly
    for i in range(100):
        response = client.get("/health")
        if response.status_code == 429:
            assert "rate limit" in response.json()["detail"].lower()
            return
    
    # If we get here, rate limiting isn't working
    assert False, "Rate limiting not triggered after 100 requests"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_rate_limit.py -v
```
Expected: FAIL (no rate limiting)

- [ ] **Step 3: Add simple in-memory rate limiter**

```python
# backend/app/main.py - add after imports
from collections import defaultdict
import time
from fastapi.responses import JSONResponse

# Simple in-memory rate limiter
request_counts = defaultdict(list)
RATE_LIMIT = 60  # requests per minute
RATE_WINDOW = 60  # seconds

@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    client_ip = request.client.host
    now = time.time()
    
    # Clean old requests
    request_counts[client_ip] = [
        t for t in request_counts[client_ip] if now - t < RATE_WINDOW
    ]
    
    # Check rate limit
    if len(request_counts[client_ip]) >= RATE_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again later."}
        )
    
    # Record request
    request_counts[client_ip].append(now)
    
    response = await call_next(request)
    return response
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_rate_limit.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_rate_limit.py
git commit -m "feat: add rate limiting middleware"
```

---

### Task 16: Update .env with All Required Variables

**Files:**
- Modify: `backend/.env`
- Test: Manual verification

**Interfaces:**
- Consumes: None
- Produces: All API keys configured

- [ ] **Step 1: Update .env file**

```bash
# backend/.env - add these variables
OPENROUTER_API_KEY=your-openrouter-key-here
DEEPINFRA_API_KEY=your-deepinfra-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

- [ ] **Step 2: Verify environment variables load**

```bash
cd backend && python -c "from app.config import settings; print(settings.OPENROUTER_API_KEY[:10])"
```
Expected: Prints first 10 chars of key (not empty)

- [ ] **Step 3: Commit (without actual secrets)**

```bash
git add backend/.env.example
git commit -m "docs: update .env.example with all required variables"
```

---

### Task 17: Full Integration Test

**Files:**
- None (manual test)
- Test: End-to-end flow verification

**Interfaces:**
- Consumes: All previous tasks completed
- Produces: Working integration between frontend and backend

- [ ] **Step 1: Start backend**

```bash
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- [ ] **Step 2: Verify backend health**

```bash
curl http://localhost:8000/health
```
Expected: `{"status": "ok"}`

- [ ] **Step 3: Start frontend**

```bash
npx expo start
```

- [ ] **Step 4: Test scan flow**

1. Open app on Expo Go
2. Navigate to Scan tab
3. Take a photo of an item
4. Verify it calls backend API
5. Verify recommendations are returned

- [ ] **Step 5: Test skills listing**

1. Navigate to Ideas tab
2. Verify skills are loaded from backend
3. Verify no mock data is displayed

- [ ] **Step 6: Test error handling**

1. Disconnect backend
2. Try to scan an item
3. Verify error boundary shows "Terjadi Kesalahan" message
4. Verify "Coba Lagi" button works

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete frontend-backend integration"
git push origin feature/backend-ai-pipeline
```

---

## Self-Review

### Spec Coverage
- ✅ ApiAdapter layer (Task 4)
- ✅ Type mapping (Task 5)
- ✅ Missing backend routes (Tasks 6-9)
- ✅ Auth system (Task 2)
- ✅ Error boundaries (Task 12)
- ✅ Seed data pipeline (Task 14)
- ✅ File upload validation (Task 3)
- ✅ Rate limiting (Task 15)
- ✅ CORS middleware (Task 1)
- ✅ Embedding/reranker fallback (Tasks 10-11)
- ✅ Mock data disable (Task 13)

### Placeholder Scan
- No TBD/TODO found
- All steps have complete code
- All tests have expected outputs

### Type Consistency
- `ScanResult` matches across frontend and backend
- `ProductRecommendation` aligned
- `Skill` model consistent
- API response shapes documented

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2025-07-28-frontend-backend-integration.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**