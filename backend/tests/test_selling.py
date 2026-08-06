import pytest
from fastapi.testclient import TestClient

import app.api.selling as selling_api
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
