"""
Knowledge Base Data Models
──────────────────────────
Defines the core data structures for project knowledge base entries,
chunk metadata, retrieval results, and ingestion status tracking.
Uses dataclasses for lightweight, type-safe local-first storage.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class SourceType(str, Enum):
    """
    All recognised source types for the knowledge base.
    Only the first three are actively implemented;
    the rest are placeholders for future ingestion support.
    """
    # ── Active (implemented) ──────────────────────────
    USER_STORIES = "user_stories"
    API_SPECS = "api_specs"
    EXISTING_TEST_CASES_DEFECTS = "existing_test_cases_defects"

    # ── Placeholder (not yet implemented) ─────────────
    BRD = "brd"
    PRD = "prd"
    COMPLIANCE = "compliance"
    RELEASE_NOTES = "release_notes"
    SOP = "sop"
    ROLE_MATRIX = "role_matrix"
    UI_NOTES = "ui_notes"

    @classmethod
    def implemented_types(cls) -> List["SourceType"]:
        """Return only the source types that have working ingestion logic."""
        return [
            cls.USER_STORIES,
            cls.API_SPECS,
            cls.EXISTING_TEST_CASES_DEFECTS,
        ]

    @classmethod
    def placeholder_types(cls) -> List["SourceType"]:
        """Return source types reserved for future implementation."""
        return [t for t in cls if t not in cls.implemented_types()]

    @property
    def is_implemented(self) -> bool:
        return self in self.implemented_types()

    @property
    def display_name(self) -> str:
        """Human-friendly label for UI display."""
        _names = {
            "user_stories": "User Stories & Acceptance Criteria",
            "api_specs": "API Specifications (OpenAPI / Swagger)",
            "existing_test_cases_defects": "Existing Test Cases & Defects",
            "brd": "Business Requirements Document",
            "prd": "Product Requirements Document",
            "compliance": "Compliance & Regulatory Docs",
            "release_notes": "Release Notes",
            "sop": "Standard Operating Procedures",
            "role_matrix": "Role & Permission Matrix",
            "ui_notes": "UI / UX Design Notes",
        }
        return _names.get(self.value, self.value.replace("_", " ").title())


class IngestionStatus(str, Enum):
    """Tracks the lifecycle of an ingestion job."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    NOT_IMPLEMENTED = "not_implemented"


@dataclass
class ChunkMetadata:
    """Structured metadata attached to every knowledge chunk."""
    source_type: SourceType
    document_name: str
    section_title: Optional[str] = None
    page_number: Optional[int] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    tags: List[str] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class KnowledgeChunk:
    """
    A single indexed chunk within the project knowledge base.
    This is the fundamental retrieval unit.
    """
    chunk_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str = ""
    source_type: SourceType = SourceType.USER_STORIES
    document_name: str = ""
    chunk_text: str = ""
    metadata: ChunkMetadata = field(default_factory=lambda: ChunkMetadata(
        source_type=SourceType.USER_STORIES,
        document_name="",
    ))
    source_reference: str = ""
    version: str = "1.0"
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    embedding: Optional[List[float]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialise to a plain dictionary for JSON export / storage."""
        return {
            "chunk_id": self.chunk_id,
            "project_id": self.project_id,
            "source_type": self.source_type.value,
            "document_name": self.document_name,
            "chunk_text": self.chunk_text,
            "metadata": {
                "source_type": self.metadata.source_type.value,
                "document_name": self.metadata.document_name,
                "section_title": self.metadata.section_title,
                "page_number": self.metadata.page_number,
                "line_start": self.metadata.line_start,
                "line_end": self.metadata.line_end,
                "tags": self.metadata.tags,
                "extra": self.metadata.extra,
            },
            "source_reference": self.source_reference,
            "version": self.version,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeChunk":
        """Reconstruct a KnowledgeChunk from a serialised dictionary."""
        meta_raw = data.get("metadata", {})
        meta = ChunkMetadata(
            source_type=SourceType(meta_raw.get("source_type", "user_stories")),
            document_name=meta_raw.get("document_name", ""),
            section_title=meta_raw.get("section_title"),
            page_number=meta_raw.get("page_number"),
            line_start=meta_raw.get("line_start"),
            line_end=meta_raw.get("line_end"),
            tags=meta_raw.get("tags", []),
            extra=meta_raw.get("extra", {}),
        )
        return cls(
            chunk_id=data.get("chunk_id", str(uuid.uuid4())),
            project_id=data.get("project_id", ""),
            source_type=SourceType(data.get("source_type", "user_stories")),
            document_name=data.get("document_name", ""),
            chunk_text=data.get("chunk_text", ""),
            metadata=meta,
            source_reference=data.get("source_reference", ""),
            version=data.get("version", "1.0"),
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
        )


@dataclass
class RetrievalResult:
    """A single retrieval hit returned by the knowledge-base retriever."""
    chunk: KnowledgeChunk
    confidence_score: float = 0.0
    rank: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rank": self.rank,
            "confidence_score": round(self.confidence_score, 4),
            "chunk": self.chunk.to_dict(),
        }


@dataclass
class IngestionReport:
    """Status report returned after an ingestion run."""
    project_id: str
    source_type: SourceType
    document_name: str
    status: IngestionStatus
    chunks_created: int = 0
    message: str = ""
    errors: List[str] = field(default_factory=list)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "project_id": self.project_id,
            "source_type": self.source_type.value,
            "document_name": self.document_name,
            "status": self.status.value,
            "chunks_created": self.chunks_created,
            "message": self.message,
            "errors": self.errors,
            "created_at": self.created_at,
        }
