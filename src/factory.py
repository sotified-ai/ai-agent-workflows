import json
import re
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from src.compliance import ComplianceGuard, LocalSemanticCache

@dataclass
class AgentDefinition:
    """Defines the metadata configuration for a dynamically created Agent."""
    name: str
    role: str
    system_prompt_template: str
    temperature: float = 0.2
    model: str = "llama3-8b-local"
    tools: List[str] = field(default_factory=list)
    validation_schema: Optional[Dict[str, Any]] = None

class DynamicAgent:
    """
    An agent compiled and instantiated dynamically by the factory.
    Does not use hardcoded classes; behavior is driven entirely by the definition config.
    """
    def __init__(self, definition: AgentDefinition, compliance_guard: ComplianceGuard, cache: LocalSemanticCache):
        self.def_ = definition
        self.compliance_guard = compliance_guard
        self.cache = cache

    def compile_prompt(self, variables: Dict[str, Any]) -> str:
        """Interpolates task variables into the system prompt template."""
        prompt = self.def_.system_prompt_template
        for key, val in variables.items():
            placeholder = f"{{{{{key}}}}}"
            if isinstance(val, (dict, list)):
                val_str = json.dumps(val, indent=2)
            else:
                val_str = str(val)
            prompt = prompt.replace(placeholder, val_str)
        # Clean up any unreplaced placeholders to prevent prompt contamination
        prompt = re.sub(r"\{\{\w+\}\}", "", prompt)
        return prompt

    def execute(self, task_input: Dict[str, Any], use_cache: bool = True) -> Dict[str, Any]:
        """
        Executes the agent action: compiles prompt, scrubs input, consults local cache,
        queries the local LLM (mocked for demo purposes, but showing how it integrates),
        unmasks the response, and returns parsed data.
        """
        raw_prompt = self.compile_prompt(task_input)

        # 1. Compliance Masking (In-flight Privacy Guard)
        masked_prompt, translation_map = self.compliance_guard.mask(raw_prompt)

        # 2. Local Semantic Cache Lookup
        cached_response = None
        if use_cache:
            cached_response = self.cache.get(masked_prompt)

        if cached_response:
            response_text = cached_response
            source = "cache"
        else:
            # 3. Local LLM Execution (Mocked interface for demonstration)
            # In production, this calls a local Ollama/vLLM server or private secure API.
            response_text = self._simulate_llm_inference(self.def_.name, masked_prompt)
            if use_cache:
                self.cache.set(masked_prompt, response_text)
            source = "llm"

        # 4. Compliance Unmasking (Restore original variables locally)
        unmasked_response = self.compliance_guard.unmask(response_text, translation_map)

        # 5. Output Verification & Structured Parsing
        try:
            parsed_data = json.loads(unmasked_response)
        except json.JSONDecodeError:
            # Fallback if LLM output contains wrapper markdown or text
            parsed_data = self._attempt_json_extraction(unmasked_response)

        return {
            "agent": self.def_.name,
            "source": source,
            "response": parsed_data,
            "raw_text": unmasked_response
        }

    def _attempt_json_extraction(self, text: str) -> Dict[str, Any]:
        try:
            # Look for JSON markdown block
            match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
            if match:
                return json.loads(match.group(1))
            # Find first { and last }
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1:
                return json.loads(text[start:end+1])
        except Exception:
            pass
        return {"error": "Failed to parse structured JSON from LLM output", "raw_response": text}

    def _simulate_llm_inference(self, agent_name: str, prompt: str) -> str:
        # Static mock responses to simulate complex local inference without internet dependencies
        # This keeps our sandbox-run deterministic and lightning-fast.
        if "Retriever" in agent_name:
            return json.dumps({
                "requirements": [
                    {
                        "id": "REQ-01",
                        "title": "MFA Challenge Verification",
                        "description": "System must prompt user for a 6-digit Time-based One-Time Password (TOTP) after valid email/password login.",
                        "criticality": "Critical",
                        "compliance_tags": ["SOC2-CC6.1", "ISO27001-A.9.4.2"]
                    },
                    {
                        "id": "REQ-02",
                        "title": "Account Lockout Rate Limiting",
                        "description": "After 5 consecutive failed MFA attempts within 10 minutes, the account must be locked for 15 minutes to prevent brute-force attacks.",
                        "criticality": "High",
                        "compliance_tags": ["OWASP-MASVS-L2", "SOC2-CC6.3"]
                    }
                ]
            })
        elif "Scenario" in agent_name:
            return json.dumps({
                "scenarios": [
                    {
                        "id": "SC-01",
                        "requirement_id": "REQ-01",
                        "title": "Successful MFA Authentication",
                        "description": "User enters correct password and correct 6-digit TOTP token, successfully landing on the dashboard.",
                        "type": "Positive"
                    },
                    {
                        "id": "SC-02",
                        "requirement_id": "REQ-01",
                        "title": "Invalid MFA Code Challenge",
                        "description": "User enters correct password but incorrect 6-digit TOTP code. Access must be denied with a clear validation message.",
                        "type": "Negative"
                    },
                    {
                        "id": "SC-03",
                        "requirement_id": "REQ-02",
                        "title": "MFA Rate Limiting and Lockout",
                        "description": "User fails MFA 5 times consecutively. Account is locked immediately, and subsequent attempts fail with a security lockout notice.",
                        "type": "Boundary"
                    }
                ]
            })
        elif "Generator" in agent_name:
            # We return test cases here. Note we purposefully miss REQ-02 account lockout in the first iteration
            # to let the QA Reviewer agent detect the gap and show off the feedback loop!
            # If the prompt contains the word "re-evaluate" or "revision" or feedback, we will provide the complete fixed set.
            if "CRITICAL GAP" in prompt:
                return json.dumps({
                    "test_cases": [
                        {
                            "id": "TC-01",
                            "scenario_id": "SC-01",
                            "requirement_id": "REQ-01",
                            "name": "Verify Successful Login with Valid MFA Code",
                            "preconditions": "User has MFA set up. User is on the login MFA prompt screen.",
                            "steps": "1. Enter valid 6-digit current TOTP code.\n2. Click 'Verify'.",
                            "expected_result": "User is authenticated and redirected to the dashboard. Session cookie is issued.",
                            "type": "Functional",
                            "automation_candidate": "Yes"
                        },
                        {
                            "id": "TC-02",
                            "scenario_id": "SC-02",
                            "requirement_id": "REQ-01",
                            "name": "Verify Login Fails with Incorrect MFA Code",
                            "preconditions": "User is on the login MFA prompt screen.",
                            "steps": "1. Enter an incorrect 6-digit code (e.g. '000000').\n2. Click 'Verify'.",
                            "expected_result": "Validation error: 'Invalid authentication code. Please try again.' remains on page. User is not logged in.",
                            "type": "Negative",
                            "automation_candidate": "Yes"
                        },
                        {
                            "id": "TC-03",
                            "scenario_id": "SC-03",
                            "requirement_id": "REQ-02",
                            "name": "Verify Account Lockout After 5 Failed MFA Attempts",
                            "preconditions": "User has completed primary email/password authentication.",
                            "steps": "1. Enter incorrect TOTP code 5 times consecutively.\n2. Attempt a 6th login with correct email, password, and TOTP.",
                            "expected_result": "Account is locked. System displays message: 'This account has been temporarily locked due to multiple failed login attempts. Please try again in 15 minutes.'",
                            "type": "Security",
                            "automation_candidate": "Yes"
                        }
                    ]
                })
            else:
                # Missing TC-03 initially
                return json.dumps({
                    "test_cases": [
                        {
                            "id": "TC-01",
                            "scenario_id": "SC-01",
                            "requirement_id": "REQ-01",
                            "name": "Verify Successful Login with Valid MFA Code",
                            "preconditions": "User has MFA set up. User is on the login MFA prompt screen.",
                            "steps": "1. Enter valid 6-digit current TOTP code.\n2. Click 'Verify'.",
                            "expected_result": "User is authenticated and redirected to the dashboard. Session cookie is issued.",
                            "type": "Functional",
                            "automation_candidate": "Yes"
                        },
                        {
                            "id": "TC-02",
                            "scenario_id": "SC-02",
                            "requirement_id": "REQ-01",
                            "name": "Verify Login Fails with Incorrect MFA Code",
                            "preconditions": "User is on the login MFA prompt screen.",
                            "steps": "1. Enter an incorrect 6-digit code (e.g. '000000').\n2. Click 'Verify'.",
                            "expected_result": "Validation error: 'Invalid authentication code. Please try again.' remains on page. User is not logged in.",
                            "type": "Negative",
                            "automation_candidate": "Yes"
                        }
                    ]
                })
        elif "Reviewer" in agent_name:
            # Scans for gaps. If we only have TC-01 and TC-02, it will trigger a Gap Found.
            if "TC-03" in prompt:
                return json.dumps({
                    "status": "Approved",
                    "feedback": "All scenarios covered. Test cases map 1:1 to required security and compliance features.",
                    "gaps_found": []
                })
            else:
                return json.dumps({
                    "status": "Rejected",
                    "feedback": "CRITICAL GAP: Scenario SC-03 (Account Lockout Rate Limiting for SOC2 CC6.3 Compliance) has no corresponding test cases in the suite. Security requirements are vulnerable to brute-force simulation tests. Re-evaluation required.",
                    "gaps_found": [
                        {
                            "severity": "High",
                            "description": "Scenario SC-03 'MFA Rate Limiting and Lockout' is missing a verification script. This fails SOC2 compliance standards.",
                            "recommendation": "Add a dedicated TC-03 security test case to verify immediate locking of account for 15 minutes after 5 consecutive failures."
                        }
                    ]
                })
        elif "Traceability" in agent_name:
            return json.dumps({
                "traceability_score": 100.0,
                "mappings": [
                    {"requirement_id": "REQ-01", "scenario_ids": ["SC-01", "SC-02"], "test_case_ids": ["TC-01", "TC-02"]},
                    {"requirement_id": "REQ-02", "scenario_ids": ["SC-03"], "test_case_ids": ["TC-03"]}
                ],
                "uncovered_requirements": []
            })

        return "{}"

class AgentFactory:
    """Manages creation, registry, and execution of config-driven DynamicAgents."""
    def __init__(self, compliance_guard: ComplianceGuard, cache: LocalSemanticCache):
        self.compliance_guard = compliance_guard
        self.cache = cache
        self.registry: Dict[str, AgentDefinition] = {}

    def register_agent(self, name: str, definition: AgentDefinition) -> None:
        self.registry[name] = definition

    def get_agent(self, name: str) -> DynamicAgent:
        if name not in self.registry:
            raise ValueError(f"Agent '{name}' is not registered in the Factory.")
        return DynamicAgent(self.registry[name], self.compliance_guard, self.cache)
