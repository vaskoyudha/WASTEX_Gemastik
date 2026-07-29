import hashlib

import pytest
from fastapi.testclient import TestClient

import app.api.scan as scan_api
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase

IMAGE = b"same-image-bytes"
HASH = hashlib.sha256(IMAGE).hexdigest()


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def test_cached_hash_skips_vision(fake_sb, monkeypatch):
    fake_sb.table("scans").insert(
        {
            "id": "old",
            "image_hash": HASH,
            "material": "kaca",
            "condition": "bersih",
            "confidence": 0.95,
            "raw_json": {"material": "kaca", "condition": "bersih", "confidence": 0.95},
        }
    )

    async def boom(image, content_type="image/jpeg"):
        raise AssertionError("vision must not be called on cache hit")

    monkeypatch.setattr(scan_api, "scan_material", boom)
    client = TestClient(app)
    r = client.post("/scan", files={"file": ("a.jpg", IMAGE, "image/jpeg")})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "identified"
    assert body["identification"]["material"] == "kaca"
    # a new scans row is still recorded for history
    assert len(fake_sb.table("scans").inserted) == 2


def test_new_hash_calls_vision(fake_sb, monkeypatch):
    from app.schemas import MaterialIdentification

    async def fake_vision(image, content_type="image/jpeg"):
        return MaterialIdentification(material="kardus", condition="kering", confidence=0.9)

    monkeypatch.setattr(scan_api, "scan_material", fake_vision)
    client = TestClient(app)
    r = client.post("/scan", files={"file": ("b.jpg", b"fresh-bytes", "image/jpeg")})
    assert r.status_code == 200
    inserted = fake_sb.table("scans").inserted[0]
    assert inserted["image_hash"] == hashlib.sha256(b"fresh-bytes").hexdigest()
