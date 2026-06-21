"""
Local Embeddings Engine
───────────────────────
Generates dense vector embeddings for text chunks without calling any
external SaaS API.

Strategy:
1. If sentence-transformers is installed locally, use the configured model
   (default: all-MiniLM-L6-v2) for high-quality semantic embeddings.
2. Otherwise, fall back to a deterministic TF-IDF-style hash embedding
   that is fast, local-first, and requires zero dependencies beyond the
   standard library.

Both paths are compliance-safe — no data leaves the local machine.
"""

from __future__ import annotations

import hashlib
import math
import re
from typing import List, Optional


class EmbeddingEngine:
    """
    Unified embedding interface.
    Attempts to use sentence-transformers; degrades gracefully to a local
    hash-based embedding when the dependency is absent.
    """

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        dimension: int = 384,
    ) -> None:
        self.model_name = model_name
        self.dimension = dimension
        self._model: Optional[object] = None
        self._use_transformer = False

        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
            self._model = SentenceTransformer(model_name)
            self._use_transformer = True
        except ImportError:
            # Fallback mode — no external dependency required
            self._use_transformer = False

    @property
    def backend(self) -> str:
        return "sentence-transformers" if self._use_transformer else "local-hash"

    # ── Public API ────────────────────────────────────────────────────────

    def embed(self, text: str) -> List[float]:
        """Produce a fixed-dimension embedding vector for a single string."""
        if self._use_transformer and self._model is not None:
            return self._embed_transformer(text)
        return self._embed_hash(text)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed a batch of strings. Returns a list of vectors."""
        if self._use_transformer and self._model is not None:
            return self._embed_transformer_batch(texts)
        return [self._embed_hash(t) for t in texts]

    # ── Sentence‐transformers backend ─────────────────────────────────────

    def _embed_transformer(self, text: str) -> List[float]:
        vec = self._model.encode(text, convert_to_numpy=True)  # type: ignore
        return vec.tolist()

    def _embed_transformer_batch(self, texts: List[str]) -> List[List[float]]:
        vecs = self._model.encode(texts, convert_to_numpy=True, batch_size=32)  # type: ignore
        return [v.tolist() for v in vecs]

    # ── Deterministic hash‐based fallback ─────────────────────────────────

    def _embed_hash(self, text: str) -> List[float]:
        """
        Deterministic, collision-resistant embedding using SHA-256 hashing
        of overlapping character n-grams.  Not suitable for semantic search
        but enables the full pipeline to run without any ML dependencies.
        """
        # Normalise
        text = re.sub(r"\s+", " ", text.lower().strip())
        if not text:
            return [0.0] * self.dimension

        # Generate n-grams (char trigrams)
        ngrams = [text[i : i + 3] for i in range(max(1, len(text) - 2))]

        vec = [0.0] * self.dimension
        for ng in ngrams:
            h = hashlib.sha256(ng.encode("utf-8")).hexdigest()
            for i in range(self.dimension):
                # Derive a stable float from the hash
                byte_val = int(h[(i * 2) % len(h) : (i * 2) % len(h) + 2], 16)
                vec[i] += (byte_val / 255.0) - 0.5

        # L2 normalise
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]
