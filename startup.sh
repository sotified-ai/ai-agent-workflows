#!/bin/bash
# ── QA Agent Factory — Linux/macOS Startup Script ─────────────────────────
set -e

echo "======================================================"
echo "  QA Agent Factory v2.0 — Startup"
echo "======================================================"

# Install dependencies if needed
if ! python3 -c "import fastapi" &>/dev/null; then
  echo "Installing dependencies..."
  pip3 install -r requirements.txt
fi

# Detect LLM backend
if [ -n "$OPENAI_API_KEY" ]; then
  echo "LLM backend: OpenAI (${OPENAI_MODEL:-gpt-4o-mini})"
else
  echo "LLM backend: Ollama — make sure 'ollama serve' is running"
  echo "             and the model is pulled: ollama pull ${OLLAMA_MODEL:-qwen2.5-coder:7b}"
fi

echo ""
echo "Starting server on http://localhost:${PORT:-8000}"
echo "======================================================"
python3 run.py
