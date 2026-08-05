import asyncio
from unittest.mock import AsyncMock, patch

from app.agent.tools.image_gen import (
    ImageGenUnavailable,
    build_master_prompt,
    build_storyboard_prompt,
    generate_image,
)
from app.schemas import ObjectIdentity


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


def test_generate_image_raises_unavailable_on_provider_error():
    import httpx

    async def fake_post(url, headers=None, json=None):
        response = AsyncMock()
        response.raise_for_status = lambda: (_ for _ in ()).throw(
            httpx.HTTPStatusError("503", request=httpx.Request("POST", url), response=response)
        )
        return response

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = fake_post
        with patch("app.agent.tools.image_gen.get_settings") as mock_settings:
            mock_settings.return_value.openrouter_base_url = "http://proxy/v1"
            mock_settings.return_value.openrouter_api_key = "key"
            mock_settings.return_value.image_model = "oc/test-image-model"

            exc = None
            try:
                asyncio_run(generate_image("a bottle"))
            except ImageGenUnavailable as e:
                exc = e
            assert exc is not None


def test_master_prompt_layers():
    step = "Step 2 instruction text"
    with_refs = build_master_prompt(step, has_references=True)
    assert "illustrator of a single DIY upcycling tutorial panel" in with_refs
    assert "match it exactly" in with_refs
    assert "only the action changes" in with_refs
    assert "never photorealistic" in with_refs
    assert "Step 2 instruction text" in with_refs

    without_refs = build_master_prompt(step, has_references=False)
    assert "only the action changes" not in without_refs
    assert "Step 2 instruction text" in without_refs


def test_storyboard_prompt_includes_identity_block():
    skill = {"title": "Vas Botol PET", "material": "plastik_pet"}
    step = {"order": 1, "instruction": "Cuci botol", "warning": None}
    identity = ObjectIdentity(
        shape="tall clear bottle with narrow neck",
        dominant_colors=["transparent", "blue"],
        material="plastik_pet",
        notable_features=["white cap"],
    )
    prompt = build_storyboard_prompt(skill, step, identity=identity)
    assert "Object identity is FIXED for every panel" in prompt
    assert "tall clear bottle with narrow neck" in prompt
    assert "transparent" in prompt
    assert "white cap" in prompt


def test_storyboard_prompt_includes_timeline():
    skill = {"title": "Vas Botol PET", "material": "plastik_pet"}
    step = {"order": 2, "instruction": "Potong botol", "warning": None}
    prompt = build_storyboard_prompt(skill, step, step_count=3)
    assert "step 2 of 3" in prompt


def test_storyboard_prompt_without_identity_and_count_unchanged_shape():
    skill = {"title": "Vas Botol PET", "material": "plastik_pet"}
    step = {"order": 1, "instruction": "Cuci botol", "warning": "Hati-hati gunting"}
    prompt = build_storyboard_prompt(skill, step)
    assert "Object identity is FIXED" not in prompt
    assert "step 1" in prompt
    assert "Cuci botol" in prompt
    assert "Hati-hati gunting" in prompt
