import pytest
from fastapi.testclient import TestClient

from app.deps import get_supabase
from app.main import app
from app.schemas import Material, MaterialIdentification
from tests.fakes import FakeSupabase


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


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


def test_scan_valid_png_type(fake_sb, monkeypatch):
    """Valid PNG type should pass validation and reach identification."""
    import app.api.scan as scan_module

    async def fake_scan(image_bytes, content_type="image/png"):
        return MaterialIdentification(material=Material.kardus, condition="bersih", confidence=0.95)

    monkeypatch.setattr(scan_module, "scan_material", fake_scan)
    client = TestClient(app)
    # Small file with PNG content type
    files = {"file": ("test.png", b"\x89PNG", "image/png")}
    response = client.post("/scan", files=files)
    # Should not be 413 or 415 - validation passed
    assert response.status_code not in [413, 415]


def test_scan_valid_webp_type(fake_sb, monkeypatch):
    """WEBP (common browser format) must pass validation and reach identification."""
    import app.api.scan as scan_module

    async def fake_scan(image_bytes, content_type="image/webp"):
        return MaterialIdentification(
            material=Material.plastik_pet, condition="bersih", confidence=0.95
        )

    monkeypatch.setattr(scan_module, "scan_material", fake_scan)
    client = TestClient(app)
    files = {"file": ("test.webp", b"RIFF\x00\x00\x00\x00WEBP", "image/webp")}
    response = client.post("/scan", files=files)
    # Should not be 413 or 415 - webp accepted
    assert response.status_code not in [413, 415]
