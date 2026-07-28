from fastapi.testclient import TestClient

from app.main import app


def test_cors_headers():
    """CORS headers should be present in response."""
    client = TestClient(app)
    response = client.options(
        "/health",
        headers={"Origin": "http://localhost:8081", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers


def test_cors_allows_origin():
    """CORS should allow configured origins."""
    client = TestClient(app)
    response = client.get("/health", headers={"Origin": "http://localhost:8081"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:8081"
