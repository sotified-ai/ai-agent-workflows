"""
Knowledge Base HTTP API Server
───────────────────────────────
Lightweight local HTTP server (stdlib only) that exposes the ingestion
and retrieval pipeline to the frontend dashboard via JSON endpoints.

Endpoints:
  GET  /api/projects                    → list all projects
  GET  /api/projects/<id>/config        → project config
  GET  /api/projects/<id>/stats         → KB statistics
  GET  /api/source-types                → all source types with status
  POST /api/projects/<id>/ingest        → ingest a source type
  POST /api/projects/<id>/search        → semantic search
  POST /api/projects/<id>/context       → build context for a story
  POST /api/projects/scaffold           → scaffold a new project

Run: python kb_server.py
"""

from __future__ import annotations

import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Any, Dict
from urllib.parse import urlparse, parse_qs

# Ensure src is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.knowledge_base.models import SourceType
from src.knowledge_base.project_loader import ProjectLoader
from src.knowledge_base.ingest import IngestionPipeline
from src.knowledge_base.retriever import KnowledgeRetriever
from src.knowledge_base.embeddings import EmbeddingEngine

HOST = "127.0.0.1"
PORT = 8099

# Shared embedding engine (loaded once)
_embedding_engine = EmbeddingEngine()
_loader = ProjectLoader()


class KBRequestHandler(BaseHTTPRequestHandler):
    """Handles all Knowledge Base API requests."""

    def _send_json(self, data: Any, status: int = 200) -> None:
        body = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/projects":
            ids = _loader.list_projects()
            projects = []
            for pid in ids:
                try:
                    cfg = _loader.load_project(pid)
                    projects.append({
                        "project_id": cfg.project_id,
                        "project_name": cfg.project_name,
                        "description": cfg.description,
                        "enabled_sources": [s.value for s in cfg.enabled_sources],
                    })
                except Exception:
                    pass
            self._send_json({"projects": projects})
            return

        if path == "/api/source-types":
            types = []
            for st in SourceType:
                types.append({
                    "value": st.value,
                    "display_name": st.display_name,
                    "implemented": st.is_implemented,
                })
            self._send_json({"source_types": types})
            return

        # /api/projects/<id>/config
        parts = path.split("/")
        if len(parts) == 5 and parts[1] == "api" and parts[2] == "projects" and parts[4] == "config":
            pid = parts[3]
            try:
                cfg = _loader.load_project(pid)
                self._send_json(cfg.to_dict())
            except FileNotFoundError:
                self._send_json({"error": f"Project '{pid}' not found."}, 404)
            return

        # /api/projects/<id>/stats
        if len(parts) == 5 and parts[1] == "api" and parts[2] == "projects" and parts[4] == "stats":
            pid = parts[3]
            try:
                cfg = _loader.load_project(pid)
                retriever = KnowledgeRetriever(cfg, _embedding_engine)
                self._send_json(retriever.stats())
            except FileNotFoundError:
                self._send_json({"error": f"Project '{pid}' not found."}, 404)
            return

        self._send_json({"error": "Not found"}, 404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        parts = path.split("/")

        # POST /api/projects/scaffold
        if path == "/api/projects/scaffold":
            body = self._read_body()
            pid = body.get("project_id", "")
            pname = body.get("project_name", pid)
            if not pid:
                self._send_json({"error": "project_id is required."}, 400)
                return
            _loader.scaffold_project(pid, pname)
            self._send_json({"status": "created", "project_id": pid})
            return

        # POST /api/projects/<id>/ingest
        if len(parts) == 5 and parts[4] == "ingest":
            pid = parts[3]
            body = self._read_body()
            source_type_str = body.get("source_type", "")
            document_name = body.get("document_name")

            try:
                st = SourceType(source_type_str)
            except ValueError:
                self._send_json({"error": f"Unknown source type: '{source_type_str}'"}, 400)
                return

            try:
                cfg = _loader.load_project(pid)
            except FileNotFoundError:
                self._send_json({"error": f"Project '{pid}' not found."}, 404)
                return

            pipeline = IngestionPipeline(cfg, _embedding_engine)
            reports = pipeline.ingest_source(st, document_name)
            self._send_json({
                "project_id": pid,
                "reports": [r.to_dict() for r in reports],
            })
            return

        # POST /api/projects/<id>/search
        if len(parts) == 5 and parts[4] == "search":
            pid = parts[3]
            body = self._read_body()
            query = body.get("query", "")
            top_k = int(body.get("top_k", 10))
            st_filter = body.get("source_type_filter")
            min_conf = float(body.get("min_confidence", 0.0))

            source_filter = None
            if st_filter:
                try:
                    source_filter = SourceType(st_filter)
                except ValueError:
                    pass

            try:
                cfg = _loader.load_project(pid)
            except FileNotFoundError:
                self._send_json({"error": f"Project '{pid}' not found."}, 404)
                return

            retriever = KnowledgeRetriever(cfg, _embedding_engine)
            result = retriever.search_json(
                query, top_k=top_k,
                source_type_filter=source_filter,
                min_confidence=min_conf,
            )
            self._send_json(result)
            return

        # POST /api/projects/<id>/context
        if len(parts) == 5 and parts[4] == "context":
            pid = parts[3]
            body = self._read_body()
            story = body.get("story", {})

            try:
                cfg = _loader.load_project(pid)
            except FileNotFoundError:
                self._send_json({"error": f"Project '{pid}' not found."}, 404)
                return

            retriever = KnowledgeRetriever(cfg, _embedding_engine)
            ctx = retriever.get_context_for_story(story)
            self._send_json(ctx)
            return

        self._send_json({"error": "Not found"}, 404)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[KB-API] {args[0]} {args[1]} {args[2]}")


def main() -> None:
    server = HTTPServer((HOST, PORT), KBRequestHandler)
    print(f"Knowledge Base API running at http://{HOST}:{PORT}")
    print(f"Embedding backend: {_embedding_engine.backend}")
    print(f"Projects dir: {_loader.projects_dir}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down KB API server.")
        server.server_close()


if __name__ == "__main__":
    main()
