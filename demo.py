import os
import sys

# Ensure parent directory is in python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.compliance import ComplianceGuard, LocalSemanticCache
from src.factory import AgentFactory, AgentDefinition
from src.orchestrator import QAStateGraphOrchestrator
from src.exporter import SpreadsheetExporter

def run_demo():
    print("====================================================")
    print("   QA AGENT FACTORY - RUNNABLE PROTOTYPE DEMO       ")
    print("====================================================")

    # 1. Initialize Compliance Guard and Cache
    compliance_guard = ComplianceGuard()
    cache = LocalSemanticCache()

    # 2. Initialize Agent Factory
    factory = AgentFactory(compliance_guard, cache)

    # 3. Register Agents dynamically via Configuration (Zero hardcoding of agent classes)
    factory.register_agent("Requirement_Retriever", AgentDefinition(
        name="Requirement_Retriever",
        role="Extracts detailed product, functional, security, and compliance requirements from raw project specs.",
        system_prompt_template="""You are an expert Requirements Engineer Agent. 
Retrieve and structure functional requirements, security standards, and compliance criteria based on the input story.
STORY DEFINITION:
{{story}}

Return a structured JSON output with the schema:
{
  "requirements": [
    { "id": "REQ-XX", "title": "...", "description": "...", "criticality": "...", "compliance_tags": ["..."] }
  ]
}"""
    ))

    factory.register_agent("Scenario_Generator", AgentDefinition(
        name="Scenario_Generator",
        role="Translates system requirements into a comprehensive list of logical test scenarios.",
        system_prompt_template="""You are a Lead QA Planner Agent.
Translate the following system and compliance requirements into a complete list of test scenarios.
Ensure you cover Positive cases, Negative failure scenarios, and Boundary limit cases.
REQUIREMENTS:
{{requirements}}

Return a structured JSON output with the schema:
{
  "scenarios": [
    { "id": "SC-XX", "requirement_id": "REQ-XX", "title": "...", "description": "...", "type": "Positive|Negative|Boundary" }
  ]
}"""
    ))

    factory.register_agent("Test_Case_Generator", AgentDefinition(
        name="Test_Case_Generator",
        role="Converts logical test scenarios into formal, step-by-step test cases.",
        system_prompt_template="""You are an expert QA Test Designer Agent.
Write step-by-step test cases for each logical scenario.
If QA Reviewer feedback is provided, you must REVISE the suite to resolve gaps.
SCENARIOS:
{{scenarios}}

FEEDBACK / REVISION REQUEST (Optional):
{{feedback}}

Return a structured JSON output with the schema:
{
  "test_cases": [
    { "id": "TC-XX", "scenario_id": "SC-XX", "requirement_id": "REQ-XX", "name": "...", "preconditions": "...", "steps": "...", "expected_result": "...", "type": "...", "automation_candidate": "Yes|No" }
  ]
}"""
    ))

    factory.register_agent("QA_Reviewer", AgentDefinition(
        name="QA_Reviewer",
        role="Audits test cases against requirements and compliance criteria to ensure 100% coverage.",
        system_prompt_template="""You are a Critical Principal QA Inspector Agent.
Review the test cases against the required scenarios and compliance standards.
Identify any gaps, missing edge cases, or security standards that lack sufficient validation.
REQUIREMENTS:
{{requirements}}
SCENARIOS:
{{scenarios}}
TEST_CASES:
{{test_cases}}

If gaps exist, reject the suite (status: 'Rejected') and outline precise feedback.
If fully covered, approve (status: 'Approved').
Return structured JSON schema:
{
  "status": "Approved|Rejected",
  "feedback": "...",
  "gaps_found": [
    { "severity": "High|Medium", "description": "...", "recommendation": "..." }
  ]
}"""
    ))

    factory.register_agent("Traceability_Validator", AgentDefinition(
        name="Traceability_Validator",
        role="Computes and validates the bi-directional coverage matrix.",
        system_prompt_template="""You are a Compliance & Traceability Auditor Agent.
Compute the bi-directional trace matrix between requirements, scenarios, and test cases.
REQUIREMENTS:
{{requirements}}
SCENARIOS:
{{scenarios}}
TEST_CASES:
{{test_cases}}

Return structured JSON schema:
{
  "traceability_score": 100.0,
  "mappings": [
    { "requirement_id": "REQ-XX", "scenario_ids": ["SC-XX"], "test_case_ids": ["TC-XX"] }
  ],
  "uncovered_requirements": []
}"""
    ))

    # 4. Instantiate and execute the State Graph Orchestrator
    orchestrator = QAStateGraphOrchestrator(factory)

    # Input user story with a PII variable included to show compliance filtering
    mfa_story = {
        "title": "Multi-Factor Authentication (MFA) Login Prompt",
        "scope": "Add a secondary TOTP security layer during user login. Designed for customer Farrukh Khan at secure endpoint f.tuheedkhan@gmail.com with deployment IP 192.168.1.50 and db_password='SecretMFA123!'.",
        "compliance_targets": ["SOC2-CC6.1", "SOC2-CC6.3", "ISO27001-A.9.4.2"]
    }

    # Run Orchestrator Pipeline
    print(f"\n--- Starting Orchestrator for Story: '{mfa_story['title']}' ---")
    results = orchestrator.run_pipeline(mfa_story)

    # 5. Export results to spreadsheet
    from pathlib import Path

    project_root = Path(__file__).resolve().parent
    export_dir = project_root / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)

    export_path = export_dir / "MFA_Test_Suite_Export.xlsx"
    SpreadsheetExporter.export_to_excel(results, str(export_path))
    print(f"\n--- Success! Multi-sheet formatted Excel report exported to: '{export_path}' ---")

if __name__ == "__main__":
    run_demo()
