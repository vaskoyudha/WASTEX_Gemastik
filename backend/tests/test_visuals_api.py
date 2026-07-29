import pytest
from fastapi.testclient import TestClient

import app.api.visuals as visuals_api
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase

SKILL = {
    "id": "s1",
    "title": "Vas Botol PET",
    "material": "plastik_pet",
    "status": "approved",
    "steps": [{"order": 1, "instruction": "Potong botol", "warning": None}],
}


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture()
def stub_image(monkeypatch):
    async def fake_generate(prompt):
        return b"fake-png-bytes"

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)


def test_mockup_generates_and_stores(fake_sb, stub_image):
    fake_sb.table("skills").insert(dict(SKILL))
    client = TestClient(app)
    r = client.get("/visuals/s1/mockup")
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "mockup"
    assert body["cached"] is False
    assert body["image_path"].endswith(".png")
    assert fake_sb.storage.from_("visuals").uploads
    assert fake_sb.table("generated_visuals").inserted


def test_storyboard_requires_valid_step(fake_sb, stub_image):
    fake_sb.table("skills").insert(dict(SKILL))
    client = TestClient(app)
    r = client.get("/visuals/s1/storyboard?step=99")
    assert r.status_code == 404


def test_cached_visual_skips_generation(fake_sb, monkeypatch):
    fake_sb.table("skills").insert(dict(SKILL))
    fake_sb.table("generated_visuals").insert(
        {"skill_id": "s1", "kind": "mockup", "step_order": None, "image_path": "v/s1-mockup.png"}
    )

    async def boom(prompt):
        raise AssertionError("must not generate when cached")

    monkeypatch.setattr(visuals_api, "generate_image", boom)
    client = TestClient(app)
    r = client.get("/visuals/s1/mockup")
    assert r.status_code == 200
    assert r.json()["cached"] is True


def test_unknown_kind_422(fake_sb, stub_image):
    client = TestClient(app)
    r = client.get("/visuals/s1/hologram")
    assert r.status_code == 422
