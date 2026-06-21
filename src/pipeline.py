"""
Integrated QA Pipeline
──────────────────────
End-to-end pipeline: context retrieval → scenario generation →
test case generation → QA review → traceability validation.

Replaces the mock-based orchestrator with real LLM calls.
All steps use the LLM adapter in src/llm.py — no simulated outputs.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from src.compliance import ComplianceGuard
from src.llm import call_llm, parse_json_response
from src.traceability import TraceabilityMatrix

logger = logging.getLogger(__name__)


# ── Prompt Templates ─────────────────────────────────────────────────────────

_RETRIEVER_SYSTEM = """You are an expert Requirements Engineering Agent for software QA.
Your task is to extract and structure all functional, non-functional, security, and
compliance requirements from the provided project context.
Return ONLY a JSON object with this schema:
{
  "requirements": [
    {
      "id": "REQ-01",
      "title": "...",
      "description": "...",
      "criticality": "Critical|High|Medium|Low",
      "compliance_tags": ["SOC2-CC6.1", ...]
    }
  ]
}"""

_SCENARIO_SYSTEM = """You are a Lead QA Planning Agent.
Convert the provided requirements into a comprehensive set of test scenarios.
Cover ALL scenario types: Positive, Negative, Boundary, Security, and Performance.
Return ONLY a JSON object with this schema:
{
  "scenarios": [
    {
      "id": "SC-01",
      "requirement_id": "REQ-01",
      "title": "...",
      "description": "...",
      "type": "Positive|Negative|Boundary|Security|Performance"
    }
  ]
}"""

_TEST_GEN_SYSTEM = """You are an expert QA Test Designer Agent.
Write detailed, executable step-by-step test cases for each provided scenario.
Each test case must be thorough, professional, and automation-ready.
If reviewer feedback is provided, RESOLVE all identified gaps in this revision.
Return ONLY a JSON object with this schema:
{
  "test_cases": [
    {
      "id": "TC-01",
      "scenario_id": "SC-01",
      "requirement_id": "REQ-01",
      "name": "...",
      "preconditions": "...",
      "steps": "1. ...\n2. ...",
      "expected_result": "...",
      "type": "Functional|Negative|Security|Boundary|Performance",
      "automation_candidate": "Yes|No"
    }
  ]
}"""

_REVIEWER_SYSTEM = """You are a Principal QA Audit Inspector Agent.
Rigorously audit the test suite against the requirements and scenarios.
Check for: missing coverage, duplicate tests, weak assertions, security gaps,
compliance requirement coverage.
Return ONLY a JSON object with this schema:
{
  "status": "Approved|Rejected",
  "feedback": "...",
  "gaps_found": [
    {
      "severity": "High|Medium|Low",
      "description": "...",
      "recommendation": "..."
    }
  ]
}"""

_TRACEABILITY_SYSTEM = """You are a Compliance Traceability Auditor Agent.
Compute the bi-directional traceability matrix linking requirements → scenarios → test cases.
Return ONLY a JSON object with this schema:
{
  "traceability_score": 100.0,
  "mappings": [
    {
      "requirement_id": "REQ-01",
      "scenario_ids": ["SC-01"],
      "test_case_ids": ["TC-01"]
    }
  ],
  "uncovered_requirements": []
}"""


# ── Pipeline ──────────────────────────────────────────────────────────────────

class QAPipeline:
    """
    Fully integrated QA pipeline with real LLM inference.
    No mock responses. All steps call the configured LLM backend.
    """

    def __init__(self, project_context: str = ""):
        self.compliance_guard = ComplianceGuard()
        self.project_context = project_context
        self.logs: List[Dict[str, Any]] = []

    def _log(self, step: str, message: str, status: str = "INFO") -> None:
        entry = {"step": step, "message": message, "status": status}
        self.logs.append(entry)
        logger.info("[%s] %s: %s", status, step, message)

    def _llm(
        self,
        system: str,
        user: str,
        temperature: float = 0.2,
    ) -> Dict[str, Any]:
        """Call LLM with compliance masking, then parse JSON response."""
        # Apply PII masking before sending to LLM
        masked_user, translation_map = self.compliance_guard.mask(user)
        raw = call_llm(system, masked_user, temperature=temperature, expect_json=True)
        # Restore masked values in response
        raw_unmasked = self.compliance_guard.unmask(raw, translation_map)
        return parse_json_response(raw_unmasked)

    def run(
        self,
        story: Dict[str, Any],
        knowledge_context: Optional[str] = None,
        max_review_loops: int = 2,
    ) -> Dict[str, Any]:
        """
        Execute the full QA pipeline for a given user story.

        Args:
            story: User story dict with title, description, compliance_targets.
            knowledge_context: Pre-fetched KB context string (from retriever).
            max_review_loops: Max QA review + correction iterations.

        Returns:
            Pipeline output dict with keys: requirements, scenarios, test_cases,
            review_report, traceability, logs.
        """
        self.logs.clear()
        context: Dict[str, Any] = {"story": story}

        def _extract_list(data: Any, key: str) -> List[Any]:
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return data.get(key, [])
            return []

        # ── Step 1: Retrieve / Structure Requirements ────────────────────────
        self._log("Retrieval", "Extracting structured requirements from project context...", "INFO")
        kb_section = f"\n\nPROJECT KNOWLEDGE BASE CONTEXT:\n{knowledge_context}" if knowledge_context else ""
        story_text = json.dumps(story, indent=2)

        req_data = self._llm(
            _RETRIEVER_SYSTEM,
            f"STORY:\n{story_text}{kb_section}\n\nExtract all requirements.",
            temperature=0.1,
        )
        context["requirements"] = _extract_list(req_data, "requirements")
        self._log(
            "Retrieval",
            f"Extracted {len(context['requirements'])} requirements.",
            "SUCCESS",
        )

        # ── Step 2: Generate Test Scenarios ─────────────────────────────────
        self._log("Scenario_Gen", "Generating test scenarios (Positive/Negative/Boundary/Security)...", "INFO")
        sc_data = self._llm(
            _SCENARIO_SYSTEM,
            f"REQUIREMENTS:\n{json.dumps(context['requirements'], indent=2)}\n\nGenerate all scenarios.",
            temperature=0.3,
        )
        context["scenarios"] = _extract_list(sc_data, "scenarios")
        self._log(
            "Scenario_Gen",
            f"Generated {len(context['scenarios'])} test scenarios.",
            "SUCCESS",
        )

        # ── Step 3: Generate Test Cases ──────────────────────────────────────
        self._log("Test_Case_Gen", "Drafting structured, executable test cases...", "INFO")
        tc_data = self._llm(
            _TEST_GEN_SYSTEM,
            (
                f"SCENARIOS:\n{json.dumps(context['scenarios'], indent=2)}\n\n"
                f"REQUIREMENTS:\n{json.dumps(context['requirements'], indent=2)}\n\n"
                "Write detailed test cases for every scenario."
            ),
            temperature=0.2,
        )
        context["test_cases"] = _extract_list(tc_data, "test_cases")
        self._log(
            "Test_Case_Gen",
            f"Generated {len(context['test_cases'])} test cases.",
            "INFO",
        )

        # ── Step 4: QA Review Loop ───────────────────────────────────────────
        loop_count = 0
        test_gen_prompt_base = (
            f"SCENARIOS:\n{json.dumps(context['scenarios'], indent=2)}\n\n"
            f"REQUIREMENTS:\n{json.dumps(context['requirements'], indent=2)}"
        )

        while loop_count < max_review_loops:
            self._log(
                "QA_Reviewer",
                f"Running compliance audit (iteration {loop_count + 1}/{max_review_loops})...",
                "INFO",
            )
            review_data = self._llm(
                _REVIEWER_SYSTEM,
                (
                    f"REQUIREMENTS:\n{json.dumps(context['requirements'], indent=2)}\n\n"
                    f"SCENARIOS:\n{json.dumps(context['scenarios'], indent=2)}\n\n"
                    f"TEST CASES:\n{json.dumps(context['test_cases'], indent=2)}\n\n"
                    "Audit the test suite for completeness and compliance."
                ),
                temperature=0.1,
            )

            if not isinstance(review_data, dict):
                review_data = {"status": "Rejected", "feedback": "Invalid JSON format from LLM", "gaps_found": []}

            if review_data.get("status") == "Approved":
                self._log("QA_Reviewer", "Audit passed. Full coverage confirmed.", "SUCCESS")
                context["review_report"] = review_data
                break
            else:
                gaps = review_data.get("gaps_found", [])
                feedback = review_data.get("feedback", "")
                self._log("QA_Reviewer", f"Gaps detected: {feedback[:120]}...", "WARNING")
                loop_count += 1

                if loop_count >= max_review_loops:
                    self._log("QA_Reviewer", "Max iterations reached. Finalising with current suite.", "WARNING")
                    context["review_report"] = review_data
                    break

                # Self-correction loopback
                self._log("Test_Case_Gen", "Loopback: re-generating test cases with reviewer feedback...", "INFO")
                tc_data = self._llm(
                    _TEST_GEN_SYSTEM,
                    (
                        f"{test_gen_prompt_base}\n\n"
                        f"CURRENT TEST CASES:\n{json.dumps(context['test_cases'], indent=2)}\n\n"
                        f"REVIEWER FEEDBACK:\n{feedback}\n\n"
                        f"GAPS TO FIX:\n{json.dumps(gaps, indent=2)}\n\n"
                        "Revise the test suite to resolve ALL identified gaps."
                    ),
                    temperature=0.2,
                )
                extracted_tc = _extract_list(tc_data, "test_cases")
                if extracted_tc:
                    context["test_cases"] = extracted_tc
                self._log(
                    "Test_Case_Gen",
                    f"Revised suite: {len(context['test_cases'])} test cases.",
                    "SUCCESS",
                )

        # ── Step 5: Traceability Matrix ──────────────────────────────────────
        self._log("Traceability", "Computing bi-directional traceability matrix...", "INFO")
        matrix = TraceabilityMatrix.compute_matrix(
            context["requirements"],
            context["scenarios"],
            context["test_cases"],
        )
        context["traceability"] = matrix
        score = round(matrix.get("traceability_score", 0), 1)
        self._log("Traceability", f"Traceability score: {score}% coverage.", "SUCCESS")

        context["logs"] = self.logs
        return context
