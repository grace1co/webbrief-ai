"""Split text into chunks with overlap.

Use tiktoken when it is available. If not, fall back to a word-based estimate.
"""
from __future__ import annotations

from dataclasses import dataclass
from pydoc import text

from app.config import settings

try:
    import tiktoken

    _ENC = tiktoken.get_encoding("cl100k_base")
except Exception:  # noqa: BLE001 - support environments without the optional tokenizer
    _ENC = None

_WORD_TO_TOKEN_RATIO = 1.3

@dataclass
class Chunk:
    index: int
    text: str
    token_count: int


def _encode(text: str) -> list[int]:
    if _ENC is not None:
        return _ENC.encode(text)
    # Fallback: return dummy IDs because only the estimated token count is used.
    estimated_tokens = int(len(text.split()) * _WORD_TO_TOKEN_RATIO)
    return list(range(estimated_tokens))


def count_tokens(text: str) -> int:
    return len(_encode(text))


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[Chunk]:
    """Split text into overlapping chunks for embedding."""
    chunk_size = chunk_size or settings.chunk_size_tokens
    overlap = overlap or settings.chunk_overlap_tokens
    if not text.strip():
        return []

    if _ENC is not None:
        tokens = _ENC.encode(text)
        chunks: list[Chunk] = []
        start = 0
        idx = 0
        step = max(chunk_size - overlap, 1)
        while start < len(tokens):
            window = tokens[start : start + chunk_size]
            chunk_str = _ENC.decode(window).strip()
            if chunk_str:
                chunks.append(Chunk(index=idx, text=chunk_str, token_count=len(window)))
                idx += 1
            start += step
        return chunks

    # Word windows keep chunking available without the optional tokenizer.
    words = text.split()
    words_per_chunk = int(chunk_size / _WORD_TO_TOKEN_RATIO)
    words_overlap = int(overlap / _WORD_TO_TOKEN_RATIO)
    step = max(words_per_chunk - words_overlap, 1)
    chunks = []
    idx = 0
    for start in range(0, len(words), step):
        window = words[start : start + words_per_chunk]
        if not window:
            continue
        chunk_str = " ".join(window)
        chunks.append(Chunk(index=idx, text=chunk_str, token_count=count_tokens(chunk_str)))
        idx += 1
        if start + words_per_chunk >= len(words):
            break
    return chunks
