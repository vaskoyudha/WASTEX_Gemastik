import asyncio

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


def test_generate_all_generates_steps_in_order(fake_sb, monkeypatch):
    fake_sb.table("skills").insert(
        {
            **SKILL,
            "steps": [
                {"order": 1, "instruction": "Cuci botol", "warning": None},
                {"order": 2, "instruction": "Potong botol", "warning": "Hati-hati gunting"},
                {"order": 3, "instruction": "Cat pot", "warning": None},
            ],
        }
    )
    prompts = []

    async def fake_generate(prompt):
        prompts.append(prompt)
        return b"fake-png-bytes"

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    assert len(prompts) == 5  # 3 storyboards + before_after + mockup
    assert "step 1" in prompts[0]
    assert "step 2" in prompts[1]
    assert "step 3" in prompts[2]
    assert "before and after" in prompts[3]
    assert "mockup" in prompts[4]
    assert len(fake_sb.storage.from_("visuals").uploads) == 5
    rows = fake_sb.table("generated_visuals").inserted
    assert len(rows) == 5
    assert {r["kind"] for r in rows} == {"storyboard", "before_after", "mockup"}


def test_generate_all_skips_cached_and_continues_on_failure(fake_sb, monkeypatch):
    fake_sb.table("skills").insert(
        {
            **SKILL,
            "steps": [
                {"order": 1, "instruction": "Cuci botol", "warning": None},
                {"order": 2, "instruction": "Potong botol", "warning": None},
            ],
        }
    )
    fake_sb.table("generated_visuals").insert(
        {
            "skill_id": "s1",
            "kind": "storyboard",
            "step_order": 1,
            "image_path": "v/s1-storyboard-1.png",
        }
    )
    prompts = []

    async def fake_generate(prompt):
        if "step 2" in prompt:
            raise visuals_api.ImageGenUnavailable("down")
        prompts.append(prompt)
        return b"fake-png-bytes"

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    # step 1 cached -> skip; step 2 fails -> continue; before_after + mockup still done
    assert len(prompts) == 2
    assert all("before and after" in p or "mockup" in p for p in prompts)


def test_generate_all_unapproved_skill_noop(fake_sb, monkeypatch):
    fake_sb.table("skills").insert({**SKILL, "status": "pending"})
    called = []

    async def fake_generate(prompt):
        called.append(prompt)
        return b"fake-png-bytes"

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    assert called == []
