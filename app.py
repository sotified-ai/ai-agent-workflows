"""
QA Agent Factory — FastAPI Application
───────────────────────────────────────
Single integrated web application.
Serves both the REST API and the static frontend.

Endpoints:
  GET  /                                    → frontend SPA
  POST /api/projects                        → create project
  GET  /api/projects                        → list projects
  GET  /api/projects/{id}                   → get project
  POST /api/projects/{id}/upload            → upload file (auto-ingests)
  GET  /api/projects/{id}/files             → list uploaded files
  POST /api/projects/{id}/generate          → run full pipeline
  GET  /api/projects/{id}/results           → get latest results
  GET  /api/projects/{id}/download/xlsx     → download Excel
  GET  /api/projects/{id}/download/json     → download JSON
  GET  /api/health                          → health check + LLM status
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("qa_factory")

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
PROJECTS_DIR = BASE_DIR / "projects"
STATIC_DIR = BASE_DIR / "static"
PROJECTS_DIR.mkdir(exist_ok=True)

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="QA Agent Factory",
    description="Enterprise-grade, privacy-safe local test automation platform.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Source Type Auto-Detection ────────────────────────────────────────────────

def detect_source_type(filename: str, content: str) -> str:
    """Heuristically determine the knowledge base source type from file content."""
    name_lower = filename.lower()
    content_lower = content.lower()

    # API spec signals
    api_signals = ["openapi:", "swagger:", '"openapi":', '"swagger":', "paths:", "/api/", "components:"]
    if any(s in content_lower for s in api_signals):
        return "api_specs"
    if name_lower.endswith((".yaml", ".yml")) and "openapi" in content_lower:
        return "api_specs"

    # Test case / defect signals
    test_signals = ["tc-", "test case", "test id", "precondition", "expected result", "defect", "bug-"]
    if any(s in content_lower for s in test_signals):
        return "existing_test_cases_defects"

    # User story signals
    story_signals = ["as a ", "as an ", "given ", "when ", "then ", "acceptance criteria", "user story"]
    if any(s in content_lower for s in story_signals):
        return "user_stories"

    # Default by extension
    if name_lower.endswith((".yaml", ".yml", ".json")):
        return "api_specs"
    return "user_stories"


# ── Project Helpers ───────────────────────────────────────────────────────────

def project_dir(project_id: str) -> Path:
    return PROJECTS_DIR / project_id


def load_project_meta(project_id: str) -> Dict[str, Any]:
    meta_path = project_dir(project_id) / "project.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found.")
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_project_meta(project_id: str, meta: Dict[str, Any]) -> None:
    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    with open(project_dir(project_id) / "project.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)


def scaffold_project_dirs(project_id: str) -> None:
    base = project_dir(project_id)
    for sub in [
        "sources/user_stories",
        "sources/api_specs",
        "sources/existing_test_cases_defects",
        "store",
        "results",
    ]:
        (base / sub).mkdir(parents=True, exist_ok=True)


# ── Pydantic Models ───────────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    name: str
    description: Optional[str] = ""


class GenerateRequest(BaseModel):
    story_title: str
    story_description: str
    compliance_targets: Optional[List[str]] = []


class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 10
    source_type_filter: Optional[str] = None
    min_confidence: Optional[float] = 0.0


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    """Check app health and LLM backend availability."""
    llm_status = "unknown"
    llm_backend = "none"
    llm_error = None

    try:
        from src.llm import _detect_backend
        llm_backend = _detect_backend()
        llm_status = "available"
    except RuntimeError as e:
        llm_status = "unavailable"
        llm_error = str(e)

    return {
        "status": "ok",
        "version": "2.0.0",
        "llm_backend": llm_backend,
        "llm_status": llm_status,
        "llm_error": llm_error,
    }


@app.post("/api/projects", status_code=201)
def create_project(req: CreateProjectRequest):
    """Create a new isolated project."""
    project_id = str(uuid.uuid4())[:8]
    scaffold_project_dirs(project_id)

    meta = {
        "project_id": project_id,
        "name": req.name,
        "description": req.description,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "file_count": 0,
        "has_results": False,
    }
    save_project_meta(project_id, meta)
    logger.info("Created project: %s (%s)", project_id, req.name)
    return meta


@app.get("/api/projects")
def list_projects():
    """List all projects."""
    projects = []
    for p in sorted(PROJECTS_DIR.iterdir()):
        meta_path = p / "project.json"
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                projects.append(json.load(f))
    return {"projects": projects}


@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    """Get a single project's metadata."""
    return load_project_meta(project_id)


@app.post("/api/projects/{project_id}/upload")
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
):
    """
    Upload a file to the project.
    Automatically:
      1. Saves the file to the correct source type directory.
      2. Runs ingestion (chunking + embedding + vector indexing).
    """
    meta = load_project_meta(project_id)
    content_bytes = await file.read()

    # Try to decode as text (support UTF-8 or Latin-1 for broad compatibility)
    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = content_bytes.decode("latin-1")

    # Detect source type
    source_type = detect_source_type(file.filename, content)
    dest_dir = project_dir(project_id) / "sources" / source_type
    dest_path = dest_dir / file.filename

    # Save file
    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(content)
    logger.info("Saved file: %s → %s/%s", file.filename, project_id, source_type)

    # Auto-ingest: rebuild the vector index for this project
    try:
        from src.knowledge_base.project_loader import ProjectLoader
        from src.knowledge_base.ingest import IngestionPipeline

        cfg = ProjectLoader(PROJECTS_DIR).load_or_scaffold(project_id, meta["name"])
        ingestor = IngestionPipeline(cfg)
        report = ingestor.ingest_all_sources()

        total_chunks = sum(r.chunks_created for r in report if hasattr(r, "chunks_created"))
        ingest_status = "completed"
        ingest_message = f"Ingested {total_chunks} chunks across {len(report)} source types."
    except Exception as exc:
        logger.warning("Ingestion error: %s", exc, exc_info=True)
        ingest_status = "warning"
        ingest_message = f"File saved but ingestion encountered an issue: {exc}"
        total_chunks = 0

    # Update metadata
    meta["file_count"] = meta.get("file_count", 0) + 1
    save_project_meta(project_id, meta)

    return {
        "filename": file.filename,
        "source_type": source_type,
        "ingest_status": ingest_status,
        "ingest_message": ingest_message,
        "total_chunks": total_chunks,
    }


@app.get("/api/projects/{project_id}/files")
def list_files(project_id: str):
    """List all uploaded files for a project, grouped by source type."""
    load_project_meta(project_id)  # validate exists
    sources_dir = project_dir(project_id) / "sources"
    result = {}
    for src_type_dir in sources_dir.iterdir():
        if src_type_dir.is_dir():
            files = [f.name for f in src_type_dir.iterdir() if f.is_file()]
            if files:
                result[src_type_dir.name] = files
    return {"files": result}


@app.post("/api/projects/{project_id}/generate")
def generate_test_cases(project_id: str, req: GenerateRequest):
    """
    Run the full QA pipeline for a project.
    Steps (all automatic, no user interaction):
      1. Retrieve knowledge context from vector DB
      2. Extract requirements (LLM)
      3. Generate scenarios (LLM)
      4. Generate test cases (LLM)
      5. QA review + self-correction loop (LLM)
      6. Traceability matrix computation
      7. Export XLSX + JSON to results/
    """
    meta = load_project_meta(project_id)

    # Build story dict
    story = {
        "title": req.story_title,
        "description": req.story_description,
        "compliance_targets": req.compliance_targets or [],
    }

    # ── Retrieve KB context ──────────────────────────────────────────────────
    knowledge_context = None
    try:
        from src.knowledge_base.project_loader import ProjectLoader
        from src.knowledge_base.retriever import KnowledgeRetriever

        cfg = ProjectLoader(PROJECTS_DIR).load_or_scaffold(project_id, meta["name"])
        retriever = KnowledgeRetriever(cfg)
        context_result = retriever.get_context_for_story(story)
        knowledge_context = context_result.get("project_context", "")
        logger.info("KB context retrieved: %d chars", len(knowledge_context))
    except Exception as exc:
        logger.warning("KB retrieval skipped: %s", exc)

    # ── Run Pipeline ─────────────────────────────────────────────────────────
    from src.pipeline import QAPipeline
    pipeline = QAPipeline()
    try:
        results = pipeline.run(story, knowledge_context=knowledge_context)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error("Pipeline error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {exc}")

    # ── Export Results ────────────────────────────────────────────────────────
    results_dir = project_dir(project_id) / "results"
    results_dir.mkdir(exist_ok=True)

    # Save JSON
    json_path = results_dir / "latest.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)

    # Export XLSX
    xlsx_path = results_dir / "latest.xlsx"
    try:
        from src.exporter import SpreadsheetExporter
        SpreadsheetExporter.export_to_excel(results, str(xlsx_path))
    except Exception as exc:
        logger.warning("XLSX export failed: %s", exc)

    # Update project metadata
    meta["has_results"] = True
    meta["last_generated_at"] = datetime.now(timezone.utc).isoformat()
    meta["story_title"] = req.story_title
    save_project_meta(project_id, meta)

    return {
        "status": "completed",
        "requirements_count": len(results.get("requirements", [])),
        "scenarios_count": len(results.get("scenarios", [])),
        "test_cases_count": len(results.get("test_cases", [])),
        "traceability_score": results.get("traceability", {}).get("traceability_score", 0),
        "review_status": results.get("review_report", {}).get("status", "N/A"),
        "logs": results.get("logs", []),
    }


@app.get("/api/projects/{project_id}/results")
def get_results(project_id: str):
    """Get the latest pipeline results for a project."""
    load_project_meta(project_id)
    json_path = project_dir(project_id) / "results" / "latest.json"
    if not json_path.exists():
        raise HTTPException(status_code=404, detail="No results yet. Run Generate first.")
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/projects/{project_id}/download/xlsx")
def download_xlsx(project_id: str):
    """Download the generated test suite as a formatted Excel workbook."""
    load_project_meta(project_id)
    xlsx_path = project_dir(project_id) / "results" / "latest.xlsx"
    if not xlsx_path.exists():
        raise HTTPException(status_code=404, detail="No XLSX generated yet. Run Generate first.")
    meta = load_project_meta(project_id)
    safe_name = re.sub(r"[^\w\-]", "_", meta.get("name", "project"))
    return FileResponse(
        path=str(xlsx_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"{safe_name}_TestSuite.xlsx",
    )


@app.get("/api/projects/{project_id}/download/json")
def download_json(project_id: str):
    """Download the generated test suite as JSON."""
    load_project_meta(project_id)
    json_path = project_dir(project_id) / "results" / "latest.json"
    if not json_path.exists():
        raise HTTPException(status_code=404, detail="No results yet. Run Generate first.")
    meta = load_project_meta(project_id)
    safe_name = re.sub(r"[^\w\-]", "_", meta.get("name", "project"))
    return FileResponse(
        path=str(json_path),
        media_type="application/json",
        filename=f"{safe_name}_TestSuite.json",
    )


@app.get("/api/projects/{project_id}/stats")
def get_kb_stats(project_id: str):
    """Get project Knowledge Base statistics."""
    load_project_meta(project_id)
    try:
        from src.knowledge_base.project_loader import ProjectLoader
        from src.knowledge_base.retriever import KnowledgeRetriever
        
        loader = ProjectLoader(PROJECTS_DIR)
        cfg = loader.load_or_scaffold(project_id, "")
        retriever = KnowledgeRetriever(cfg)
        return retriever.stats()
    except Exception as exc:
        logger.error("Failed to get KB stats: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/projects/{project_id}/search")
def search_kb(project_id: str, req: SearchRequest):
    """Perform a semantic search in the project's knowledge base."""
    load_project_meta(project_id)
    try:
        from src.knowledge_base.project_loader import ProjectLoader
        from src.knowledge_base.retriever import KnowledgeRetriever
        from src.knowledge_base.models import SourceType
        
        loader = ProjectLoader(PROJECTS_DIR)
        cfg = loader.load_or_scaffold(project_id, "")
        
        st_filter = None
        if req.source_type_filter:
            try:
                st_filter = SourceType(req.source_type_filter)
            except ValueError:
                pass
                
        retriever = KnowledgeRetriever(cfg)
        result = retriever.search_json(
            req.query,
            top_k=req.top_k,
            source_type_filter=st_filter,
            min_confidence=req.min_confidence or 0.0,
        )
        return result
    except Exception as exc:
        logger.error("Semantic search failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/projects/{project_id}/ingest")
def reingest_kb(project_id: str):
    """Rebuild the vector index for this project (re-ingests all sources)."""
    meta = load_project_meta(project_id)
    try:
        from src.knowledge_base.project_loader import ProjectLoader
        from src.knowledge_base.ingest import IngestionPipeline

        loader = ProjectLoader(PROJECTS_DIR)
        cfg = loader.load_or_scaffold(project_id, meta["name"])
        ingestor = IngestionPipeline(cfg)
        report = ingestor.ingest_all_sources()
        
        total_chunks = sum(r.chunks_created for r in report if hasattr(r, "chunks_created"))
        return {
            "status": "completed",
            "message": f"Successfully re-indexed {total_chunks} chunks across project sources.",
            "total_chunks": total_chunks
        }
    except Exception as exc:
        logger.error("Re-ingestion failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))



@app.get("/api/code/{filename}")
def get_code(filename: str):
    """Fetch file contents for the code browser."""
    allowed_files = {
        "compliance": BASE_DIR / "src" / "compliance.py",
        "factory": BASE_DIR / "src" / "factory.py",
        "orchestrator": BASE_DIR / "src" / "orchestrator.py",
        "traceability": BASE_DIR / "src" / "traceability.py",
        "exporter": BASE_DIR / "src" / "exporter.py",
        "demo": BASE_DIR / "demo.py",
        "blueprint": BASE_DIR / "ARCH_BLUEPRINT.md",
    }
    if filename not in allowed_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = allowed_files[filename]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    with open(file_path, "r", encoding="utf-8") as f:
        return {"filename": file_path.name, "content": f.read()}



# ── Static Files (Frontend) ───────────────────────────────────────────────────
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
