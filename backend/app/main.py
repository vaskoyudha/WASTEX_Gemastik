import time
from collections import defaultdict

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    auth,
    feedback,
    impact,
    ingest,
    pricing,
    products,
    recommend,
    scan,
    selling,
    skills,
    tutorial,
    visuals,
)
from app.auth import get_current_user
from app.config import get_settings

app = FastAPI(title="WASTEX AI Pipeline", version="0.1.0")

# Add CORS middleware
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory rate limiter (per-IP sliding window)
request_counts: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 60  # requests per window
RATE_WINDOW = 60  # seconds


@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    request_counts[client_ip] = [t for t in request_counts[client_ip] if now - t < RATE_WINDOW]

    if len(request_counts[client_ip]) >= RATE_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Try again later."},
        )

    request_counts[client_ip].append(now)
    return await call_next(request)


app.include_router(scan.router, prefix="/scan", tags=["scan"])
app.include_router(recommend.router, prefix="/recommend", tags=["recommend"])
app.include_router(skills.router, prefix="/skills", tags=["skills"])
app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
app.include_router(products.router, prefix="/products", tags=["products"])
app.include_router(tutorial.router, prefix="/tutorial", tags=["tutorial"])
app.include_router(pricing.router, prefix="/pricing", tags=["pricing"])
app.include_router(selling.router, prefix="/selling", tags=["selling"])
app.include_router(visuals.router, prefix="/visuals", tags=["visuals"])
app.include_router(impact.router, prefix="/impact", tags=["impact"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(feedback.router, prefix="/feedback", tags=["feedback"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/me")
def get_me(user: dict = Depends(get_current_user)) -> dict:
    return user
