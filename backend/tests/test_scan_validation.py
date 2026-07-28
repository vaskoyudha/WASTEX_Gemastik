from fastapi.testclient import TestClient

from app.main import app


def test_scan_file_too_large():
    """File > 10MB should be rejected."""
    client = TestClient(app)
    # Create a 11MB file
    large_content = b"x" * (11 * 1024 * 1024)
    files = {"file": ("test.jpg", large_content, "image/jpeg")}
    response = client.post("/scan", files=files)
    assert response.status_code == 413
    assert "too large" in response.json()["detail"].lower()


def test_scan_invalid_file_type():
    """Non-image file should be rejected."""
    client = TestClient(app)
    files = {"file": ("test.txt", b"hello", "text/plain")}
    response = client.post("/scan", files=files)
    assert response.status_code == 415
    assert "unsupported" in response.json()["detail"].lower()


def test_scan_valid_png_type():
    """Valid PNG type should pass validation."""
    client = TestClient(app)
    # Small file with PNG content type - will fail at vision but passes validation
    files = {"file": ("test.png", b"\x89PNG", "image/png")}
    response = client.post("/scan", files=files)
    # Should not be 413 or 415 - validation passed
    assert response.status_code not in [413, 415]
