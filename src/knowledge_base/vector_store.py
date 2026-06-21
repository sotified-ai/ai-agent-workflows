"""
Local Vector Store
──────────────────
A lightweight, file-backed vector store that persists to JSON on the local
filesystem.  Supports insert, delete, filtered search, and cosine-similarity
ranking — all with zero external service dependencies.

Design:
- Each project gets its own store file under `projects/<id>/store/vectors.json`.
- Vectors are held in memory during a session and flushed to disk on save().
- Cosine similarity is used for nearest-neighbour retrieval.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .models import KnowledgeChunk, SourceType


class VectorStore:
    """
    In-memory + disk-backed vector store for a single project.
    """

    def __init__(self, store_path: Path) -> None:
        self.store_path = Path(store_path)
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        self._chunks: Dict[str, KnowledgeChunk] = {}
        self._load()

    # ── Persistence ───────────────────────────────────────────────────────

    def _load(self) -> None:
        """Load existing vectors from disk."""
        if self.store_path.exists():
            try:
                with open(self.store_path, "r", encoding="utf-8") as fh:
                    raw_list: List[Dict[str, Any]] = json.load(fh)
                for item in raw_list:
                    chunk = KnowledgeChunk.from_dict(item)
                    chunk.embedding = item.get("embedding")
                    self._chunks[chunk.chunk_id] = chunk
            except (json.JSONDecodeError, KeyError):
                self._chunks = {}

    def save(self) -> None:
        """Flush current state to disk."""
        records: List[Dict[str, Any]] = []
        for chunk in self._chunks.values():
            d = chunk.to_dict()
            d["embedding"] = chunk.embedding
            records.append(d)
        with open(self.store_path, "w", encoding="utf-8") as fh:
            json.dump(records, fh, indent=2, ensure_ascii=False)

    # ── CRUD ──────────────────────────────────────────────────────────────

    def insert(self, chunk: KnowledgeChunk) -> None:
        """Add or overwrite a chunk in the store."""
        self._chunks[chunk.chunk_id] = chunk

    def insert_batch(self, chunks: List[KnowledgeChunk]) -> int:
        """Insert many chunks at once. Returns count inserted."""
        for c in chunks:
            self._chunks[c.chunk_id] = c
        return len(chunks)

    def delete_by_document(self, document_name: str) -> int:
        """Remove all chunks belonging to a specific document."""
        to_delete = [
            cid for cid, c in self._chunks.items()
            if c.document_name == document_name
        ]
        for cid in to_delete:
            del self._chunks[cid]
        return len(to_delete)

    def delete_by_source_type(self, source_type: SourceType) -> int:
        """Remove all chunks of a given source type."""
        to_delete = [
            cid for cid, c in self._chunks.items()
            if c.source_type == source_type
        ]
        for cid in to_delete:
            del self._chunks[cid]
        return len(to_delete)

    def count(self, source_type: Optional[SourceType] = None) -> int:
        """Count chunks, optionally filtered by source type."""
        if source_type is None:
            return len(self._chunks)
        return sum(1 for c in self._chunks.values() if c.source_type == source_type)

    def list_documents(self, source_type: Optional[SourceType] = None) -> List[str]:
        """Return unique document names, optionally filtered."""
        names = set()
        for c in self._chunks.values():
            if source_type is None or c.source_type == source_type:
                names.add(c.document_name)
        return sorted(names)

    # ── Search ────────────────────────────────────────────────────────────

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        source_type_filter: Optional[SourceType] = None,
        min_confidence: float = 0.0,
    ) -> List[Tuple[KnowledgeChunk, float]]:
        """
        Find the top_k most similar chunks via cosine similarity.
        Optionally filter by source_type and confidence threshold.
        """
        scored: List[Tuple[KnowledgeChunk, float]] = []

        for chunk in self._chunks.values():
            # Apply source type filter
            if source_type_filter is not None and chunk.source_type != source_type_filter:
                continue
            if chunk.embedding is None:
                continue

            score = _cosine_similarity(query_embedding, chunk.embedding)
            if score >= min_confidence:
                scored.append((chunk, score))

        # Sort descending by score
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def get_all_chunks(
        self, source_type: Optional[SourceType] = None
    ) -> List[KnowledgeChunk]:
        """Return all chunks, optionally filtered."""
        if source_type is None:
            return list(self._chunks.values())
        return [c for c in self._chunks.values() if c.source_type == source_type]


# ── Maths ─────────────────────────────────────────────────────────────────

def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a)) or 1.0
    norm_b = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (norm_a * norm_b)
