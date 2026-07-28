from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openrouter_api_key: str
    deepinfra_api_key: str
    supabase_url: str
    supabase_service_key: str
    database_url: str = ""

    chat_model: str = "deepseek/deepseek-chat"
    vision_model: str = "openai/gpt-4o"
    vision_fallback_model: str = "google/gemini-2.5-flash"
    embedding_model: str = "BAAI/bge-m3"
    rerank_model: str = "BAAI/bge-reranker-v2-m3"

    vision_confidence_threshold: float = 0.70
    rerank_score_threshold: float = 0.40
    retrieval_top_k: int = 20
    rerank_top_k: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()
