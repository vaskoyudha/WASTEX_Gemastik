import pytest
from fastapi.testclient import TestClient

import app.api.selling as selling_api
from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from app.schemas import SellingKit
from tests.fakes import FakeSupabase


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


FAKE_KIT = SellingKit(
    skill_id="s1",
    product_name="Vas Botol Estetik",
    description="Vas cantik dari botol PET bekas.",
    captions=["Dari sampah jadi cuan! #upcycling"],
    photo_tips=["Foto dekat jendela dengan cahaya alami."],
    packaging_ideas=["Bungkus kertas koran bekas + tali rami."],
    hashtags=["#wastex", "#upcycling"],
)


@pytest.fixture()
def stub_agent(monkeypatch):
    async def fake_generate(skill):
        return FAKE_KIT

    monkeypatch.setattr(selling_api, "generate_selling_kit", fake_generate)


def test_selling_kit_for_approved_skill(fake_sb, stub_agent):
    fake_sb.table("skills").insert(
        {"id": "s1", "title": "Vas Botol", "material": "plastik_pet", "status": "approved"}
    )
    client = TestClient(app)
    r = client.get("/selling/s1")
    assert r.status_code == 200
    body = r.json()
    assert body["product_name"] == "Vas Botol Estetik"
    assert body["captions"]
    assert body["packaging_ideas"]


def test_selling_kit_unknown_skill_404(fake_sb, stub_agent):
    client = TestClient(app)
    r = client.get("/selling/nope")
    assert r.status_code == 404


def test_selling_kit_unapproved_skill_404(fake_sb, stub_agent):
    fake_sb.table("skills").insert(
        {"id": "s1", "title": "Draft", "material": "kaca", "status": "draft"}
    )
    client = TestClient(app)
    r = client.get("/selling/s1")
    assert r.status_code == 404


def test_completion_selling_kit_uses_finished_product_photo(fake_sb, stub_agent, monkeypatch):
    fake_sb.table("skills").insert(
        {
            "id": "s1",
            "title": "Vas Botol",
            "material": "plastik_pet",
            "status": "approved",
            "est_price_idr": 25000,
        }
    )
    fake_sb.table("skill_completions").insert(
        {
            "id": "c1",
            "user_id": "u1",
            "skill_id": "s1",
            "photo_path": "c1.jpeg",
            "rating": 5,
        }
    )
    fake_sb.storage.from_("completions").upload("c1.jpeg", b"finished-product")
    captured = {}

    async def fake_image(prompt, references=None):
        captured["prompt"] = prompt
        captured["references"] = references
        return b"promo-png"

    monkeypatch.setattr(selling_api, "generate_image", fake_image)
    token = create_test_token({"sub": "u1"})
    r = TestClient(app).get(
        "/selling/s1/completions/c1",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert r.status_code == 200
    assert r.json()["completion_id"] == "c1"
    assert r.json()["promo_image_url"].endswith("/completions/promos/c1.png")
    assert captured["references"] == [b"finished-product"]
    assert "FOTO PRODUK JADI PENGGUNA" in captured["prompt"]
    assert fake_sb.table("skill_completions").updated[0]["selling_kit"]["product_name"]


def test_completion_selling_kit_hides_another_users_completion(fake_sb, stub_agent):
    fake_sb.table("skills").insert(
        {"id": "s1", "title": "Vas Botol", "material": "plastik_pet", "status": "approved"}
    )
    fake_sb.table("skill_completions").insert(
        {"id": "c1", "user_id": "u2", "skill_id": "s1", "photo_path": "c1.jpeg"}
    )
    token = create_test_token({"sub": "u1"})
    r = TestClient(app).get(
        "/selling/s1/completions/c1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404


def test_completion_story_asset_is_vertical_and_uses_finished_photo(
    fake_sb, stub_agent, monkeypatch
):
    fake_sb.table("skills").insert(
        {
            "id": "s1",
            "title": "Vas Botol",
            "material": "plastik_pet",
            "status": "approved",
            "est_price_idr": 25000,
        }
    )
    fake_sb.table("skill_completions").insert(
        {
            "id": "c1",
            "user_id": "u1",
            "skill_id": "s1",
            "photo_path": "c1.jpeg",
        }
    )
    fake_sb.storage.from_("completions").upload("c1.jpeg", b"finished-product")
    captured = {}

    async def fake_image(prompt, references=None, size="1024x1024", aspect_ratio=None):
        captured.update(
            prompt=prompt,
            references=references,
            size=size,
            aspect_ratio=aspect_ratio,
        )
        return b"story-png"

    monkeypatch.setattr(selling_api, "generate_image", fake_image)
    token = create_test_token({"sub": "u1"})
    r = TestClient(app).post(
        "/selling/s1/completions/c1/story",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert r.status_code == 200
    assert r.json()["story_image_url"].endswith("/completions/promos/c1-story.png")
    assert captured["references"] == [b"finished-product"]
    assert captured["size"] == "1K"
    assert captured["aspect_ratio"] == "9:16"
    assert "vertikal 9:16" in captured["prompt"]
    assert fake_sb.table("skill_completions").updated[0]["story_image_path"].endswith("-story.png")


def test_completion_story_asset_uses_cache(fake_sb, stub_agent, monkeypatch):
    fake_sb.table("skills").insert(
        {"id": "s1", "title": "Vas", "material": "kaca", "status": "approved"}
    )
    fake_sb.table("skill_completions").insert(
        {
            "id": "c1",
            "user_id": "u1",
            "skill_id": "s1",
            "photo_path": "c1.jpeg",
            "story_image_path": "promos/c1-story.png",
        }
    )

    async def boom(*args, **kwargs):
        raise AssertionError("cached story must not regenerate")

    monkeypatch.setattr(selling_api, "generate_image", boom)
    token = create_test_token({"sub": "u1"})
    r = TestClient(app).post(
        "/selling/s1/completions/c1/story",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["story_image_url"].endswith("/completions/promos/c1-story.png")


async def test_generate_selling_kit_uses_chat_json(monkeypatch):
    import app.agent.selling as selling_module

    captured = {}

    async def fake_chat_json(system, user, model, client_factory=None):
        captured["system"] = system
        captured["user"] = user
        return SellingKit(
            product_name="Vas Estetik",
            description="Dari botol PET bekas.",
            captions=["Cuan!"],
            photo_tips=["Cahaya alami."],
            packaging_ideas=["Koran bekas."],
            hashtags=["#wastex"],
        )

    monkeypatch.setattr(selling_module, "chat_json", fake_chat_json)
    kit = await selling_module.generate_selling_kit(
        {"id": "s9", "title": "Vas Botol", "material": "plastik_pet", "difficulty": "pemula"}
    )
    assert kit.product_name == "Vas Estetik"
    assert kit.skill_id == "s9"
    assert "Vas Botol" in captured["user"]
