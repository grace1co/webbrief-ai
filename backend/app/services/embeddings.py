"""Generate embeddings through an OpenAI-compatible endpoint."""
from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class EmbeddingError(RuntimeError):
    pass


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Return one embedding vector per input text."""
    if not texts:
        return []
    if not settings.embedding_api_key:
        raise EmbeddingError("EMBEDDING_API_KEY is not configured.")

    url = f"{settings.embedding_base_url.rstrip('/')}/embeddings"
    headers = {"Authorization": f"Bearer {settings.embedding_api_key}"}
    payload = {"model": settings.embedding_model, "input": texts}

    try:
        with httpx.Client(timeout=60) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise EmbeddingError(f"Embedding request failed: {exc}") from exc

    return [item["embedding"] for item in data["data"]]


def embed_query(text: str) -> list[float]:
    return embed_texts([text])[0]
