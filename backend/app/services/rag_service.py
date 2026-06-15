"""Retrieve website context and generate grounded answers."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Iterator

from app.config import settings
from app.services import qdrant_service
from app.services.embeddings import embed_query
from app.services.llm import chat, chat_stream
from app.services.prompts import CHAT_SYSTEM


@dataclass
class RagAnswer:
    answer: str
    citations: list[dict]


def _build_context(hits: list[qdrant_service.SearchHit]) -> str:
    """Format search hits as numbered source passages for the LLM."""
    blocks = []
    for i, h in enumerate(hits, start=1):
        title = h.page_title or h.page_url
        blocks.append(f"[{i}] Source: {title} ({h.page_url})\n{h.chunk_text}")
    return "\n\n".join(blocks)


def answer_question(analysis_id: str, question: str) -> RagAnswer:
    """Retrieve grounded context and produce a cited answer."""
    query_vector = embed_query(question)
    hits = qdrant_service.search(
        analysis_id=analysis_id,
        query_vector=query_vector,
        top_k=settings.retrieval_top_k,
    )

    if not hits:
        return RagAnswer(
            answer=(
                "I could not find that information in the crawled website content. "
                "The website may not provide enough detail about this topic."
            ),
            citations=[],
        )

    context = _build_context(hits)
    user_prompt = (
        f"Website context passages:\n\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer using only the passages above."
    )
    answer = chat(CHAT_SYSTEM, user_prompt)

    # Keep the first citation per page so source lists stay concise and ranked.
    seen: set[str] = set()
    citations: list[dict] = []
    for h in hits:
        if h.page_url in seen:
            continue
        seen.add(h.page_url)
        excerpt = h.chunk_text[:280] + ("…" if len(h.chunk_text) > 280 else "")
        citations.append(
            {"page_title": h.page_title, "page_url": h.page_url, "excerpt": excerpt}
        )

    return RagAnswer(answer=answer, citations=citations)


def answer_question_stream(analysis_id: str, question: str) -> Iterator[str]:
    """Stream citations first, then answer tokens as JSON events."""
    query_vector = embed_query(question)
    hits = qdrant_service.search(
        analysis_id=analysis_id,
        query_vector=query_vector,
        top_k=settings.retrieval_top_k,
    )

    if not hits:
        yield json.dumps({"event": "citations", "data": []})
        yield json.dumps({
            "event": "token",
            "data": (
                "I could not find that information in the crawled website content. "
                "The website may not provide enough detail about this topic."
            ),
        })
        yield json.dumps({"event": "done"})
        return

    # Keep the first citation per page so source lists stay concise and ranked.
    seen: set[str] = set()
    citations: list[dict] = []
    for h in hits:
        if h.page_url in seen:
            continue
        seen.add(h.page_url)
        excerpt = h.chunk_text[:280] + ("…" if len(h.chunk_text) > 280 else "")
        citations.append({"page_title": h.page_title, "page_url": h.page_url, "excerpt": excerpt})

    yield json.dumps({"event": "citations", "data": citations})

    context = _build_context(hits)
    user_prompt = (
        f"Website context passages:\n\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer using only the passages above."
    )
    for token in chat_stream(CHAT_SYSTEM, user_prompt):
        yield json.dumps({"event": "token", "data": token})

    yield json.dumps({"event": "done"})


def gather_context(analysis_id: str, seed_query: str, top_k: int = 12) -> str:
    """Retrieve a broad context block for report/score generation."""
    query_vector = embed_query(seed_query)
    hits = qdrant_service.search(analysis_id, query_vector, top_k=top_k)
    return _build_context(hits)
