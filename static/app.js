/* QA Agent Factory — Frontend Application Suite Logic
   ───────────────────────────────────────────────────
   Serves all views: Workspace Console, Blueprint, Simulator, Code Browser, and KB Explorer.
*/

'use strict';

const API = ''; // Same origin

// ── Application State ────────────────────────────────────────────────────────
let currentProject = null;
let currentStep = 1;
let lastResults = null;
let activeView = 'workspace';
let selectedSimNode = 'kb';
let selectedCodeFile = 'compliance';

// ── Initialization ───────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  loadProjects();
  loadCodeFile('compliance'); // Preload default file
});

// ── Health Check ───────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const r = await fetch(`${API}/api/health`);
    const d = await r.json();
    const dot = document.getElementById('llm-dot');
    const lbl = document.getElementById('llm-label');
    if (d.llm_status === 'available') {
      dot.className = 'status-dot ok';
      lbl.textContent = `LLM: ${d.llm_backend} ✓`;
    } else {
      dot.className = 'status-dot err';
      lbl.textContent = 'LLM: Not configured';
    }
  } catch {
    document.getElementById('llm-dot').className = 'status-dot err';
    document.getElementById('llm-label').textContent = 'Server unreachable';
  }
}

// ── Sidebar View Switching ───────────────────────────────────────────────────
function switchView(viewName) {
  activeView = viewName;

  // Toggle active class in nav
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`nav-btn-${viewName}`).classList.add('active');

  // Toggle view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
    panel.classList.add('hidden');
  });
  const activePanel = document.getElementById(`view-${viewName}`);
  activePanel.classList.remove('hidden');
  activePanel.classList.add('active');

  // Specific tab initializations
  if (viewName === 'workspace') {
    loadProjects();
  } else if (viewName === 'code') {
    loadCodeFile(selectedCodeFile);
  } else if (viewName === 'kb') {
    populateKbProjects();
  }
}

// ── Projects list & select ───────────────────────────────────────────────────
let projectsData = []; // Cache list globally

async function loadProjects() {
  try {
    const r = await fetch(`${API}/api/projects`);
    const d = await r.json();
    projectsData = d.projects || [];
    renderProjectsList();
  } catch (e) {
    showToast('Failed to load projects list.', 'err');
  }
}

function renderProjectsList() {
  const list = document.getElementById('projects-list');
  if (projectsData.length === 0) {
    list.innerHTML = '<div class="empty-state">No projects yet. Create your first project above.</div>';
    return;
  }

  list.innerHTML = projectsData.map(p => `
    <div class="project-item ${currentProject?.project_id === p.project_id ? 'selected' : ''}"
         onclick="selectProjectById('${p.project_id}')">
      <div>
        <div class="proj-name">${esc(p.name)}</div>
        <div class="proj-meta">${esc(p.description || '—')} &nbsp;·&nbsp; ${p.file_count || 0} files</div>
      </div>
      <span class="proj-arrow">→</span>
    </div>
  `).join('');
}

function selectProjectById(id) {
  const p = projectsData.find(x => x.project_id === id);
  if (p) {
    selectProject(p);
  }
}

function selectProject(p) {
  currentProject = p;
  renderProjectsList();
  document.getElementById('active-project-badge').textContent = p.name;
  document.getElementById('gen-project-badge').textContent = p.name;
  showToast(`Project "${p.name}" selected`, 'ok');
  goStep(2);
}

async function createProject() {
  const name = document.getElementById('proj-name').value.trim();
  if (!name) { showToast('Enter a project name.', 'err'); return; }

  const btn = document.getElementById('btn-create-project');
  btn.disabled = true; btn.textContent = 'Creating...';

  try {
    const r = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: document.getElementById('proj-desc').value.trim(),
      }),
    });
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-plus-lg"></i> Create Project`;

    if (!r.ok) { showToast('Failed to create project.', 'err'); return; }

    const p = await r.json();
    document.getElementById('proj-name').value = '';
    document.getElementById('proj-desc').value = '';
    currentProject = p;
    document.getElementById('active-project-badge').textContent = p.name;
    document.getElementById('gen-project-badge').textContent = p.name;
    await loadProjects();
    showToast(`Project "${p.name}" created!`, 'ok');
    goStep(2);
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-plus-lg"></i> Create Project`;
    showToast('Network error during project creation.', 'err');
  }
}

function newProject() {
  currentProject = null;
  lastResults = null;
  document.getElementById('results-summary').style.display = 'none';
  document.getElementById('pipeline-progress').style.display = 'none';
  document.getElementById('btn-to-download').style.display = 'none';
  goStep(1);
  loadProjects();
}

// ── Wizard Step Navigation ───────────────────────────────────────────────────
function goStep(n) {
  if (n > 1 && !currentProject) {
    showToast('Please create or select a project first.', 'err');
    return;
  }
  if (n > 3 && !lastResults) {
    showToast('Please generate test cases first.', 'err');
    return;
  }
  currentStep = n;

  // Update panels
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${n}`).classList.add('active');

  // Update step indicators
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`step-ind-${i}`);
    el.classList.remove('active', 'done');
    if (i < n)      el.classList.add('done');
    else if (i === n) el.classList.add('active');
  }

  if (n === 2) refreshFilesList();
  if (n === 4) renderFinalStats();
}

// ── File Uploads ─────────────────────────────────────────────────────────────
function handleDragover(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.add('drag-over');
}
function handleDragleave() {
  document.getElementById('dropzone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('drag-over');
  uploadFiles([...e.dataTransfer.files]);
}
function handleFileSelect(e) {
  uploadFiles([...e.target.files]);
}

async function uploadFiles(files) {
  if (!currentProject) { showToast('No project selected.', 'err'); return; }

  const log = document.getElementById('upload-log');
  log.style.display = 'block';
  log.innerHTML = '';

  for (const file of files) {
    appendLog(log, `↑ Uploading ${file.name}...`, 'info');

    const fd = new FormData();
    fd.append('file', file);

    try {
      const r = await fetch(`${API}/api/projects/${currentProject.project_id}/upload`, {
        method: 'POST', body: fd,
      });
      const d = await r.json();
      if (r.ok) {
        appendLog(log, `✓ ${file.name} → ${typeLabel(d.source_type)} (${d.total_chunks} chunks indexed)`, 'ok');
      } else {
        appendLog(log, `✗ ${file.name}: ${d.detail || 'Upload failed'}`, 'err');
      }
    } catch (e) {
      appendLog(log, `✗ ${file.name}: Network error`, 'err');
    }
  }
  await refreshFilesList();
}

async function refreshFilesList() {
  if (!currentProject) return;
  try {
    const r = await fetch(`${API}/api/projects/${currentProject.project_id}/files`);
    const d = await r.json();
    const section = document.getElementById('files-section');
    const list = document.getElementById('files-list');

    const allFiles = Object.entries(d.files || {}).flatMap(([type, names]) =>
      names.map(n => ({ type, name: n }))
    );

    if (allFiles.length === 0) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    list.innerHTML = allFiles.map(f => `
      <div class="file-chip">
        <span class="chip-type ${chipClass(f.type)}">${typeLabel(f.type)}</span>
        ${esc(f.name)}
      </div>
    `).join('');
  } catch (e) {
    // Fail silently in background
  }
}

// ── Actual Generation Pipeline ───────────────────────────────────────────────
const PIPELINE_STEPS = [
  { key: 'Retrieval',    label: 'Retrieving knowledge context' },
  { key: 'Scenario_Gen', label: 'Generating test scenarios' },
  { key: 'Test_Case_Gen',label: 'Writing test cases' },
  { key: 'QA_Reviewer',  label: 'Running QA audit' },
  { key: 'Traceability', label: 'Computing traceability matrix' },
];

async function generateTests() {
  const title = document.getElementById('story-title').value.trim();
  const desc  = document.getElementById('story-desc').value.trim();
  if (!title || !desc) {
    showToast('Please fill in the story title and description.', 'err');
    return;
  }

  const btn = document.getElementById('btn-generate');
  btn.disabled = true;
  btn.innerHTML = `<span class="spin">⟳</span> Running Pipeline...`;

  // Show progress
  const progress = document.getElementById('pipeline-progress');
  const stepsList = document.getElementById('pipeline-steps-list');
  progress.style.display = 'block';
  document.getElementById('results-summary').style.display = 'none';
  document.getElementById('btn-to-download').style.display = 'none';

  stepsList.innerHTML = PIPELINE_STEPS.map(s => `
    <div class="pipeline-step" id="ps-${s.key}">
      <span class="step-icon">○</span>
      <span>${s.label}</span>
    </div>
  `).join('');

  // Animate steps during the (blocking) API call
  let stepIdx = 0;
  const stepTimer = setInterval(() => {
    if (stepIdx < PIPELINE_STEPS.length) {
      const step = PIPELINE_STEPS[stepIdx];
      const el = document.getElementById(`ps-${step.key}`);
      if (el) {
        el.classList.add('running');
        el.querySelector('.step-icon').innerHTML = '<span class="spin">⟳</span>';
        document.getElementById('pipeline-step-label').textContent = step.label;
      }
      if (stepIdx > 0) {
        const prev = PIPELINE_STEPS[stepIdx - 1];
        const prevEl = document.getElementById(`ps-${prev.key}`);
        if (prevEl) {
          prevEl.classList.remove('running');
          prevEl.classList.add('done');
          prevEl.querySelector('.step-icon').textContent = '✓';
        }
      }
      stepIdx++;
    }
  }, 4000);

  try {
    const targets = document.getElementById('compliance-targets').value
      .split(',').map(s => s.trim()).filter(Boolean);

    const r = await fetch(`${API}/api/projects/${currentProject.project_id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        story_title: title,
        story_description: desc,
        compliance_targets: targets,
      }),
    });

    clearInterval(stepTimer);

    // Mark all steps done
    PIPELINE_STEPS.forEach(s => {
      const el = document.getElementById(`ps-${s.key}`);
      if (el) {
        el.classList.remove('running'); el.classList.add('done');
        el.querySelector('.step-icon').textContent = '✓';
      }
    });

    const d = await r.json();
    if (!r.ok) {
      showToast(d.detail || 'Generation failed.', 'err');
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-play-fill"></i> Run Generation Pipeline`;
      return;
    }

    lastResults = d;
    renderResults(d);
  } catch (e) {
    clearInterval(stepTimer);
    showToast('Network error — is the server running?', 'err');
  }

  btn.disabled = false;
  btn.innerHTML = `<i class="bi bi-play-fill"></i> Run Generation Pipeline`;
}

function renderResults(d) {
  document.getElementById('res-req').textContent = d.requirements_count ?? '—';
  document.getElementById('res-sc').textContent  = d.scenarios_count ?? '—';
  document.getElementById('res-tc').textContent  = d.test_cases_count ?? '—';
  document.getElementById('res-cov').textContent = d.traceability_score != null
    ? `${Math.round(d.traceability_score)}%` : '—';

  const badge = document.getElementById('review-badge');
  const status = d.review_status || 'N/A';
  badge.textContent = `QA Review: ${status}`;
  badge.className = `review-badge ${status === 'Approved' ? 'approved' : 'rejected'}`;

  document.getElementById('results-summary').style.display = 'block';
  document.getElementById('btn-to-download').style.display = 'inline-flex';
  showToast('Test cases generated successfully!', 'ok');
}

function downloadFile(type) {
  if (!currentProject) return;
  window.location.href = `${API}/api/projects/${currentProject.project_id}/download/${type}`;
}

function renderFinalStats() {
  if (!lastResults) return;
  const el = document.getElementById('final-stats');
  el.innerHTML = `
    <strong>${lastResults.requirements_count}</strong> requirements &nbsp;·&nbsp;
    <strong>${lastResults.scenarios_count}</strong> test scenarios &nbsp;·&nbsp;
    <strong>${lastResults.test_cases_count}</strong> test cases &nbsp;·&nbsp;
    <strong>${Math.round(lastResults.traceability_score || 0)}%</strong> traceability coverage &nbsp;·&nbsp;
    QA Review: <strong>${lastResults.review_status}</strong>
  `;
}

// ── VIEW 3: INTERACTIVE SIMULATOR ───────────────────────────────────────────
const SIM_NODE_SPECS = {
  kb: {
    title: "Project Knowledge Base",
    subtitle: "Data Source",
    desc: "A unified ingestion repository containing unstructured specifications, technical requirements, Jira user stories, API definitions, and compliance/ISO manuals. It acts as the ground truth database for test validation.",
    config: `{\n  "source": "knowledge_base",\n  "ingested_entities": ["Jira", "Wikis", "Swagger/OpenAPI"],\n  "chunk_size": 1024,\n  "overlap": 128\n}`,
    code: `class KnowledgeBase:\n    def __init__(self, workspace_id: str):\n        self.workspace_id = workspace_id\n        self.documents = []\n        \n    def ingest(self, raw_text: str, category: str):\n        self.documents.append({\n            'text': raw_text,\n            'category': category\n        })`,
    input: "Raw project descriptions, email scopes, Jira epics, OpenAPI specs.",
    output: "Tokenized, chunked, and semantic-vector-indexed business artifacts."
  },
  retriever: {
    title: "Requirement Retriever",
    subtitle: "Agent Configuration",
    desc: "Queries the vector knowledge base using hybrid retrieval (BM25 + Dense Embeddings) and compiles business expectations, functional boundaries, security compliance levels, and SLA requirements.",
    config: `{\n  "name": "Requirement_Retriever",\n  "role": "Requirements Engineer",\n  "model": "qwen2.5-coder-7b-local",\n  "temperature": 0.1,\n  "tools": ["hybrid_vector_search"]\n}`,
    code: `REQUIREMENTS_PROMPT_TEMPLATE = """\nExtract and structure functional requirements and compliance tags.\nSTORY: {{story}}\n"""\nretriever = factory.get_agent("Requirement_Retriever")\nresults = retriever.execute({"story": mfa_story})`,
    input: "Anonymized User Story Context from Compliance Guard.",
    output: "JSON-structured requirement list with compliance ID mappings (e.g. SOC2, ISO27001)."
  },
  scenario: {
    title: "Scenario Generator",
    subtitle: "Agent Configuration",
    desc: "Formulates a complete topological map of test scenarios. It breaks requirements into positive authentication scenarios, negative error-handling scenarios, and edge/boundary limits.",
    config: `{\n  "name": "Scenario_Generator",\n  "role": "Lead Test Planner",\n  "model": "llama3-8b-local",\n  "temperature": 0.2,\n  "tools": []\n}`,
    code: `SCENARIO_PROMPT_TEMPLATE = """\nTranslate requirements to distinct test scenarios.\nREQUIREMENTS: {{requirements}}\n"""\nscenario_agent = factory.get_agent("Scenario_Generator")\nscenarios = scenario_agent.execute({"requirements": requirements})`,
    input: "Analyzed Requirements JSON.",
    output: "Topological Scenario Matrix containing Positive, Negative, and Boundary cases."
  },
  generator: {
    title: "Test Case Generator",
    subtitle: "Agent Configuration",
    desc: "Translates logical scenarios into step-by-step executable functional validations. Integrates review comments during loops to revise and self-heal generated scripts.",
    config: `{\n  "name": "Test_Case_Generator",\n  "role": "Lead Test Designer",\n  "model": "qwen2.5-coder-7b-local",\n  "temperature": 0.2,\n  "tools": ["syntax_formatter"]\n}`,
    code: `TESTS_PROMPT_TEMPLATE = """\nWrite step-by-step test cases for: {{scenarios}}\nFEEDBACK: {{feedback}}\n"""\ntest_gen = factory.get_agent("Test_Case_Generator")\ntest_cases = test_gen.execute({"scenarios": scenarios, "feedback": review_feedback})`,
    input: "Test Scenarios list & optional QA Auditor Loopback Feedback.",
    output: "Thoroughly specified, automation-ready QA test cases with preconditions and expected results."
  },
  reviewer: {
    title: "QA Reviewer / Auditor",
    subtitle: "Agent Configuration",
    desc: "Audits the test suite against initial specifications to ensure 100% compliance coverage. If gaps (such as missing account lockout scenarios for SOC2 compliance) are detected, it rejects the suite and feeds corrective comments back to the generator.",
    config: `{\n  "name": "QA_Reviewer",\n  "role": "Principal Quality Inspector",\n  "model": "gpt4-secure-proxy",\n  "temperature": 0.1,\n  "validation_schema": {\n    "required": ["status", "feedback", "gaps_found"]\n  }\n}`,
    code: `AUDIT_PROMPT_TEMPLATE = """\nAudit test cases: {{test_cases}} against scenarios: {{scenarios}}\n"""\nreviewer = factory.get_agent("QA_Reviewer")\naudit_report = reviewer.execute({"test_cases": test_cases, "scenarios": scenarios})`,
    input: "Generated Test Cases, Scenarios, and compliance criteria.",
    output: "Status (Approved | Rejected) + detailed list of identified coverage or security gaps."
  },
  trace: {
    title: "Traceability Validator",
    subtitle: "Validation Component",
    desc: "Calculates the mathematical coverage score by tracing elements bi-directionally (Requirements ➔ Scenarios ➔ Test Cases) ensuring zero orphaned criteria.",
    config: `{\n  "component": "traceability_validator",\n  "strict_mode": true,\n  "expected_coverage": 100.0\n}`,
    code: `class TraceabilityMatrix:\n    @staticmethod\n    def compute_matrix(reqs, scenarios, test_cases):\n        # Map entities and count uncovered requirements\n        coverage_score = (covered_reqs / total_reqs) * 100.0\n        return {"traceability_score": coverage_score, "mappings": [...]}`,
    input: "Final Requirements, Scenarios, and verified Test Cases JSON.",
    output: "Bi-directional mapping index and verified overall coverage percentage."
  },
  export: {
    title: "Spreadsheet Exporter",
    subtitle: "Output Module",
    desc: "Formats and writes the validated test assets to a multi-sheet, production-grade Excel workbook. Follows strict formatting containing charcoal themes, wrapped texts, Segoe UI fonts, and auto-adjusted width grids.",
    config: `{\n  "format": "xlsx",\n  "engine": "openpyxl",\n  "sheets": ["Requirements", "Test Scenarios", "Test Cases", "Traceability Matrix"]\n}`,
    code: `class SpreadsheetExporter:\n    @staticmethod\n    def export_to_excel(pipeline_output, filepath):\n        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:\n            df_req.to_excel(writer, sheet_name="Requirements", index=False)\n            # Apply charcoal themes, fonts, alignment borders, and auto-width logic\n        return filepath`,
    input: "Full validated context pipeline JSON.",
    output: "Formatted enterprise-grade Excel workbook (.xlsx)."
  }
};

function selectSimNode(nodeKey) {
  selectedSimNode = nodeKey;

  // Toggle active class on nodes
  document.querySelectorAll('.dag-node').forEach(node => node.classList.remove('active'));
  document.getElementById(`node-${nodeKey}`).classList.add('active');

  // Fill details pane
  const spec = SIM_NODE_SPECS[nodeKey];
  document.getElementById('sim-pane-title').textContent = spec.title;
  document.getElementById('sim-pane-subtitle').textContent = spec.subtitle;
  document.getElementById('sim-pane-desc').textContent = spec.desc;
  document.getElementById('sim-pane-config-json').textContent = spec.config;
  document.getElementById('sim-pane-code').textContent = spec.code;
  document.getElementById('sim-pane-input').textContent = spec.input;
  document.getElementById('sim-pane-output').textContent = spec.output;
}

let isSimulating = false;
function runSimulation() {
  if (isSimulating) return;
  isSimulating = true;

  const btn = document.getElementById('btn-run-sim');
  const consoleStatus = document.getElementById('sim-console-status');
  const termLogs = document.getElementById('sim-terminal-logs');
  const downloadBox = document.getElementById('sim-terminal-download');
  const loopBadge = document.getElementById('sim-reviewer-loop-badge');

  btn.disabled = true;
  btn.innerHTML = `<span class="spin">⟳</span> Simulating...`;
  consoleStatus.className = 'status-badge running';
  consoleStatus.textContent = 'RUNNING';
  loopBadge.style.display = 'none';
  downloadBox.style.display = 'none';

  termLogs.innerHTML = '';
  appendSimLog(termLogs, `Initializing QA Agent Factory Simulator Node...`, 'info');
  appendSimLog(termLogs, `Model deploy target selected: ${document.getElementById('sim-llm').value}`, 'info');
  appendSimLog(termLogs, `In-flight PII compliance scrubbing: ${document.getElementById('sim-pii').checked ? 'ON' : 'OFF'}`, 'info');

  const timeline = [
    { delay: 1500, node: 'kb', text: `Connecting project database... Found 3 context documents. Ingested 14 vector chunks.`, type: 'ok' },
    { delay: 3000, node: 'retriever', text: `[Requirement_Retriever] Querying vector db... Loaded context. Extracted REQ-01 (TOTP Auth) and REQ-02 (Rate Limiting).`, type: 'ok' },
    { delay: 4500, node: 'scenario', text: `[Scenario_Generator] Compiling test boundaries... Drafted 3 scenarios: SC-01 (Positive), SC-02 (Negative), SC-03 (Boundary lockout).`, type: 'ok' },
    { delay: 6000, node: 'generator', text: `[Test_Case_Generator] Writing step test cases... Synthesized TC-01 & TC-02. (Note: purposefully omitted TC-03 account lockout for audit evaluation loop).`, type: 'warn' },
    { delay: 7800, node: 'reviewer', text: `[QA_Reviewer] Auditing suite... REJECTED! Status: Rejected. Gap identified: Scenario SC-03 'MFA Rate Limiting' has no corresponding test script. SOC2-CC6.3 compliance failed.`, type: 'err', action: () => { loopBadge.style.display = 'inline-block'; } },
    { delay: 9500, node: 'generator', text: `[Test_Case_Generator] Loop-back trigger! Merging reviewer corrective comments... Drafting revised test case TC-03. Completed.`, type: 'ok' },
    { delay: 11000, node: 'reviewer', text: `[QA_Reviewer] Re-auditing suite (Iteration 2)... APPROVED! Status: Approved. Gaps resolved: 0. SOC2 / ISO compliance checked.`, type: 'ok', action: () => { loopBadge.style.display = 'none'; } },
    { delay: 12500, node: 'trace', text: `[Traceability_Validator] Checking matrix... 100% bi-directional mapping confirmed. Score: 100.0%.`, type: 'ok' },
    { delay: 13500, node: 'export', text: `[SpreadsheetExporter] Formatting spreadsheet grids... Compiled Requirements, Scenarios, Tests, and Matrix sheets. XLSX exported!`, type: 'ok' },
  ];

  timeline.forEach(step => {
    setTimeout(() => {
      selectSimNode(step.node);
      appendSimLog(termLogs, step.text, step.type);
      if (step.action) step.action();

      // End of simulation logic
      if (step.node === 'export') {
        isSimulating = false;
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-play-fill"></i> Start Simulation`;
        consoleStatus.className = 'status-badge completed';
        consoleStatus.textContent = 'COMPLETED';
        downloadBox.style.display = 'block';
        showToast('Simulation run finished successfully!', 'ok');
      }
    }, step.delay);
  });
}

function appendSimLog(container, text, type) {
  const div = document.createElement('div');
  div.className = `log-${type}`;
  div.textContent = `${new Date().toLocaleTimeString()} - ${text}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ── VIEW 4: PROTOTYPE CODE BROWSER ───────────────────────────────────────────
async function loadCodeFile(fileKey) {
  selectedCodeFile = fileKey;

  // Highlight list item
  document.querySelectorAll('.file-item').forEach(item => item.classList.remove('active'));
  const activeItem = document.getElementById(`code-fn-${fileKey}`);
  if (activeItem) activeItem.classList.add('active');

  const pathDisplay = {
    compliance: '/src/compliance.py',
    factory: '/src/factory.py',
    orchestrator: '/src/orchestrator.py',
    traceability: '/src/traceability.py',
    exporter: '/src/exporter.py',
    demo: '/demo.py',
    blueprint: '/ARCH_BLUEPRINT.md'
  };

  document.getElementById('code-viewer-path').textContent = pathDisplay[fileKey] || fileKey;
  const viewer = document.getElementById('code-viewer-pre');
  viewer.textContent = 'Loading code module...';

  try {
    const r = await fetch(`${API}/api/code/${fileKey}`);
    const d = await r.json();
    if (r.ok) {
      viewer.textContent = d.content;
    } else {
      viewer.textContent = `Error loading file: ${d.detail || 'Not found'}`;
    }
  } catch (e) {
    viewer.textContent = `Network error trying to fetch file contents.`;
  }
}

function copyCode() {
  const codeText = document.getElementById('code-viewer-pre').textContent;
  navigator.clipboard.writeText(codeText).then(() => {
    showToast('Code copied to clipboard!', 'ok');
  }).catch(() => {
    showToast('Failed to copy code.', 'err');
  });
}

// ── VIEW 5: KNOWLEDGE BASE EXPLORER ──────────────────────────────────────────
async function populateKbProjects() {
  const select = document.getElementById('kb-project-select');
  select.innerHTML = '<option value="">Select a project...</option>';

  try {
    const r = await fetch(`${API}/api/projects`);
    const d = await r.json();
    const projects = d.projects || [];

    if (projects.length === 0) {
      select.innerHTML = '<option value="">No projects created yet</option>';
      return;
    }

    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.project_id;
      opt.textContent = p.name;
      if (currentProject && currentProject.project_id === p.project_id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    kbProjectChanged();
  } catch (e) {
    showToast('Failed to populate projects.', 'err');
  }
}

async function kbProjectChanged() {
  const pid = document.getElementById('kb-project-select').value;
  const statsBody = document.getElementById('kb-stats-body');
  const container = document.getElementById('kb-results-container');
  const badge = document.getElementById('kb-results-badge');

  container.innerHTML = `
    <div class="kb-empty-results">
      <i class="bi bi-database" style="font-size: 2.5rem; color: var(--border2); margin-bottom: 12px; display: block;"></i>
      <p>Run a search query to retrieve vector matches.</p>
    </div>
  `;
  badge.textContent = '0 Results';

  if (!pid) {
    statsBody.innerHTML = 'Select a project to view statistics.';
    return;
  }

  statsBody.innerHTML = 'Fetching database stats...';

  try {
    const r = await fetch(`${API}/api/projects/${pid}/stats`);
    const d = await r.json();
    if (r.ok) {
      let typesText = '';
      if (d.chunks_by_source_type && Object.keys(d.chunks_by_source_type).length > 0) {
        typesText = Object.entries(d.chunks_by_source_type).map(([k, v]) => {
          return `· ${typeLabel(k)}: ${v} chunks`;
        }).join('<br>');
      } else {
        typesText = '· No chunks indexed yet';
      }

      statsBody.innerHTML = `
        Total Chunks: <strong>${d.total_chunks || 0}</strong><br>
        Source Files: <strong>${d.documents?.length || 0}</strong><br>
        <div style="margin-top: 6px; color: var(--text3); font-size: 10px;">BREAKDOWN:</div>
        ${typesText}
      `;
    } else {
      statsBody.innerHTML = `<span class="log-err">Error: ${d.detail || 'Stats unavailable'}</span>`;
    }
  } catch (e) {
    statsBody.innerHTML = '<span class="log-err">Stats fetch failed.</span>';
  }
}

async function kbSearch() {
  const pid = document.getElementById('kb-project-select').value;
  const query = document.getElementById('kb-search-query').value.trim();
  const sourceFilter = document.getElementById('kb-source-select').value;
  const container = document.getElementById('kb-results-container');
  const badge = document.getElementById('kb-results-badge');

  if (!pid) { showToast('Please select a project first.', 'err'); return; }
  if (!query) { showToast('Please enter a search query.', 'err'); return; }

  container.innerHTML = '<div class="kb-empty-results"><span class="spin">⟳</span> Querying database vectors...</div>';
  badge.textContent = 'Searching...';

  try {
    const r = await fetch(`${API}/api/projects/${pid}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        top_k: 10,
        source_type_filter: sourceFilter || null,
        min_confidence: 0.0
      })
    });

    const d = await r.json();
    if (!r.ok) {
      container.innerHTML = `<div class="kb-empty-results log-err">Search failed: ${d.detail || 'Internal error'}</div>`;
      badge.textContent = '0 Results';
      return;
    }

    const results = d.results || [];
    badge.textContent = `${results.length} Results`;

    if (results.length === 0) {
      container.innerHTML = `
        <div class="kb-empty-results">
          <i class="bi bi-search" style="font-size: 2.5rem; color: var(--border2); margin-bottom: 12px; display: block;"></i>
          <p>No results matched your query. Try different keywords or check if the project database is empty.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = results.map(r => `
      <div class="kb-result-card">
        <div class="kb-result-meta">
          <div class="kb-result-title">
            <span class="chip-type ${chipClass(r.chunk.source_type)}">${typeLabel(r.chunk.source_type)}</span>
            <span>Chunk ID: ${esc(r.chunk.chunk_id.substring(0, 12))}...</span>
          </div>
          <span class="kb-result-score">Confidence Score: ${Math.round(r.confidence_score * 100)}%</span>
        </div>
        <div class="kb-result-doc">
          <i class="bi bi-file-earmark-text"></i>
          <span>Document: ${esc(r.chunk.document_name)} &nbsp;·&nbsp; Section: ${esc(r.chunk.metadata?.section_title || 'N/A')}</span>
        </div>
        <div class="kb-result-text">${esc(r.chunk.chunk_text)}</div>
      </div>
    `).join('');

  } catch (e) {
    container.innerHTML = '<div class="kb-empty-results log-err">Network error during query.</div>';
    badge.textContent = '0 Results';
  }
}

async function kbIngest() {
  const pid = document.getElementById('kb-project-select').value;
  const statusBox = document.getElementById('kb-ingest-status');

  if (!pid) { showToast('Please select a project first.', 'err'); return; }

  statusBox.className = 'logs-body log-info';
  statusBox.textContent = 'Triggering vector re-ingestion...';

  try {
    const r = await fetch(`${API}/api/projects/${pid}/ingest`, {
      method: 'POST'
    });
    const d = await r.json();
    if (r.ok) {
      statusBox.className = 'logs-body log-ok';
      statusBox.textContent = `Ingestion succeeded!\n${d.message}`;
      showToast('Re-indexing complete!', 'ok');
      kbProjectChanged(); // Refresh stats
    } else {
      statusBox.className = 'logs-body log-err';
      statusBox.textContent = `Ingestion failed:\n${d.detail || 'Internal server error'}`;
      showToast('Re-indexing failed.', 'err');
    }
  } catch (e) {
    statusBox.className = 'logs-body log-err';
    statusBox.textContent = 'Network error trying to contact ingestion server.';
    showToast('Re-indexing network error.', 'err');
  }
}
