"""
LLM Adapter
───────────
Provides a unified interface for calling local (Ollama) or cloud (OpenAI) LLMs.
Detection order:
  1. If OPENAI_API_KEY env var is set → use OpenAI (gpt-4o-mini)
  2. If Ollama is reachable at OLLAMA_HOST → use Ollama
  3. Raise RuntimeError with clear instructions

Set environment variables:
  OPENAI_API_KEY     → use OpenAI backend
  OLLAMA_HOST        → Ollama base URL (default: http://localhost:11434)
  OLLAMA_MODEL       → model name (default: qwen2.5-coder:7b)
  OPENAI_MODEL       → model name (default: gpt-4o-mini)
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
LLM_TIMEOUT: int = int(os.getenv("LLM_TIMEOUT", "600"))


def _detect_backend() -> str:
    """Detect which LLM backend is available. Returns 'openai' or 'ollama'."""
    if OPENAI_API_KEY:
        logger.info("LLM backend: OpenAI (%s)", OPENAI_MODEL)
        return "openai"
    # Probe Ollama
    try:
        r = httpx.get(f"{OLLAMA_HOST}/api/tags", timeout=3)
        if r.status_code == 200:
            data = r.json()
            available_models = [m["name"] for m in data.get("models", [])]

            # Check if our configured model is pulled
            global OLLAMA_MODEL
            configured = OLLAMA_MODEL
            model_found = any(
                configured == m or configured == m.split(":")[0]
                for m in available_models
            )

            if not model_found and available_models:
                # Auto-select the first available model
                OLLAMA_MODEL = available_models[0]
                logger.warning(
                    "Model '%s' not found in Ollama. Auto-selected '%s'. "
                    "Available: %s",
                    configured, OLLAMA_MODEL, available_models,
                )
            elif not model_found and not available_models:
                raise RuntimeError(
                    f"Ollama is running but no models are installed.\n"
                    f"  Run: ollama pull {configured}\n"
                    f"  Then restart the app."
                )

            logger.info("LLM backend: Ollama (%s @ %s)", OLLAMA_MODEL, OLLAMA_HOST)
            return "ollama"
    except RuntimeError:
        raise
    except Exception:
        pass
    raise RuntimeError(
        "No LLM backend detected.\n"
        "  Option A - Local (Ollama): Install Ollama, run `ollama pull llama3.2:3b`, then `ollama serve`.\n"
        "  Option B - Cloud (OpenAI): Set the OPENAI_API_KEY environment variable.\n"
        "  See README.md for full setup instructions."
    )


_BACKEND: Optional[str] = None


def _get_backend() -> str:
    global _BACKEND
    if _BACKEND is None:
        _BACKEND = _detect_backend()
    return _BACKEND


def call_llm(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    expect_json: bool = True,
) -> str:
    """
    Send a prompt to the configured LLM and return the response text.

    Args:
        system_prompt: The system/role instruction.
        user_prompt:   The task or question for the model.
        temperature:   Sampling temperature (lower = more deterministic).
        expect_json:   If True, hint to model to respond with valid JSON only.

    Returns:
        Raw string response from the LLM.

    Raises:
        RuntimeError: If no LLM backend is available or the call fails.
    """
    backend = _get_backend()
    if expect_json:
        system_prompt = (
            system_prompt
            + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, no code blocks."
        )

    if backend == "openai":
        return _call_openai(system_prompt, user_prompt, temperature)
    else:
        return _call_ollama(system_prompt, user_prompt, temperature)


def _call_openai(system_prompt: str, user_prompt: str, temperature: float) -> str:
    payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    resp = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        json=payload,
        headers=headers,
        timeout=LLM_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _call_ollama(system_prompt: str, user_prompt: str, temperature: float) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"[SYSTEM]\n{system_prompt}\n\n[USER]\n{user_prompt}",
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_ctx": 8192,
        },
    }
    resp = httpx.post(
        f"{OLLAMA_HOST}/api/generate",
        json=payload,
        timeout=LLM_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json().get("response", "")


def parse_json_response(raw: str) -> Dict[str, Any]:
    """
    Robustly parse JSON from an LLM response.
    Handles code fences, leading/trailing text, and partial wrapping.
    """
    text = raw.strip()

    # Strip markdown code blocks
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```\s*$", "", text)
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find first { ... } or [ ... ] block
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = text.find(start_char)
        end = text.rfind(end_char)
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                continue

    raise ValueError(f"Could not parse JSON from LLM response:\n{raw[:500]}")
