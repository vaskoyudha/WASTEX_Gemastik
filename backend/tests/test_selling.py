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
    response = client.post("/selling", json={"skill_id": "some-id", "price": 50000})
    assert response.status_code == 401  # No auth header
