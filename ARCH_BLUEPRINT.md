# QA Agent Factory: Enterprise Architectural Blueprint

Solving the triad of **Automated Test Generation**, **Long-term Context Retention**, and **Compliance-Safe Local Deployment** through a modular, metadata-driven Agent Factory architecture.

---

## 1. Executive Problem Statements & Solutions

### Problem A: The Hallucination of Plain Chatbots (Test Generation)
**The Challenge:** Traditional LLMs prompted with "Write test cases for X" will hallucinate API endpoints, skip critical boundary conditions, ignore security standards, and produce unstructured, non-reproducible outputs.
**The Solution:** The **QA Agent Factory** replaces flat prompt chats with a structured, feedback-driven State Graph pipeline.
1. **Separation of Concerns:** Individual specialized roles (Requirement Retrieval, Scenario Mapping, Test Writing, Auditing) are dynamically registered and run in sequence.
2. **Dynamic Peer Review Loop:** A critical `QA Reviewer` agent audits the output of the `Test Case Generator`. If coverage or security gaps are detected, the orchestrator triggers an automatic loop-back self-correction step, passing explicit remediation instructions back to the writer.

### Problem B: The Amnesia of LLM Context Windows (Context Retention)
**The Challenge:** Complex software projects have large codebases, extensive API schemas, multi-page Jira tickets, and corporate compliance manuals. Feeding all of this into an LLM on every query causes context-window overflow, high costs, and context dilution (LLM "loses" details in the middle).
**The Solution:** A **Hierarchical Retrieval & State Management System**.
1. **Durable Shared Execution Ledger:** Instead of passing full histories, a centralized State Graph manages a lean execution context.
2. **Context Compression (Workspace Manager):** A semantic workspace compressor summarizes past execution turns, while a local vector database queries the Project Knowledge Base on-demand to fetch only the relevant requirements for the current test scope.
3. **Traceability Ledger:** Requirements, scenarios, and test cases are mapped bi-directionally. This keeps a tight mathematical link between entities, ensuring context is locked in structure rather than loose prompt text.

### Problem C: Data Privacy & Air-gapped Mandates (Compliance-Safe Local Deployment)
**The Challenge:** Corporate compliance (SOC2, ISO27001, HIPAA) strictly prohibits transmitting sensitive customer data, source code, or internal database schemas to public cloud LLM APIs.
**The Solution:** A **Local-First, Privacy-Preserving Proxy Architecture**.
1. **Dual-Way Compliance Masking:** The `ComplianceGuard` intercepts all outgoing prompts before execution. It scrubs sensitive PII, passwords, emails, and internal IP addresses, replacing them with reversible secure tokens (e.g., `__SAFE_EMAIL_0__`). The local or cloud LLM processes anonymized requirements. Once the LLM responds, the guard restores the sensitive variables locally.
2. **Local Inference Isolation:** The execution wrapper decouples LLM calls, seamlessly supporting local private servers (Ollama, vLLM, Hugging Face TGI) executing open-weights models like `Llama-3-8B-Instruct` or `Qwen-2.5-Coder` in an air-gapped network.
3. **Local Semantic Caching:** A high-speed cache hashes prompt configurations, bypassing LLM generation for identical queries, saving local hardware compute and providing deterministic performance.

---

## 2. Recommended System Architecture

Rather than separate hardcoded agent classes that require code changes for every new QA workflow, the system uses the **QA Agent Factory Pattern**.

```
                         [ Project Knowledge Base (Jira/APIs/Docs) ]
                                            ↓
                                  +-------------------+
                                  |  Compliance Guard | <--- (PII Scrubbing, Local Cache)
                                  +-------------------+
                                            ↓
                                  +-------------------+
                                  |   Agent Factory   | <--- (Loads JSON definitions,
                                  +-------------------+       compiles prompts & tools)
                                            ↓
                   +-------------------------------------------------+
                   |         QA State Graph Orchestrator             |
                   +-------------------------------------------------+
                   |                                                 |
                   |  [Retrieve] ➔ [Scenarios] ➔ [Test Generator]     |
                   |                                     │           |
                   |   [Traceability] 🖚  [Export] <--- [Reviewer] 🠔─┘ |
                   |         (100% Coverage Audit & Loopback)        |
                   +-------------------------------------------------+
                                            ↓
                                [ Structured XLSX Export ]
```

### Component Breakdown
1. **Dynamic Agent Registry (Factory Core):**
   - Receives JSON-based `AgentDefinitions` specifying roles, prompts, models, and temperatures.
   - Instantiates a generic `DynamicAgent` class that handles compiling prompt templates and executing local inference.
2. **Compliance Proxy / Guard:**
   - Dual-way anonymizer.
   - Local hash-based semantic cache.
3. **Orchestrator (State Graph):**
   - Coordinates state transitions.
   - Executes loops and branches based on evaluation outputs (e.g., if `status == "Rejected"`, branch back to `Test_Case_Generator`).
4. **Bi-Directional Traceability Matrix:**
   - Evaluates coverage mathematically.
   - Identifies uncovered scenarios and maps requirement IDs 1:1 to test case scripts.
5. **Spreadsheet Exporter:**
   - Translates validation outputs into standardized, beautifully formatted multi-sheet Excel workbooks matching enterprise standards.

---

## 3. Dynamic Factory Configuration (Example Definition)
This JSON schema allows the system to register and configure a new agent on-the-fly without restarting or editing the core engine code:

```json
{
  "name": "QA_Reviewer",
  "role": "Audits test cases against requirements and compliance criteria.",
  "system_prompt_template": "You are a Critical Principal QA Inspector. Review test cases: {{test_cases}} against scenarios: {{scenarios}}...",
  "temperature": 0.1,
  "model": "qwen2.5-coder-7b-local",
  "tools": ["vector_retriever", "rule_validator"],
  "validation_schema": {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["Approved", "Rejected"] },
      "feedback": { "type": "string" },
      "gaps_found": { "type": "array" }
    },
    "required": ["status", "feedback", "gaps_found"]
  }
}
```

---

## 4. Run/Deployment Manual

### Prerequisites
- Python 3.10+
- Pre-installed packages: `pandas`, `openpyxl`, `jinja2`

### Run the Simulated Prototype Engine
The repository contains a fully working local prototype of the QA Agent Factory showing dynamic agent compilation, dual-way PII masking, local semantic caching, state-machine loopbacks, and Excel exporting.

To execute the demo:
```bash
/usr/local/bin/python3 /home/user/qa_agent_factory/src/demo.py
```

### Deploying Locally with Ollama / vLLM
To run this architecture with absolute compliance-safe local deployment, wrap the LLM execution in `factory.py` to point to a local Ollama server:

```python
import requests

def _call_local_ollama(self, prompt: str) -> str:
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": self.def_.model, # e.g., "llama3" or "qwen2.5-coder"
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": self.def_.temperature
            }
        }
    )
    return response.json().get("response", "")
```
