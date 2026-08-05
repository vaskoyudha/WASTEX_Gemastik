import asyncio
import json

import pytest

from app.agent.tools.vision import (
    VisionUnavailable,
    extract_object_identity,
)
from app.schemas import ObjectIdentity


class FakeClient:
    """Minimal async httpx stand-in: post() returns self, .text is the body."""

    def __init__(self, content: str):
        self.content = content
        self.post_calls = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, headers=None, json=None):
        self.post_calls += 1
        return self

    def raise_for_status(self):
        pass

    @property
    def text(self) -> str:
        return self.content


def _wrap(content: str) -> str:
    return json.dumps({"choices": [{"message": {"content": content}}]})


def test_extract_identity_parses_canonical_fields():
    body = _wrap(
        json.dumps(
            {
                "shape": "tall clear bottle with narrow neck",
                "dominant_colors": ["transparent", "blue"],
                "material": "plastik_pet",
                "notable_features": ["white cap"],
            }
        )
    )
    client = FakeClient(body)
    identity = asyncio.run(
        extract_object_identity(b"x", "image/jpeg", client_factory=lambda **kw: client)
    )
    assert isinstance(identity, ObjectIdentity)
    assert identity.shape == "tall clear bottle with narrow neck"
    assert identity.material == "plastik_pet"
    assert identity.dominant_colors == ["transparent", "blue"]
    assert identity.notable_features == ["white cap"]


def test_extract_identity_raises_when_all_providers_fail():
    client = FakeClient("not json at all")
    with pytest.raises(VisionUnavailable):
        asyncio.run(extract_object_identity(b"x", "image/jpeg", client_factory=lambda **kw: client))
    assert client.post_calls == 4  # 2 retries on vision_model + 2 on fallback
