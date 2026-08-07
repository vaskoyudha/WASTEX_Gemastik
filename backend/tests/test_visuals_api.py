import asyncio

import pytest
from fastapi.testclient import TestClient

import app.api.visuals as visuals_api
from app.agent.tools.vision import VisionUnavailable
from app.deps import get_supabase
from app.main import app
from app.schemas import ObjectIdentity
from tests.fakes import FakeSupabase

SKILL = {
    "id": "s1",
    "title": "Vas Botol PET",
    "material": "plastik_pet",
    "est_price_idr": 25000,
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
    async def fake_generate(prompt, reference_images=None):
        return b"fake-png-bytes"

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)


def test_mockup_generates_and_stores(fake_sb, stub_image):
    fake_sb.table("skills").insert(dict(SKILL))
    body = asyncio.run(visuals_api.get_visual("s1", "mockup", sb=fake_sb))
    assert body["kind"] == "mockup"
    assert body["cached"] is False
    assert body["image_path"].endswith(".png")
    assert fake_sb.storage.from_("visuals").uploads
    assert fake_sb.table("generated_visuals").inserted
    prompt = fake_sb.table("generated_visuals").inserted[0]["prompt"]
    assert "Rp25.000" in prompt
    assert "PESAN SEKARANG" in prompt
    assert "JANGAN render teks" not in prompt


def test_storyboard_requires_valid_step(fake_sb, stub_image):
    fake_sb.table("skills").insert(dict(SKILL))
    client = TestClient(app)
    r = client.get("/visuals/s1/storyboard?step=99")
    assert r.status_code == 404


def test_cached_visual_skips_generation(fake_sb, monkeypatch):
    fake_sb.table("skills").insert(dict(SKILL))
    fake_sb.table("generated_visuals").insert(
        {
            "skill_id": "s1",
            "kind": "mockup",
            "step_order": None,
            "image_path": "v/s1-mockup.png",
            "prompt": "[VERSI PROMPT: sales-v2]",
        }
    )

    async def boom(prompt, reference_images=None):
        raise AssertionError("must not generate when cached")

    monkeypatch.setattr(visuals_api, "generate_image", boom)
    client = TestClient(app)
    r = client.get("/visuals/s1/mockup")
    assert r.status_code == 200
    assert r.json()["cached"] is True


def test_legacy_mockup_cache_is_regenerated(fake_sb, stub_image):
    fake_sb.table("skills").insert(dict(SKILL))
    fake_sb.table("generated_visuals").insert(
        {
            "skill_id": "s1",
            "kind": "mockup",
            "step_order": None,
            "image_path": "s1-mockup.png",
            "prompt": "[FOTO PRODUK MOCKUP] old prompt",
        }
    )

    body = asyncio.run(visuals_api.get_visual("s1", "mockup", sb=fake_sb))

    assert body["cached"] is False
    assert body["image_path"].endswith("mockup-sales-v2.png")
    assert len(fake_sb.table("generated_visuals").inserted) == 2


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

    async def fake_generate(prompt, reference_images=None):
        prompts.append(prompt)
        return b"fake-png-bytes"

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    assert len(prompts) == 6  # materials + 3 storyboards + before_after + mockup
    assert "[PANEL ALAT & BAHAN]" in prompts[0]
    assert "step 1" in prompts[1]
    assert "step 2" in prompts[2]
    assert "step 3" in prompts[3]
    assert "SEBELUM & SESUDAH" in prompts[4]
    assert "FOTO PRODUK MOCKUP" in prompts[5]
    assert len(fake_sb.storage.from_("visuals").uploads) == 6
    rows = fake_sb.table("generated_visuals").inserted
    assert len(rows) == 6
    assert {r["kind"] for r in rows} == {"storyboard", "materials", "before_after", "mockup"}


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

    async def fake_generate(prompt, reference_images=None):
        if "step 2" in prompt:
            raise visuals_api.ImageGenUnavailable("down")
        prompts.append(prompt)
        return b"fake-png-bytes"

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    # materials generated first; step 1 cached -> skip; step 2 fails -> continue;
    # before_after + mockup still done
    assert len(prompts) == 3
    assert "[PANEL ALAT & BAHAN]" in prompts[0]
    assert all("SEBELUM & SESUDAH" in p or "FOTO PRODUK MOCKUP" in p for p in prompts[1:])


def test_generate_all_unapproved_skill_noop(fake_sb, monkeypatch):
    fake_sb.table("skills").insert({**SKILL, "status": "pending"})
    called = []

    async def fake_generate(prompt, reference_images=None):
        called.append(prompt)
        return b"fake-png-bytes"

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    assert called == []


def test_generate_all_threads_previous_panel(fake_sb, monkeypatch):
    fake_sb.table("skills").insert(
        {
            **SKILL,
            "reference_image_path": "photo-1.jpg",
            "steps": [
                {"order": 1, "instruction": "Cuci botol", "warning": None},
                {"order": 2, "instruction": "Potong botol", "warning": None},
            ],
        }
    )
    calls = []

    async def fake_generate(prompt, reference_images=None):
        calls.append((prompt, reference_images))
        return b"fake-png-bytes"

    async def fake_load_ref(sb, skill):
        return [b"photo-bytes"]

    async def fake_identity(image_bytes, content_type="image/jpeg", client_factory=None):
        return ObjectIdentity(
            shape="tall clear bottle",
            dominant_colors=["transparent"],
            material="plastik_pet",
            notable_features=["white cap"],
        )

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)
    monkeypatch.setattr(visuals_api, "_load_reference_bytes", fake_load_ref)
    monkeypatch.setattr(visuals_api, "extract_object_identity", fake_identity)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    assert len(calls) == 5  # materials + 2 storyboards + before_after + mockup
    # materials panel: photo only as reference
    assert calls[0][1] == [b"photo-bytes"]
    assert "ilustrator instruksional" in calls[0][0]
    assert "[PANEL ALAT & BAHAN]" in calls[0][0]
    # step 1: materials panel is the primary reference, photo second
    assert calls[1][1] == [b"fake-png-bytes", b"photo-bytes"]


def test_generate_all_threads_object_identity_and_timeline(fake_sb, monkeypatch):
    fake_sb.table("skills").insert(
        {
            **SKILL,
            "reference_image_path": "photo-1.jpg",
            "steps": [
                {"order": 1, "instruction": "Cuci botol", "warning": None},
                {"order": 2, "instruction": "Potong botol", "warning": None},
            ],
        }
    )
    fake_sb.storage.from_("scans").upload("photo-1.jpg", b"scan-bytes")
    prompts = []

    async def fake_generate(prompt, reference_images=None):
        prompts.append(prompt)
        return b"fake-png-bytes"

    async def fake_identity(image_bytes, content_type="image/jpeg", client_factory=None):
        return ObjectIdentity(
            shape="tall clear bottle",
            dominant_colors=["transparent"],
            material="plastik_pet",
            notable_features=["white cap"],
        )

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)
    monkeypatch.setattr(visuals_api, "extract_object_identity", fake_identity)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    assert "[PANEL ALAT & BAHAN]" in prompts[0]
    assert "IDENTITAS OBJEK" in prompts[0]
    assert "tall clear bottle" in prompts[0]
    assert "step 1 dari 2" in prompts[1]
    assert "step 2 dari 2" in prompts[2]


def test_generate_all_continues_when_identity_extraction_fails(fake_sb, monkeypatch):
    fake_sb.table("skills").insert(
        {
            **SKILL,
            "reference_image_path": "photo-1.jpg",
            "steps": [{"order": 1, "instruction": "Cuci botol", "warning": None}],
        }
    )
    fake_sb.storage.from_("scans").upload("photo-1.jpg", b"scan-bytes")
    prompts = []

    async def fake_generate(prompt, reference_images=None):
        prompts.append(prompt)
        return b"fake-png-bytes"

    async def boom_identity(image_bytes, content_type="image/jpeg", client_factory=None):
        raise VisionUnavailable("provider down")

    monkeypatch.setattr(visuals_api, "generate_image", fake_generate)
    monkeypatch.setattr(visuals_api, "extract_object_identity", boom_identity)

    async def run():
        await visuals_api.generate_all_visuals(fake_sb, "s1")

    asyncio.run(run())
    assert len(prompts) == 4  # materials + 1 storyboard + before_after + mockup
    assert "[PANEL ALAT & BAHAN]" in prompts[0]
    assert "IDENTITAS OBJEK" not in prompts[0]
    assert "step 1" in prompts[1]
