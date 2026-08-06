"""Chat JSON helper: httpx mentah + response_format json_object.

Dipakai untuk endpoint yang butuh structured output tetapi memakai model
"thinking" (mis. deepseek-v4-flash) yang MENOLAK tool_choice dari pydantic-ai.
Pola ini sama dengan skill_proposals._call_until_success dan sudah terbukti
bekerja: JSON dipaksa lewat response_format, bukan tool calling.
"""

import json

import httpx
from pydantic import BaseModel

from app.agent.tools.vision import parse_proxy_json
from app.config import get_settings


class ChatJsonUnavailable(Exception):
    pass


async def _post(
    client: httpx.AsyncClient, system: str, user: str, model: str, api_key: str
) -> dict:
    s = get_settings()
    r = await client.post(
        f"{s.openrouter_base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        },
    )
    r.raise_for_status()
    return json.loads(parse_proxy_json(r.text)["choices"][0]["message"]["content"])


async def chat_json[T: BaseModel](
    system: str,
    user: str,
    model_cls: type[T],
    client_factory=httpx.AsyncClient,
) -> T:
    """Panggil chat model, paksa JSON, validasi ke model_cls.

    Retry 2x per model (chat lalu fallback), sama seperti pipeline skill.
    """
    settings = get_settings()
    last_err: Exception | None = None
    async with client_factory(timeout=120) as client:
        for model in (settings.chat_model, settings.chat_fallback_model):
            for _ in range(2):
                try:
                    payload = await _post(client, system, user, model, settings.openrouter_api_key)
                    return model_cls.model_validate(payload)
                except Exception as e:
                    last_err = e
    raise ChatJsonUnavailable("all chat providers failed") from last_err
