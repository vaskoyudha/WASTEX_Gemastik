import base64
import json

import httpx

from app.config import get_settings
from app.schemas import MaterialIdentification, ObjectIdentity

VISION_PROMPT = """# Tugas
Identifikasi material sampah anorganik DOMINAN pada foto.

## Iron Law
KLASIFIKASI HANYA BERDASARKAN BUKTI VISUAL YANG TERLIHAT DI FOTO.
Jangan tebak, jangan berasumsi, jangan menambah detail yang tidak terlihat.

## Aturan (MUST/NEVER)
1. Tentukan SATU material dominan. Jika ada beberapa objek, analisis objek TERBESAR/tengah bingkai.
2. Periksa SEMUA ciri (bentuk, tekstur, transparansi, kilau, warna) sebelum memutuskan.
3. Jika ragukan antara dua kategori, ikuti Protokol Ambiguitas. JANGAN serampangan memilih.
4. Jangan pernah membaca huruf/kode daur ulang sebagai bukti utama jika tidak jelas di foto.
5. Amati dulu dalam hati: senarai ciri yang terlihat -> bandingkan dengan tiap kategori -> putuskan.
6. Output HANYA JSON valid. Tanpa teks lain di luar JSON.

## Kategori (Ciri Kuat = bukti utama, Ciri Lemah = jangan diandalkan sendirian)
- plastik_pet: Ciri Kuat: botol bening/transparan, kaku, dasar berbintik, bobot ringan. Ciri Lemah: warna (PET bisa warna apa saja).
- plastik_hdpe: Ciri Kuat: botol/jerigen buram (tidak tembus pandang) - sampo, deterjen, galon, kode 2. Ciri Lemah: bentuk botol (mirip PET).
- kardus: Ciri Kuat: tekstur kertas tebal, bergelombang (corrugated) terlihat di tepi/robekan, warna coklat alami. Ciri Lemah: warna coklat (plastik/kaca juga bisa coklat).
- kaleng: Ciri Kuat: logam silinder mengkilap, ada lipatan tepi atas/bawah, ringan bila aluminium. Ciri Lemah: bentuk silinder (mirip botol PET).
- kaca: Ciri Kuat: transparan berat, permukaan keras mengkilap, pantulan yang jelas, tepi tebal terlihat. Ciri Lemah: transparan (PET bening juga transparan).
- sachet: Ciri Kuat: kemasan pipih multi-lapis, lentur, lipatan, kilau metalik di dalam, kecil (kopi/deterjen/mi instan). Ciri Lemah: metalik (kaleng juga mengkilap).

## Pasangan yang Sering Tertukar (confusion pairs)
| Kategori A | Kategori B | Pembeda Kunci |
| plastik_pet | plastik_hdpe | TEMBUS CAHAYA vs BUram |
| plastik_pet | kaca | ringan tipis vs berat tebal |
| kaleng | plastik_pet | metalik berlipatan vs bening kaku |
| kardus | plastik coklat | bergelombang vs licin |
| sachet | kaleng | pipih lentur vs silinder kaku |

## Protokol Ambiguitas
Jika ciri visual tidak cukup untuk memutuskan (tidak tajam/tidak jelas/kontradiktif):
1. Pilih kemungkinan yang paling masuk akal.
2. Tetapkan confidence MAKSIMAL 0.6.
3. Sebutkan keraguan tersebut di field condition (mis. "bisa kaca atau PET, sulit dibedakan").

## Red Flags (hati-hati bila ini terjadi)
- Foto blur/gelap/benda kecil -> berpotensi salah klasifikasi -> ikuti Protokol Ambiguitas.
- Memilih berdasarkan satu ciri saja (misal asal silinder = botol).
- Memaksakan kategori karena takut salah; lebih baik confidence rendah yang jujur.
- Teks/label/kode terlihat -> boleh membantu, tapi bukan bukti tunggal.

## Format Output (WAJIB)
Jawab HANYA dengan JSON valid:
{"material":"<plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet>",
 "condition":"<deskripsi singkat kondisi dalam bahasa Indonesia>",
 "confidence":<0.0 - 1.0>}

## Self-Check (sebelum menjawab)
- Material yang dipilih didukung bukti visual yang terlihat?
- Confidence mencerminkan kepastian yang jujur (rendah bila ragu)?
- JSON valid, tanpa trailing text/koma?"""


class VisionUnavailable(Exception):
    pass


IDENTITY_PROMPT = """# Tugas
Analisis foto sampah daur ulang dan tulis identitas visual KANONIK objeknya untuk menjaga konsistensi ilustrasi tutorial.

## Iron Law
DESKRIPSI HANYA BERDASARKAN BUKTI VISUAL YANG TERLIHAT DI FOTO. Jangan menebak, jangan menambah detail imajinasi.

## Aturan (MUST/NEVER)
1. shape: bentuk dasar objek dalam bahasa Inggris, 3-8 kata (mis. "tall clear bottle with narrow neck").
2. dominant_colors: 1-3 warna yang benar-benar terlihat (Inggris, mis. "transparent", "blue", "white").
3. material: salah satu dari plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet.
4. notable_features: 0-2 ciri khas yang terlihat (mis. "white cap", "bent label", "dented side").
5. Output HANYA JSON valid. Tanpa teks lain di luar JSON.

## Red Flags (hati-hati bila ini terjadi)
- Warna dari pencahayaan/kuning lampu dianggap warna asli -> jangan, sebutkan warna netral.
- Menyebut ciri yang tidak terlihat di foto -> jangan.
- Shape terlalu panjang/bertele-tele -> ringkas 3-8 kata.

## Self-Check (sebelum menjawab)
- Setiap field didukung bukti visual di foto?
- dominant_colors hanya warna yang benar-benar terlihat?
- JSON valid, tanpa trailing text/koma?

## Format Output (WAJIB)
Jawab HANYA dengan JSON valid:
{"shape": "...", "dominant_colors": ["..."], "material": "plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet", "notable_features": ["..."]}"""


def parse_proxy_json(text: str) -> dict:
    cutoff = text.find("data: [DONE]")
    if cutoff != -1:
        text = text[:cutoff].rstrip()
    return json.loads(text)


def build_vision_messages(data_url: str, prompt: str = VISION_PROMPT) -> list[dict]:
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
            ],
        }
    ]


async def _identify(
    client: httpx.AsyncClient, model: str, data_url: str, api_key: str
) -> MaterialIdentification:
    s = get_settings()
    r = await client.post(
        f"{s.openrouter_base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "response_format": {"type": "json_object"},
            "messages": build_vision_messages(data_url),
        },
    )
    r.raise_for_status()
    payload = json.loads(parse_proxy_json(r.text)["choices"][0]["message"]["content"])
    return MaterialIdentification.model_validate(payload)


async def _extract_identity(
    client: httpx.AsyncClient, model: str, data_url: str, api_key: str
) -> ObjectIdentity:
    s = get_settings()
    r = await client.post(
        f"{s.openrouter_base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "response_format": {"type": "json_object"},
            "messages": build_vision_messages(data_url, IDENTITY_PROMPT),
        },
    )
    r.raise_for_status()
    payload = json.loads(parse_proxy_json(r.text)["choices"][0]["message"]["content"])
    return ObjectIdentity.model_validate(payload)


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


async def extract_object_identity(
    image_bytes: bytes,
    content_type: str = "image/jpeg",
    client_factory=httpx.AsyncClient,
) -> ObjectIdentity:
    s = get_settings()
    data_url = f"data:{content_type};base64,{base64.b64encode(image_bytes).decode()}"
    last_err: Exception | None = None
    async with client_factory(timeout=60) as client:
        # Same retry shape as scan_material: 2 attempts per provider, model -> fallback.
        for model in (s.vision_model, s.vision_fallback_model):
            for _ in range(2):
                try:
                    return await _extract_identity(client, model, data_url, s.openrouter_api_key)
                except Exception as e:
                    last_err = e
    raise VisionUnavailable("all vision providers failed") from last_err
