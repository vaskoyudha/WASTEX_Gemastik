from fastapi.testclient import TestClient

from app.main import app, request_counts

client = TestClient(app)


def test_rate_limiting():
    """Should return 429 after exceeding the per-IP limit."""
    request_counts.clear()
    got_429 = False
    for _ in range(100):
        response = client.get("/health")
        if response.status_code == 429:
            assert "rate limit" in response.json()["detail"].lower()
            got_429 = True
            break
    request_counts.clear()
    assert got_429, "Rate limiting not triggered after 100 requests"


def test_rate_limited_response_has_cors_headers():
    """A 429 from the rate limiter must still carry CORS headers so browsers
    surface the real error instead of an opaque CORS failure."""
    request_counts.clear()
    got_429 = False
    for _ in range(100):
        response = client.get("/health", headers={"Origin": "http://localhost:8081"})
        if response.status_code == 429:
            got_429 = True
            assert response.headers.get("access-control-allow-origin") == "http://localhost:8081"
            break
    request_counts.clear()
    assert got_429, "Rate limiting not triggered after 100 requests"
