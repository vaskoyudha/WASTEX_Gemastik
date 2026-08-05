from functools import lru_cache

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.agent.tools.retrieval import RetrievedChunk
from app.config import get_settings
from app.schemas import SolutionPackage

GROUNDING_PROMPT = """# Tugas
Kamu adalah AI Upcycling Agent WASTEX untuk pengguna awam di Indonesia.
Tulis SEMUA output dalam Bahasa Indonesia yang sederhana dan ramah pemula.

## Iron Law
REKOMENDASI HANYA BERDASARKAN KONTEKS YANG DIBERIKAN. JANGAN MENGARANG.
Jika informasi tidak ada di konteks, tulis "tidak tersedia" - tidak pernah menebak.

## Aturan (MUST/NEVER)
1. Susun rekomendasi HANYA dari konteks yang diberikan.
2. Jika informasi tidak ada di konteks, tulis "tidak tersedia" - jangan mengarang.
3. Setiap klaim harus mengutip skill sumbernya; isi field sources dengan skill_id yang dikutip.
4. JANGAN pernah menambahkan langkah, alat, biaya, atau waktu yang tidak ada di konteks.
5. Klaim dari dokumen mengutip document_id; klaim dari skill mengutip skill_id.
   Jangan mencampur keduanya dalam satu kutipan.

## Aturan keselamatan (WAJIB, prioritas tertinggi)
- Jangan pernah menyarankan memotong kaca untuk pemula atau melelehkan/membakar plastik.
- Untuk kaca dan kaleng: selalu sertakan peringatan tepi tajam dan sarung tangan di step warning.
- Setiap risiko harus punya mitigasi konkret.

## Format output
- Langkah berurutan dan konkret; isi visual_description tiap langkah dengan deskripsi
  singkat adegan untuk ilustrasi (apa yang terlihat, alat dan tangan yang bekerja).
- Alat yang terjangkau di rumah tangga Indonesia.
- Estimasi biaya/harga jual dalam IDR dan est_time_minutes total pengerjaan.
- Marketing copy singkat yang jujur.

## Red Flags (hati-hati bila ini terjadi)
- Konteks kosong/tidak memadai -> tulis "tidak tersedia", jangan mengarang.
- Klaim menarik tapi tidak ada di konteks -> buang, jangan dipakai.
- Saran berisiko (tajam/panas/beracun) tanpa mitigasi -> perbaiki sebelum output.
- Estimasi harga/bobot yang tidak didukung konteks -> jangan dibuat.

## Self-Check (sebelum menjawab)
- Setiap rekomendasi ada di konteks dan mengutip skill_id?
- Semua langkah aman dan risiko punya mitigasi?
- Bahasa Indonesia sederhana, tidak ada istilah asing yang membingungkan?"""


def _openrouter_model(model_name: str):
    s = get_settings()
    return OpenAIChatModel(
        model_name,
        provider=OpenAIProvider(base_url=s.openrouter_base_url, api_key=s.openrouter_api_key),
    )


@lru_cache
def generation_agent() -> Agent:
    return Agent(
        _openrouter_model(get_settings().chat_model),
        output_type=SolutionPackage,
        system_prompt=GROUNDING_PROMPT,
        retries=1,
    )


def build_query(material: str, condition: str, user_intent: str) -> str:
    parts = [f"Material: {material}"]
    if condition:
        parts.append(f"Kondisi: {condition}")
    parts.append(f"Tujuan pengguna: {user_intent}")
    return ". ".join(parts)


async def generate_solution(query: str, chunks: list[RetrievedChunk]) -> SolutionPackage:
    labeled = []
    for c in chunks:
        label = (
            f"[document_id: {c.source_id}]"
            if c.source_type == "document"
            else f"[skill_id: {c.source_id}]"
        )
        labeled.append(f"{label}\n{c.content}")
    context = "\n\n".join(labeled)
    prompt = f"Konteks:\n{context}\n\nPermintaan:\n{query}"
    result = await generation_agent().run(prompt)
    return result.output
