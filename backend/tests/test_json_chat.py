import json

import pytest

from app.agent.json_chat import ChatJsonUnavailable, chat_json
from app.schemas import SellingKit


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    @property
    def text(self):
        return json.dumps({"choices": [{"message": {"content": json.dumps(self._payload)}}]})


class FakeClient:
    def __init__(self, payloads, failures=0):
        self._payloads = payloads
        self._failures = failures
        self.post_calls = 0
        self.last_json = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, headers, json):
        self.post_calls += 1
        self.last_json = json
        if self.post_calls <= self._failures:
            raise RuntimeError("provider down")
        payload = self._payloads[min(self.post_calls - 1, len(self._payloads) - 1)]
        return FakeResponse(payload)


KIT = {
    "product_name": "Vas Botol",
    "description": "Vas cantik dari botol PET.",
    "captions": ["Dari sampah jadi cuan!"],
    "photo_tips": ["Foto dekat jendela."],
    "packaging_ideas": ["Koran bekas + tali."],
    "hashtags": ["#wastex"],
}


async def test_chat_json_parses_model():
    client = FakeClient([KIT])
    out = await chat_json("sys", "user", SellingKit, client_factory=lambda **kw: client)
    assert isinstance(out, SellingKit)
    assert out.product_name == "Vas Botol"
    assert client.post_calls == 1


async def test_chat_json_uses_json_object_response_format():
    client = FakeClient([KIT])
    await chat_json("sys", "user", SellingKit, client_factory=lambda **kw: client)
    assert client.last_json["response_format"] == {"type": "json_object"}
    # tidak mengirim tools/tool_choice (yang ditolak thinking model)
    assert "tool_choice" not in client.last_json
    assert "tools" not in client.last_json


async def test_chat_json_retries_then_falls_back():
    client = FakeClient([KIT, KIT, KIT, KIT], failures=3)
    out = await chat_json("sys", "user", SellingKit, client_factory=lambda **kw: client)
    assert isinstance(out, SellingKit)
    assert client.post_calls == 4  # 2 chat + 2 fallback, sukses di percobaan ke-4


async def test_chat_json_raises_when_all_fail():
    client = FakeClient([KIT], failures=99)
    with pytest.raises(ChatJsonUnavailable):
        await chat_json("sys", "user", SellingKit, client_factory=lambda **kw: client)
