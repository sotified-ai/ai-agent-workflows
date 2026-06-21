# QA Agent Factory v2.0

An enterprise-grade, privacy-safe, local-first AI test case generation platform.
Upload your requirements, API specs, or existing test cases — the system automatically ingests them, retrieves the right context, generates test scenarios, writes executable test cases, runs a QA audit, computes traceability, and delivers a formatted Excel workbook.

**All of this happens behind a single "Generate" button.**

---

## ✨ User Workflow

```
Create Project → Upload Files → Generate Test Cases → Download Output
```

1. **Create Project** — Name your project. Every project is fully isolated.
2. **Upload Files** — Drop in `.md`, `.txt`, `.yaml`, `.yml`, or `.json` files.  
   Files are auto-detected (User Stories / API Specs / Test Cases) and instantly indexed.
3. **Generate Test Cases** — Describe the feature or user story. Click Generate.  
   The pipeline runs automatically: context retrieval → scenarios → test cases → QA review → traceability.
4. **Download** — Get a formatted multi-sheet `.xlsx` workbook or raw `.json`.

No manual ingestion. No CLI commands. No API calls.

---

## 🚀 Running the Application

### Option A: Python (Recommended for local use)

**Prerequisites:**
- Python 3.10+
- [Ollama](https://ollama.com/) (free, local LLM) **OR** an OpenAI API key

**1. Install dependencies:**
```bash
pip install -r requirements.txt
```

**2. Configure an LLM backend (choose one):**

*Option A1 — Ollama (local, no cost, no cloud)*
```bash
# Install Ollama: https://ollama.com
ollama pull qwen2.5-coder:7b
ollama serve
```

*Option A2 — OpenAI*
```bash
# Windows
set OPENAI_API_KEY=sk-...
# macOS/Linux
export OPENAI_API_KEY=sk-...
```

**3. Start the application:**
```bash
python run.py
```
Open **http://localhost:8000** in your browser.

---

### Option B: Windows Batch Script
```bat
start.bat
```

### Option C: Linux / macOS Shell Script
```bash
chmod +x startup.sh && ./startup.sh
```

---

### Option D: Docker (Zero-configuration deployment)

**Requirements:** Docker Desktop or Docker Engine + Docker Compose

```bash
docker compose up --build
```

This starts:
- **QA Agent Factory** on `http://localhost:8000`
- **Ollama** LLM server on `http://localhost:11434` (auto-downloads on first use)

**To pull the LLM model after startup:**
```bash
docker exec qa-ollama ollama pull qwen2.5-coder:7b
```

**To use OpenAI instead of Ollama:**
```bash
OPENAI_API_KEY=sk-... docker compose up --build
```

---

## 📂 Project Structure

```
ai_agent_code/
├── app.py                    ← FastAPI application (API + static serving)
├── run.py                    ← Single entry point: python run.py
├── Dockerfile
├── docker-compose.yml
├── startup.sh                ← Linux/macOS launcher
├── start.bat                 ← Windows launcher
├── requirements.txt
├── static/                   ← Frontend (served by FastAPI)
│   ├── index.html            ← 4-step wizard UI
│   ├── app.js                ← Frontend logic
│   └── styles.css            ← Premium dark theme
├── projects/                 ← Per-project isolated storage (auto-created)
│   └── {project_id}/
│       ├── project.json      ← Project metadata
│       ├── sources/          ← Uploaded files (by source type)
│       ├── store/            ← Local vector index
│       └── results/          ← latest.xlsx + latest.json
└── src/                      ← Python backend modules
    ├── llm.py                ← LLM adapter (Ollama / OpenAI)
    ├── pipeline.py           ← Full QA pipeline (no mocks)
    ├── compliance.py         ← PII masking (ComplianceGuard)
    ├── traceability.py       ← Bi-directional coverage matrix
    ├── exporter.py           ← XLSX exporter (openpyxl)
    └── knowledge_base/       ← KB ingestion & retrieval engine
        ├── models.py
        ├── project_loader.py
        ├── chunker.py
        ├── embeddings.py
        ├── vector_store.py
        ├── ingest.py
        └── retriever.py
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | _(unset)_ | Set to use OpenAI backend. If set, Ollama is ignored. |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model name |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen2.5-coder:7b` | Ollama model name |
| `PORT` | `8000` | HTTP port to bind |
| `HOST` | `0.0.0.0` | Bind address |
| `LLM_TIMEOUT` | `120` | LLM request timeout in seconds |

---

## 🔌 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check + LLM backend status |
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/{id}` | Get project metadata |
| POST | `/api/projects/{id}/upload` | Upload file (auto-ingests) |
| GET | `/api/projects/{id}/files` | List uploaded files |
| POST | `/api/projects/{id}/generate` | Run full QA pipeline |
| GET | `/api/projects/{id}/results` | Get last pipeline results |
| GET | `/api/projects/{id}/download/xlsx` | Download Excel workbook |
| GET | `/api/projects/{id}/download/json` | Download JSON results |

---

## 🔒 Privacy & Compliance

- **Local-first by default.** With Ollama, no data ever leaves your machine.
- **In-flight PII masking.** The `ComplianceGuard` scrubs emails, IPs, passwords, and API keys from prompts before sending to any LLM backend. Original values are restored locally after the response.
- **Air-gap compatible.** Works fully offline with Ollama.
- **Project isolation.** Every project's data, files, and vector index are stored in a separate directory.

---

## 📋 Supported File Types

| File | Auto-detected as |
|---|---|
| `.md`, `.txt` with "As a user", "Given/When/Then" | User Stories |
| `.yaml`, `.yml`, `.json` with "openapi:", "paths:" | API Specifications |
| `.md`, `.txt` with "TC-", "Test Case", "Precondition" | Existing Test Cases & Defects |
| Other `.md`, `.txt` | User Stories (default) |
| Other `.yaml`, `.yml` | API Specifications (default) |
