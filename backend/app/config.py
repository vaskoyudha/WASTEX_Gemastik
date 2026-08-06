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

    # TEMPORARY: chat switched to qd/qmodel_38max; vision kept on mimo (qmodel_38max has
    # no working vision support). Originals: chat_model=oc/deepseek-v4-flash-free,
    # chat_fallback_model=oc/mimo-v2.5-free
    chat_model: str = "qd/qmodel_38max"
    chat_fallback_model: str = "qd/qmodel_38max"
    vision_model: str = "oc/mimo-v2.5-free"
    vision_fallback_model: str = "oc/mimo-v2.5-free"
    image_model: str = "google/gemini-2.5-flash-image-preview"
    embedding_model: str = "BAAI/bge-m3"
    rerank_model: str = "Qwen/Qwen3-Reranker-4B"

    vision_confidence_threshold: float = 0.70
    rerank_score_threshold: float = 0.40
    retrieval_top_k: int = 20
    rerank_top_k: int = 5

    cors_origins: list[str] = [
        "http://localhost:8080",  # Expo web (SDK 57 default)
        "http://localhost:8081",  # Expo dev server
        "http://localhost:8082",  # Expo web (second instance)
        "http://localhost:19006",  # Expo web (legacy)
        "exp://localhost:19000",  # Expo Go
    ]

    supabase_jwt_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
