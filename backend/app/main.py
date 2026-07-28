from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ingest, pricing, products, recommend, scan, selling, skills, tutorial
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

app.include_router(scan.router, prefix="/scan", tags=["scan"])
app.include_router(recommend.router, prefix="/recommend", tags=["recommend"])
app.include_router(skills.router, prefix="/skills", tags=["skills"])
app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
app.include_router(products.router, prefix="/products", tags=["products"])
app.include_router(tutorial.router, prefix="/tutorial", tags=["tutorial"])
app.include_router(pricing.router, prefix="/pricing", tags=["pricing"])
app.include_router(selling.router, prefix="/selling", tags=["selling"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/me")
def get_me(user: dict = Depends(get_current_user)) -> dict:
    return user
