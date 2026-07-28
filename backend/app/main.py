from fastapi import FastAPI

from app.api import ingest, recommend, scan, skills

app = FastAPI(title="WASTEX AI Pipeline", version="0.1.0")

app.include_router(scan.router, prefix="/scan", tags=["scan"])
app.include_router(recommend.router, prefix="/recommend", tags=["recommend"])
app.include_router(skills.router, prefix="/skills", tags=["skills"])
app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
