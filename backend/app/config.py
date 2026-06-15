"""Application configuration loaded from environment variables."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Core infra
    database_url: str = "postgresql+psycopg://webbrief:webbrief@localhost:5432/webbrief"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_collection: str = "webbrief_chunks"

    # AI providers
    llm_api_key: str | None = None
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    embedding_api_key: str | None = None
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536

    # App URLs
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    # Crawler guardrails
    crawl_timeout_seconds: int = 15
    crawl_max_pages_cap: int = 25
    chunk_size_tokens: int = 500
    chunk_overlap_tokens: int = 60
    retrieval_top_k: int = 6


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
