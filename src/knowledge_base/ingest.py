"""
Ingestion Pipeline
──────────────────
Reads raw source documents, chunks, embeds, and stores them in the
project's local vector store.
Only the three active source types are wired into the pipeline.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from .chunker import Chunker
from .embeddings import EmbeddingEngine
from .models import (
    IngestionReport,
    IngestionStatus,
    KnowledgeChunk,
    SourceType,
)
from .project_loader import ProjectConfig
from .vector_store import VectorStore

_ALLOWED_EXTENSIONS = (".txt", ".md", ".yaml", ".yml", ".json", ".csv")


class IngestionPipeline:
    """Orchestrates: read files → chunk → embed → store → report."""

    def __init__(
        self,
        project_config: ProjectConfig,
        embedding_engine: Optional[EmbeddingEngine] = None,
    ) -> None:
        self.config = project_config
        self.chunker = Chunker(
            chunk_size=project_config.chunk_size,
            overlap=project_config.chunk_overlap,
        )
        self.embedding_engine = embedding_engine or EmbeddingEngine(
            model_name=project_config.embedding_model,
            dimension=project_config.embedding_dimension,
        )
        self.vector_store = VectorStore(
            store_path=project_config.store_dir / "vectors.json"
        )

    # ── Public API ────────────────────────────────────────────────────

    def ingest_source(
        self,
        source_type: SourceType,
        document_name: Optional[str] = None,
    ) -> List[IngestionReport]:
        """Ingest files for a source type. Returns per-file reports."""
        if not source_type.is_implemented:
            return [self._not_implemented(source_type, document_name)]

        if source_type not in self.config.enabled_sources:
            return [IngestionReport(
                project_id=self.config.project_id,
                source_type=source_type,
                document_name=document_name or "*",
                status=IngestionStatus.FAILED,
                message=f"'{source_type.display_name}' is not enabled.",
            )]

        source_dir = self.config.sources_dir / source_type.value
        source_dir.mkdir(parents=True, exist_ok=True)

        files = self._resolve_files(source_dir, document_name)
        if isinstance(files, IngestionReport):
            return [files]

        reports = [self._ingest_file(f, source_type) for f in files]
        self.vector_store.save()
        return reports

    def ingest_all_sources(self) -> List[IngestionReport]:
        """Ingest every enabled source type."""
        reports: List[IngestionReport] = []
        for st in self.config.enabled_sources:
            reports.extend(self.ingest_source(st))
        return reports

    def ingest_text(
        self, text: str, source_type: SourceType,
        document_name: str, version: str = "1.0",
    ) -> IngestionReport:
        """Ingest raw text directly (no file read)."""
        if not source_type.is_implemented:
            return self._not_implemented(source_type, document_name)
        try:
            chunks = self.chunker.chunk_document(
                text, project_id=self.config.project_id,
                source_type=source_type, document_name=document_name,
                version=version,
            )
            self._embed_and_store(chunks)
            self.vector_store.save()
            return IngestionReport(
                project_id=self.config.project_id,
                source_type=source_type, document_name=document_name,
                status=IngestionStatus.COMPLETED,
                chunks_created=len(chunks),
                message=f"Ingested {len(chunks)} chunks.",
            )
        except Exception as exc:
            return IngestionReport(
                project_id=self.config.project_id,
                source_type=source_type, document_name=document_name,
                status=IngestionStatus.FAILED,
                message=str(exc), errors=[str(exc)],
            )

    # ── Helpers ───────────────────────────────────────────────────────

    def _not_implemented(self, st: SourceType, doc: Optional[str] = None) -> IngestionReport:
        return IngestionReport(
            project_id=self.config.project_id, source_type=st,
            document_name=doc or "*",
            status=IngestionStatus.NOT_IMPLEMENTED,
            message=f"'{st.display_name}' is a placeholder — not yet implemented.",
        )

    def _resolve_files(self, source_dir: Path, doc: Optional[str]):
        if doc:
            fp = source_dir / doc
            if not fp.exists():
                return IngestionReport(
                    project_id=self.config.project_id,
                    source_type=SourceType.USER_STORIES,
                    document_name=doc,
                    status=IngestionStatus.FAILED,
                    message=f"File not found: {fp}",
                )
            return [fp]
        files = sorted(
            f for f in source_dir.iterdir()
            if f.is_file() and f.suffix in _ALLOWED_EXTENSIONS
        )
        if not files:
            return IngestionReport(
                project_id=self.config.project_id,
                source_type=SourceType.USER_STORIES,
                document_name="*",
                status=IngestionStatus.FAILED,
                message=f"No files found in {source_dir}",
            )
        return files

    def _ingest_file(self, filepath: Path, source_type: SourceType) -> IngestionReport:
        doc_name = filepath.name
        try:
            text = filepath.read_text(encoding="utf-8")
        except Exception as exc:
            return IngestionReport(
                project_id=self.config.project_id,
                source_type=source_type, document_name=doc_name,
                status=IngestionStatus.FAILED, message=str(exc),
                errors=[str(exc)],
            )
        if not text.strip():
            return IngestionReport(
                project_id=self.config.project_id,
                source_type=source_type, document_name=doc_name,
                status=IngestionStatus.FAILED, message="File is empty.",
            )
        try:
            self.vector_store.delete_by_document(doc_name)
            chunks = self.chunker.chunk_document(
                text, project_id=self.config.project_id,
                source_type=source_type, document_name=doc_name,
                source_reference=str(filepath),
            )
            self._embed_and_store(chunks)
            return IngestionReport(
                project_id=self.config.project_id,
                source_type=source_type, document_name=doc_name,
                status=IngestionStatus.COMPLETED,
                chunks_created=len(chunks),
                message=f"Ingested {len(chunks)} chunks from '{doc_name}'.",
            )
        except Exception as exc:
            return IngestionReport(
                project_id=self.config.project_id,
                source_type=source_type, document_name=doc_name,
                status=IngestionStatus.FAILED,
                message=str(exc), errors=[str(exc)],
            )

    def _embed_and_store(self, chunks: List[KnowledgeChunk]) -> None:
        texts = [c.chunk_text for c in chunks]
        embeddings = self.embedding_engine.embed_batch(texts)
        for chunk, emb in zip(chunks, embeddings):
            chunk.embedding = emb
            self.vector_store.insert(chunk)
