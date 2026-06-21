"""
run.py — Single entry point for the QA Agent Factory application.

Usage:
    python run.py

This starts the integrated FastAPI web server on http://localhost:8000.
Open that URL in any browser to access the application.

Environment variables (optional):
    PORT            - Server port (default: 8000)
    HOST            - Bind address (default: 0.0.0.0)
    OPENAI_API_KEY  - Use OpenAI as LLM backend instead of Ollama
    OLLAMA_HOST     - Ollama server URL (default: http://localhost:11434)
    OLLAMA_MODEL    - Ollama model name (default: qwen2.5-coder:7b)
    OPENAI_MODEL    - OpenAI model name (default: gpt-4o-mini)
"""

import os
import sys

import uvicorn

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
RELOAD = os.getenv("DEV_RELOAD", "false").lower() == "true"

if __name__ == "__main__":
    print("=" * 60)
    print("  QA Agent Factory v2.0")
    print(f"  Starting on http://{HOST if HOST != '0.0.0.0' else 'localhost'}:{PORT}")
    print("=" * 60)

    # Verify LLM is available before starting
    try:
        from src.llm import _detect_backend
        backend = _detect_backend()
        print(f"  [OK] LLM backend: {backend}")
    except RuntimeError as e:
        print(f"\n  [!] LLM backend not detected:\n  {e}\n")
        print("  The app will start but Generate will fail until an LLM is configured.")

    print()

    uvicorn.run(
        "app:app",
        host=HOST,
        port=PORT,
        reload=RELOAD,
        log_level="info",
    )
