"""Chat JSON helper: httpx mentah + response_format json_object.

Dipakai untuk endpoint yang butuh structured output tetapi memakai model
"thinking" (mis. deepseek-v4-flash) yang MENOLAK tool_choice dari pydantic-ai.
Pola ini sama dengan skill_proposals._call_until_success dan sudah terbukti
bekerja: JSON dipaksa lewat response_format, bukan tool calling.
"""

import json
import re

import httpx
from pydantic import BaseModel

from app.agent.tools.vision import parse_proxy_json
from app.config import get_settings


class ChatJsonUnavailable(Exception):
    pass


def extract_json_object(content: str) -> dict:
    """Ekstrak objek JSON dari konten model.

    Beberapa model (mis. qd/qmodel_38max) mengabaikan response_format
    json_object dan menjawab dengan prose/markdown. Coba: parse langsung,
    blok ```json ... ```, lalu substring '{' pertama sampai '}' terakhir.
    """
    text = content.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            pass
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    raise json.JSONDecodeError("no JSON object found in content", text, 0)


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
    content = parse_proxy_json(r.text)["choices"][0]["message"]["content"] or ""
    return extract_json_object(content)


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
