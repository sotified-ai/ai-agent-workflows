@echo off
REM ── QA Agent Factory — Windows Startup Script ─────────────────────────────
echo ======================================================
echo   QA Agent Factory v2.0 — Startup
echo ======================================================

REM Install dependencies if requirements.txt exists
pip install -r requirements.txt --quiet

REM Print LLM guidance
if defined OPENAI_API_KEY (
    echo LLM backend: OpenAI
) else (
    echo LLM backend: Ollama
    echo Make sure Ollama is running: ollama serve
    echo Model should be pulled:      ollama pull qwen2.5-coder:7b
)

echo.
echo Starting server on http://localhost:8000
echo ======================================================
python run.py
