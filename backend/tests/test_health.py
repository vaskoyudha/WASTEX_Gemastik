from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_openapi_routes_exist() -> None:
    paths = TestClient(app).get("/openapi.json").json()["paths"]
    for route in ("/scan", "/recommend", "/skills", "/ingest", "/skills/{skill_id}/status"):
        assert route in paths, f"missing route {route}"
