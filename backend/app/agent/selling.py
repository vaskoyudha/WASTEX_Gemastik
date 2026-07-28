from functools import lru_cache

from pydantic_ai import Agent

from app.agent.orchestrator import _openrouter_model
from app.config import get_settings
from app.schemas import SellingKit

SELLING_PROMPT = """Kamu adalah AI Selling Assistant WASTEX untuk pengrajin pemula di Indonesia.
WASTEX BUKAN marketplace - kamu hanya membuat materi pemasaran, bukan transaksi.
Dari data produk upcycling yang diberikan, buat dalam Bahasa Indonesia:
1. product_name: nama produk yang menarik dan mudah dicari (maks 5 kata).
2. description: deskripsi produk 2-3 kalimat yang menonjolkan nilai ramah lingkungan
   dan kisah "dari limbah jadi berharga". Jujur, tanpa klaim berlebihan.
3. captions: 3 caption media sosial (Instagram/TikTok) dengan gaya santai, ajakan
   bertindak, dan emoji secukupnya.
4. photo_tips: 3 saran foto produk praktis dengan HP (pencahayaan, latar, sudut).
5. packaging_ideas: 2-3 ide kemasan murah dan ramah lingkungan dari bahan bekas.
6. hashtags: 5-8 hashtag relevan (campuran Indonesia dan Inggris, tanpa spasi).
Sesuaikan nada dengan tingkat kesulitan dan material produk. Jangan mengarang harga."""


@lru_cache
def selling_agent() -> Agent:
    return Agent(
        _openrouter_model(get_settings().chat_model),
        output_type=SellingKit,
        system_prompt=SELLING_PROMPT,
        retries=1,
    )


async def generate_selling_kit(skill: dict) -> SellingKit:
    prompt = (
        f"Produk: {skill.get('title')}\n"
        f"Material: {skill.get('material')}\n"
        f"Tingkat kesulitan: {skill.get('difficulty')}\n"
        f"Perkiraan harga jual (IDR): {skill.get('est_price_idr') or 'tidak tersedia'}\n"
        f"Langkah pembuatan: {skill.get('steps') or []}"
    )
    result = await selling_agent().run(prompt)
    kit = result.output
    kit.skill_id = str(skill.get("id", ""))
    return kit
