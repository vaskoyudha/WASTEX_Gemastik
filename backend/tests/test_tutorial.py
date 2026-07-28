from fastapi.testclient import TestClient

from app.main import app


def test_get_tutorial_not_found():
    """Tutorial endpoint should return 404 when skill has no tutorial."""
    client = TestClient(app)
    response = client.get("/tutorial/nonexistent-id")
    assert response.status_code == 404
