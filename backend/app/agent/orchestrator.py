from functools import lru_cache

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.agent.tools.retrieval import RetrievedChunk
from app.config import get_settings
from app.schemas import SolutionPackage

GROUNDING_PROMPT = """Kamu adalah AI Upcycling Agent WASTEX.
Susun rekomendasi upcycling HANYA dari konteks yang diberikan.
Jika informasi tidak ada di konteks, tulis "tidak tersedia" - jangan mengarang.
Setiap klaim harus mengutip skill sumbernya; isi field sources dengan skill_id yang dikutip.
Sertakan langkah, alat, risiko beserta mitigasinya, estimasi biaya/harga jual (IDR), dan marketing copy singkat."""


def _openrouter_model(model_name: str):
    s = get_settings()
    return OpenAIChatModel(
        model_name,
        provider=OpenAIProvider(base_url="https://openrouter.ai/api/v1", api_key=s.openrouter_api_key),
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
    context = "\n\n".join(f"[skill_id: {c.skill_id}]\n{c.content}" for c in chunks)
    prompt = f"Konteks:\n{context}\n\nPermintaan:\n{query}"
    result = await generation_agent().run(prompt)
    return result.output
