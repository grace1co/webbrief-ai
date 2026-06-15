"""Manage Qdrant collection setup, vector inserts, search, and cleanup."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import settings

logger = logging.getLogger(__name__)

# Reuse one Qdrant client instead of creating a new connection for every request.
_client: QdrantClient | None = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
    return _client


def ensure_collection() -> None:
    client = get_client()
    existing = {c.name for c in client.get_collections().collections}
    if settings.qdrant_collection not in existing:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=qmodels.VectorParams(
                size=settings.embedding_dim,
                distance=qmodels.Distance.COSINE,
            ),
        )
        # Index analysis_id because every search is filtered to one analysis.
        client.create_payload_index(
            collection_name=settings.qdrant_collection,
            field_name="analysis_id",
            field_schema=qmodels.PayloadSchemaType.KEYWORD,
        )
        logger.info("Created Qdrant collection %s", settings.qdrant_collection)


@dataclass
class UpsertPoint:
    chunk_id: str
    analysis_id: str
    page_id: str
    page_url: str
    page_title: str | None
    chunk_text: str
    chunk_index: int
    created_at: str
    vector: list[float]


def upsert_chunks(points: list[UpsertPoint]) -> list[str]:
    """Insert chunk vectors and return their Qdrant point IDs."""
    if not points:
        return []
    client = get_client()
    ids: list[str] = []
    q_points = []
    for p in points:
        pid = str(uuid.uuid4())
        ids.append(pid)
        q_points.append(
            qmodels.PointStruct(
                id=pid,
                vector=p.vector,
                payload={
                    "chunk_id": p.chunk_id,
                    "analysis_id": p.analysis_id,
                    "page_id": p.page_id,
                    "page_url": p.page_url,
                    "page_title": p.page_title,
                    "chunk_text": p.chunk_text,
                    "chunk_index": p.chunk_index,
                    "created_at": p.created_at,
                },
            )
        )
    client.upsert(collection_name=settings.qdrant_collection, points=q_points)
    return ids


@dataclass
class SearchHit:
    score: float
    page_title: str | None
    page_url: str
    chunk_text: str
    chunk_id: str


def search(analysis_id: str, query_vector: list[float], top_k: int) -> list[SearchHit]:
    """Vector search filtered to a single analysis_id."""
    client = get_client()
    flt = qmodels.Filter(
        must=[
            qmodels.FieldCondition(
                key="analysis_id",
                match=qmodels.MatchValue(value=analysis_id),
            )
        ]
    )
    results = client.search(
        collection_name=settings.qdrant_collection,
        query_vector=query_vector,
        query_filter=flt,
        limit=top_k,
        with_payload=True,
    )
    hits: list[SearchHit] = []
    for r in results:
        payload = r.payload or {}
        hits.append(
            SearchHit(
                score=r.score,
                page_title=payload.get("page_title"),
                page_url=payload.get("page_url", ""),
                chunk_text=payload.get("chunk_text", ""),
                chunk_id=payload.get("chunk_id", ""),
            )
        )
    return hits


def delete_analysis(analysis_id: str) -> None:
    """Delete all vector points for one analysis."""
    client = get_client()
    client.delete(
        collection_name=settings.qdrant_collection,
        points_selector=qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="analysis_id",
                        match=qmodels.MatchValue(value=analysis_id),
                    )
                ]
            )
        ),
    )
