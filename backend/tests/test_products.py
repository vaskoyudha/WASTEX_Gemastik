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
