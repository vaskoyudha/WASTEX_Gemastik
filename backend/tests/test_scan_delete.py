import pytest
from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _auth(user="u1"):
    return {"Authorization": f"Bearer {create_test_token({'sub': user})}"}


def test_delete_scan_requires_auth(fake_sb):
    client = TestClient(app)
    r = client.delete("/scan/sc1")
    assert r.status_code == 401


def test_owner_deletes_scan_and_image(fake_sb):
    fake_sb.table("scans").insert({"id": "sc1", "user_id": "u1", "image_url": "sc1.jpeg"})
    client = TestClient(app)
    r = client.delete("/scan/sc1", headers=_auth("u1"))
    assert r.status_code == 204
    assert "sc1.jpeg" in fake_sb.storage.from_("scans").removed


def test_non_owner_gets_404(fake_sb):
    fake_sb.table("scans").insert({"id": "sc1", "user_id": "u1", "image_url": "sc1.jpeg"})
    client = TestClient(app)
    r = client.delete("/scan/sc1", headers=_auth("intruder"))
    assert r.status_code == 404
    assert fake_sb.storage.from_("scans").removed == []


def test_unknown_scan_404(fake_sb):
    client = TestClient(app)
    r = client.delete("/scan/nope", headers=_auth())
    assert r.status_code == 404
