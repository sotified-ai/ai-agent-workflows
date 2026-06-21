"""
Knowledge Base Retriever
────────────────────────
Queries the project's vector store and returns ranked, confidence-scored
results with full source references.  Designed to plug directly into the
QA Agent Factory orchestrator's Requirement_Retriever step.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .embeddings import EmbeddingEngine
from .models import KnowledgeChunk, RetrievalResult, SourceType
from .project_loader import ProjectConfig
from .vector_store import VectorStore


class KnowledgeRetriever:
    """
    Retrieval interface for a single project's knowledge base.
    Returns structured JSON-ready results with confidence scoring.
    """

    def __init__(
        self,
        project_config: ProjectConfig,
        embedding_engine: Optional[EmbeddingEngine] = None,
    ) -> None:
        self.config = project_config
        self.embedding_engine = embedding_engine or EmbeddingEngine(
            model_name=project_config.embedding_model,
            dimension=project_config.embedding_dimension,
        )
        self.vector_store = VectorStore(
            store_path=project_config.store_dir / "vectors.json"
        )

    # ── Public API ────────────────────────────────────────────────────

    def search(
        self,
        query: str,
        *,
        top_k: int = 10,
        source_type_filter: Optional[SourceType] = None,
        min_confidence: float = 0.0,
    ) -> List[RetrievalResult]:
        """
        Semantic search across the project knowledge base.
        Returns ranked RetrievalResult objects.
        """
        retrieval_cfg = self.config.to_dict().get("retrieval", {})
        effective_top_k = top_k or int(retrieval_cfg.get("top_k", 10))
        effective_min = min_confidence or float(
            retrieval_cfg.get("min_confidence", 0.0)
        )

        query_embedding = self.embedding_engine.embed(query)

        raw_results = self.vector_store.search(
            query_embedding=query_embedding,
            top_k=effective_top_k,
            source_type_filter=source_type_filter,
            min_confidence=effective_min,
        )

        results: List[RetrievalResult] = []
        for rank, (chunk, score) in enumerate(raw_results, start=1):
            results.append(
                RetrievalResult(chunk=chunk, confidence_score=score, rank=rank)
            )
        return results

    def search_json(
        self,
        query: str,
        *,
        top_k: int = 10,
        source_type_filter: Optional[SourceType] = None,
        min_confidence: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Same as search(), but returns a structured JSON-serialisable dict
        ready for consumption by the orchestrator or HTTP API.
        """
        results = self.search(
            query,
            top_k=top_k,
            source_type_filter=source_type_filter,
            min_confidence=min_confidence,
        )
        return {
            "project_id": self.config.project_id,
            "query": query,
            "source_type_filter": (
                source_type_filter.value if source_type_filter else None
            ),
            "total_results": len(results),
            "results": [r.to_dict() for r in results],
        }

    def get_context_for_story(
        self,
        story: Dict[str, Any],
        *,
        source_types: Optional[List[SourceType]] = None,
        top_k: int = 10,
    ) -> Dict[str, Any]:
        """
        Build a retrieval context block suitable for injection into the
        Requirement_Retriever prompt.  Accepts the same story dict used
        by the existing orchestrator.

        Returns a dict with:
        - project_context: list of relevant chunks with source refs
        - source_references: deduplicated list of source documents
        """
        # Compose a search query from the story fields
        parts = [
            story.get("title", ""),
            story.get("scope", ""),
            story.get("description", ""),
        ]
        if story.get("compliance_targets"):
            parts.append(" ".join(story["compliance_targets"]))
        query_text = " ".join(p for p in parts if p)

        all_results: List[RetrievalResult] = []
        filter_types = source_types or [None]  # type: ignore[list-item]

        for st in filter_types:
            results = self.search(
                query_text,
                top_k=top_k,
                source_type_filter=st,
            )
            all_results.extend(results)

        # Deduplicate & re-rank
        seen_ids = set()
        unique: List[RetrievalResult] = []
        for r in sorted(all_results, key=lambda x: x.confidence_score, reverse=True):
            if r.chunk.chunk_id not in seen_ids:
                seen_ids.add(r.chunk.chunk_id)
                r.rank = len(unique) + 1
                unique.append(r)

        unique = unique[:top_k]

        # Build source reference list
        source_refs = sorted(
            {r.chunk.source_reference for r in unique if r.chunk.source_reference}
        )

        return {
            "project_id": self.config.project_id,
            "project_name": self.config.project_name,
            "total_context_chunks": len(unique),
            "project_context": [
                {
                    "rank": r.rank,
                    "confidence": round(r.confidence_score, 4),
                    "source_type": r.chunk.source_type.value,
                    "document": r.chunk.document_name,
                    "source_reference": r.chunk.source_reference,
                    "section": r.chunk.metadata.section_title,
                    "text": r.chunk.chunk_text,
                }
                for r in unique
            ],
            "source_references": source_refs,
        }

    # ── Stats ─────────────────────────────────────────────────────────

    def stats(self) -> Dict[str, Any]:
        """Return summary statistics about the project's knowledge base."""
        total = self.vector_store.count()
        by_type: Dict[str, int] = {}
        for st in SourceType:
            c = self.vector_store.count(st)
            if c > 0:
                by_type[st.value] = c
        docs = self.vector_store.list_documents()
        return {
            "project_id": self.config.project_id,
            "total_chunks": total,
            "chunks_by_source_type": by_type,
            "documents": docs,
        }
