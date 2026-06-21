/* QA Agent Factory — Frontend Logic
   ────────────────────────────────────
   All API calls go to the same origin (FastAPI serves both frontend and API).
   No external dependencies. Pure vanilla JS.
*/

'use strict';

const API = '';   // Same origin — FastAPI serves both frontend and API

// ── State ──────────────────────────────────────────────────────────────────
let currentProject = null;   // { project_id, name, ... }
let currentStep = 1;
let lastResults = null;

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  loadProjects();
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

// ── Navigation ─────────────────────────────────────────────────────────────
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

// ── Step 1: Projects ───────────────────────────────────────────────────────
async function loadProjects() {
  const r = await fetch(`${API}/api/projects`);
  const d = await r.json();
  const list = document.getElementById('projects-list');

  if (!d.projects || d.projects.length === 0) {
    list.innerHTML = '<div class="empty-state">No projects yet. Create your first project above.</div>';
    return;
  }

  list.innerHTML = d.projects.map(p => `
    <div class="project-item ${currentProject?.project_id === p.project_id ? 'selected' : ''}"
         onclick="selectProject(${JSON.stringify(p).replace(/"/g, '&quot;')})">
      <div>
        <div class="proj-name">${esc(p.name)}</div>
        <div class="proj-meta">${esc(p.description || '—')} &nbsp;·&nbsp; ${p.file_count || 0} files</div>
      </div>
      <span class="proj-arrow">→</span>
    </div>
  `).join('');
}

function selectProject(p) {
  currentProject = p;
  document.querySelectorAll('.project-item').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
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

  const r = await fetch(`${API}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description: document.getElementById('proj-desc').value.trim(),
    }),
  });
  btn.disabled = false;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create Project`;

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

// ── Step 2: File Upload ────────────────────────────────────────────────────
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
}

// ── Step 3: Generate ───────────────────────────────────────────────────────
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
  }, 4000);   // Advance indicator every 4s

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
      // Mark last running as error
      showToast(d.detail || 'Generation failed.', 'err');
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Generate Test Cases`;
      return;
    }

    lastResults = d;
    renderResults(d);
  } catch (e) {
    clearInterval(stepTimer);
    showToast('Network error — is the server running?', 'err');
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Generate Test Cases`;
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

// ── Step 4: Download ───────────────────────────────────────────────────────
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

// ── Utilities ──────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function appendLog(el, msg, type) {
  const line = document.createElement('div');
  line.className = `log-${type}`;
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function typeLabel(t) {
  const map = {
    user_stories: 'User Stories',
    api_specs: 'API Spec',
    existing_test_cases_defects: 'Test Cases',
  };
  return map[t] || t;
}

function chipClass(t) {
  const map = {
    user_stories: 'chip-stories',
    api_specs: 'chip-api',
    existing_test_cases_defects: 'chip-tests',
  };
  return map[t] || '';
}

let toastTimer;
function showToast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}
