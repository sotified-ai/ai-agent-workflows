# QA Agent Factory & Project Knowledge Base

An enterprise-grade, privacy-safe, local-first test automation and requirement engineering suite. The system dynamically instantiates specialized agents based on JSON definitions, maintains a bi-directional traceability matrix, enforces compliance (in-flight PII masking), and compiles comprehensive, beautifully formatted multi-sheet Excel test suites.

This repository features both the **Core Python Execution Engine** and a **Modern Interactive Web Dashboard**.

---

## 🏗️ System Architecture

```
                       [ Project Knowledge Base (Jira/APIs/Docs) ]
                                          │
                                +-------------------+
                                |  Compliance Guard | <--- (PII Scrubbing, Local Cache)
                                +-------------------+
                                          │
                                +-------------------+
                                |   Agent Factory   | <--- (Loads JSON definitions,
                                +-------------------+       compiles prompts & tools)
                                          │
                 +-------------------------------------------------+
                 |         QA State Graph Orchestrator             |
                 +-------------------------------------------------+
                 |                                                 |
                 |  [Retrieve] ➔ [Scenarios] ➔ [Test Generator]     |
                 |                                     │           |
                 |   [Traceability] ☝  [Export] <--- [Reviewer] ┘ |
                 |         (100% Coverage Audit & Loopback)        |
                 +-------------------------------------------------+
                                          │
                              [ Structured XLSX Export ]
```

---

## 📂 Project Structure

```
ai_agent_code/
├── README.md                      # This documentation
├── .gitignore                     # Git exclusion rules
├── kb_server.py                   # Knowledge Base Local HTTP API Server
├── demo.py                        # Executable pipeline CLI simulation
├── test_kb_pipeline.py            # Integration test script for the KB pipeline
├── dashboard/                     # HTML/JS/CSS Interactive Web Dashboard
│   ├── index.html                 # Dashboard layout
│   ├── app.js                     # Interactive logic & KB API connectors
│   ├── styles.css                 # Custom glassmorphic CSS styling
│   └── bootstrap-icons.min.css    # UI Icons
├── projects/                      # Project-specific Knowledge Bases
│   └── sample_project/
│       ├── project_config.yaml    # Knowledge source configuration (YAML)
│       ├── sources/               # Raw document directories
│       │   ├── user_stories/
│       │   ├── api_specs/
│       │   └── existing_test_cases_defects/
│       └── store/
│           └── vectors.json       # In-memory/disk local vector store
└── src/                           # Python backend modules
    ├── compliance.py              # PII masking (ComplianceGuard) & Semantic Cache
    ├── factory.py                 # Dynamic Agent compiler & registry
    ├── orchestrator.py            # DAG execution loops with self-healing
    ├── traceability.py            # Bi-directional mapping and coverage score
    ├── exporter.py                # Styled XLSX exporter with openpyxl
    └── knowledge_base/            # Project Knowledge Base (PKB) engine
        ├── models.py              # Ingestion/Retrieval dataclasses & SourceType enum
        ├── project_loader.py      # Project YAML loading & directory scaffolding
        ├── chunker.py             # Semantic splitting (Stories, APIs, Test Cases)
        ├── embeddings.py          # Local-first Embeddings (no cloud dependency)
        ├── vector_store.py        # File-backed Vector DB with cosine similarity
        ├── ingest.py              # Ingestion pipeline controller
        └── retriever.py           # Semantic Search & Context retriever
```

---

## ⚙️ Core Modules & Features

### 1. In-Flight Compliance Proxy (`ComplianceGuard`)
* **Dual-Way Masking:** Automatically detects and replaces sensitive information (emails, credentials, API keys, database connection strings, IPs) in prompts with reversible tokens (`__SAFE_EMAIL_0__`).
* **Post-Execution Reconstruction:** The LLM's response is scrubbed, and the original variables are restored locally, keeping your workspace compliant (SOC2-CC6.1/ISO27001).
* **Local Semantic Cache:** Prompt hashes are evaluated locally to return instant cached responses for identical requests, optimizing resource usage.

### 2. Project Knowledge Base (PKB)
* **Local Ingestion & Scaffolding:** Create structured data repositories for any project using standard YAML configs.
* **Semantic Chunking:** Custom splitting rules separate User Stories, OpenAPI/Swagger specifications, and Test Case/Defect logs into semantic units.
* **Embeddings & Vector Store:** Integrates local sentence-transformers (falls back to a zero-dependency deterministic hash embedding if unavailable). Runs entirely offline.
* **Context Assembly:** Translates target user stories into semantic queries to build an enriched context prompt for the test generator.

### 3. Dynamic Agent Factory
* No hardcoded agent classes. Agents are dynamically registered and compiled via JSON configurations specifying role, system prompt template, model, and temperature.
* Custom validation schemas ensure agents emit structured outputs.

### 4. DAG State Graph & Self-Healing
* Orchestrates execution steps.
* Features a **Quality Loopback:** The `QA Reviewer` inspects generated test suites. If coverage or compliance gaps are identified, it triggers self-correction loops with remedial feedback to the `Test Case Generator`.

### 5. Traceability & Reporting
* **Traceability Matrix:** Maps requirements to test cases. Calculates coverage percentage.
* **Professional XLSX Export:** Emits structured sheets formatted with clean Segoe UI typography, charcoal headers, auto-fit columns, and cell borders.

---

## 🚀 Running the System Locally

### Prerequisites
Install the required Python dependencies:
```bash
pip install pandas openpyxl jinja2 pyyaml
```

### Option A: Run the CLI Simulation (Standard Demo)
Execute the master simulation showing dynamic agent instantiation, loopbacks, masking, and Excel export:
```bash
python demo.py
```
*Outputs `MFA_Test_Suite_Export.xlsx` on completion.*

### Option B: Run the Project Knowledge Base Pipeline
Ingest and query project documents using the test script:
```bash
python test_kb_pipeline.py
```

### Option C: Run the Interactive Web Dashboard
1. Start the local Knowledge Base HTTP server:
   ```bash
   python kb_server.py
   ```
2. Open the dashboard by double-clicking `dashboard/index.html` in any browser.
3. Switch to the **Knowledge Base** tab to ingest files, query the vector database, view stats, and inspect search results.
4. Go to the **Interactive Factory Simulator** tab to execute the complete agent workflow and download the styled XLSX spreadsheet.
