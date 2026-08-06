import json

import httpx

from app.agent.tools.vision import parse_proxy_json
from app.schemas import (
    ContinuityCritique,
    ContinuityCritiqueBatch,
    SkillProposal,
    SkillVerifyResponse,
)

STEP_CONTINUITY_CRITIQUE_PROMPT = """# Tugas
Kamu adalah validator kritis kontinuitas langkah kerajinan daur ulang. Periksa daftar proposal skill di bawah.

## Cara menalar (per step, per proposal)
Untuk SETIAP langkah N pada setiap proposal:
1. Sebutkan prasyarat fisik/waktu yang dibutuhkan agar aksi step N bisa dikerjakan
   (contoh: mengisi tanah butuh lubang drainase; mengecat butuh permukaan bersih dan
   kering; memasang tali butuh lubang; melipat butuh bahan sudah dipotong).
2. Periksa langkah 1..N-1: apakah prasyarat itu SUDAH disediakan oleh langkah sebelumnya?
3. Jika TIDAK -> catat di steps[] dengan order=N dan missing_prerequisite yang spesifik.

## Iron Law
HANYA menilai kontinuitas prasyarat antar langkah; DILARANG menilai aspek lain.

## Aturan (MUST/NEVER)
- HANYA laporkan prasyarat yang benar-benar diperlukan secara fisik; jangan berlebihan.
- JANGAN menilai aspek lain (gaya, estetika, harga, keamanan) - hanya kontinuitas urutan.
- JANGAN melaporkan langkah pertama (N=1) karena tidak punya prasyarat dari step sebelumnya.
- Verdict "kontinu" HANYA jika tidak ada satu pun prasyarat yang terlewat.

## Red Flags (hati-hati bila ini terjadi)
- Step berisi tanah/tanaman tetapi tidak ada langkah drainase sebelumnya -> WAJIB "perbaiki".
- Step berisi cat/perekat tetapi tidak ada langkah pembersihan/pengeringan sebelumnya -> WAJIB "perbaiki".
- Step berisi tali/pengait tetapi tidak ada langkah pelubangan sebelumnya -> WAJIB "perbaiki".
- Step melipat/menyambung bahan yang belum dipotong -> WAJIB "perbaiki".

## Self-Check
- Setiap step yang butuh prasyarat sudah diperiksa terhadap step sebelumnya?
- missing_prerequisite spesifik dan bisa dieksekusi?
- Verdict konsisten dengan isi steps[]?

Jawab HANYA dengan JSON valid berformat:
{{"critiques": [{{"index": 0, "verdict": "kontinu|perbaiki",
  "steps": [{{"order": 3, "missing_prerequisite": "lubang drainase", "note": "..."}}],
  "suggestions": ["tambahkan langkah melubangi dasar kaleng sebelum mengisi tanah"]}}]}}
Satu objek per proposal, urut sesuai index."""

STEP_REPAIR_PROMPT = """# Tugas
Kamu adalah perajin ulung yang mengubah sampah anorganik menjadi produk kreatif bernilai
jual tinggi. Perbaiki draft skill berikut agar urutan langkahnya KONTINU.

## Draft yang harus diperbaiki
{draft_json}

## Masalah kontinuitas yang ditemukan oleh kritikus
{gaps}

## Iron Law
JANGAN mengubah ide utama draft; hanya perbaiki urutan dan tambah prasyarat yang hilang.

## Aturan (MUST/NEVER)
- JANGAN mengubah ide, judul, material, difficulty, tools, atau additional_materials.
- Tambahkan langkah prasyarat yang hilang sebagai step baru dengan order yang benar,
  ATAU ubah urutan langkah agar prasyarat muncul sebelum penggunaannya.
- Setiap langkah (termasuk yang baru) WAJIB punya visual_description detail 2-4 kalimat.
- Langkah tetap SATU aksi utama, tidak kondisional/pilihan ganda.
## Red Flags (hati-hati bila ini terjadi)
- Menghapus langkah yang sudah benar atau mengubah ide utama -> jangan, hanya tambah/susun ulang.
- Langkah baru tanpa visual_description -> jangan, WAJIB lengkap.
- Menambah bahan utama di luar material draft -> jangan, ikuti material draft.

Jawab HANYA dengan JSON valid berformat:
{{"proposal": {{"title": "...", "description": "...", "material": "...",
  "difficulty": "...", "steps": [...], "tools": [...], "additional_materials": [...],
  "est_cost_idr": ..., "est_price_idr": ...}}}}"""

SKILL_PROPOSAL_PROMPT = """# Tugas
Kamu adalah perajin ulung yang mengubah sampah anorganik menjadi produk kreatif
bernilai jual tinggi, sekaligus perancang kerajinan daur ulang (upcycling) yang teliti.
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
- Setiap langkah WAJIB punya visual_description: 2-4 kalimat detail visual dalam Bahasa
  Indonesia tentang apa yang harus TAMPAK pada panel ilustrasi (objek utama, aksi yang
  sedang dilakukan, posisi tangan/alat, hasil yang terlihat, sudut pandang, elemen
  pendukung di sekitar, ekspresi/detail kecil yang memperjelas aksi).
- URUTAN LANGAH WAJIB KONTINU: langkah N+1 harus bisa dikerjakan PERSIS SETELAH
  langkah N selesai, tanpa langkah prasyarat tersembunyi. JANGAN melompati prasyarat.
  Contoh wajib diikuti: lubangi drainase SEBELUM mengisi tanah; cuci & keringkan
  SEBELUM memotong/mengecat; buat lubang SEBELUM memasang tali; ampelas SEBELUM mengecat.
- SATU AKTI UTAMA per langkah: jangan menggabungkan beberapa aksi yang menghasilkan
  produk jadi dalam satu langkah; pisahkan menjadi langkah-langkah terpisah.
- Instruksi TIDAK boleh kondisional/pilihan ganda ("bisa A atau B", "atau biarkan
  apa adanya") — tentukan SATU aksi yang pasti dan hasil yang terlihat.
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
- Urutan langkah kontinu: bisa langkah N+1 dikerjakan persis setelah langkah N tanpa
  prasyarat tersembunyi (mis. drainase, pengeringan, lubang)? Setiap langkah punya
  SATU aksi utama, bukan pilihan ganda?
- JSON valid sesuai format?

Jawab HANYA dengan JSON valid berformat:
{{"proposals": [{{"title": "...", "description": "...",
  "material": "plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet",
  "difficulty": "pemula|menengah|mahir",
  "steps": [{{"order": 1, "instruction": "...", "warning": "...", "visual_description": "..."}}],
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
   Periksa KONTINUITAS: apakah setiap langkah bisa dikerjakan PERSIS SETELAH langkah
   sebelumnya tanpa prasyarat tersembunyi (mis. lubang drainase sebelum mengisi tanah,
   pengeringan sebelum mengecat, lubang sebelum memasang tali, pengampelasan sebelum
   mengecat)? Jika ada lompatan prasyarat atau langkah yang menggabungkan banyak aksi
   atau bersifat pilihan ganda ("bisa A atau B") -> WAJIB "perbaiki".

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


def _parse_critiques(payload: dict) -> list[ContinuityCritique]:
    if "critiques" not in payload:
        raise ValueError("missing critiques key")
    return ContinuityCritiqueBatch.model_validate(payload).critiques


def _parse_single_proposal(payload: dict) -> SkillProposal:
    return SkillProposal.model_validate(payload["proposal"])


def _build_proposal_messages(material: str, condition: str) -> list[dict]:
    content = SKILL_PROPOSAL_PROMPT.format(material=material, condition=condition)
    return [{"role": "user", "content": content}]


def _build_critique_messages(proposals: list[SkillProposal]) -> list[dict]:
    dump = json.dumps([p.model_dump(mode="json") for p in proposals], indent=2, ensure_ascii=False)
    content = STEP_CONTINUITY_CRITIQUE_PROMPT + "\n\nProposal:\n" + dump
    return [{"role": "user", "content": content}]


def _build_repair_messages(proposal: SkillProposal, critique: ContinuityCritique) -> list[dict]:
    gaps = json.dumps(critique.model_dump(mode="json"), indent=2, ensure_ascii=False)
    content = STEP_REPAIR_PROMPT.format(draft_json=proposal.model_dump_json(indent=2), gaps=gaps)
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
    proposals = await _call_until_success(
        messages, lambda p: _parse_proposals(p, material), client_factory
    )
    if not proposals:
        return proposals

    # Fase kritik kontinuitas: LLM memeriksa prasyarat setiap step terhadap step
    # sebelumnya. Gagal kritik -> kembalikan proposal apa adanya (tidak menghambat).
    try:
        critiques = await _call_until_success(
            _build_critique_messages(proposals), _parse_critiques, client_factory
        )
    except SkillGenUnavailable:
        return proposals

    # Fase auto-repair: proposal yang di-flag "perbaiki" di-regenerate dengan
    # umpan balik kritik. Gagal repair -> pertahankan proposal asli.
    repaired: list[SkillProposal] = []
    by_index = {c.index: c for c in critiques}
    for i, proposal in enumerate(proposals):
        critique = by_index.get(i)
        if critique is not None and critique.verdict == "perbaiki":
            try:
                fixed = await _call_until_success(
                    _build_repair_messages(proposal, critique),
                    _parse_single_proposal,
                    client_factory,
                )
                repaired.append(fixed)
                continue
            except SkillGenUnavailable:
                pass
        repaired.append(proposal)
    return repaired


async def verify_draft(
    draft: SkillProposal,
    chat_history: list[dict],
    client_factory=httpx.AsyncClient,
) -> SkillVerifyResponse:
    messages = _build_verify_messages(draft, chat_history)
    return await _call_until_success(messages, _parse_verdict, client_factory)
