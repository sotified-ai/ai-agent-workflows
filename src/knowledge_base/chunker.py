"""
Document Chunker
────────────────
Splits raw document text into overlapping chunks suitable for embedding
and vector-store indexing.  Implements source-type-aware chunking strategies
so that user stories, API specs, and test cases are split at semantically
meaningful boundaries.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from .models import ChunkMetadata, KnowledgeChunk, SourceType


class Chunker:
    """
    Configurable text chunker with support for:
    - Fixed-size overlapping windows (default)
    - Section-aware splitting for structured documents
    """

    def __init__(self, chunk_size: int = 512, overlap: int = 64) -> None:
        if chunk_size < 1:
            raise ValueError("chunk_size must be >= 1")
        if overlap < 0 or overlap >= chunk_size:
            raise ValueError("overlap must be >= 0 and < chunk_size")
        self.chunk_size = chunk_size
        self.overlap = overlap

    # ── Public API ────────────────────────────────────────────────────────

    def chunk_document(
        self,
        text: str,
        *,
        project_id: str,
        source_type: SourceType,
        document_name: str,
        source_reference: str = "",
        version: str = "1.0",
    ) -> List[KnowledgeChunk]:
        """
        Route to the best chunking strategy for the given source type,
        then produce a list of KnowledgeChunks ready for embedding.
        """
        if not text or not text.strip():
            return []

        if source_type == SourceType.USER_STORIES:
            raw_chunks = self._chunk_user_stories(text)
        elif source_type == SourceType.API_SPECS:
            raw_chunks = self._chunk_api_specs(text)
        elif source_type == SourceType.EXISTING_TEST_CASES_DEFECTS:
            raw_chunks = self._chunk_test_cases(text)
        else:
            # Fallback: generic sliding-window
            raw_chunks = self._chunk_sliding_window(text)

        chunks: List[KnowledgeChunk] = []
        for idx, (chunk_text, section_title, line_start, line_end) in enumerate(raw_chunks):
            meta = ChunkMetadata(
                source_type=source_type,
                document_name=document_name,
                section_title=section_title,
                line_start=line_start,
                line_end=line_end,
            )
            kc = KnowledgeChunk(
                project_id=project_id,
                source_type=source_type,
                document_name=document_name,
                chunk_text=chunk_text,
                metadata=meta,
                source_reference=source_reference or document_name,
                version=version,
            )
            chunks.append(kc)
        return chunks

    # ── Strategy: User Stories ────────────────────────────────────────────

    def _chunk_user_stories(self, text: str) -> List[Tuple[str, Optional[str], Optional[int], Optional[int]]]:
        """
        Split by story boundaries (look for patterns like 'Story:', 'US-', 
        'As a', '## ', numbered items, or YAML-style `- title:` blocks).
        Falls back to sliding-window if no structure detected.
        """
        # Attempt section-based splitting first
        section_pattern = re.compile(
            r"(?:^|\n)(?=(?:Story\s*[:#]|US-\d|As a |##\s|\d+\.\s|- title:))",
            re.IGNORECASE,
        )
        sections = self._split_by_pattern(text, section_pattern)
        if len(sections) > 1:
            return sections

        # Fallback
        return self._chunk_sliding_window(text)

    # ── Strategy: API Specs ───────────────────────────────────────────────

    def _chunk_api_specs(self, text: str) -> List[Tuple[str, Optional[str], Optional[int], Optional[int]]]:
        """
        Split at endpoint or path boundaries (e.g. '/paths/', 'GET ', 'POST ',
        '## ', YAML top-level keys).
        """
        section_pattern = re.compile(
            r"(?:^|\n)(?=(?:(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+/|"
            r"paths:|##\s|/\w+.*:$))",
            re.IGNORECASE | re.MULTILINE,
        )
        sections = self._split_by_pattern(text, section_pattern)
        if len(sections) > 1:
            return sections

        return self._chunk_sliding_window(text)

    # ── Strategy: Test Cases / Defects ────────────────────────────────────

    def _chunk_test_cases(self, text: str) -> List[Tuple[str, Optional[str], Optional[int], Optional[int]]]:
        """
        Split at test-case boundaries (TC-, Test Case, BUG-, DEF-, ## ).
        """
        section_pattern = re.compile(
            r"(?:^|\n)(?=(?:TC-\d|Test Case|BUG-\d|DEF-\d|Defect|##\s|\d+\.\s))",
            re.IGNORECASE,
        )
        sections = self._split_by_pattern(text, section_pattern)
        if len(sections) > 1:
            return sections

        return self._chunk_sliding_window(text)

    # ── Generic sliding‐window ────────────────────────────────────────────

    def _chunk_sliding_window(
        self, text: str
    ) -> List[Tuple[str, Optional[str], Optional[int], Optional[int]]]:
        """Character-level sliding window with overlap."""
        chunks: List[Tuple[str, Optional[str], Optional[int], Optional[int]]] = []
        start = 0
        total = len(text)
        while start < total:
            end = min(start + self.chunk_size, total)
            snippet = text[start:end]

            # Compute approximate line numbers
            line_start = text[:start].count("\n") + 1
            line_end = text[:end].count("\n") + 1

            chunks.append((snippet, None, line_start, line_end))

            if end >= total:
                break
            start += self.chunk_size - self.overlap
        return chunks

    # ── Helpers ───────────────────────────────────────────────────────────

    def _split_by_pattern(
        self, text: str, pattern: re.Pattern  # type: ignore[type-arg]
    ) -> List[Tuple[str, Optional[str], Optional[int], Optional[int]]]:
        """
        Split text using a regex pattern.  Each match position starts a new
        section.  Sections that exceed chunk_size are further sub-chunked.
        """
        positions = [m.start() for m in pattern.finditer(text)]
        if not positions:
            return []

        # Ensure we capture text before the first match
        if positions[0] != 0:
            positions.insert(0, 0)

        raw_sections: List[Tuple[str, Optional[str], Optional[int], Optional[int]]] = []
        for i, pos in enumerate(positions):
            end = positions[i + 1] if i + 1 < len(positions) else len(text)
            section_text = text[pos:end].strip()
            if not section_text:
                continue

            # Derive a section title from the first line
            first_line = section_text.split("\n", 1)[0].strip()
            title = first_line[:120] if first_line else None

            line_start = text[:pos].count("\n") + 1
            line_end = text[:end].count("\n") + 1

            # Sub-chunk if the section is too large
            if len(section_text) > self.chunk_size:
                sub = self._chunk_sliding_window(section_text)
                for s_text, _, sl, el in sub:
                    adjusted_ls = (line_start + (sl - 1)) if sl else line_start
                    adjusted_le = (line_start + (el - 1)) if el else line_end
                    raw_sections.append((s_text, title, adjusted_ls, adjusted_le))
            else:
                raw_sections.append((section_text, title, line_start, line_end))

        return raw_sections
