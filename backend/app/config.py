from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openrouter_api_key: str
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    deepinfra_api_key: str
    supabase_url: str
    supabase_service_key: str
    database_url: str = ""

    chat_model: str = "deepseek/deepseek-chat"
    vision_model: str = "oc/mimo-v2.5-free"
    vision_fallback_model: str = "oc/mimo-v2.5-free"
    chat_fallback_model: str = "google/gemini-2.5-flash"
    image_model: str = "google/gemini-2.5-flash-image-preview"
    embedding_model: str = "BAAI/bge-m3"
    rerank_model: str = "BAAI/bge-reranker-v2-m3"

    vision_confidence_threshold: float = 0.70
    rerank_score_threshold: float = 0.40
    retrieval_top_k: int = 20
    rerank_top_k: int = 5

    cors_origins: list[str] = [
        "http://localhost:8081",  # Expo dev server
        "http://localhost:19006",  # Expo web
        "exp://localhost:19000",  # Expo Go
    ]

    supabase_jwt_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
