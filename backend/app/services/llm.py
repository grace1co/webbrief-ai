"""Call an OpenAI-compatible chat API and parse JSON responses."""
from __future__ import annotations

import json
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    pass


def chat(
    system: str,
    user: str,
    *,
    temperature: float = 0.2,
    json_mode: bool = False,
) -> str:
    """Send a single-turn system+user prompt and return the text reply."""
    if not settings.llm_api_key:
        raise LLMError("LLM_API_KEY is not configured.")

    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    payload: dict = {
        "model": settings.llm_model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        with httpx.Client(timeout=120) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise LLMError(f"LLM request failed: {exc}") from exc

    return data["choices"][0]["message"]["content"]


def chat_stream(system: str, user: str, *, temperature: float = 0.2):
    """Yield text tokens from a streaming chat completion."""
    if not settings.llm_api_key:
        raise LLMError("LLM_API_KEY is not configured.")

    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    payload: dict = {
        "model": settings.llm_model,
        "temperature": temperature,
        "stream": True,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    try:
        with httpx.Client(timeout=120) as client:
            with client.stream("POST", url, headers=headers, json=payload) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    raw = line[6:]
                    if raw == "[DONE]":
                        return
                    try:
                        chunk = json.loads(raw)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except (json.JSONDecodeError, KeyError):
                        continue
    except httpx.HTTPError as exc:
        raise LLMError(f"LLM streaming failed: {exc}") from exc


def chat_json(system: str, user: str, *, temperature: float = 0.2) -> dict:
    """Call the LLM in JSON mode and handle fenced JSON output."""
    raw = chat(system, user, temperature=temperature, json_mode=True)
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM JSON: %s", raw[:500])
        raise LLMError("LLM returned malformed JSON.") from exc
