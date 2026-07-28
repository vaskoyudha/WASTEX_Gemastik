import pytest
from fastapi.testclient import TestClient

import app.api.scan as scan_module
from app.deps import get_supabase
from app.main import app
from app.schemas import Material, MaterialIdentification
from tests.fakes import FakeSupabase

client = TestClient(app)


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _identify(confidence: float):
    async def fake_scan(image_bytes, content_type="image/jpeg"):
        return MaterialIdentification(
            material=Material.plastik_pet, condition="bersih", confidence=confidence
        )

    return fake_scan


def test_scan_uploads_image_and_stores_path(fake_sb, monkeypatch):
    monkeypatch.setattr(scan_module, "scan_material", _identify(0.95))
    r = client.post("/scan", files={"file": ("botol.jpg", b"fakejpegbytes", "image/jpeg")})
    assert r.status_code == 200
    uploads = fake_sb.storage.from_("scans").uploads
    assert len(uploads) == 1
    row = fake_sb.table("scans").inserted[0]
    assert row["image_url"] == uploads[0][0]
    assert row["image_url"].endswith(".jpeg")
    assert row["id"] in row["image_url"]


def test_scan_survives_storage_failure(fake_sb, monkeypatch):
    monkeypatch.setattr(scan_module, "scan_material", _identify(0.95))

    def broken_upload(path, data, file_options=None):
        raise RuntimeError("storage down")

    fake_sb.storage.from_("scans").upload = broken_upload
    r = client.post("/scan", files={"file": ("botol.jpg", b"x", "image/jpeg")})
    assert r.status_code == 200
    assert fake_sb.table("scans").inserted[0]["image_url"] is None
