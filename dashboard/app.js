// QA Agent Factory - Application Interactivity

const SOURCE_REPOSITORY = {"blueprint": "# QA Agent Factory: Enterprise Architectural Blueprint\n\nSolving the triad of **Automated Test Generation**, **Long-term Context Retention**, and **Compliance-Safe Local Deployment** through a modular, metadata-driven Agent Factory architecture.\n\n---\n\n## 1. Executive Problem Statements & Solutions\n\n### Problem A: The Hallucination of Plain Chatbots (Test Generation)\n**The Challenge:** Traditional LLMs prompted with \"Write test cases for X\" will hallucinate API endpoints, skip critical boundary conditions, ignore security standards, and produce unstructured, non-reproducible outputs.\n**The Solution:** The **QA Agent Factory** replaces flat prompt chats with a structured, feedback-driven State Graph pipeline.\n1. **Separation of Concerns:** Individual specialized roles (Requirement Retrieval, Scenario Mapping, Test Writing, Auditing) are dynamically registered and run in sequence.\n2. **Dynamic Peer Review Loop:** A critical `QA Reviewer` agent audits the output of the `Test Case Generator`. If coverage or security gaps are detected, the orchestrator triggers an automatic loop-back self-correction step, passing explicit remediation instructions back to the writer.\n\n### Problem B: The Amnesia of LLM Context Windows (Context Retention)\n**The Challenge:** Complex software projects have large codebases, extensive API schemas, multi-page Jira tickets, and corporate compliance manuals. Feeding all of this into an LLM on every query causes context-window overflow, high costs, and context dilution (LLM \"loses\" details in the middle).\n**The Solution:** A **Hierarchical Retrieval & State Management System**.\n1. **Durable Shared Execution Ledger:** Instead of passing full histories, a centralized State Graph manages a lean execution context.\n2. **Context Compression (Workspace Manager):** A semantic workspace compressor summarizes past execution turns, while a local vector database queries the Project Knowledge Base on-demand to fetch only the relevant requirements for the current test scope.\n3. **Traceability Ledger:** Requirements, scenarios, and test cases are mapped bi-directionally. This keeps a tight mathematical link between entities, ensuring context is locked in structure rather than loose prompt text.\n\n### Problem C: Data Privacy & Air-gapped Mandates (Compliance-Safe Local Deployment)\n**The Challenge:** Corporate compliance (SOC2, ISO27001, HIPAA) strictly prohibits transmitting sensitive customer data, source code, or internal database schemas to public cloud LLM APIs.\n**The Solution:** A **Local-First, Privacy-Preserving Proxy Architecture**.\n1. **Dual-Way Compliance Masking:** The `ComplianceGuard` intercepts all outgoing prompts before execution. It scrubs sensitive PII, passwords, emails, and internal IP addresses, replacing them with reversible secure tokens (e.g., `__SAFE_EMAIL_0__`). The local or cloud LLM processes anonymized requirements. Once the LLM responds, the guard restores the sensitive variables locally.\n2. **Local Inference Isolation:** The execution wrapper decouples LLM calls, seamlessly supporting local private servers (Ollama, vLLM, Hugging Face TGI) executing open-weights models like `Llama-3-8B-Instruct` or `Qwen-2.5-Coder` in an air-gapped network.\n3. **Local Semantic Caching:** A high-speed cache hashes prompt configurations, bypassing LLM generation for identical queries, saving local hardware compute and providing deterministic performance.\n\n---\n\n## 2. Recommended System Architecture\n\nRather than separate hardcoded agent classes that require code changes for every new QA workflow, the system uses the **QA Agent Factory Pattern**.\n\n```\n                         [ Project Knowledge Base (Jira/APIs/Docs) ]\n                                            \u2193\n                                  +-------------------+\n                                  |  Compliance Guard | <--- (PII Scrubbing, Local Cache)\n                                  +-------------------+\n                                            \u2193\n                                  +-------------------+\n                                  |   Agent Factory   | <--- (Loads JSON definitions,\n                                  +-------------------+       compiles prompts & tools)\n                                            \u2193\n                   +-------------------------------------------------+\n                   |         QA State Graph Orchestrator             |\n                   +-------------------------------------------------+\n                   |                                                 |\n                   |  [Retrieve] \u2794 [Scenarios] \u2794 [Test Generator]     |\n                   |                                     \u2502           |\n                   |   [Traceability] \ud83d\udd9a  [Export] <--- [Reviewer] \ud83e\udc14\u2500\u2518 |\n                   |         (100% Coverage Audit & Loopback)        |\n                   +-------------------------------------------------+\n                                            \u2193\n                                [ Structured XLSX Export ]\n```\n\n### Component Breakdown\n1. **Dynamic Agent Registry (Factory Core):**\n   - Receives JSON-based `AgentDefinitions` specifying roles, prompts, models, and temperatures.\n   - Instantiates a generic `DynamicAgent` class that handles compiling prompt templates and executing local inference.\n2. **Compliance Proxy / Guard:**\n   - Dual-way anonymizer.\n   - Local hash-based semantic cache.\n3. **Orchestrator (State Graph):**\n   - Coordinates state transitions.\n   - Executes loops and branches based on evaluation outputs (e.g., if `status == \"Rejected\"`, branch back to `Test_Case_Generator`).\n4. **Bi-Directional Traceability Matrix:**\n   - Evaluates coverage mathematically.\n   - Identifies uncovered scenarios and maps requirement IDs 1:1 to test case scripts.\n5. **Spreadsheet Exporter:**\n   - Translates validation outputs into standardized, beautifully formatted multi-sheet Excel workbooks matching enterprise standards.\n\n---\n\n## 3. Dynamic Factory Configuration (Example Definition)\nThis JSON schema allows the system to register and configure a new agent on-the-fly without restarting or editing the core engine code:\n\n```json\n{\n  \"name\": \"QA_Reviewer\",\n  \"role\": \"Audits test cases against requirements and compliance criteria.\",\n  \"system_prompt_template\": \"You are a Critical Principal QA Inspector. Review test cases: {{test_cases}} against scenarios: {{scenarios}}...\",\n  \"temperature\": 0.1,\n  \"model\": \"qwen2.5-coder-7b-local\",\n  \"tools\": [\"vector_retriever\", \"rule_validator\"],\n  \"validation_schema\": {\n    \"type\": \"object\",\n    \"properties\": {\n      \"status\": { \"type\": \"string\", \"enum\": [\"Approved\", \"Rejected\"] },\n      \"feedback\": { \"type\": \"string\" },\n      \"gaps_found\": { \"type\": \"array\" }\n    },\n    \"required\": [\"status\", \"feedback\", \"gaps_found\"]\n  }\n}\n```\n\n---\n\n## 4. Run/Deployment Manual\n\n### Prerequisites\n- Python 3.10+\n- Pre-installed packages: `pandas`, `openpyxl`, `jinja2`\n\n### Run the Simulated Prototype Engine\nThe repository contains a fully working local prototype of the QA Agent Factory showing dynamic agent compilation, dual-way PII masking, local semantic caching, state-machine loopbacks, and Excel exporting.\n\nTo execute the demo:\n```bash\n/usr/local/bin/python3 /home/user/qa_agent_factory/src/demo.py\n```\n\n### Deploying Locally with Ollama / vLLM\nTo run this architecture with absolute compliance-safe local deployment, wrap the LLM execution in `factory.py` to point to a local Ollama server:\n\n```python\nimport requests\n\ndef _call_local_ollama(self, prompt: str) -> str:\n    response = requests.post(\n        \"http://localhost:11434/api/generate\",\n        json={\n            \"model\": self.def_.model, # e.g., \"llama3\" or \"qwen2.5-coder\"\n            \"prompt\": prompt,\n            \"stream\": False,\n            \"options\": {\n                \"temperature\": self.def_.temperature\n            }\n        }\n    )\n    return response.json().get(\"response\", \"\")\n```\n", "compliance": "import os\nimport re\nimport hashlib\nfrom typing import Dict, Tuple\n\nclass ComplianceGuard:\n    \"\"\"\n    Handles PII / sensitive data scrubbing (dual-way mapping) and local semantic caching\n    to enable compliance-safe, fast, and secure local LLM deployment.\n    \"\"\"\n    def __init__(self):\n        # Regular expressions for common PII and sensitive data patterns\n        self.patterns = {\n            \"EMAIL\": r\"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+\",\n            \"IP_ADDRESS\": r\"\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b\",\n            \"API_KEY\": r\"(?:api[_-]?key|secret|token|password|auth|passwd|credential)\\s*[:=]\\s*['\\\"][a-zA-Z0-9_\\\\-]{12,}['\\\"]\",\n            \"CREDIT_CARD\": r\"\\b(?:\\d[ -]*?){13,16}\\b\",\n            \"PHONE\": r\"\\b(?:\\+?\\d{1,3}[- ]?)?\\(?\\d{3}\\)?[- ]?\\d{3}[- ]?\\d{4}\\b\",\n        }\n\n    def mask(self, text: str) -> Tuple[str, Dict[str, str]]:\n        \"\"\"\n        Masks sensitive terms in the input text.\n        Returns the masked text and the translation map to restore the text later.\n        \"\"\"\n        if not text:\n            return \"\", {}\n\n        translation_map = {}\n        masked_text = text\n        counter = 0\n\n        for key, pattern in self.patterns.items():\n            matches = list(set(re.findall(pattern, masked_text, re.IGNORECASE)))\n            for match in matches:\n                # Skip short matching strings that could be false positives\n                if len(match) < 4:\n                    continue\n                placeholder = f\"__SAFE_{key}_{counter}__\"\n                translation_map[placeholder] = match\n                masked_text = masked_text.replace(match, placeholder)\n                counter += 1\n\n        return masked_text, translation_map\n\n    def unmask(self, text: str, translation_map: Dict[str, str]) -> str:\n        \"\"\"\n        Restores the original sensitive text using the translation map.\n        \"\"\"\n        if not text or not translation_map:\n            return text\n\n        unmasked_text = text\n        for placeholder, original in translation_map.items():\n            unmasked_text = unmasked_text.replace(placeholder, original)\n\n        return unmasked_text\n\nclass LocalSemanticCache:\n    \"\"\"\n    Local-first execution cache to avoid redundant, expensive LLM calls\n    and accelerate local test generation pipelines.\n    \"\"\"\n    def __init__(self, cache_dir: str = \".cache\"):\n        self.cache_dir = cache_dir\n        if not os.path.exists(cache_dir):\n            os.makedirs(cache_dir)\n\n    def _get_hash(self, key: str) -> str:\n        return hashlib.sha256(key.encode(\"utf-8\")).hexdigest()\n\n    def get(self, prompt: str) -> str:\n        h = self._get_hash(prompt)\n        cache_path = os.path.join(self.cache_dir, f\"{h}.cache\")\n        if os.path.exists(cache_path):\n            with open(cache_path, \"r\", encoding=\"utf-8\") as f:\n                return f.read()\n        return None\n\n    def set(self, prompt: str, response: str) -> None:\n        h = self._get_hash(prompt)\n        cache_path = os.path.join(self.cache_dir, f\"{h}.cache\")\n        with open(cache_path, \"w\", encoding=\"utf-8\") as f:\n            f.write(response)\n", "factory": "import json\nimport re\nfrom dataclasses import dataclass, field\nfrom typing import Dict, Any, List, Optional\nfrom src.compliance import ComplianceGuard, LocalSemanticCache\n\n@dataclass\nclass AgentDefinition:\n    \"\"\"Defines the metadata configuration for a dynamically created Agent.\"\"\"\n    name: str\n    role: str\n    system_prompt_template: str\n    temperature: float = 0.2\n    model: str = \"llama3-8b-local\"\n    tools: List[str] = field(default_factory=list)\n    validation_schema: Optional[Dict[str, Any]] = None\n\nclass DynamicAgent:\n    \"\"\"\n    An agent compiled and instantiated dynamically by the factory.\n    Does not use hardcoded classes; behavior is driven entirely by the definition config.\n    \"\"\"\n    def __init__(self, definition: AgentDefinition, compliance_guard: ComplianceGuard, cache: LocalSemanticCache):\n        self.def_ = definition\n        self.compliance_guard = compliance_guard\n        self.cache = cache\n\n    def compile_prompt(self, variables: Dict[str, Any]) -> str:\n        \"\"\"Interpolates task variables into the system prompt template.\"\"\"\n        prompt = self.def_.system_prompt_template\n        for key, val in variables.items():\n            placeholder = f\"{{{{{key}}}}}\"\n            if isinstance(val, (dict, list)):\n                val_str = json.dumps(val, indent=2)\n            else:\n                val_str = str(val)\n            prompt = prompt.replace(placeholder, val_str)\n        # Clean up any unreplaced placeholders to prevent prompt contamination\n        prompt = re.sub(r\"\\{\\{\\w+\\}\\}\", \"\", prompt)\n        return prompt\n\n    def execute(self, task_input: Dict[str, Any], use_cache: bool = True) -> Dict[str, Any]:\n        \"\"\"\n        Executes the agent action: compiles prompt, scrubs input, consults local cache,\n        queries the local LLM (mocked for demo purposes, but showing how it integrates),\n        unmasks the response, and returns parsed data.\n        \"\"\"\n        raw_prompt = self.compile_prompt(task_input)\n\n        # 1. Compliance Masking (In-flight Privacy Guard)\n        masked_prompt, translation_map = self.compliance_guard.mask(raw_prompt)\n\n        # 2. Local Semantic Cache Lookup\n        cached_response = None\n        if use_cache:\n            cached_response = self.cache.get(masked_prompt)\n\n        if cached_response:\n            response_text = cached_response\n            source = \"cache\"\n        else:\n            # 3. Local LLM Execution (Mocked interface for demonstration)\n            # In production, this calls a local Ollama/vLLM server or private secure API.\n            response_text = self._simulate_llm_inference(self.def_.name, masked_prompt)\n            if use_cache:\n                self.cache.set(masked_prompt, response_text)\n            source = \"llm\"\n\n        # 4. Compliance Unmasking (Restore original variables locally)\n        unmasked_response = self.compliance_guard.unmask(response_text, translation_map)\n\n        # 5. Output Verification & Structured Parsing\n        try:\n            parsed_data = json.loads(unmasked_response)\n        except json.JSONDecodeError:\n            # Fallback if LLM output contains wrapper markdown or text\n            parsed_data = self._attempt_json_extraction(unmasked_response)\n\n        return {\n            \"agent\": self.def_.name,\n            \"source\": source,\n            \"response\": parsed_data,\n            \"raw_text\": unmasked_response\n        }\n\n    def _attempt_json_extraction(self, text: str) -> Dict[str, Any]:\n        try:\n            # Look for JSON markdown block\n            match = re.search(r\"```json\\s*(.*?)\\s*```\", text, re.DOTALL)\n            if match:\n                return json.loads(match.group(1))\n            # Find first { and last }\n            start = text.find('{')\n            end = text.rfind('}')\n            if start != -1 and end != -1:\n                return json.loads(text[start:end+1])\n        except Exception:\n            pass\n        return {\"error\": \"Failed to parse structured JSON from LLM output\", \"raw_response\": text}\n\n    def _simulate_llm_inference(self, agent_name: str, prompt: str) -> str:\n        # Static mock responses to simulate complex local inference without internet dependencies\n        # This keeps our sandbox-run deterministic and lightning-fast.\n        if \"Retriever\" in agent_name:\n            return json.dumps({\n                \"requirements\": [\n                    {\n                        \"id\": \"REQ-01\",\n                        \"title\": \"MFA Challenge Verification\",\n                        \"description\": \"System must prompt user for a 6-digit Time-based One-Time Password (TOTP) after valid email/password login.\",\n                        \"criticality\": \"Critical\",\n                        \"compliance_tags\": [\"SOC2-CC6.1\", \"ISO27001-A.9.4.2\"]\n                    },\n                    {\n                        \"id\": \"REQ-02\",\n                        \"title\": \"Account Lockout Rate Limiting\",\n                        \"description\": \"After 5 consecutive failed MFA attempts within 10 minutes, the account must be locked for 15 minutes to prevent brute-force attacks.\",\n                        \"criticality\": \"High\",\n                        \"compliance_tags\": [\"OWASP-MASVS-L2\", \"SOC2-CC6.3\"]\n                    }\n                ]\n            })\n        elif \"Scenario\" in agent_name:\n            return json.dumps({\n                \"scenarios\": [\n                    {\n                        \"id\": \"SC-01\",\n                        \"requirement_id\": \"REQ-01\",\n                        \"title\": \"Successful MFA Authentication\",\n                        \"description\": \"User enters correct password and correct 6-digit TOTP token, successfully landing on the dashboard.\",\n                        \"type\": \"Positive\"\n                    },\n                    {\n                        \"id\": \"SC-02\",\n                        \"requirement_id\": \"REQ-01\",\n                        \"title\": \"Invalid MFA Code Challenge\",\n                        \"description\": \"User enters correct password but incorrect 6-digit TOTP code. Access must be denied with a clear validation message.\",\n                        \"type\": \"Negative\"\n                    },\n                    {\n                        \"id\": \"SC-03\",\n                        \"requirement_id\": \"REQ-02\",\n                        \"title\": \"MFA Rate Limiting and Lockout\",\n                        \"description\": \"User fails MFA 5 times consecutively. Account is locked immediately, and subsequent attempts fail with a security lockout notice.\",\n                        \"type\": \"Boundary\"\n                    }\n                ]\n            })\n        elif \"Generator\" in agent_name:\n            # We return test cases here. Note we purposefully miss REQ-02 account lockout in the first iteration\n            # to let the QA Reviewer agent detect the gap and show off the feedback loop!\n            # If the prompt contains the word \"re-evaluate\" or \"revision\" or feedback, we will provide the complete fixed set.\n            if \"CRITICAL GAP\" in prompt:\n                return json.dumps({\n                    \"test_cases\": [\n                        {\n                            \"id\": \"TC-01\",\n                            \"scenario_id\": \"SC-01\",\n                            \"requirement_id\": \"REQ-01\",\n                            \"name\": \"Verify Successful Login with Valid MFA Code\",\n                            \"preconditions\": \"User has MFA set up. User is on the login MFA prompt screen.\",\n                            \"steps\": \"1. Enter valid 6-digit current TOTP code.\\n2. Click 'Verify'.\",\n                            \"expected_result\": \"User is authenticated and redirected to the dashboard. Session cookie is issued.\",\n                            \"type\": \"Functional\",\n                            \"automation_candidate\": \"Yes\"\n                        },\n                        {\n                            \"id\": \"TC-02\",\n                            \"scenario_id\": \"SC-02\",\n                            \"requirement_id\": \"REQ-01\",\n                            \"name\": \"Verify Login Fails with Incorrect MFA Code\",\n                            \"preconditions\": \"User is on the login MFA prompt screen.\",\n                            \"steps\": \"1. Enter an incorrect 6-digit code (e.g. '000000').\\n2. Click 'Verify'.\",\n                            \"expected_result\": \"Validation error: 'Invalid authentication code. Please try again.' remains on page. User is not logged in.\",\n                            \"type\": \"Negative\",\n                            \"automation_candidate\": \"Yes\"\n                        },\n                        {\n                            \"id\": \"TC-03\",\n                            \"scenario_id\": \"SC-03\",\n                            \"requirement_id\": \"REQ-02\",\n                            \"name\": \"Verify Account Lockout After 5 Failed MFA Attempts\",\n                            \"preconditions\": \"User has completed primary email/password authentication.\",\n                            \"steps\": \"1. Enter incorrect TOTP code 5 times consecutively.\\n2. Attempt a 6th login with correct email, password, and TOTP.\",\n                            \"expected_result\": \"Account is locked. System displays message: 'This account has been temporarily locked due to multiple failed login attempts. Please try again in 15 minutes.'\",\n                            \"type\": \"Security\",\n                            \"automation_candidate\": \"Yes\"\n                        }\n                    ]\n                })\n            else:\n                # Missing TC-03 initially\n                return json.dumps({\n                    \"test_cases\": [\n                        {\n                            \"id\": \"TC-01\",\n                            \"scenario_id\": \"SC-01\",\n                            \"requirement_id\": \"REQ-01\",\n                            \"name\": \"Verify Successful Login with Valid MFA Code\",\n                            \"preconditions\": \"User has MFA set up. User is on the login MFA prompt screen.\",\n                            \"steps\": \"1. Enter valid 6-digit current TOTP code.\\n2. Click 'Verify'.\",\n                            \"expected_result\": \"User is authenticated and redirected to the dashboard. Session cookie is issued.\",\n                            \"type\": \"Functional\",\n                            \"automation_candidate\": \"Yes\"\n                        },\n                        {\n                            \"id\": \"TC-02\",\n                            \"scenario_id\": \"SC-02\",\n                            \"requirement_id\": \"REQ-01\",\n                            \"name\": \"Verify Login Fails with Incorrect MFA Code\",\n                            \"preconditions\": \"User is on the login MFA prompt screen.\",\n                            \"steps\": \"1. Enter an incorrect 6-digit code (e.g. '000000').\\n2. Click 'Verify'.\",\n                            \"expected_result\": \"Validation error: 'Invalid authentication code. Please try again.' remains on page. User is not logged in.\",\n                            \"type\": \"Negative\",\n                            \"automation_candidate\": \"Yes\"\n                        }\n                    ]\n                })\n        elif \"Reviewer\" in agent_name:\n            # Scans for gaps. If we only have TC-01 and TC-02, it will trigger a Gap Found.\n            if \"TC-03\" in prompt:\n                return json.dumps({\n                    \"status\": \"Approved\",\n                    \"feedback\": \"All scenarios covered. Test cases map 1:1 to required security and compliance features.\",\n                    \"gaps_found\": []\n                })\n            else:\n                return json.dumps({\n                    \"status\": \"Rejected\",\n                    \"feedback\": \"CRITICAL GAP: Scenario SC-03 (Account Lockout Rate Limiting for SOC2 CC6.3 Compliance) has no corresponding test cases in the suite. Security requirements are vulnerable to brute-force simulation tests. Re-evaluation required.\",\n                    \"gaps_found\": [\n                        {\n                            \"severity\": \"High\",\n                            \"description\": \"Scenario SC-03 'MFA Rate Limiting and Lockout' is missing a verification script. This fails SOC2 compliance standards.\",\n                            \"recommendation\": \"Add a dedicated TC-03 security test case to verify immediate locking of account for 15 minutes after 5 consecutive failures.\"\n                        }\n                    ]\n                })\n        elif \"Traceability\" in agent_name:\n            return json.dumps({\n                \"traceability_score\": 100.0,\n                \"mappings\": [\n                    {\"requirement_id\": \"REQ-01\", \"scenario_ids\": [\"SC-01\", \"SC-02\"], \"test_case_ids\": [\"TC-01\", \"TC-02\"]},\n                    {\"requirement_id\": \"REQ-02\", \"scenario_ids\": [\"SC-03\"], \"test_case_ids\": [\"TC-03\"]}\n                ],\n                \"uncovered_requirements\": []\n            })\n\n        return \"{}\"\n\nclass AgentFactory:\n    \"\"\"Manages creation, registry, and execution of config-driven DynamicAgents.\"\"\"\n    def __init__(self, compliance_guard: ComplianceGuard, cache: LocalSemanticCache):\n        self.compliance_guard = compliance_guard\n        self.cache = cache\n        self.registry: Dict[str, AgentDefinition] = {}\n\n    def register_agent(self, name: str, definition: AgentDefinition) -> None:\n        self.registry[name] = definition\n\n    def get_agent(self, name: str) -> DynamicAgent:\n        if name not in self.registry:\n            raise ValueError(f\"Agent '{name}' is not registered in the Factory.\")\n        return DynamicAgent(self.registry[name], self.compliance_guard, self.cache)\n", "orchestrator": "from typing import Dict, Any, List\nfrom src.factory import AgentFactory\n\nclass QAStateGraphOrchestrator:\n    \"\"\"\n    State Graph / Flow Engine that coordinates the dynamic agents.\n    Supports complex execution loops (e.g., looping back to Generator\n    when Reviewer flags a quality gap).\n    \"\"\"\n    def __init__(self, factory: AgentFactory):\n        self.factory = factory\n        # Logs to display in our interactive terminal simulator\n        self.execution_logs: List[Dict[str, Any]] = []\n\n    def log(self, step: str, message: str, status: str = \"INFO\"):\n        self.execution_logs.append({\n            \"step\": step,\n            \"message\": message,\n            \"status\": status\n        })\n        print(f\"[{status}] {step}: {message}\")\n\n    def run_pipeline(self, initial_story: Dict[str, Any]) -> Dict[str, Any]:\n        self.execution_logs.clear()\n        context = {\"story\": initial_story}\n\n        # 1. Retrieve Requirements\n        self.log(\"Retrieval\", \"Querying Project Knowledge Base for requirement artifacts...\", \"INFO\")\n        retriever = self.factory.get_agent(\"Requirement_Retriever\")\n        retrieval_res = retriever.execute({\"story\": context[\"story\"]})\n        context[\"requirements\"] = retrieval_res[\"response\"][\"requirements\"]\n        self.log(\"Retrieval\", f\"Retrieved {len(context['requirements'])} detailed business/compliance requirements.\", \"SUCCESS\")\n\n        # 2. Generate Scenarios\n        self.log(\"Scenario_Gen\", \"Formulating test scenarios (Positive, Negative, Boundary)...\", \"INFO\")\n        scenario_agent = self.factory.get_agent(\"Scenario_Generator\")\n        scenarios_res = scenario_agent.execute({\"requirements\": context[\"requirements\"]})\n        context[\"scenarios\"] = scenarios_res[\"response\"][\"scenarios\"]\n        self.log(\"Scenario_Gen\", f\"Compiled {len(context['scenarios'])} distinct logical test scenarios.\", \"SUCCESS\")\n\n        # 3. Generate Test Cases (Iteration 1)\n        self.log(\"Test_Case_Gen\", \"Drafting structured step-by-step test cases...\", \"INFO\")\n        test_gen_agent = self.factory.get_agent(\"Test_Case_Generator\")\n        test_cases_res = test_gen_agent.execute({\"scenarios\": context[\"scenarios\"]})\n        context[\"test_cases\"] = test_cases_res[\"response\"][\"test_cases\"]\n        self.log(\"Test_Case_Gen\", f\"Generated {len(context['test_cases'])} initial test cases.\", \"WARNING\")\n\n        # 4. QA Reviewer & Gap Detector Loop\n        max_loops = 2\n        loop_count = 0\n        while loop_count < max_loops:\n            self.log(\"QA_Reviewer\", f\"Running gap detector / compliance audit (Iteration {loop_count+1})...\", \"INFO\")\n            reviewer_agent = self.factory.get_agent(\"QA_Reviewer\")\n            review_res = reviewer_agent.execute({\n                \"requirements\": context[\"requirements\"],\n                \"scenarios\": context[\"scenarios\"],\n                \"test_cases\": context[\"test_cases\"]\n            })\n\n            review_data = review_res[\"response\"]\n\n            if review_data.get(\"status\") == \"Approved\":\n                self.log(\"QA_Reviewer\", \"Compliance Audit passed. Zero coverage gaps identified.\", \"SUCCESS\")\n                context[\"review_report\"] = review_data\n                break\n            else:\n                self.log(\"QA_Reviewer\", f\"GAP DETECTED: {review_data.get('feedback')}\", \"ERROR\")\n                loop_count += 1\n                if loop_count >= max_loops:\n                    self.log(\"QA_Reviewer\", \"Max repair iterations reached. Moving forward with minor warnings.\", \"WARNING\")\n                    context[\"review_report\"] = review_data\n                    break\n\n                # LOOP BACK / SELF-CORRECTION\n                self.log(\"Test_Case_Gen\", \"LOOP-BACK TRIGGERED: Re-routing feedback to Test Case Generator...\", \"WARNING\")\n                test_cases_res = test_gen_agent.execute({\n                    \"scenarios\": context[\"scenarios\"],\n                    \"feedback\": review_data[\"feedback\"],\n                    \"gaps\": review_data[\"gaps_found\"]\n                })\n                context[\"test_cases\"] = test_cases_res[\"response\"][\"test_cases\"]\n                self.log(\"Test_Case_Gen\", f\"Self-corrected test suite compiled. Total test cases now: {len(context['test_cases'])}.\", \"SUCCESS\")\n\n        # 5. Traceability Matrix Validation\n        self.log(\"Traceability\", \"Building bi-directional traceability graph...\", \"INFO\")\n        trace_agent = self.factory.get_agent(\"Traceability_Validator\")\n        trace_res = trace_agent.execute({\n            \"requirements\": context[\"requirements\"],\n            \"scenarios\": context[\"scenarios\"],\n            \"test_cases\": context[\"test_cases\"]\n        })\n        context[\"traceability\"] = trace_res[\"response\"]\n\n        # Inject additional relationships for mapping output\n        from src.traceability import TraceabilityMatrix\n        matrix = TraceabilityMatrix.compute_matrix(\n            context[\"requirements\"],\n            context[\"scenarios\"],\n            context[\"test_cases\"]\n        )\n        context[\"traceability\"].update(matrix)\n        self.log(\"Traceability\", f\"Traceability validated successfully. Coverage: {context['traceability'].get('traceability_score')}%\", \"SUCCESS\")\n\n        return context\n", "traceability": "from typing import List, Dict, Any\n\nclass TraceabilityMatrix:\n    \"\"\"\n    Validates coverage between requirements, scenarios, and test cases.\n    Ensures zero dangling requirements or untraced scenarios.\n    \"\"\"\n    @staticmethod\n    def compute_matrix(requirements: List[Dict[str, Any]], \n                       scenarios: List[Dict[str, Any]], \n                       test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:\n\n        req_to_scenarios = {r[\"id\"]: [] for r in requirements}\n        sc_to_test_cases = {s[\"id\"]: [] for s in scenarios}\n        req_to_test_cases = {r[\"id\"]: [] for r in requirements}\n\n        # Map Scenarios to Requirements\n        for sc in scenarios:\n            req_id = sc.get(\"requirement_id\")\n            if req_id in req_to_scenarios:\n                req_to_scenarios[req_id].append(sc[\"id\"])\n\n        # Map Test Cases to Scenarios and Requirements\n        for tc in test_cases:\n            sc_id = tc.get(\"scenario_id\")\n            req_id = tc.get(\"requirement_id\")\n\n            if sc_id in sc_to_test_cases:\n                sc_to_test_cases[sc_id].append(tc[\"id\"])\n            if req_id in req_to_test_cases:\n                req_to_test_cases[req_id].append(tc[\"id\"])\n\n        # Identify gaps\n        uncovered_requirements = []\n        for req_id, tcs in req_to_test_cases.items():\n            if not tcs:\n                uncovered_requirements.append(req_id)\n\n        uncovered_scenarios = []\n        for sc_id, tcs in sc_to_test_cases.items():\n            if not tcs:\n                uncovered_scenarios.append(sc_id)\n\n        total_reqs = len(requirements)\n        covered_reqs = total_reqs - len(uncovered_requirements)\n        coverage_score = (covered_reqs / total_reqs * 100) if total_reqs > 0 else 100.0\n\n        return {\n            \"traceability_score\": coverage_score,\n            \"req_to_scenarios_map\": req_to_scenarios,\n            \"sc_to_test_cases_map\": sc_to_test_cases,\n            \"uncovered_requirements\": uncovered_requirements,\n            \"uncovered_scenarios\": uncovered_scenarios\n        }\n", "exporter": "import os\nimport pandas as pd\nfrom typing import Dict, Any, List\n\nclass SpreadsheetExporter:\n    \"\"\"\n    Exports the generated test engineering artifacts (Requirements, Scenarios, \n    Test Cases, and Traceability) to a production-grade multi-sheet Excel file.\n    Follows Gumloop spreadsheet-output rules strictly:\n    - Unique column headers in row 1, no titles/metadata, no blank rows.\n    \"\"\"\n    @staticmethod\n    def export_to_excel(pipeline_output: Dict[str, Any], filepath: str) -> str:\n        # Create separate DataFrames for each Sheet\n\n        # 1. Requirements Sheet\n        req_rows = []\n        for r in pipeline_output[\"requirements\"]:\n            req_rows.append({\n                \"Requirement ID\": r[\"id\"],\n                \"Title\": r[\"title\"],\n                \"Description\": r[\"description\"],\n                \"Criticality\": r[\"criticality\"],\n                \"Compliance Standards\": \", \".join(r.get(\"compliance_tags\", []))\n            })\n        df_req = pd.DataFrame(req_rows)\n\n        # 2. Scenarios Sheet\n        sc_rows = []\n        for s in pipeline_output[\"scenarios\"]:\n            sc_rows.append({\n                \"Scenario ID\": s[\"id\"],\n                \"Requirement ID\": s[\"requirement_id\"],\n                \"Title\": s[\"title\"],\n                \"Description\": s[\"description\"],\n                \"Type\": s[\"type\"]\n            })\n        df_sc = pd.DataFrame(sc_rows)\n\n        # 3. Test Cases Sheet\n        tc_rows = []\n        for t in pipeline_output[\"test_cases\"]:\n            tc_rows.append({\n                \"Test Case ID\": t[\"id\"],\n                \"Scenario ID\": t[\"scenario_id\"],\n                \"Requirement ID\": t[\"requirement_id\"],\n                \"Test Case Name\": t[\"name\"],\n                \"Preconditions\": t[\"preconditions\"],\n                \"Execution Steps\": t[\"steps\"],\n                \"Expected Result\": t[\"expected_result\"],\n                \"Type\": t[\"type\"],\n                \"Automation Candidate\": t[\"automation_candidate\"]\n            })\n        df_tc = pd.DataFrame(tc_rows)\n\n        # 4. Traceability Summary Sheet\n        trace_data = pipeline_output[\"traceability\"]\n        trace_rows = []\n        for req_id, sc_ids in trace_data.get(\"req_to_scenarios_map\", {}).items():\n            # Find related test cases\n            tc_ids = []\n            for tc in pipeline_output[\"test_cases\"]:\n                if tc[\"requirement_id\"] == req_id:\n                    tc_ids.append(tc[\"id\"])\n\n            trace_rows.append({\n                \"Requirement ID\": req_id,\n                \"Associated Scenarios\": \", \".join(sc_ids),\n                \"Associated Test Cases\": \", \".join(tc_ids),\n                \"Coverage Status\": \"Fully Covered\" if tc_ids else \"Gap Identified\"\n            })\n        df_trace = pd.DataFrame(trace_rows)\n\n        # Write to Excel with multiple sheets using ExcelWriter\n        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:\n            df_req.to_excel(writer, sheet_name=\"Requirements\", index=False)\n            df_sc.to_excel(writer, sheet_name=\"Test Scenarios\", index=False)\n            df_tc.to_excel(writer, sheet_name=\"Test Cases\", index=False)\n            df_trace.to_excel(writer, sheet_name=\"Traceability Matrix\", index=False)\n\n            # Optional: Format spreadsheet using openpyxl for clean styling\n            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side\n\n            workbook = writer.book\n            header_font = Font(name=\"Segoe UI\", size=11, bold=True, color=\"FFFFFF\")\n            header_fill = PatternFill(start_color=\"1F2937\", end_color=\"1F2937\", fill_type=\"solid\") # Charcoal Theme\n            cell_font = Font(name=\"Segoe UI\", size=10)\n            thin_border = Border(\n                left=Side(style='thin', color='E5E7EB'),\n                right=Side(style='thin', color='E5E7EB'),\n                top=Side(style='thin', color='E5E7EB'),\n                bottom=Side(style='thin', color='E5E7EB')\n            )\n\n            for sheet_name in workbook.sheetnames:\n                ws = workbook[sheet_name]\n                ws.auto_filter.ref = ws.dimensions\n                ws.row_dimensions[1].height = 26\n\n                for col_idx in range(1, ws.max_column + 1):\n                    cell = ws.cell(row=1, column=col_idx)\n                    cell.font = header_font\n                    cell.fill = header_fill\n                    cell.alignment = Alignment(horizontal=\"left\", vertical=\"center\", wrap_text=True)\n\n                for row in range(2, ws.max_row + 1):\n                    ws.row_dimensions[row].height = 20\n                    for col in range(1, ws.max_column + 1):\n                        cell = ws.cell(row=row, column=col)\n                        cell.font = cell_font\n                        cell.border = thin_border\n                        cell.alignment = Alignment(vertical=\"center\", wrap_text=True)\n\n                for col in ws.columns:\n                    max_len = 0\n                    col_letter = col[0].column_letter\n                    for cell in col:\n                        val = str(cell.value or '')\n                        if '\\n' in val:\n                            lines = val.split('\\n')\n                            max_len = max(max_len, max(len(l) for l in lines))\n                        else:\n                            max_len = max(max_len, len(val))\n                    ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 40)\n\n            workbook.save(filepath)\n        return filepath\n", "demo": "import os\nimport sys\n\n# Ensure parent directory is in python path\nsys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))\n\nfrom src.compliance import ComplianceGuard, LocalSemanticCache\nfrom src.factory import AgentFactory, AgentDefinition\nfrom src.orchestrator import QAStateGraphOrchestrator\nfrom src.exporter import SpreadsheetExporter\n\ndef run_demo():\n    print(\"====================================================\")\n    print(\"   QA AGENT FACTORY - RUNNABLE PROTOTYPE DEMO       \")\n    print(\"====================================================\")\n\n    # 1. Initialize Compliance Guard and Cache\n    compliance_guard = ComplianceGuard()\n    cache = LocalSemanticCache()\n\n    # 2. Initialize Agent Factory\n    factory = AgentFactory(compliance_guard, cache)\n\n    # 3. Register Agents dynamically via Configuration (Zero hardcoding of agent classes)\n    factory.register_agent(\"Requirement_Retriever\", AgentDefinition(\n        name=\"Requirement_Retriever\",\n        role=\"Extracts detailed product, functional, security, and compliance requirements from raw project specs.\",\n        system_prompt_template=\"\"\"You are an expert Requirements Engineer Agent. \nRetrieve and structure functional requirements, security standards, and compliance criteria based on the input story.\nSTORY DEFINITION:\n{{story}}\n\nReturn a structured JSON output with the schema:\n{\n  \"requirements\": [\n    { \"id\": \"REQ-XX\", \"title\": \"...\", \"description\": \"...\", \"criticality\": \"...\", \"compliance_tags\": [\"...\"] }\n  ]\n}\"\"\"\n    ))\n\n    factory.register_agent(\"Scenario_Generator\", AgentDefinition(\n        name=\"Scenario_Generator\",\n        role=\"Translates system requirements into a comprehensive list of logical test scenarios.\",\n        system_prompt_template=\"\"\"You are a Lead QA Planner Agent.\nTranslate the following system and compliance requirements into a complete list of test scenarios.\nEnsure you cover Positive cases, Negative failure scenarios, and Boundary limit cases.\nREQUIREMENTS:\n{{requirements}}\n\nReturn a structured JSON output with the schema:\n{\n  \"scenarios\": [\n    { \"id\": \"SC-XX\", \"requirement_id\": \"REQ-XX\", \"title\": \"...\", \"description\": \"...\", \"type\": \"Positive|Negative|Boundary\" }\n  ]\n}\"\"\"\n    ))\n\n    factory.register_agent(\"Test_Case_Generator\", AgentDefinition(\n        name=\"Test_Case_Generator\",\n        role=\"Converts logical test scenarios into formal, step-by-step test cases.\",\n        system_prompt_template=\"\"\"You are an expert QA Test Designer Agent.\nWrite step-by-step test cases for each logical scenario.\nIf QA Reviewer feedback is provided, you must REVISE the suite to resolve gaps.\nSCENARIOS:\n{{scenarios}}\n\nFEEDBACK / REVISION REQUEST (Optional):\n{{feedback}}\n\nReturn a structured JSON output with the schema:\n{\n  \"test_cases\": [\n    { \"id\": \"TC-XX\", \"scenario_id\": \"SC-XX\", \"requirement_id\": \"REQ-XX\", \"name\": \"...\", \"preconditions\": \"...\", \"steps\": \"...\", \"expected_result\": \"...\", \"type\": \"...\", \"automation_candidate\": \"Yes|No\" }\n  ]\n}\"\"\"\n    ))\n\n    factory.register_agent(\"QA_Reviewer\", AgentDefinition(\n        name=\"QA_Reviewer\",\n        role=\"Audits test cases against requirements and compliance criteria to ensure 100% coverage.\",\n        system_prompt_template=\"\"\"You are a Critical Principal QA Inspector Agent.\nReview the test cases against the required scenarios and compliance standards.\nIdentify any gaps, missing edge cases, or security standards that lack sufficient validation.\nREQUIREMENTS:\n{{requirements}}\nSCENARIOS:\n{{scenarios}}\nTEST_CASES:\n{{test_cases}}\n\nIf gaps exist, reject the suite (status: 'Rejected') and outline precise feedback.\nIf fully covered, approve (status: 'Approved').\nReturn structured JSON schema:\n{\n  \"status\": \"Approved|Rejected\",\n  \"feedback\": \"...\",\n  \"gaps_found\": [\n    { \"severity\": \"High|Medium\", \"description\": \"...\", \"recommendation\": \"...\" }\n  ]\n}\"\"\"\n    ))\n\n    factory.register_agent(\"Traceability_Validator\", AgentDefinition(\n        name=\"Traceability_Validator\",\n        role=\"Computes and validates the bi-directional coverage matrix.\",\n        system_prompt_template=\"\"\"You are a Compliance & Traceability Auditor Agent.\nCompute the bi-directional trace matrix between requirements, scenarios, and test cases.\nREQUIREMENTS:\n{{requirements}}\nSCENARIOS:\n{{scenarios}}\nTEST_CASES:\n{{test_cases}}\n\nReturn structured JSON schema:\n{\n  \"traceability_score\": 100.0,\n  \"mappings\": [\n    { \"requirement_id\": \"REQ-XX\", \"scenario_ids\": [\"SC-XX\"], \"test_case_ids\": [\"TC-XX\"] }\n  ],\n  \"uncovered_requirements\": []\n}\"\"\"\n    ))\n\n    # 4. Instantiate and execute the State Graph Orchestrator\n    orchestrator = QAStateGraphOrchestrator(factory)\n\n    # Input user story with a PII variable included to show compliance filtering\n    mfa_story = {\n        \"title\": \"Multi-Factor Authentication (MFA) Login Prompt\",\n        \"scope\": \"Add a secondary TOTP security layer during user login. Designed for customer Silly Squad at secure endpoint sillysquad077@gmail.com with deployment IP 192.168.1.50 and db_password='SecretMFA123!'.\",\n        \"compliance_targets\": [\"SOC2-CC6.1\", \"SOC2-CC6.3\", \"ISO27001-A.9.4.2\"]\n    }\n\n    # Run Orchestrator Pipeline\n    print(f\"\\n--- Starting Orchestrator for Story: '{mfa_story['title']}' ---\")\n    results = orchestrator.run_pipeline(mfa_story)\n\n    # 5. Export results to spreadsheet\n    export_path = \"/home/user/qa_agent_factory/MFA_Test_Suite_Export.xlsx\"\n    SpreadsheetExporter.export_to_excel(results, export_path)\n    print(f\"\\n--- Success! Multi-sheet formatted Excel report exported to: '{export_path}' ---\")\n\nif __name__ == \"__main__\":\n    run_demo()\n"};

// Active Tab state
let activeTab = 'blueprint';

// Active Spec Node state
let activeNode = 'kb';

// Specs configurations
const NODE_SPECS = {
  kb: {
    title: "Project Knowledge Base",
    subtitle: "Data Source",
    type: "DATA SOURCE",
    badgeClass: "bg-slate-900 border-slate-800 text-slate-400",
    desc: "A unified ingestion repository containing unstructured specifications, technical requirements, Jira user stories, API definitions, and compliance/ISO manuals. It acts as the ground truth database for test validation.",
    config: '{\n  "source": "knowledge_base",\n  "ingested_entities": ["Jira", "Wikis", "Swagger/OpenAPI"],\n  "chunk_size": 1024,\n  "overlap": 128\n}',
    code: "// Simulated Knowledge Base Entity Structure\nclass KnowledgeBase:\n    def __init__(self, workspace_id: str):\n        self.workspace_id = workspace_id\n        self.documents = []\n        \n    def ingest(self, raw_text: str, category: str):\n        self.documents.append({\n            'text': raw_text,\n            'category': category\n        })",
    input: "Raw project descriptions, email scopes, Jira epics, OpenAPI specs.",
    output: "Tokenized, chunked, and semantic-vector-indexed business artifacts."
  },
  retriever: {
    title: "Requirement Retriever",
    subtitle: "Agent Configuration",
    type: "DYNAMIC AGENT",
    badgeClass: "bg-teal-500/10 border-teal-500/20 text-teal-400",
    desc: "Queries the vector knowledge base using hybrid retrieval (BM25 + Dense Embeddings) and compiles business expectations, functional boundaries, security compliance levels, and SLA requirements.",
    config: '{\n  "name": "Requirement_Retriever",\n  "role": "Requirements Engineer",\n  "model": "qwen2.5-coder-7b-local",\n  "temperature": 0.1,\n  "tools": ["hybrid_vector_search", "jira_sync_api"]\n}',
    code: "// Prompt Template compiled dynamically from template metadata\nREQUIREMENTS_PROMPT_TEMPLATE = \"\"\"\nExtract and structure functional requirements and compliance tags.\nSTORY: {{{{story}}}}\n\"\"\"\nretriever = factory.get_agent(\"Requirement_Retriever\")\nresults = retriever.execute({\"story\": mfa_story})",
    input: "Anonymized User Story Context from Compliance Guard.",
    output: "JSON-structured requirement list with compliance ID mappings (e.g. SOC2, ISO27001)."
  },
  scenario: {
    title: "Scenario Generator",
    subtitle: "Agent Configuration",
    type: "DYNAMIC AGENT",
    badgeClass: "bg-teal-500/10 border-teal-500/20 text-teal-400",
    desc: "Formulates a complete topological map of test scenarios. It breaks requirements into positive authentication scenarios, negative error-handling scenarios, and edge/boundary limits.",
    config: '{\n  "name": "Scenario_Generator",\n  "role": "Lead Test Planner",\n  "model": "llama3-8b-local",\n  "temperature": 0.2,\n  "tools": []\n}',
    code: "// Scenario compilation prompt\nSCENARIO_PROMPT_TEMPLATE = \"\"\"\nTranslate requirements to distinct test scenarios.\nREQUIREMENTS: {{{{requirements}}}}\n\"\"\"\nscenario_agent = factory.get_agent(\"Scenario_Generator\")\nscenarios = scenario_agent.execute({\"requirements\": requirements})",
    input: "Analyzed Requirements JSON.",
    output: "Topological Scenario Matrix containing Positive, Negative, and Boundary schemas."
  },
  generator: {
    title: "Test Case Generator",
    subtitle: "Agent Configuration",
    type: "DYNAMIC AGENT",
    badgeClass: "bg-teal-500/10 border-teal-500/20 text-teal-400",
    desc: "Transforms logical scenarios into complete, formal test cases with step-by-step actions, precise pre-conditions, and deterministic expected outcomes. Supports prompt revision to fix identified gaps.",
    config: '{\n  "name": "Test_Case_Generator",\n  "role": "Senior Test Automation Writer",\n  "model": "qwen2.5-coder-7b-local",\n  "temperature": 0.2,\n  "tools": []\n}',
    code: "TEST_GEN_PROMPT = \"\"\"\nWrite step-by-step test cases. If feedback is present, REVISE the suite.\nSCENARIOS: {{{{scenarios}}}}\nFEEDBACK: {{{{feedback}}}}\n\"\"\"\ntest_agent = factory.get_agent(\"Test_Case_Generator\")\ntc_results = test_agent.execute({\"scenarios\": scenarios, \"feedback\": feedback})",
    input: "Scenarios list + iterative review feedback comments (if loopback active).",
    output: "Formally described, detailed structural validation test suite."
  },
  reviewer: {
    title: "QA Reviewer / Gap Auditor",
    subtitle: "Agent Configuration",
    type: "DYNAMIC AGENT",
    badgeClass: "bg-teal-500/10 border-teal-500/20 text-teal-400",
    desc: "An independent validation agent that cross-checks generated test cases against original requirements and compliance standard definitions. If edge cases are missing, it issues a 'Rejected' status with repair directives.",
    config: '{\n  "name": "QA_Reviewer",\n  "role": "Principal QA Architect & Compliance Auditor",\n  "model": "llama3-70b-local",\n  "temperature": 0.1,\n  "tools": ["compliance_rules_library"]\n}',
    code: "REVIEWER_PROMPT = \"\"\"\nReview the test suite against compliance criteria.\nREQUIREMENTS: {{{{requirements}}}}\nTEST_CASES: {{{{test_cases}}}}\n\"\"\"\nreviewer = factory.get_agent(\"QA_Reviewer\")\naudit = reviewer.execute({\"requirements\": reqs, \"test_cases\": tcs})",
    input: "Original Requirements + Compiled Test Cases.",
    output: "Status (Approved/Rejected) + Structured Gap Details (severity, recommendations)."
  },
  trace: {
    title: "Traceability Validator",
    subtitle: "Graph Mapping Engine",
    type: "VALIDATION ENGINE",
    badgeClass: "bg-slate-900 border-slate-800 text-slate-400",
    desc: "Constructs a mathematical bi-directional graph mapping Requirements <-> Scenarios <-> Test Cases. Calculates actual logical test coverage percentage and flags uncovered business vectors.",
    config: '{\n  "engine": "graph_coverage_evaluator",\n  "bidirectional": true,\n  "strict_mode": true,\n  "coverage_threshold": 100.0\n}',
    code: "class TraceabilityMatrix:\n    @staticmethod\n    def compute_matrix(requirements, scenarios, test_cases):\n        # Map Requirements -> Scenarios -> Test Cases\n        # Identify and list unmapped requirements\n        return {\n            'traceability_score': coverage_score,\n            'req_to_scenarios_map': req_map,\n            'sc_to_test_cases_map': sc_map\n        }",
    input: "All intermediate pipeline execution outputs.",
    output: "Bi-directional mapping matrices, gaps identified list, coverage percentage score."
  },
  export: {
    title: "Spreadsheet Exporter",
    subtitle: "Output Format Service",
    type: "OUTPUT GENERATOR",
    badgeClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    desc: "Formats and structures the final validated engineering suite into an industry-standard multi-sheet Excel file complying with the Gumloop Spreadsheet Output specification. Ready for import into Jira, TestRail, or Zephyr.",
    config: '{\n  "engine": "openpyxl",\n  "sheets": ["Requirements", "Test Scenarios", "Test Cases", "Traceability Matrix"],\n  "auto_filter": true,\n  "auto_adjust_columns": true\n}',
    code: "class SpreadsheetExporter:\n    @staticmethod\n    def export_to_excel(pipeline_output, filepath):\n        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:\n            df_req.to_excel(writer, sheet_name='Requirements', index=False)\n            df_sc.to_excel(writer, sheet_name='Test Scenarios', index=False)\n            df_tc.to_excel(writer, sheet_name='Test Cases', index=False)\n            df_trace.to_excel(writer, sheet_name='Traceability Matrix', index=False)",
    input: "Validated, fully trace-verified test suite structures.",
    output: "Production-grade, styled, and multi-sheet formatted XLSX file."
  }
};

// Switch tab handler
window.switchTab = function (tabId) {
  activeTab = tabId;
  const tabs = ['blueprint', 'simulator', 'repo', 'knowledgebase'];
  tabs.forEach(t => {
    const tabEl = document.getElementById('tab-' + t);
    const btnEl = document.getElementById('tab-btn-' + t);
    if (t === tabId) {
      tabEl.classList.remove('hidden');
      btnEl.classList.add('tab-active');
      btnEl.classList.remove('tab-inactive');
    } else {
      tabEl.classList.add('hidden');
      btnEl.classList.remove('tab-active');
      btnEl.classList.add('tab-inactive');
    }
  });
};

// Switch Node handler
window.selectNode = function (nodeId) {
  // Reset previous node styles unless it is simulated state
  const nodes = ['kb', 'retriever', 'scenario', 'generator', 'reviewer', 'trace', 'export'];
  nodes.forEach(n => {
    const el = document.getElementById('node-' + n);
    if (el) {
      // Reset to inactive if not active
      if (n === nodeId) {
        el.classList.add('node-active');
        el.classList.remove('node-inactive');
      } else {
        el.classList.add('node-inactive');
        el.classList.remove('node-active');
      }
    }
  });

  // Update Specs Pane
  activeNode = nodeId;
  const spec = NODE_SPECS[nodeId];
  document.getElementById('pane-title').innerText = spec.title.toUpperCase();
  document.getElementById('pane-subtitle').innerText = spec.subtitle;
  document.getElementById('pane-desc').innerText = spec.desc;
  document.getElementById('pane-config-json').innerText = spec.config;
  document.getElementById('pane-code').innerText = spec.code;
  document.getElementById('pane-input').innerText = spec.input;
  document.getElementById('pane-output').innerText = spec.output;

  // Set type badge class
  const typeBadge = document.getElementById('pane-type-badge');
  typeBadge.innerText = spec.type;
  typeBadge.className = "text-[9px] uppercase font-bold px-2.5 py-1 border rounded " + spec.badgeClass;
};

// View source code in repo tab
window.viewRepoCode = function (fileId) {
  const files = ['compliance', 'factory', 'orchestrator', 'traceability', 'exporter', 'demo', 'blueprint'];
  files.forEach(f => {
    const el = document.getElementById('code-btn-' + f);
    if (el) {
      if (f === fileId) {
        el.classList.add('bg-slate-800', 'text-white');
        el.classList.remove('text-slate-300');
      } else {
        el.classList.remove('bg-slate-800', 'text-white');
        el.classList.add('text-slate-300');
      }
    }
  });

  let filepath = "";
  if (fileId === "blueprint") {
    filepath = "/home/user/qa_agent_factory/ARCH_BLUEPRINT.md";
  } else {
    filepath = "/home/user/qa_agent_factory/src/" + fileId + ".py";
    if (fileId === "demo") filepath = "/home/user/qa_agent_factory/src/demo.py";
  }

  document.getElementById('repo-filepath').innerText = filepath;
  document.getElementById('repo-code-viewer').innerText = SOURCE_REPOSITORY[fileId];
};

// Copy code action
window.copyRepoCode = function () {
  const fileId = document.querySelector('[id^="code-btn-"].bg-slate-800').id.replace('code-btn-', '');
  const code = SOURCE_REPOSITORY[fileId];
  navigator.clipboard.writeText(code).then(() => {
    alert("Copied to clipboard!");
  });
};

// Simulated loop logs matching our successful demo execution
const SIMULATION_LOGS = [
  { node: 'retriever', type: 'INFO', text: "Querying Project Knowledge Base for requirement artifacts..." },
  { node: 'retriever', type: 'SUCCESS', text: "Retrieved 2 detailed business/compliance requirements:" },
  { node: 'retriever', type: 'DATA', text: "➔ REQ-01: MFA Challenge Verification (SOC2-CC6.1)\n➔ REQ-02: Account Lockout Rate Limiting (SOC2-CC6.3)" },
  { node: 'scenario', type: 'INFO', text: "Formulating logical test scenarios (Positive, Negative, Boundary)..." },
  { node: 'scenario', type: 'SUCCESS', text: "Compiled 3 distinct logical test scenarios:" },
  { node: 'scenario', type: 'DATA', text: "➔ SC-01 (Positive): Successful MFA Authentication\n➔ SC-02 (Negative): Invalid MFA Code Challenge\n➔ SC-03 (Boundary): MFA Rate Limiting and Lockout" },
  { node: 'generator', type: 'INFO', text: "Drafting structured step-by-step test cases..." },
  { node: 'generator', type: 'WARNING', text: "Generated 2 initial test cases." },
  { node: 'generator', type: 'DATA', text: "➔ TC-01 maps to SC-01 (Positive Case)\n➔ TC-02 maps to SC-02 (Negative Case)\n✖ Warning: SC-03 has no test case mapping initially." },
  { node: 'reviewer', type: 'INFO', text: "Running gap detector / compliance audit (Iteration 1)..." },
  { node: 'reviewer', type: 'ERROR', text: "GAP DETECTED: CRITICAL GAP: Scenario SC-03 (Account Lockout Rate Limiting for SOC2 CC6.3 Compliance) has no corresponding test cases in the suite. Security requirements are vulnerable to brute-force simulation tests. Re-evaluation required." },
  { node: 'generator', type: 'WARNING', text: "LOOP-BACK TRIGGERED: Re-routing feedback to Test Case Generator..." },
  { node: 'generator', type: 'SUCCESS', text: "Self-corrected test suite compiled. Total test cases now: 3." },
  { node: 'generator', type: 'DATA', text: "➔ Added TC-03: Verify Account Lockout After 5 Failed MFA Attempts" },
  { node: 'reviewer', type: 'INFO', text: "Running gap detector / compliance audit (Iteration 2)..." },
  { node: 'reviewer', type: 'SUCCESS', text: "Compliance Audit passed. Zero coverage gaps identified." },
  { node: 'trace', type: 'INFO', text: "Building bi-directional traceability graph..." },
  { node: 'trace', type: 'SUCCESS', text: "Traceability validated successfully. Coverage: 100.0%" },
  { node: 'export', type: 'INFO', text: "Compiling workbook sheets and formatting design templates..." },
  { node: 'export', type: 'SUCCESS', text: "Excel workbook compiled and styled with Auto-Filters. File saved to MFA_Test_Suite_Export.xlsx" }
];

let simRunning = false;

window.runSimulation = function () {
  if (simRunning) return;
  simRunning = true;

  const consoleEl = document.getElementById('sim-logs');
  const runBtn = document.getElementById('run-btn');
  const statusEl = document.getElementById('sim-status');
  const exportBox = document.getElementById('sim-export-box');
  const reviewerBadge = document.getElementById('reviewer-badge');
  const piiChecked = document.getElementById('config-pii').checked;
  const selectedLLM = document.getElementById('config-llm').value;

  // Clear console
  consoleEl.innerHTML = "";
  exportBox.classList.add('hidden');
  reviewerBadge.className = "hidden";
  runBtn.disabled = true;
  runBtn.classList.add('opacity-50', 'cursor-not-allowed');
  statusEl.innerText = "RUNNING";
  statusEl.className = "text-[10px] font-bold text-teal-400 uppercase pulse-active";

  // Reset all node colors to inactive
  const nodes = ['kb', 'retriever', 'scenario', 'generator', 'reviewer', 'trace', 'export'];
  nodes.forEach(n => {
    const el = document.getElementById('node-' + n);
    if (el) el.className = "p-3.5 rounded-xl border transition-all cursor-pointer node-inactive flex items-center justify-between";
  });

  let stepIdx = 0;

  function renderStep() {
    if (stepIdx >= SIMULATION_LOGS.length) {
      // Finished
      statusEl.innerText = "SUCCESS";
      statusEl.className = "text-[10px] font-bold text-emerald-400 uppercase";
      runBtn.disabled = false;
      runBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      simRunning = false;
      exportBox.classList.remove('hidden');

      // Flash final export node as success
      const exportNode = document.getElementById('node-export');
      if (exportNode) exportNode.className = "p-3.5 rounded-xl border transition-all cursor-pointer node-success flex items-center justify-between";
      return;
    }

    const step = SIMULATION_LOGS[stepIdx];

    // Highlight active node
    nodes.forEach(n => {
      const el = document.getElementById('node-' + n);
      if (el) {
        if (n === step.node) {
          if (step.type === "SUCCESS") el.className = "p-3.5 rounded-xl border transition-all cursor-pointer node-success flex items-center justify-between pulse-active";
          else if (step.type === "WARNING") el.className = "p-3.5 rounded-xl border transition-all cursor-pointer node-warning flex items-center justify-between pulse-active";
          else if (step.type === "ERROR") el.className = "p-3.5 rounded-xl border transition-all cursor-pointer node-error flex items-center justify-between pulse-active";
          else el.className = "p-3.5 rounded-xl border transition-all cursor-pointer node-active flex items-center justify-between pulse-active";
        } else {
          // Keep completed nodes as success
          if (nodes.indexOf(n) < nodes.indexOf(step.node)) {
            // Reviewer might show warning initially
            if (n === 'reviewer' && stepIdx < 14) {
              el.className = "p-3.5 rounded-xl border transition-all cursor-pointer node-error flex items-center justify-between";
            } else {
              el.className = "p-3.5 rounded-xl border transition-all cursor-pointer node-success flex items-center justify-between";
            }
          } else {
            el.className = "p-3.5 rounded-xl border transition-all cursor-pointer node-inactive flex items-center justify-between";
          }
        }
      }
    });

    // Add badge indicators
    if (step.node === 'reviewer' && step.type === 'ERROR') {
      reviewerBadge.innerText = "REJECTED ➔ LOOP";
      reviewerBadge.className = "text-[8px] uppercase font-black px-1.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded";
    } else if (step.node === 'reviewer' && step.type === 'SUCCESS' && stepIdx > 13) {
      reviewerBadge.innerText = "APPROVED";
      reviewerBadge.className = "text-[8px] uppercase font-black px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded";
    }

    // Create log element
    const logDiv = document.createElement('div');
    let colorClass = "text-slate-300";
    let icon = "bi-info-circle-fill text-slate-500";

    if (step.type === "SUCCESS") {
      colorClass = "text-emerald-400 font-semibold";
      icon = "bi-check-circle-fill text-emerald-500";
    } else if (step.type === "WARNING") {
      colorClass = "text-amber-400 font-semibold";
      icon = "bi-exclamation-triangle-fill text-amber-500";
    } else if (step.type === "ERROR") {
      colorClass = "text-rose-400 font-semibold p-2 bg-rose-950/20 border border-rose-900/30 rounded-lg";
      icon = "bi-x-circle-fill text-rose-500";
    } else if (step.type === "DATA") {
      colorClass = "text-slate-400 pl-6";
      icon = "bi-arrow-right-short text-slate-500";
    }

    // Implement simulated dynamic anonymization logging
    let textToDisplay = step.text;
    if (piiChecked && stepIdx === 0) {
      textToDisplay += "\n[Compliance Shield] Scrubbing user Silly Squad -> __SAFE_EMAIL_0__, IP -> __SAFE_IP_0__, Password -> __SAFE_API_KEY_0__...";
    }
    if (piiChecked && stepIdx === 19) {
      textToDisplay += "\n[Compliance Shield] Restoring masked sensitive identifiers in local exporter module...";
    }

    logDiv.className = colorClass + " flex items-start gap-2 animate-fadeIn";
    logDiv.innerHTML = `<i class="bi ${icon} mt-0.5 shrink-0"></i><div>${textToDisplay.replace(/\n/g, '<br>')}</div>`;
    consoleEl.appendChild(logDiv);

    // Auto scroll console
    consoleEl.scrollTop = consoleEl.scrollHeight;

    stepIdx++;
    setTimeout(renderStep, step.type === "DATA" ? 800 : 1500);
  }

  // Start stepping
  renderStep();
};

// ─────────────────────────────────────────────────────────────────────────
// KNOWLEDGE BASE TAB — Frontend Hooks
// ─────────────────────────────────────────────────────────────────────────

const KB_API_BASE = 'http://127.0.0.1:8099';

window.kbLoadProjects = async function () {
  const sel = document.getElementById('kb-project-select');
  try {
    const res = await fetch(`${KB_API_BASE}/api/projects`);
    const data = await res.json();
    sel.innerHTML = '';
    if (!data.projects || data.projects.length === 0) {
      sel.innerHTML = '<option value="">No projects found — start the KB server</option>';
      return;
    }
    data.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.project_id;
      opt.textContent = `${p.project_name} (${p.project_id})`;
      sel.appendChild(opt);
    });
    kbProjectChanged();
  } catch (e) {
    sel.innerHTML = '<option value="">KB server offline — run kb_server.py</option>';
  }
};

window.kbLoadSourceTypes = async function () {
  const sel = document.getElementById('kb-source-select');
  try {
    const res = await fetch(`${KB_API_BASE}/api/source-types`);
    const data = await res.json();
    sel.innerHTML = '';
    data.source_types.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st.value;
      const tag = st.implemented ? '✓' : '◻ placeholder';
      opt.textContent = `${st.display_name}  [${tag}]`;
      sel.appendChild(opt);
    });
  } catch (e) {
    sel.innerHTML = '<option value="">KB server offline</option>';
  }
};

window.kbProjectChanged = async function () {
  const pid = document.getElementById('kb-project-select').value;
  if (!pid) return;
  kbLoadStats(pid);
};

window.kbLoadStats = async function (pid) {
  const el = document.getElementById('kb-stats');
  try {
    const res = await fetch(`${KB_API_BASE}/api/projects/${pid}/stats`);
    const data = await res.json();
    let html = `<div class="text-emerald-400 font-semibold">Total Chunks: ${data.total_chunks}</div>`;
    if (data.documents && data.documents.length > 0) {
      html += `<div class="mt-1 text-slate-300">Documents: ${data.documents.join(', ')}</div>`;
    }
    if (data.chunks_by_source_type) {
      const entries = Object.entries(data.chunks_by_source_type);
      if (entries.length > 0) {
        html += '<div class="mt-1">';
        entries.forEach(([k, v]) => { html += `<span class="text-teal-400">${k}</span>: ${v} chunks &nbsp; `; });
        html += '</div>';
      }
    }
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<span class="text-rose-400">Could not load stats (KB server offline?)</span>';
  }
};

window.kbIngest = async function () {
  const pid = document.getElementById('kb-project-select').value;
  const st = document.getElementById('kb-source-select').value;
  const statusEl = document.getElementById('kb-ingest-status');
  if (!pid || !st) {
    statusEl.innerHTML = '<span class="text-amber-400">Please select a project and source type first.</span>';
    return;
  }
  statusEl.innerHTML = '<span class="text-teal-400 pulse-active"><i class="bi bi-arrow-repeat mr-1"></i> Ingesting...</span>';
  try {
    const res = await fetch(`${KB_API_BASE}/api/projects/${pid}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_type: st }),
    });
    const data = await res.json();
    let html = '';
    (data.reports || []).forEach(r => {
      const color = r.status === 'completed' ? 'text-emerald-400' :
                    r.status === 'not_implemented' ? 'text-amber-400' : 'text-rose-400';
      const icon = r.status === 'completed' ? 'bi-check-circle-fill' :
                   r.status === 'not_implemented' ? 'bi-exclamation-triangle-fill' : 'bi-x-circle-fill';
      html += `<div class="${color} flex items-start gap-2 mb-1">`;
      html += `<i class="bi ${icon} mt-0.5 shrink-0"></i>`;
      html += `<div><strong>${r.document_name}</strong> — ${r.message}`;
      if (r.chunks_created > 0) html += ` (${r.chunks_created} chunks)`;
      html += `</div></div>`;
    });
    statusEl.innerHTML = html || '<span class="text-slate-400">No reports returned.</span>';
    kbLoadStats(pid);
  } catch (e) {
    statusEl.innerHTML = `<span class="text-rose-400">Error: ${e.message}</span>`;
  }
};

window.kbSearch = async function () {
  const pid = document.getElementById('kb-project-select').value;
  const st = document.getElementById('kb-source-select').value;
  const query = document.getElementById('kb-search-query').value.trim();
  const container = document.getElementById('kb-results-container');
  const badge = document.getElementById('kb-results-badge');
  const subtitle = document.getElementById('kb-results-subtitle');

  if (!pid) {
    container.innerHTML = '<div class="text-amber-400 text-center py-8">Select a project first.</div>';
    return;
  }
  if (!query) {
    container.innerHTML = '<div class="text-amber-400 text-center py-8">Enter a search query.</div>';
    return;
  }

  container.innerHTML = '<div class="text-teal-400 text-center py-8 pulse-active"><i class="bi bi-arrow-repeat mr-1"></i> Searching...</div>';

  try {
    const body = { query, top_k: 10 };
    if (st) body.source_type_filter = st;
    const res = await fetch(`${KB_API_BASE}/api/projects/${pid}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    badge.textContent = `${data.total_results || 0} RESULTS`;
    subtitle.textContent = `Query: "${query}" — Project: ${pid}`;
    kbRenderResults(data.results || [], container);
  } catch (e) {
    container.innerHTML = `<div class="text-rose-400 text-center py-8">Error: ${e.message}</div>`;
    badge.textContent = 'ERROR';
  }
};

window.kbRenderResults = function (results, container) {
  if (results.length === 0) {
    container.innerHTML = '<div class="text-slate-500 text-center py-8">No matching chunks found. Try a different query or ingest documents first.</div>';
    return;
  }
  let html = '';
  results.forEach(r => {
    const conf = (r.confidence_score * 100).toFixed(1);
    const confColor = r.confidence_score > 0.7 ? 'text-emerald-400' :
                      r.confidence_score > 0.4 ? 'text-amber-400' : 'text-rose-400';
    const chunk = r.chunk;
    html += `<div class="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-teal-500/30 transition-all">`;
    html += `<div class="flex items-center justify-between mb-2">`;
    html += `<div class="flex items-center gap-2">`;
    html += `<span class="text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded border border-teal-500/20">#${r.rank}</span>`;
    html += `<span class="text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">${chunk.source_type}</span>`;
    html += `</div>`;
    html += `<span class="${confColor} font-bold text-[11px]">${conf}% confidence</span>`;
    html += `</div>`;
    html += `<div class="text-slate-200 text-xs leading-relaxed mb-2 whitespace-pre-wrap">${_escapeHtml(chunk.chunk_text.substring(0, 500))}${chunk.chunk_text.length > 500 ? '...' : ''}</div>`;
    html += `<div class="flex items-center gap-4 text-[10px] text-slate-500">`;
    html += `<span><i class="bi bi-file-earmark mr-1"></i>${chunk.document_name}</span>`;
    if (chunk.source_reference) html += `<span><i class="bi bi-link-45deg mr-1"></i>${chunk.source_reference}</span>`;
    if (chunk.metadata && chunk.metadata.section_title) html += `<span><i class="bi bi-bookmark mr-1"></i>${chunk.metadata.section_title.substring(0, 60)}</span>`;
    html += `</div></div>`;
  });
  container.innerHTML = html;
};

function _escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Initialize default views
document.addEventListener('DOMContentLoaded', () => {
  switchTab('blueprint');
  selectNode('kb');
  viewRepoCode('compliance');
  // Pre-load KB data
  kbLoadProjects();
  kbLoadSourceTypes();
});
