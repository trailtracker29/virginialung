/**
 * Patient Portal — JavaScript Logic
 * Handles all 7 steps of the intake flow + case status views
 */

// ── State ─────────────────────────────────────────────────────────────────────

const PatientState = {
  currentStep: 1,
  requestType: null,
  requestTypeLabel: null,
  patientType: 'new',
  uploadedFiles: [],
  aiResult: null,
  submittedCaseId: null,
  patientCaseId: null,   // track the case ID in AppState
  confirmationShown: false,
  patientConfirmed: false,
};

// ── View Navigation ───────────────────────────────────────────────────────────

function showView(viewId) {
  document.querySelectorAll('.patient-view').forEach(v => v.classList.remove('is-active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('is-active');

  // Update nav
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (viewId === 'viewRequest')           document.getElementById('navNewRequest')?.classList.add('active');
  if (viewId === 'viewCaseStatus')        document.getElementById('navCaseStatus')?.classList.add('active');
  if (viewId === 'viewPatientCaseDetail') document.getElementById('navCaseStatus')?.classList.add('active');

  if (viewId === 'viewCaseStatus') updateCaseStatusView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Step 1: Request Type ──────────────────────────────────────────────────────

function selectRequestType(card) {
  document.querySelectorAll('.request-type-card').forEach(c => c.classList.remove('is-selected'));
  card.classList.add('is-selected');
  PatientState.requestType = card.dataset.type;
  PatientState.requestTypeLabel = card.dataset.label;
  document.getElementById('step1NextBtn').disabled = false;
}

function goToStep2() {
  if (!PatientState.requestType) {
    showToast('Please select a request type', 'warning');
    return;
  }
  document.getElementById('step1').classList.add('hidden');
  document.getElementById('stepsWrapper').classList.remove('hidden');
  showStepCard(2);
  setProgress(1);
}

function backToStep1() {
  document.getElementById('step1').classList.remove('hidden');
  document.getElementById('stepsWrapper').classList.add('hidden');
  PatientState.currentStep = 1;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function setProgress(completedUpTo) {
  // completedUpTo = last fully completed step number (1-based)
  for (let i = 1; i <= 7; i++) {
    const el = document.getElementById('prog' + i);
    if (!el) continue;
    el.parentElement.classList.remove('progress-step--completed', 'progress-step--active');
    if (i < completedUpTo) {
      el.textContent = '✓';
      el.parentElement.classList.add('progress-step--completed');
    } else if (i === completedUpTo) {
      el.textContent = i;
      el.parentElement.classList.add('progress-step--active');
    } else {
      el.textContent = i;
    }
  }
}

// ── Step Card Switching ───────────────────────────────────────────────────────

function showStepCard(num) {
  [2,3,4,5,6,7].forEach(n => {
    const el = document.getElementById('step' + n);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById('step' + num);
  if (target) target.classList.remove('hidden');
  PatientState.currentStep = num;
  setProgress(num);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Step 2: Basic Info ────────────────────────────────────────────────────────

function setPatientType(type) {
  PatientState.patientType = type;
  document.getElementById('toggleNew').classList.toggle('is-active', type === 'new');
  document.getElementById('toggleExisting').classList.toggle('is-active', type === 'existing');
}

function validateStep2() {
  let valid = true;
  const fields = [
    { id: 'firstName', errId: 'firstNameErr', test: v => v.trim().length > 0 },
    { id: 'lastName',  errId: 'lastNameErr',  test: v => v.trim().length > 0 },
    { id: 'dob',       errId: 'dobErr',       test: v => v.trim().length > 0 },
    { id: 'phone',     errId: 'phoneErr',     test: v => v.trim().length >= 7 },
    { id: 'email',     errId: 'emailErr',     test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
  ];
  fields.forEach(({ id, errId, test }) => {
    const input = document.getElementById(id);
    const err   = document.getElementById(errId);
    if (!input) return;
    const ok = test(input.value);
    input.classList.toggle('is-error', !ok);
    if (err) err.classList.toggle('hidden', ok);
    if (!ok) valid = false;
  });
  return valid;
}

function goToStep3() {
  if (!validateStep2()) {
    showToast('Please fill in all required fields', 'warning');
    return;
  }
  // Update step 3 type label
  const typeIcons = {
    new_patient: '🆕', schedule: '📅', reschedule: '🔄', referral: '📋',
    billing: '💳', documents: '📎', existing: '👤', other: '💬',
  };
  document.getElementById('step3TypeIcon').textContent = typeIcons[PatientState.requestType] || '📋';
  document.getElementById('step3TypeLabel').textContent = PatientState.requestTypeLabel;
  showStepCard(3);
}

// ── Step 3: AI Analysis ───────────────────────────────────────────────────────

async function analyzeRequest() {
  const text = document.getElementById('requestText').value.trim();
  if (!text) {
    document.getElementById('requestText').classList.add('is-error');
    document.getElementById('requestTextErr').classList.remove('hidden');
    showToast('Please describe your request first', 'warning');
    return;
  }
  document.getElementById('requestText').classList.remove('is-error');
  document.getElementById('requestTextErr').classList.add('hidden');

  const analyzeBtn = document.getElementById('step3AnalyzeBtn');
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = '<div class="spinner"></div> Analyzing...';

  // Show processing animation
  document.getElementById('aiProcessingBlock').classList.remove('hidden');
  document.getElementById('aiResultBlock').classList.remove('is-visible');

  const stages = [
    { status: 'Understanding your request...', sub: 'Analyzing language and intent' },
    { status: 'Extracting information...', sub: 'Identifying key details from your description' },
    { status: 'Checking for completeness...', sub: 'Comparing against required fields' },
    { status: 'Generating summary...', sub: 'Preparing your case' },
  ];

  for (const stage of stages) {
    document.getElementById('aiStatusText').textContent = stage.status;
    document.getElementById('aiSubstatusText').textContent = stage.sub;
    await delay(900);
  }

  // Simulate AI result based on text + request type
  const result = simulateAIAnalysis(text, PatientState.requestType);
  PatientState.aiResult = result;

  // Hide processing, show result
  document.getElementById('aiProcessingBlock').classList.add('hidden');
  document.getElementById('aiDetectedIntent').textContent = result.intent;

  // Render extracted items
  const itemsEl = document.getElementById('aiExtractedItems');
  itemsEl.innerHTML = result.extracted.map(item =>
    `<div class="ai-extracted-item">
      <span class="${item.found ? 'icon-check' : 'icon-warn'}">${item.found ? '✓' : '⚠'}</span>
      <span>${item.label}</span>
    </div>`
  ).join('');

  // Confidence bar
  renderConfidenceBar(result.confidence, document.getElementById('aiConfidenceContainer'));

  document.getElementById('aiResultBlock').classList.add('is-visible');

  // Swap buttons
  analyzeBtn.classList.add('hidden');
  document.getElementById('step3NextBtn').classList.remove('hidden');

  showToast('AI analysis complete', 'success');
}

function simulateAIAnalysis(text, type) {
  const lowerText = text.toLowerCase();

  const hasInsurance = lowerText.includes('insurance') || lowerText.includes('coverage');
  const hasReferral  = lowerText.includes('referral') || lowerText.includes('referred') || lowerText.includes('doctor gave');
  const hasAppt     = lowerText.includes('appointment') || lowerText.includes('schedule') || lowerText.includes('book');
  const isNew       = PatientState.patientType === 'new' || lowerText.includes('new patient');
  const isExisting  = PatientState.patientType === 'existing' || lowerText.includes('existing');

  const intents = {
    new_patient: 'New patient appointment request',
    schedule:    'Appointment scheduling request',
    reschedule:  'Appointment reschedule request',
    referral:    'Specialist referral request',
    billing:     'Insurance / billing inquiry',
    documents:   'Document submission',
    existing:    'Existing patient request',
    other:       'General administrative request',
  };

  const extracted = [
    { label: 'Name provided',           found: true },
    { label: 'Contact information',     found: true },
    { label: 'Date of birth',           found: true },
    { label: isNew ? 'New patient' : 'Existing patient', found: true },
    { label: 'Insurance information',   found: hasInsurance },
    { label: 'Referral mentioned',      found: hasReferral },
    { label: 'Appointment request',     found: hasAppt || type === 'schedule' || type === 'new_patient' },
  ].filter((item, idx, arr) => {
    // only show relevant items
    if (type === 'billing') return idx < 5;
    if (type === 'documents') return idx < 5;
    return true;
  });

  // Calculate confidence
  let conf = 70;
  if (text.length > 50) conf += 10;
  if (hasInsurance)     conf += 5;
  if (hasReferral)      conf += 5;
  if (type !== 'other') conf += 5;
  conf = Math.min(conf, 97);

  // Missing
  const missing = [];
  if (!hasInsurance && type !== 'billing') missing.push('Insurance information');
  if (!hasReferral && (type === 'new_patient' || type === 'referral')) missing.push('Referral document');

  return {
    intent: intents[type] || 'Administrative request',
    extracted,
    confidence: conf,
    missing,
  };
}

// ── Step 4: Info Check ────────────────────────────────────────────────────────

function goToStep4() {
  showStepCard(4);

  // Received items
  const received = document.getElementById('infoCheckReceived');
  const firstName = document.getElementById('firstName').value;
  const lastName  = document.getElementById('lastName').value;
  const email     = document.getElementById('email').value;
  const phone     = document.getElementById('phone').value;

  const items = [
    { label: 'Full name: ' + firstName + ' ' + lastName, ok: true },
    { label: 'Phone: ' + phone, ok: true },
    { label: 'Email: ' + email, ok: true },
    { label: 'Patient status: ' + (PatientState.patientType === 'new' ? 'New patient' : 'Existing patient'), ok: true },
    { label: 'Insurance information', ok: PatientState.aiResult?.extracted.find(e => e.label === 'Insurance information')?.found || false },
    { label: 'Referral', ok: PatientState.aiResult?.extracted.find(e => e.label === 'Referral mentioned')?.found || false },
  ];

  received.innerHTML = items.map(item => `
    <div class="check-item ${item.ok ? 'check-item--ok' : 'check-item--miss'}">
      <div class="check-item__icon">${item.ok ? '✓' : '✕'}</div>
      <span class="check-item__text">${item.label}</span>
    </div>
  `).join('');

  // Missing alerts
  const missing = PatientState.aiResult?.missing || [];
  const missingSection = document.getElementById('missingInfoSection');
  const missingAlerts  = document.getElementById('missingAlerts');
  const uploadBtn      = document.getElementById('step4UploadBtn');

  if (missing.length > 0) {
    missingSection.classList.remove('hidden');
    missingAlerts.innerHTML = missing.map(m => `
      <div class="missing-alert">
        <div class="missing-alert__title">⚠ Missing: ${m}</div>
        <div class="missing-alert__text">
          ${m.includes('Insurance') ?
            'We noticed you didn\'t mention insurance information. If you have insurance, please upload your insurance card on the next step.' :
            'We noticed you mentioned having a referral, but the document has not been uploaded yet. Please upload it on the next step.'}
        </div>
      </div>
    `).join('');
    uploadBtn.textContent = 'Upload Missing Documents';
  } else {
    missingSection.classList.add('hidden');
    uploadBtn.textContent = 'Continue to Documents';
  }
}

// ── Step 5: Document Upload ───────────────────────────────────────────────────

function goToStep5() {
  showStepCard(5);
}

function handleFileSelect(files) {
  Array.from(files).forEach(file => {
    const docType = document.getElementById('docTypeSelect').value;
    addFileToUpload(file, docType);
  });
  // Reset input so same file can be re-selected
  document.getElementById('fileInput').value = '';
}

function addFileToUpload(file, docType) {
  const id = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const sizeStr = file.size > 1024 * 1024
    ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
    : (file.size / 1024).toFixed(0) + ' KB';

  PatientState.uploadedFiles.push({ id, name: file.name, type: docType, size: sizeStr, status: 'uploading' });

  const list = document.getElementById('uploadedFilesList');
  const item = document.createElement('div');
  item.className = 'file-item';
  item.id = id;
  item.innerHTML = `
    <div class="file-item__icon">📄</div>
    <div class="file-item__info">
      <div class="file-item__name">${file.name}</div>
      <div class="file-item__meta">${docType} · ${sizeStr}</div>
      <div class="file-item__progress">
        <div class="file-item__progress-bar" id="prog_${id}" style="width:0%"></div>
      </div>
    </div>
    <div class="file-item__status" id="status_${id}" style="color:var(--color-neutral-400);">Uploading...</div>
    <button class="file-item__remove" onclick="removeFile('${id}')" aria-label="Remove file">✕</button>
  `;
  list.appendChild(item);

  // Simulate upload progress
  simulateUpload(id);
}

async function simulateUpload(id) {
  const bar    = document.getElementById('prog_' + id);
  const status = document.getElementById('status_' + id);
  if (!bar || !status) return;

  // Animate progress
  let pct = 0;
  const interval = setInterval(() => {
    pct = Math.min(pct + Math.random() * 25, 100);
    bar.style.width = pct + '%';
    if (pct >= 100) {
      clearInterval(interval);
      bar.style.background = 'var(--color-success)';
      status.innerHTML = '<span style="color:var(--color-success);">✓ Received</span>';
      // Update state
      const f = PatientState.uploadedFiles.find(f => f.id === id);
      if (f) f.status = 'verified';

      showDocCheck();
    }
  }, 300);
}

async function showDocCheck() {
  const block = document.getElementById('docCheckBlock');
  block.classList.remove('hidden');
  const texts = [
    'Checking your documents...',
    'Verifying document format...',
    'Information extracted ✓',
  ];
  for (const t of texts) {
    document.getElementById('docCheckText').textContent = t;
    await delay(1000);
  }
  block.classList.add('hidden');
  showToast('Document received and verified', 'success');
}

function removeFile(id) {
  PatientState.uploadedFiles = PatientState.uploadedFiles.filter(f => f.id !== id);
  const el = document.getElementById(id);
  if (el) el.remove();
}

// Drag and drop
const uploadZone = document.getElementById('uploadZone');
if (uploadZone) {
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFileSelect(e.dataTransfer.files);
  });
}

// ── Step 6: Review ────────────────────────────────────────────────────────────

function goToStep6() {
  showStepCard(6);
  buildReview();
}

function buildReview() {
  const firstName = document.getElementById('firstName').value;
  const lastName  = document.getElementById('lastName').value;
  const dob       = document.getElementById('dob').value;
  const phone     = document.getElementById('phone').value;
  const email     = document.getElementById('email').value;

  document.getElementById('reviewRequestType').textContent = PatientState.requestTypeLabel || '—';
  document.getElementById('reviewRequestText').textContent = document.getElementById('requestText').value || '—';
  document.getElementById('reviewName').textContent        = firstName + ' ' + lastName;
  document.getElementById('reviewDob').textContent         = dob ? new Date(dob + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
  document.getElementById('reviewPhone').textContent       = phone || '—';
  document.getElementById('reviewEmail').textContent       = email || '—';
  document.getElementById('reviewPatientStatus').textContent = PatientState.patientType === 'new' ? 'New Patient' : 'Existing Patient';

  // Documents
  const docsEl = document.getElementById('reviewDocsList');
  if (PatientState.uploadedFiles.length > 0) {
    docsEl.innerHTML = PatientState.uploadedFiles.map(f =>
      `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:0.85rem;">
        <span style="color:var(--color-success);">✓</span>
        <span style="font-weight:500;">${f.name}</span>
        <span style="color:var(--color-neutral-400);">· ${f.type}</span>
      </div>`
    ).join('');
  } else {
    docsEl.innerHTML = '<div style="font-size:0.82rem; color:var(--color-neutral-400);">No documents uploaded</div>';
  }

  // AI summary
  const conf = PatientState.aiResult?.confidence || 85;
  document.getElementById('reviewAiSummary').textContent =
    `Intent detected: ${PatientState.aiResult?.intent || 'Administrative request'} (${conf}% confidence). Case is prepared and ready for staff review.`;
  renderConfidenceBar(conf, document.getElementById('reviewConfidenceBar'));
}

// ── Step 7: Submit ────────────────────────────────────────────────────────────

async function submitCase() {
  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const dob       = document.getElementById('dob').value;
  const phone     = document.getElementById('phone').value.trim();
  const email     = document.getElementById('email').value.trim();
  const text      = document.getElementById('requestText').value.trim();

  const payload = {
    firstName,
    lastName,
    dob,
    phone,
    email,
    requestText: text,
    requestType: PatientState.requestType,
    requestTypeLabel: PatientState.requestTypeLabel,
    patientType: PatientState.patientType,
    documents: PatientState.uploadedFiles
  };

  try {
    const targetUrl = window.AppConfig.INTAKE_WEBHOOK_URL || `${window.AppConfig.API_BASE_URL}/api/intake`;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    
    const newCase = result.caseData;
    
    PatientState.submittedCaseId = newCase.id;
    PatientState.patientCaseId   = newCase.id;

    // Show step 7
    showStepCard(7);
    document.getElementById('submittedCaseId').textContent = newCase.id;
    setProgress(7);
    showToast('Request submitted successfully!', 'success');
  } catch (error) {
    console.error('Submission failed:', error);
    showToast('Submission failed. Please try again later.', 'danger');
  }
}

function copyCaseId() {
  const id = document.getElementById('submittedCaseId').textContent;
  navigator.clipboard?.writeText(id).then(() => {
    document.getElementById('copyBtn').textContent = 'Copied!';
    setTimeout(() => { document.getElementById('copyBtn').textContent = 'Copy ID'; }, 2000);
  });
}

function startNewRequest() {
  // Reset state
  PatientState.currentStep    = 1;
  PatientState.requestType    = null;
  PatientState.requestTypeLabel = null;
  PatientState.patientType    = 'new';
  PatientState.uploadedFiles  = [];
  PatientState.aiResult       = null;

  // Reset UI
  document.querySelectorAll('.request-type-card').forEach(c => c.classList.remove('is-selected'));
  document.getElementById('step1NextBtn').disabled = true;
  document.getElementById('step1').classList.remove('hidden');
  document.getElementById('stepsWrapper').classList.add('hidden');

  ['firstName','lastName','dob','phone','email','requestText'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('uploadedFilesList').innerHTML = '';
  document.getElementById('aiResultBlock').classList.remove('is-visible');
  document.getElementById('aiProcessingBlock').classList.add('hidden');
  document.getElementById('step3AnalyzeBtn').classList.remove('hidden');
  document.getElementById('step3AnalyzeBtn').disabled = false;
  document.getElementById('step3AnalyzeBtn').innerHTML = 'Analyze My Request <span>⬡</span>';
  document.getElementById('step3NextBtn').classList.add('hidden');

  setPatientType('new');
  showView('viewRequest');
}

// ── Case Status View ──────────────────────────────────────────────────────────

async function updateCaseStatusView() {
  const list = document.getElementById('patientCasesList');
  const noMsg = document.getElementById('noCasesMsg');

  if (!list) return;

  try {
    const response = await fetch(`${window.AppConfig.API_BASE_URL}/api/cases`);
    const allCases = await response.json();
    const displayCases = allCases.slice(0, 5);

    if (displayCases.length === 0) {
      noMsg.classList.remove('hidden');
      list.innerHTML = '';
      return;
    }

    noMsg.classList.add('hidden');
    list.innerHTML = displayCases.map(c => renderPatientCaseCard(c)).join('');
  } catch (error) {
    console.error('Error fetching cases:', error);
  }
}

function renderPatientCaseCard(c) {
  const statusBannerClass = {
    ready_action: 'case-status-banner--ready',
    completed: 'case-status-banner--ready',
    needs_info: 'case-status-banner--waiting',
    waiting_user: 'case-status-banner--waiting',
    needs_review: 'case-status-banner--review',
    ai_processed: 'case-status-banner--review',
    new: 'case-status-banner--review',
    escalated: 'case-status-banner--waiting',
  };

  const statusIcon = {
    ready_action: '✓', completed: '✔', needs_info: '⚠', waiting_user: '⏳',
    needs_review: '👁', ai_processed: '⬡', new: '●', escalated: '↑',
  };

  const statusDesc = {
    ready_action: 'Your case is ready. A staff member is about to take the next action.',
    completed: 'Your request has been completed.',
    needs_info: 'We need additional information to proceed.',
    waiting_user: 'We are waiting for your response.',
    needs_review: 'A staff member is reviewing your case.',
    ai_processed: 'AI has processed your case. Awaiting staff review.',
    new: 'Your case has been received and is being processed.',
    escalated: 'Your case has been escalated for specialist review.',
  };

  const hasAction = c.status === 'needs_info' || c.status === 'waiting_user';
  const statusLabel = StatusLabels[c.status] || c.status;

  return `
    <div class="card" style="margin-bottom:16px; cursor:pointer;" onclick="openPatientCaseDetail('${c.id}')">
      <div style="padding:20px 24px; border-bottom:1px solid var(--color-neutral-100); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-family:'Courier New',monospace; font-size:0.85rem; font-weight:700; color:var(--color-primary);">${c.id}</div>
          <div style="font-size:1rem; font-weight:700; color:var(--color-neutral-900); margin-top:2px;">${c.requestTypeLabel}</div>
          <div style="font-size:0.78rem; color:var(--color-neutral-400); margin-top:2px;">${formatTimestamp(c.createdAt)}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${getStatusChipHTML(c.status)}
          ${hasAction ? '<span class="badge badge--danger">Action needed</span>' : ''}
        </div>
      </div>
      <div style="padding:16px 24px;">
        <div class="case-status-banner ${statusBannerClass[c.status] || 'case-status-banner--review'}" style="margin-bottom:0;">
          <div class="case-status-banner__icon">${statusIcon[c.status] || '●'}</div>
          <div>
            <div class="case-status-banner__title">${statusLabel}</div>
            <div class="case-status-banner__desc">${statusDesc[c.status] || 'Your case is being processed.'}</div>
          </div>
        </div>
        ${hasAction ? `
          <div style="margin-top:12px;">
            <button class="btn btn--warning btn--sm" onclick="event.stopPropagation(); openPatientCaseDetail('${c.id}')">
              Provide Missing Information
            </button>
          </div>` : ''}
        ${c.missingInfo && c.missingInfo.length > 0 ? `
          <div style="margin-top:12px; font-size:0.8rem; color:var(--color-warning);">
            ⚠ Missing: ${c.missingInfo.join(', ')}
          </div>` : ''}
      </div>
    </div>
  `;
}

async function openPatientCaseDetail(caseId) {
  try {
    const response = await fetch(`${window.AppConfig.API_BASE_URL}/api/cases/${caseId}`);
    const c = await response.json();
    if (!c) return;

    const content = document.getElementById('patientCaseDetailContent');
    if (!content) return;

    const hasAction = c.status === 'needs_info' || c.status === 'waiting_user';

  content.innerHTML = `
    <div class="step-card" style="margin-bottom:20px;">
      <div class="case-status-hero">
        <div class="case-status-hero__id">${c.id}</div>
        <h2 style="margin-bottom:8px;">${c.requestTypeLabel}</h2>
        <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap;">
          ${getStatusChipHTML(c.status)}
          ${hasAction ? '<span class="badge badge--danger">Action needed</span>' : ''}
        </div>
      </div>

      ${hasAction ? `
        <div style="padding:0 28px 24px;">
          <div class="missing-alert">
            <div class="missing-alert__title">⚠ Information needed</div>
            <div class="missing-alert__text">
              The following information is still needed to process your request:
              <ul style="margin-top:8px; padding-left:16px; list-style:disc;">
                ${c.missingInfo.map(m => `<li style="margin-bottom:4px;">${m}</li>`).join('')}
              </ul>
            </div>
          </div>
          <button class="btn btn--warning btn--full" style="margin-top:12px;" onclick="showToast('Document upload coming — use the upload step', 'info')">
            ⚠ Provide Missing Information
          </button>
        </div>` : ''}

      <div style="padding:0 28px 28px;">
        <!-- Summary rows -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
          <div style="background:var(--color-neutral-50); border:1px solid var(--color-neutral-200); border-radius:var(--radius-md); padding:14px;">
            <div style="font-size:0.72rem; color:var(--color-neutral-400); font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">Submitted</div>
            <div style="font-size:0.85rem; font-weight:600;">${formatTimestamp(c.createdAt)}</div>
          </div>
          <div style="background:var(--color-neutral-50); border:1px solid var(--color-neutral-200); border-radius:var(--radius-md); padding:14px;">
            <div style="font-size:0.72rem; color:var(--color-neutral-400); font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">Last updated</div>
            <div style="font-size:0.85rem; font-weight:600;">${formatTimestamp(c.updatedAt)}</div>
          </div>
        </div>

        <!-- Request description -->
        <div style="margin-bottom:20px;">
          <div style="font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--color-neutral-500); margin-bottom:8px;">Your Request</div>
          <div class="request-text-block">${c.requestText}</div>
        </div>

        <!-- Documents -->
        ${c.documents && c.documents.length > 0 ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--color-neutral-500); margin-bottom:8px;">Documents</div>
            <div class="doc-list">
              ${c.documents.map(d => `
                <div class="doc-item">
                  <div class="doc-item__icon">📄</div>
                  <div class="doc-item__info">
                    <div class="doc-item__name">${d.name}</div>
                    <div class="doc-item__meta">${d.type} · ${d.size} · ${formatTimestamp(d.uploadedAt)}</div>
                  </div>
                  <span class="badge badge--success">✓ Received</span>
                </div>
              `).join('')}
            </div>
          </div>` : ''}

        <!-- Timeline -->
        <div>
          <div style="font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--color-neutral-500); margin-bottom:12px;">Case Timeline</div>
          <div id="patientTimeline"></div>
        </div>

        <!-- Note -->
        <div style="margin-top:20px; padding:14px 16px; background:var(--color-primary-light); border:1px solid var(--color-primary-subtle); border-radius:var(--radius-md); font-size:0.82rem; color:var(--color-neutral-600); line-height:1.6;">
          <strong style="color:var(--color-primary);">⬡ AI + Human:</strong> Our AI has prepared your case. A staff member will review it and take the next appropriate step. No clinical or scheduling decision is made without a human review.
        </div>
      </div>
    </div>
  `;

  renderTimeline(c.timeline || c.activities, document.getElementById('patientTimeline'));
  showView('viewPatientCaseDetail');
  } catch (error) {
    console.error('Failed to load case detail', error);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  showView('viewRequest');
});
