import json

import httpx

from app.agent.tools.vision import parse_proxy_json
from app.schemas import SkillProposal, SkillVerifyResponse

SKILL_PROPOSAL_PROMPT = """# Tugas
Kamu adalah perancang kerajinan daur ulang (upcycling) yang teliti.
Buat 3 proposal skill yang BENAR-BENAR bisa dibuat dari material ini: {material}.

## Iron Law
HANYA GUNAKAN MATERIAL YANG DIBERIKAN SEBAGAI BAHAN UTAMA. DILARANG MENAMBAH BAHAN UTAMA DARI LUAR.
Jika material tidak cocok untuk ide apa pun, jawab daftar proposals kosong.

## Aturan (MUST/NEVER)
- HANYA gunakan material yang diberikan (salah satu dari:
  plastik_pet, plastik_hdpe, kardus, kaleng, kaca, sachet) sebagai BAHAN UTAMA.
- Bahan pelengkap (tali, cat, lem, tanah/tanaman, pengait, alat bantu kecil,
  dan sejenisnya) BOLEH dipakai, WAJIB dideklarasikan di additional_materials
  dengan name, category (tali|cat|lem|tanah_tanaman|pengait|alat|lainnya),
  est_cost_idr (perkiraan harga wajar dalam IDR), dan purpose (kegunaan, >= 3 kata).
- DILARANG menyebut bahan pelengkap di langkah (instruction/warning) yang TIDAK
  terdaftar di additional_materials.
- Jika material tidak cocok untuk ide apa pun, jawab dengan daftar proposals kosong.
- Setiap langkah wajib punya instruksi jelas dan peringatan keamanan bila ada risiko
  (tergores, terkena panas, zat berbahaya).
- Tingkat kesulitan hanya salah satu dari: pemula, menengah, mahir.
- Kondisi bahan: {condition}. Sesuaikan ide dengan kondisi tersebut.

## Red Flags (hati-hati bila ini terjadi)
- Ide butuh bahan UTAMA di luar whitelist -> buang ide, ganti yang lain.
- Langkah berisiko tanpa peringatan keamanan -> jangan diloloskan.
- Bahan pelengkap disebut di langkah tanpa terdaftar di additional_materials -> perbaiki.
- Ide mustahil dikerjakan di rumah (peralatan industri) -> buang.
- Proposals lebih dari 3 -> jangan, maksimal 3.

## Self-Check (sebelum menjawab)
- Setiap proposal hanya memakai {material} sebagai bahan utama?
- Semua bahan pelengkap di langkah terdaftar di additional_materials?
- Semua langkah aman, jelas, dan peringatan ada untuk risiko?
- JSON valid sesuai format?

Jawab HANYA dengan JSON valid berformat:
{{"proposals": [{{"title": "...", "description": "...",
  "material": "plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet",
  "difficulty": "pemula|menengah|mahir",
  "steps": [{{"order": 1, "instruction": "...", "warning": "..."}}],
  "tools": [{{"name": "...", "optional": false}}],
  "additional_materials": [{{"name": "...", "category": "tali|cat|lem|tanah_tanaman|pengait|alat|lainnya", "est_cost_idr": 2000, "purpose": "..."}}],
  "est_cost_idr": 5000, "est_price_idr": 25000}}]}}"""

SKILL_VERIFY_PROMPT = """# Tugas
Kamu adalah validator skill daur ulang yang ketat. Periksa draft skill berikut.

## Iron Law
VERDICT HANYA BERDASARKAN 4 ASPEK BERIKUT, BUKAN OPINI PRIBADI.
Jika SATU aspek gagal, verdict = "perbaiki". Tanpa pengecualian.

## Aturan (MUST/NEVER)
1. Kesesuaian material: bahan utama semua langkah HARUS sesuai material yang
   dinyatakan; bahan PELENGKAP (tali, cat, lem, tanah/tanaman, pengait, alat
   bantu kecil) BOLEH dipakai dan BUKAN pelanggaran SELAMA terdaftar di
   additional_materials dengan purpose yang jelas.
2. Kelayakan: apakah langkah-langkah masuk akal dan bisa benar-benar dikerjakan di rumah?
3. Keamanan: apakah ada langkah berbahaya tanpa peringatan yang cukup?
4. Kelengkapan: apakah urutan langkah lengkap dari awal sampai produk jadi?

## Red Flags (hati-hati bila ini terjadi)
- Langkah berbahaya (tajam/panas/beracun) tanpa peringatan -> WAJIB "perbaiki".
- Bahan pelengkap disebut di langkah tapi tidak terdaftar di additional_materials -> WAJIB "perbaiki".
- additional_materials.est_cost_idr tidak wajar (> Rp100.000 per item) atau purpose
  kurang dari 3 kata -> WAJIB "perbaiki".
- Feedback kosong saat verdict "perbaiki" -> jangan, beri alasan spesifik.
- Verdict "layak" karena enggan menolak -> jangan, ikuti aspek.

## Self-Check (sebelum menjawab)
- Verdict konsisten dengan hasil 4 aspek?
- Feedback menyebut masalah spesifik, termasuk bahan pelengkap yang bermasalah?
- JSON valid sesuai format?

Jawab HANYA dengan JSON valid berformat:
{"verdict": "layak" atau "perbaiki",
 "feedback": ["<satu kalimat per masalah>", "..."],
 "suggestions": ["<saran perbaikan spesifik>", "..."]}
Jika semua aspek lolos, verdict = "layak" dan feedback kosong."""


def _parse_proposals(payload: dict, expected_material: str) -> list[SkillProposal]:
    proposals = payload.get("proposals") or []
    result = []
    for item in proposals:
        try:
            proposal = SkillProposal.model_validate(item)
        except Exception:  # noqa: S112
            continue
        if proposal.material.value == expected_material:
            result.append(proposal)
    return result


def _parse_verdict(payload: dict) -> SkillVerifyResponse:
    return SkillVerifyResponse.model_validate(payload)


def _build_proposal_messages(material: str, condition: str) -> list[dict]:
    content = SKILL_PROPOSAL_PROMPT.format(material=material, condition=condition)
    return [{"role": "user", "content": content}]


def _build_verify_messages(draft: SkillProposal, chat_history: list[dict]) -> list[dict]:
    content = SKILL_VERIFY_PROMPT + "\n\nDraft skill:\n" + draft.model_dump_json(indent=2)
    return [{"role": "user", "content": content}, *chat_history]


async def _post_json(
    client: httpx.AsyncClient, messages: list[dict], model: str, api_key: str
) -> dict:
    from app.config import get_settings

    s = get_settings()
    r = await client.post(
        f"{s.openrouter_base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "response_format": {"type": "json_object"},
            "messages": messages,
        },
    )
    r.raise_for_status()
    return json.loads(parse_proxy_json(r.text)["choices"][0]["message"]["content"])


class SkillGenUnavailable(Exception):
    pass


async def _call_until_success(messages, parse, client_factory):
    from app.config import get_settings

    settings = get_settings()
    last_err: Exception | None = None
    async with client_factory(timeout=120) as client:
        for model in (settings.chat_model, settings.chat_fallback_model):
            for _ in range(2):
                try:
                    payload = await _post_json(client, messages, model, settings.openrouter_api_key)
                    return parse(payload)
                except Exception as e:
                    last_err = e
    raise SkillGenUnavailable("all chat providers failed") from last_err


async def generate_proposals(
    material: str, condition: str, client_factory=httpx.AsyncClient
) -> list[SkillProposal]:
    messages = _build_proposal_messages(material, condition)
    return await _call_until_success(
        messages, lambda p: _parse_proposals(p, material), client_factory
    )


async def verify_draft(
    draft: SkillProposal,
    chat_history: list[dict],
    client_factory=httpx.AsyncClient,
) -> SkillVerifyResponse:
    messages = _build_verify_messages(draft, chat_history)
    return await _call_until_success(messages, _parse_verdict, client_factory)
