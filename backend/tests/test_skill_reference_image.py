from uuid import uuid4

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


def _auth_header() -> dict:
    token = create_test_token({"sub": "u1", "email": "u@x.app"})
    return {"Authorization": f"Bearer {token}"}


def test_create_skill_resolves_scan_reference(fake_sb):
    scan_id = str(uuid4())
    fake_sb.table("scans").insert({"id": scan_id, "user_id": "u1", "image_url": f"{scan_id}.jpg"})
    client = TestClient(app)
    payload = {
        "title": "Vas Botol PET",
        "description": "Membuat vas dari botol PET bekas.",
        "material": "plastik_pet",
        "difficulty": "pemula",
        "steps": [{"order": 1, "instruction": "Cuci botol", "warning": None}],
        "reference_scan_id": scan_id,
    }
    r = client.post("/skills", json=payload, headers=_auth_header())
    assert r.status_code == 201
    assert r.json()["reference_image_path"] == f"{scan_id}.jpg"
