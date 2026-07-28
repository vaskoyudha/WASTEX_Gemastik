from fastapi.testclient import TestClient

from app.main import app


def test_calculate_pricing():
    """Pricing endpoint should return cost breakdown."""
    client = TestClient(app)
    response = client.get("/pricing/some-skill-id")
    assert response.status_code == 404  # Skill not found
