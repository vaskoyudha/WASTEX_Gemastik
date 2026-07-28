import base64
import json

import httpx

from app.config import get_settings
from app.schemas import MaterialIdentification

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

VISION_PROMPT = """Identifikasi material sampah utama pada foto ini.

Ciri khas tiap kategori:
- plastik_pet: botol minuman bening/transparan, kaku, dasar berbintik, kode daur ulang 1.
- plastik_hdpe: botol/jerigen buram tidak tembus pandang (sampo, deterjen, galon), kode 2.
- kardus: karton coklat bergelombang, kotak kemasan, tekstur kertas tebal.
- kaleng: logam silinder (minuman aluminium atau kaleng makanan), mengkilap, ada lipatan tepi.
- kaca: botol/toples bening atau berwarna, permukaan keras mengkilap, terlihat berat.
- sachet: kemasan plastik multilayer kecil (kopi, deterjen, mi instan), lentur, metalik di dalam.

Aturan ambiguitas: jika ragu antara dua kategori (misalnya PET vs PVC, atau kaca vs
plastik bening), pilih yang paling mungkin TAPI set confidence maksimal 0.6 dan
sebutkan keraguan itu di field condition.

Jawab HANYA dengan JSON valid berformat:
{"material": "<salah satu: plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet>",
 "condition": "<deskripsi singkat kondisi (bersih/kotor/rusak) dalam bahasa Indonesia>",
 "confidence": <angka 0 sampai 1>}"""


class VisionUnavailable(Exception):
    pass


def build_vision_messages(data_url: str) -> list[dict]:
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": VISION_PROMPT},
                {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
            ],
        }
    ]


async def _identify(
    client: httpx.AsyncClient, model: str, data_url: str, api_key: str
) -> MaterialIdentification:
    r = await client.post(
        OPENROUTER_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "response_format": {"type": "json_object"},
            "messages": build_vision_messages(data_url),
        },
    )
    r.raise_for_status()
    payload = json.loads(r.json()["choices"][0]["message"]["content"])
    return MaterialIdentification.model_validate(payload)


async def scan_material(
    image_bytes: bytes, content_type: str = "image/jpeg"
) -> MaterialIdentification:
    s = get_settings()
    data_url = f"data:{content_type};base64,{base64.b64encode(image_bytes).decode()}"
    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=60) as client:
        # Spec §5: timeout + 1 retry per provider, then GPT-4o -> Gemini fallback.
        for model in (s.vision_model, s.vision_fallback_model):
            for _ in range(2):
                try:
                    return await _identify(client, model, data_url, s.openrouter_api_key)
                except Exception as e:
                    last_err = e
    raise VisionUnavailable("all vision providers failed") from last_err
