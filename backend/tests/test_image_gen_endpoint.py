import asyncio
from unittest.mock import AsyncMock, patch

from app.agent.tools.image_gen import build_master_prompt, generate_image


def asyncio_run(coro):
    return asyncio.run(coro)


def test_generate_image_posts_to_generations_endpoint():
    async def fake_post(url, headers=None, json=None):
        assert url.endswith("/images/generations?response_format=binary")
        assert "modalities" not in (json or {})
        assert json["model"] == "oc/test-image-model"
        assert json["prompt"] == "a bottle"
        assert json["size"] == "1024x1024"
        response = AsyncMock()
        response.status_code = 200
        response.raise_for_status = lambda: None
        response.content = b"raw-png-bytes"
        return response

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = fake_post
        with patch("app.agent.tools.image_gen.get_settings") as mock_settings:
            mock_settings.return_value.openrouter_base_url = "http://proxy/v1"
            mock_settings.return_value.openrouter_api_key = "key"
            mock_settings.return_value.image_model = "oc/test-image-model"

            result = asyncio_run(generate_image("a bottle"))
            assert result == b"raw-png-bytes"


def test_generate_image_sends_reference_image():
    captured = {}

    async def fake_post(url, headers=None, json=None):
        captured.update(json or {})
        response = AsyncMock()
        response.raise_for_status = lambda: None
        response.content = b"raw-png-bytes"
        return response

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = fake_post
        with patch("app.agent.tools.image_gen.get_settings") as mock_settings:
            mock_settings.return_value.openrouter_base_url = "http://proxy/v1"
            mock_settings.return_value.openrouter_api_key = "key"
            mock_settings.return_value.image_model = "oc/test-image-model"

            asyncio_run(generate_image("a bottle", [b"\x89PNG-prev", b"\x89PNG-photo"]))
            # provider default (openai-compatible) uses "image" with the PRIMARY ref only
            import base64

            assert captured["image"] == base64.b64encode(b"\x89PNG-prev").decode()


def test_master_prompt_layers():
    step = "Step 2 instruction text"
    with_refs = build_master_prompt(step, has_references=True)
    assert "illustrator of a single DIY upcycling tutorial panel" in with_refs
    assert "previous panel is the truth" in with_refs
    assert "Step 2 instruction text" in with_refs
    assert "scan photo keeps the real object" in with_refs

    without_refs = build_master_prompt(step, has_references=False)
    assert "previous panel is the truth" not in without_refs
    assert "Step 2 instruction text" in without_refs
