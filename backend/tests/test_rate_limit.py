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
