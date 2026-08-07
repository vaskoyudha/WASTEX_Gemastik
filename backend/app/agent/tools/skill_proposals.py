import asyncio
import json
import re

import httpx

from app.agent.tools.vision import parse_proxy_json
from app.schemas import (
    AdditionalMaterial,
    ContinuityCritique,
    ContinuityCritiqueBatch,
    ContinuityStepIssue,
    SkillIdea,
    SkillProposal,
    SkillVerifyResponse,
    Step,
)

SKILL_IDEA_PROMPT = """# Tugas
Kamu adalah perajin ulung yang mengubah sampah anorganik menjadi produk kreatif
bernilai jual tinggi. Buat 3 ide skill ringkas yang bisa dibuat dari material ini:
{material}.

## Iron Law
HANYA GUNAKAN MATERIAL YANG DIBERIKAN SEBAGAI BAHAN UTAMA. DILARANG MENAMBAH BAHAN UTAMA DARI LUAR.
Jika material tidak cocok untuk ide apa pun, jawab dengan daftar ideas kosong.

## Aturan (MUST/NEVER)
- Buat PERSIS 3 ide yang BENAR-BENAR bisa dikerjakan di rumah.
- Setiap ide hanya berisi: title, description 1-2 kalimat, material, difficulty
  (pemula|menengah|mahir), perkiraan est_cost_idr dan est_price_idr.
- DILARANG menyertakan langkah pembuatan, tools, atau bahan tambahan di tahap ini.
- Ide yang mustahil dikerjakan di rumah (peralatan industri) -> buang.
- Kondisi bahan: {condition}. Sesuaikan ide dengan kondisi tersebut.

## Red Flags (hati-hati bila ini terjadi)
- Ide butuh bahan UTAMA di luar whitelist -> buang ide, ganti yang lain.
- Ide berisi langkah/tools/bahan tambahan -> jangan, hanya info ringkas.
- Ide mustahil dikerjakan di rumah -> buang.
- Ide lebih dari 3 -> jangan, maksimal 3.

## Self-Check (sebelum menjawab)
- Hanya memakai {material} sebagai bahan utama?
- PERSIS 3 ide, masing-masing ringkas dan tidak memuat langkah detail?
- JSON valid sesuai format?

Jawab HANYA dengan JSON valid berformat:
{{"ideas": [{{"title": "...", "description": "...", "material": "plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet",
  "difficulty": "pemula|menengah|mahir", "est_cost_idr": 5000, "est_price_idr": 25000}}]}}"""

SKILL_EXPAND_PROMPT = """# Tugas
Kamu adalah perajin ulung yang mengubah sampah anorganik menjadi produk kreatif
bernilai jual tinggi, sekaligus perancang kerajinan daur ulang (upcycling) yang teliti.
Buat DRAFT SKILL LENGKAP berdasarkan ide berikut yang dipilih user:
{idea_json}

## Iron Law
- HANYA GUNAKAN MATERIAL YANG DIBERIKAN SEBAGAI BAHAN UTAMA: {material}.
- Judul dan description WAJIB TETAP SAMA PERSIS dengan ide yang dipilih.
- Jika material tidak cocok dengan ide, jawab daftar proposals kosong.

## Aturan (MUST/NEVER)
- Bahan pelengkap (tali, cat, lem, tanah/tanaman, pengait, alat bantu kecil,
  dan sejenisnya) BOLEH dipakai, WAJIB dideklarasikan di additional_materials
  dengan name, category (tali|cat|lem|tanah_tanaman|pengait|alat|lainnya),
  est_cost_idr (perkiraan harga wajar dalam IDR), dan purpose (kegunaan, >= 3 kata).
- Setiap alat di tools WAJIB memiliki description yang menjelaskan kegunaannya
  dalam proyek ini (>= 3 kata), selain name dan optional.
- DILARANG menyebut bahan pelengkap di langkah (instruction/warning) yang TIDAK
  terdaftar di additional_materials.
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
- Wadah TERTUTUP (kaleng/botol/toples) yang akan diisi tanah/cairan WAJIB punya
  langkah membuka/memotong bagian atas wadah SEBELUM langkah mengisi.
- Tingkat kesulitan hanya salah satu dari: pemula, menengah, mahir.
- Kondisi bahan: {condition}. Sesuaikan draft dengan kondisi tersebut.

## Red Flags (hati-hati bila ini terjadi)
- Mengubah judul/description dari ide user -> jangan, WAJIB tetap.
- Langkah berisiko tanpa peringatan keamanan -> jangan diloloskan.
- Bahan pelengkap disebut di langkah tanpa terdaftar di additional_materials -> perbaiki.
- Ide mustahil dikerjakan di rumah (peralatan industri) -> buang.

## Self-Check (sebelum menjawab)
- Judul dan description sama persis dengan ide user?
- Hanya memakai {material} sebagai bahan utama?
- Semua alat punya description kegunaan minimal 3 kata?
- Semua bahan pelengkap di langkah terdaftar di additional_materials?
- Urutan langkah kontinu dengan SATU aksi utama per langkah?
- JSON valid sesuai format?

Jawab HANYA dengan JSON valid berformat:
{{"proposal": {{"title": "...", "description": "...",
  "material": "plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet",
  "difficulty": "pemula|menengah|mahir",
  "steps": [{{"order": 1, "instruction": "...", "warning": "...", "visual_description": "..."}}],
  "tools": [{{"name": "...", "optional": false, "description": "..."}}],
  "additional_materials": [{{"name": "...", "category": "tali|cat|lem|tanah_tanaman|pengait|alat|lainnya", "est_cost_idr": 2000, "purpose": "..."}}],
  "est_cost_idr": 5000, "est_price_idr": 25000}}}}"""

STEP_CONTINUITY_CRITIQUE_PROMPT = """# Tugas
Kamu adalah validator kritis kontinuitas langkah kerajinan daur ulang. Periksa daftar proposal skill di bawah.

## Cara menalar (per step, per proposal)
Untuk SETIAP langkah N pada setiap proposal:
1. Sebutkan prasyarat fisik/waktu yang dibutuhkan agar aksi step N bisa dikerjakan
   (contoh: mengisi tanah butuh lubang drainase; mengecat butuh permukaan bersih dan
   kering; memasang tali butuh lubang; melipat butuh bahan sudah dipotong).
2. Periksa langkah 1..N-1: apakah prasyarat itu SUDAH disediakan oleh langkah sebelumnya?
3. Jika TIDAK -> catat di steps[] dengan order=N dan missing_prerequisite yang spesifik.
4. Bayangkan mengerjakan langkah demi langkah secara FISIK di rumah: adakah hambatan
   fisik antara langkah N-1 dan N (wadah tertutup yang belum dibuka, bahan belum
   dipotong, permukaan belum siap, bagian belum bisa dijangkau)?

## Iron Law
HANYA menilai kontinuitas prasyarat antar langkah; DILARANG menilai aspek lain.

## Aturan (MUST/NEVER)
- HANYA laporkan prasyarat yang benar-benar diperlukan secara fisik; jangan berlebihan.
- JANGAN menilai aspek lain (gaya, estetika, harga, keamanan) - hanya kontinuitas urutan.
- JANGAN melaporkan langkah pertama (N=1) karena tidak punya prasyarat dari step sebelumnya.
- Verdict "kontinu" HANYA jika tidak ada satu pun prasyarat yang terlewat.

## Red Flags (hati-hati bila ini terjadi)
- Step berisi tanah/tanaman tetapi tidak ada langkah drainase sebelumnya -> WAJIB "perbaiki".
- Wadah TERTUTUP (kaleng/botol/toples) yang diisi tanah/cairan/tanaman tanpa langkah
  membuka/memotong bagian atas -> WAJIB "perbaiki".
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
- Setiap alat di tools WAJIB memiliki description yang menjelaskan kegunaannya
  dalam proyek ini (>= 3 kata), selain name dan optional.
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
- Wadah TERTUTUP (kaleng/botol/toples) yang akan diisi tanah/cairan WAJIB punya
  langkah membuka/memotong bagian atas wadah SEBELUM langkah mengisi.
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
- Semua alat punya description kegunaan minimal 3 kata?
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
  "tools": [{{"name": "...", "optional": false, "description": "..."}}],
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
- tools.description kosong atau kurang dari 3 kata -> WAJIB "perbaiki".
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

SKILL_VERIFY_REPAIR_PROMPT = """# Tugas
Kamu adalah perajin ulung yang harus memperbaiki draft skill berdasarkan hasil verifier.

## Draft asli
{draft_json}

## Feedback verifier
{verdict_json}

## Iron Law
- Pertahankan ide, title, description, material, dan difficulty draft asli.
- Perbaiki SEMUA masalah yang disebutkan dalam feedback dan suggestions.
- Jangan menambah bahan utama selain material draft.

## Aturan
- Boleh mengubah, menambah, memecah, atau mengurutkan ulang steps.
- Boleh melengkapi tools dan additional_materials bila dibutuhkan oleh langkah.
- Setiap alat di tools wajib punya description yang menjelaskan kegunaannya
  dalam proyek ini (>= 3 kata).
- Semua bahan pelengkap yang disebut dalam langkah wajib terdaftar di
  additional_materials dengan category, est_cost_idr, dan purpose yang jelas.
- Setiap langkah berbahaya wajib memiliki warning yang spesifik.
- Setiap langkah wajib punya satu aksi utama dan visual_description 2-4 kalimat.
- Urutan langkah harus kontinu dari persiapan hingga produk selesai.

## Self-Check
- Semua feedback verifier sudah diperbaiki?
- Title, description, material, difficulty, dan ide tetap sama?
- Semua alat punya description kegunaan minimal 3 kata?
- JSON valid sesuai format?

Jawab HANYA dengan JSON valid berformat:
{{"proposal": {{"title": "...", "description": "...",
  "material": "plastik_pet|plastik_hdpe|kardus|kaleng|kaca|sachet",
  "difficulty": "pemula|menengah|mahir",
  "steps": [{{"order": 1, "instruction": "...", "warning": "...", "visual_description": "..."}}],
  "tools": [{{"name": "...", "optional": false, "description": "..."}}],
  "additional_materials": [{{"name": "...", "category": "tali|cat|lem|tanah_tanaman|pengait|alat|lainnya", "est_cost_idr": 2000, "purpose": "..."}}],
  "est_cost_idr": 5000, "est_price_idr": 25000}}}}"""


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


def _parse_ideas(payload: dict, expected_material: str) -> list[SkillIdea]:
    ideas = payload.get("ideas") or []
    result = []
    for item in ideas:
        try:
            idea = SkillIdea.model_validate(item)
        except Exception:  # noqa: S112
            continue
        if idea.material.value == expected_material:
            result.append(idea)
    return result


_CLOSED_CONTAINER_MATERIALS = ("kaleng", "kaca", "plastik_pet", "plastik_hdpe")

_PREREQ_RULES = [
    (
        re.compile(r"tanah|tanam|bibit|sukulen|kaktus"),
        re.compile(r"lubang|drainase"),
        "lubang drainase di bagian bawah wadah belum dibuat",
    ),
    (
        re.compile(r"tanah|tanam|bibit|sukulen|kaktus|\bisi\b|mengisi|tuang"),
        re.compile(r"buka|potong|sayat|iris|pembuka"),
        "bagian atas wadah tertutup belum dibuka/dipotong",
    ),
    (
        re.compile(r"tali|ikat|gantung|menggantung"),
        re.compile(r"lubang"),
        "lubang untuk tali/pengait belum dibuat",
    ),
    (
        re.compile(r"cat|lem|melapisi"),
        re.compile(r"kering|bersih|cuci|ampelas"),
        "permukaan belum kering/bersih sebelum dicat atau dilem",
    ),
]


def find_missing_prerequisites(proposal: SkillProposal) -> list[ContinuityStepIssue]:
    """Pemeriksaan deterministik prasyarat antar langkah (lapisan tambahan di
    luar kritik LLM). Satu isu per step, urut sesuai order."""
    issues: list[ContinuityStepIssue] = []
    steps = sorted(proposal.steps, key=lambda s: s.order)
    closed = proposal.material.value in _CLOSED_CONTAINER_MATERIALS
    for i, step in enumerate(steps):
        hay = (step.instruction or "").lower()
        prev = " ".join((s.instruction or "") for s in steps[:i]).lower()
        for pattern, required, missing in _PREREQ_RULES:
            if not pattern.search(hay):
                continue
            if not closed and "bagian atas" in missing:
                continue
            if not required.search(prev):
                issues.append(
                    ContinuityStepIssue(
                        order=step.order,
                        missing_prerequisite=missing,
                        note=f"step {step.order} membutuhkan prasyarat: {missing}",
                    )
                )
                break
    return issues


# Kata kunci bahan pelengkap yang umum disebut di langkah, dipetakan ke entri
# additional_materials kanonik (nama, kategori, estimasi biaya, tujuan).
_MATERIAL_KEYWORD_MAP: dict[str, tuple[str, str, int, str]] = {
    "alkohol": ("alkohol", "lainnya", 5000, "membersihkan dan mengeringkan permukaan"),
    "amplas": ("amplas", "alat", 3000, "menghaluskan tepi potongan yang tajam"),
    "ampelas": ("amplas", "alat", 3000, "menghaluskan tepi potongan yang tajam"),
    "kuas": ("kuas", "alat", 10000, "mengoleskan cat atau lem pada permukaan"),
    "cat": ("cat", "cat", 15000, "menghias permukaan produk jadi"),
    "akrilik": ("cat akrilik", "cat", 15000, "menghias permukaan produk jadi"),
    "primer": ("primer", "cat", 10000, "melapisi permukaan sebelum pengecatan"),
    "pernis": ("pernis", "cat", 12000, "melapisi permukaan agar mengilap"),
    "clear coat": ("clear coat", "cat", 12000, "melapisi permukaan agar tahan lama"),
    "lem": ("lem", "lem", 8000, "merekatkan bagian yang terpisah"),
    "perekat": ("perekat", "lem", 8000, "merekatkan bagian yang terpisah"),
    "tali": ("tali", "tali", 5000, "mengikat atau menggantung produk"),
    "rafia": ("rafia", "tali", 3000, "mengikat atau menggantung produk"),
    "benang": ("benang", "tali", 5000, "menjahit atau mengikat produk"),
    "tanah": ("tanah", "tanah_tanaman", 5000, "sebagai media tanam tanaman"),
    "bibit": ("bibit", "tanah_tanaman", 5000, "tanaman yang akan ditanam"),
    "pupuk": ("pupuk", "tanah_tanaman", 8000, "menyuburkan media tanam"),
    "pengait": ("pengait", "pengait", 3000, "menggantung produk pada dinding"),
    "kait": ("kait", "pengait", 3000, "menggantung produk pada dinding"),
}


def find_missing_materials(proposal: SkillProposal) -> list[AdditionalMaterial]:
    """Pemeriksaan deterministik: bahan pelengkap yang disebut di langkah
    (instruction atau warning) tapi belum terdaftar di additional_materials.
    Mengembalikan entri kanonik yang HARUS ditambahkan agar langkah konsisten
    dengan deklarasi bahan (aturan verifier). Alat (tools) tidak dihitung."""
    tool_names = {t.name.lower() for t in proposal.tools}
    declared = {m.name.lower() for m in proposal.additional_materials}
    hay = " ".join(f"{s.instruction} {s.warning or ''}".lower() for s in proposal.steps)
    missing: dict[str, AdditionalMaterial] = {}
    for keyword, (name, category, cost, purpose) in _MATERIAL_KEYWORD_MAP.items():
        if keyword not in hay:
            continue
        if name.lower() in declared or name.lower() in tool_names:
            continue
        missing.setdefault(
            name.lower(),
            AdditionalMaterial(
                name=name,
                category=category,  # type: ignore[arg-type]
                est_cost_idr=cost,
                purpose=purpose,
            ),
        )
    return list(missing.values())


def auto_add_missing_materials(proposal: SkillProposal) -> SkillProposal:
    """Tambahkan bahan pelengkap yang hilang secara deterministik (tanpa LLM)."""
    missing = find_missing_materials(proposal)
    if not missing:
        return proposal
    return proposal.model_copy(
        update={"additional_materials": proposal.additional_materials + missing}
    )


# ---------------------------------------------------------------------------
# Deterministic step auto-insertion: instead of asking the LLM to critique
# and repair missing prerequisite steps (2-4 extra round-trips), we insert
# pre-written template steps at the correct position.  The templates cover
# the same 4 prerequisite patterns checked by _PREREQ_RULES / the old LLM
# STEP_CONTINUITY_CRITIQUE_PROMPT.
# ---------------------------------------------------------------------------

_PREREQ_INSERTIONS: dict[str, Step] = {
    "lubang drainase di bagian bawah wadah belum dibuat": Step(
        order=0,
        instruction=(
            "Balik wadah dan lubangi bagian bawah menggunakan paku panas atau bor kecil. "
            "Buat 3-5 lubang kecil agar air dapat mengalir keluar sebagai drainase."
        ),
        warning="Hati-hati saat melubangi — gunakan alas keras, pegang wadah dengan stabil, dan jauhkan tangan dari titik tusuk.",
    ),
    "bagian atas wadah tertutup belum dibuka/dipotong": Step(
        order=0,
        instruction=(
            "Potong atau buka bagian atas wadah menggunakan gunting atau cutter. "
            "Pastikan bukaan cukup lebar untuk keperluan langkah selanjutnya."
        ),
        warning="Tepi potongan bisa sangat tajam. Gunakan sarung tangan dan haluskan tepi dengan amplas atau lakban.",
    ),
    "lubang untuk tali/pengait belum dibuat": Step(
        order=0,
        instruction=(
            "Tandai posisi lubang pada wadah, lalu lubangi menggunakan paku atau bor kecil. "
            "Pastikan lubang cukup besar untuk memasukkan tali atau pengait."
        ),
        warning="Lubangi dengan hati-hati agar wadah tidak retak. Gunakan alas keras di bawah wadah.",
    ),
    "permukaan belum kering/bersih sebelum dicat atau dilem": Step(
        order=0,
        instruction=(
            "Cuci seluruh permukaan wadah dengan sabun dan air bersih untuk menghilangkan "
            "kotoran dan minyak. Bilas, lalu keringkan sepenuhnya sebelum melanjutkan."
        ),
        warning=None,
    ),
}


def auto_insert_missing_steps(proposal: SkillProposal) -> SkillProposal:
    """Sisipkan langkah prasyarat yang hilang secara deterministik (tanpa LLM).

    Memanfaatkan find_missing_prerequisites() untuk mendeteksi celah
    kontinuitas, lalu menyisipkan template step dari _PREREQ_INSERTIONS
    di posisi yang tepat (tepat sebelum step yang membutuhkannya).
    Setelah penyisipan, seluruh step di-renumber ulang secara berurutan."""
    issues = find_missing_prerequisites(proposal)
    if not issues:
        return proposal

    steps = sorted(proposal.steps, key=lambda s: s.order)

    for issue in reversed(issues):
        template = _PREREQ_INSERTIONS.get(issue.missing_prerequisite)
        if template is None:
            continue
        insert_idx = next((i for i, s in enumerate(steps) if s.order >= issue.order), len(steps))
        new_step = template.model_copy(update={"order": 0})
        steps.insert(insert_idx, new_step)

    for i, step in enumerate(steps, start=1):
        step.order = i

    return proposal.model_copy(update={"steps": steps})


def _merge_deterministic(
    proposals: list[SkillProposal], critiques: list[ContinuityCritique]
) -> list[ContinuityCritique]:
    by_index = {c.index: c for c in critiques}
    merged: dict[int, ContinuityCritique] = {}
    for i, proposal in enumerate(proposals):
        issues = find_missing_prerequisites(proposal)
        crit = by_index.get(i)
        if issues:
            base = (
                crit.model_copy(deep=True)
                if crit is not None
                else ContinuityCritique(index=i, verdict="kontinu", steps=[], suggestions=[])
            )
            orders = {s.order for s in base.steps}
            new_issues = [iss for iss in issues if iss.order not in orders]
            merged[i] = base.model_copy(
                update={"verdict": "perbaiki", "steps": base.steps + new_issues}
            )
        elif crit is not None:
            merged[i] = crit
    return [merged[i] for i in sorted(merged)]


def _build_proposal_messages(material: str, condition: str) -> list[dict]:
    content = SKILL_PROPOSAL_PROMPT.format(material=material, condition=condition)
    return [{"role": "user", "content": content}]


def _build_idea_messages(material: str, condition: str) -> list[dict]:
    content = SKILL_IDEA_PROMPT.format(material=material, condition=condition)
    return [{"role": "user", "content": content}]


def _build_expand_messages(material: str, condition: str, idea: SkillIdea) -> list[dict]:
    content = SKILL_EXPAND_PROMPT.format(
        material=material, condition=condition, idea_json=idea.model_dump_json(indent=2)
    )
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


def _build_verify_repair_messages(draft: SkillProposal, verdict: SkillVerifyResponse) -> list[dict]:
    content = SKILL_VERIFY_REPAIR_PROMPT.format(
        draft_json=draft.model_dump_json(indent=2),
        verdict_json=verdict.model_dump_json(indent=2, exclude={"draft", "auto_repaired"}),
    )
    return [{"role": "user", "content": content}]


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


async def _repair_proposal(
    proposal: SkillProposal,
    critique: ContinuityCritique,
    client_factory,
) -> SkillProposal:
    return await _call_until_success(
        _build_repair_messages(proposal, critique),
        _parse_single_proposal,
        client_factory,
    )


async def generate_ideas(
    material: str, condition: str, client_factory=httpx.AsyncClient
) -> list[SkillIdea]:
    """Fase 1 (two-phase): 3 ide ringkas dalam SATU panggilan LLM, tanpa
    kritik/repair loop. Detail lengkap dihasilkan saat user memilih ide."""
    messages = _build_idea_messages(material, condition)
    return await _call_until_success(messages, lambda p: _parse_ideas(p, material), client_factory)


async def _continuity_repair_loop(
    current: list[SkillProposal], client_factory
) -> list[SkillProposal]:
    """Loop kritik -> auto-repair (maks 2 iterasi): kritik kontinuitas LLM digabung
    dengan pemeriksaan deterministik; proposal yang di-flag "perbaiki" di-repair
    dengan umpan balik, lalu dikritik ulang hingga kontinu atau iterasi habis.
    Repair antar proposal dijalankan PARALEL (asyncio.gather) karena independen."""
    for _ in range(2):
        try:
            critiques = await _call_until_success(
                _build_critique_messages(current), _parse_critiques, client_factory
            )
        except SkillGenUnavailable:
            critiques = []
        critiques = _merge_deterministic(current, critiques)
        flagged = [c for c in critiques if c.verdict == "perbaiki"]
        if not flagged:
            return current
        to_repair = [c for c in flagged if c.index < len(current)]
        if not to_repair:
            return current
        results = await asyncio.gather(
            *(_repair_proposal(current[c.index], c, client_factory) for c in to_repair),
            return_exceptions=True,
        )
        next_round = list(current)
        for critique, result in zip(to_repair, results):
            if isinstance(result, SkillProposal):
                next_round[critique.index] = result
        current = next_round
    return current


async def generate_proposals(
    material: str, condition: str, client_factory=httpx.AsyncClient
) -> list[SkillProposal]:
    messages = _build_proposal_messages(material, condition)
    proposals = await _call_until_success(
        messages, lambda p: _parse_proposals(p, material), client_factory
    )
    if not proposals:
        return proposals
    fixed = await _continuity_repair_loop(proposals, client_factory)
    return [auto_add_missing_materials(p) for p in fixed]


async def expand_proposal(
    material: str,
    condition: str,
    idea: SkillIdea,
    client_factory=httpx.AsyncClient,
) -> SkillProposal:
    """Fase 2 (two-phase): jadikan ide ringkas yang dipilih user menjadi
    draft skill LENGKAP (steps, tools, additional_materials).  Perbaikan
    kontinuitas langkah dilakukan secara DETERMINISTIK (tanpa LLM tambahan):
    find_missing_prerequisites mendeteksi celah, auto_insert_missing_steps
    menyisipkan template step, dan auto_add_missing_materials melengkapi
    bahan pelengkap yang terpakai di langkah tapi belum dideklarasikan."""
    messages = _build_expand_messages(material, condition, idea)
    draft = await _call_until_success(messages, _parse_single_proposal, client_factory)
    if draft.material.value != material:
        raise SkillGenUnavailable("expanded proposal material mismatch")
    draft = auto_insert_missing_steps(draft)
    return auto_add_missing_materials(draft)


async def verify_draft(
    draft: SkillProposal,
    chat_history: list[dict],
    client_factory=httpx.AsyncClient,
) -> SkillVerifyResponse:
    verdict = await _call_until_success(
        _build_verify_messages(draft, chat_history), _parse_verdict, client_factory
    )
    if verdict.verdict == "layak":
        return verdict.model_copy(update={"draft": draft})

    current = draft
    # A verifier can uncover a follow-up issue after the first repair. Keep the
    # draft inside the review/repair pipeline instead of exposing that feedback
    # as a user-facing result.
    for _ in range(3):
        repaired = await _call_until_success(
            _build_verify_repair_messages(current, verdict),
            _parse_single_proposal,
            client_factory,
        )
        if (
            repaired.title != draft.title
            or repaired.description != draft.description
            or repaired.material != draft.material
            or repaired.difficulty != draft.difficulty
        ):
            raise SkillGenUnavailable("repair changed the original skill identity")
        repaired = auto_insert_missing_steps(repaired)
        repaired = auto_add_missing_materials(repaired)
        verdict = await _call_until_success(
            _build_verify_messages(repaired, []), _parse_verdict, client_factory
        )
        if verdict.verdict == "layak":
            return verdict.model_copy(update={"draft": repaired, "auto_repaired": True})
        current = repaired

    raise SkillGenUnavailable("draft did not pass verification after automatic repairs")
