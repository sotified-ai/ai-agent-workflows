"""
Project Loader
───────────────
Responsible for loading and validating per-project configuration from
the `projects/<project_id>/project_config.yaml` file and managing
the project directory structure.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml  # type: ignore

from .models import SourceType


# ── Default project root relative to the repo root ───────────────────────
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_PROJECTS_DIR = _REPO_ROOT / "projects"


class ProjectConfig:
    """
    Parsed, validated representation of a project_config.yaml.
    Exposes helper accessors used by ingestion and retrieval modules.
    """

    def __init__(self, raw: Dict[str, Any], config_path: Path) -> None:
        self._raw = raw
        self._config_path = config_path

    # ── Core identifiers ─────────────────────────────────────────────────
    @property
    def project_id(self) -> str:
        return self._raw["project_id"]

    @property
    def project_name(self) -> str:
        return self._raw.get("project_name", self.project_id)

    @property
    def description(self) -> str:
        return self._raw.get("description", "")

    # ── Source‐type configuration ─────────────────────────────────────────
    @property
    def enabled_sources(self) -> List[SourceType]:
        """Return the list of SourceTypes that are enabled in config."""
        raw_sources: Dict[str, Any] = self._raw.get("knowledge_sources", {})
        enabled: List[SourceType] = []
        for key, cfg in raw_sources.items():
            if isinstance(cfg, dict) and cfg.get("enabled", False):
                try:
                    enabled.append(SourceType(key))
                except ValueError:
                    pass  # Skip unknown source type keys silently
        return enabled

    def source_config(self, source_type: SourceType) -> Dict[str, Any]:
        """Return the raw config block for a given source type."""
        return self._raw.get("knowledge_sources", {}).get(source_type.value, {})

    # ── Paths ─────────────────────────────────────────────────────────────
    @property
    def project_dir(self) -> Path:
        return self._config_path.parent

    @property
    def sources_dir(self) -> Path:
        return self.project_dir / "sources"

    @property
    def store_dir(self) -> Path:
        return self.project_dir / "store"

    # ── Chunking / embedding settings ─────────────────────────────────────
    @property
    def chunk_size(self) -> int:
        return int(self._raw.get("chunking", {}).get("chunk_size", 512))

    @property
    def chunk_overlap(self) -> int:
        return int(self._raw.get("chunking", {}).get("overlap", 64))

    @property
    def embedding_model(self) -> str:
        return self._raw.get("embeddings", {}).get(
            "model", "all-MiniLM-L6-v2"
        )

    @property
    def embedding_dimension(self) -> int:
        return int(self._raw.get("embeddings", {}).get("dimension", 384))

    # ── Serialisation ─────────────────────────────────────────────────────
    def to_dict(self) -> Dict[str, Any]:
        return dict(self._raw)


class ProjectLoader:
    """
    Discovers, loads, and validates project configurations.
    Also ensures the required directory tree exists on disk.
    """

    def __init__(self, projects_dir: Optional[Path] = None) -> None:
        self.projects_dir = Path(projects_dir) if projects_dir else DEFAULT_PROJECTS_DIR
        self.projects_dir.mkdir(parents=True, exist_ok=True)

    # ── Loading ───────────────────────────────────────────────────────────
    def load_project(self, project_id: str) -> ProjectConfig:
        """Load a single project by ID. Raises FileNotFoundError if missing."""
        config_path = self.projects_dir / project_id / "project_config.yaml"
        if not config_path.exists():
            raise FileNotFoundError(
                f"Project config not found: {config_path}"
            )
        with open(config_path, "r", encoding="utf-8") as fh:
            raw = yaml.safe_load(fh) or {}

        # Inject project_id if missing in yaml body
        raw.setdefault("project_id", project_id)
        cfg = ProjectConfig(raw, config_path)
        self._ensure_directories(cfg)
        return cfg

    def list_projects(self) -> List[str]:
        """Return IDs of all projects that have a valid config file."""
        ids: List[str] = []
        if not self.projects_dir.exists():
            return ids
        for child in sorted(self.projects_dir.iterdir()):
            if child.is_dir() and (child / "project_config.yaml").exists():
                ids.append(child.name)
        return ids

    def load_or_scaffold(self, project_id: str, project_name: str = "") -> ProjectConfig:
        """Load a project config, scaffolding it first if it doesn't exist."""
        config_path = self.projects_dir / project_id / "project_config.yaml"
        if not config_path.exists():
            self.scaffold_project(project_id, project_name)
        return self.load_project(project_id)

    def load_all_projects(self) -> Dict[str, ProjectConfig]:
        """Load every discovered project into a dict keyed by project_id."""
        result: Dict[str, ProjectConfig] = {}
        for pid in self.list_projects():
            try:
                result[pid] = self.load_project(pid)
            except Exception:
                pass  # Skip broken configs gracefully
        return result

    # ── Scaffold ──────────────────────────────────────────────────────────
    def scaffold_project(self, project_id: str, project_name: str = "") -> Path:
        """
        Create a new project directory tree and default config file.
        Returns the path to the generated project_config.yaml.
        """
        project_dir = self.projects_dir / project_id
        sources_dir = project_dir / "sources"
        store_dir = project_dir / "store"

        # Create sub-folders for each source type
        for st in SourceType:
            (sources_dir / st.value).mkdir(parents=True, exist_ok=True)
        store_dir.mkdir(parents=True, exist_ok=True)

        config_path = project_dir / "project_config.yaml"
        if not config_path.exists():
            default_config = _build_default_config(project_id, project_name)
            with open(config_path, "w", encoding="utf-8") as fh:
                yaml.dump(default_config, fh, default_flow_style=False, sort_keys=False)

        return config_path

    # ── Internal helpers ──────────────────────────────────────────────────
    def _ensure_directories(self, cfg: ProjectConfig) -> None:
        """Guarantee source and store directories exist."""
        cfg.sources_dir.mkdir(parents=True, exist_ok=True)
        cfg.store_dir.mkdir(parents=True, exist_ok=True)
        for st in cfg.enabled_sources:
            (cfg.sources_dir / st.value).mkdir(parents=True, exist_ok=True)


def _build_default_config(project_id: str, project_name: str = "") -> Dict[str, Any]:
    """Generate the default YAML structure for a new project."""
    sources: Dict[str, Any] = {}
    for st in SourceType:
        sources[st.value] = {
            "enabled": st.is_implemented,
            "description": st.display_name,
            "path": f"sources/{st.value}",
        }
    return {
        "project_id": project_id,
        "project_name": project_name or project_id,
        "description": f"QA Agent Factory knowledge base for {project_name or project_id}",
        "knowledge_sources": sources,
        "chunking": {
            "chunk_size": 512,
            "overlap": 64,
        },
        "embeddings": {
            "model": "all-MiniLM-L6-v2",
            "dimension": 384,
            "local_only": True,
        },
        "retrieval": {
            "top_k": 10,
            "min_confidence": 0.25,
        },
    }
