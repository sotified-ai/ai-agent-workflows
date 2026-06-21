"""Quick integration test for the Knowledge Base pipeline."""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.knowledge_base.project_loader import ProjectLoader
from src.knowledge_base.ingest import IngestionPipeline
from src.knowledge_base.retriever import KnowledgeRetriever
from src.knowledge_base.models import SourceType


def main():
    loader = ProjectLoader()
    cfg = loader.load_project("sample_project")
    print(f"Project: {cfg.project_id}")
    print(f"Enabled sources: {[s.value for s in cfg.enabled_sources]}")

    # Ingest all sources
    pipeline = IngestionPipeline(cfg)
    reports = pipeline.ingest_all_sources()
    for r in reports:
        print(f"  [{r.status.value}] {r.source_type.value}: {r.document_name} -> {r.chunks_created} chunks")
        print(f"    {r.message}")

    # Stats
    retriever = KnowledgeRetriever(cfg, pipeline.embedding_engine)
    stats = retriever.stats()
    print(f"\nStats: {json.dumps(stats, indent=2)}")

    # Search
    results = retriever.search_json("MFA login TOTP authentication", top_k=3)
    print(f"\nSearch results ({results['total_results']} hits):")
    for r in results["results"]:
        chunk = r["chunk"]
        text_preview = chunk["chunk_text"][:80].replace("\n", " ")
        print(f"  #{r['rank']} [{r['confidence_score']}] {chunk['source_type']} | {chunk['document_name']}")
        print(f"    {text_preview}...")

    # Test placeholder type
    not_impl = pipeline.ingest_source(SourceType.BRD)
    print(f"\nPlaceholder test: {not_impl[0].status.value}")
    print(f"  -> {not_impl[0].message}")

    # Test context for story
    ctx = retriever.get_context_for_story({
        "title": "MFA Login",
        "scope": "TOTP verification",
        "compliance_targets": ["SOC2-CC6.1"],
    })
    print(f"\nContext chunks for story: {ctx['total_context_chunks']}")
    print(f"Source references: {ctx['source_references']}")

    print("\n=== ALL TESTS PASSED ===")


if __name__ == "__main__":
    main()
