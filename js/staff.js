/**
 * Staff Portal — JavaScript Logic
 * Dashboard, case queue, case detail, and all action simulations
 */

// ── State ─────────────────────────────────────────────────────────────────────

const StaffState = {
  currentView: 'viewDashboard',
  currentCaseId: null,
  currentFilter: 'all',
  searchQuery: '',
};

// ── View Switching ────────────────────────────────────────────────────────────

function switchStaffView(viewId, navItem) {
  document.querySelectorAll('.staff-view').forEach(v => v.classList.remove('is-active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('is-active');
  StaffState.currentView = viewId;

  // Nav highlight
  document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('is-active'));
  if (navItem) navItem.classList.add('is-active');

  // Topbar title
  const titles = {
    viewDashboard: ['Dashboard', 'AI Workflow Engine · Operations'],
    viewCaseQueue: ['Case Queue', 'AI Workflow Engine · Cases'],
    viewCaseDetail: ['Case Detail', 'AI Workflow Engine · Case View'],
  };
  const [title, breadcrumb] = titles[viewId] || ['Operations', ''];
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('topbarBreadcrumb').textContent = breadcrumb;

  if (viewId === 'viewDashboard') renderDashboard();
  if (viewId === 'viewCaseQueue') renderCaseQueue();

  // Close sidebar on mobile
  if (window.innerWidth < 768) {
    document.getElementById('staffSidebar').classList.remove('is-open');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleSidebar() {
  document.getElementById('staffSidebar').classList.toggle('is-open');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function renderDashboard() {
  const metrics = AppState.getDashboardMetrics();
  updateSidebarBadges(metrics);

  // Metrics grid
  const grid = document.getElementById('metricsGrid');
  if (grid) {
    grid.innerHTML = `
      ${metricCard('📥', 'metric-card__icon--blue', metrics.new, 'New Cases', '+3 today', 'up')}
      ${metricCard('⬡', 'metric-card__icon--purple', metrics.aiProcessed, 'AI Processed', 'Ready for action', '')}
      ${metricCard('⚠', 'metric-card__icon--yellow', metrics.needsInfo, 'Needs Information', 'Awaiting patient', '')}
      ${metricCard('👁', 'metric-card__icon--red', metrics.needsReview, 'Needs Review', 'Human review required', '')}
      ${metricCard('✓', 'metric-card__icon--green', metrics.completed, 'Completed', 'This week', 'up')}
      ${metricCard('📊', 'metric-card__icon--gray', metrics.total, 'Total Cases', 'All time', '')}
    `;
  }

  // Recent cases table (show 6 most recent)
  const tbody = document.getElementById('dashboardCasesTbody');
  if (tbody) {
    const cases = AppState.getCases().slice(0, 6);
    tbody.innerHTML = cases.map(c => dashboardCaseRow(c)).join('');
  }
}

function metricCard(icon, iconClass, value, label, trend, trendDir) {
  return `
    <div class="metric-card">
      <div class="metric-card__icon ${iconClass}">${icon}</div>
      <div class="metric-card__value">${value}</div>
      <div class="metric-card__label">${label}</div>
      ${trend ? `<div class="metric-card__trend ${trendDir === 'up' ? 'metric-card__trend--up' : ''}">${trend}</div>` : ''}
    </div>
  `;
}

function dashboardCaseRow(c) {
  return `
    <tr onclick="openCaseDetail('${c.id}')">
      <td><span class="table-case-id">${c.id}</span></td>
      <td>
        <div class="table-patient-name">${c.patientName}</div>
        <div class="table-patient-meta">${c.email}</div>
      </td>
      <td class="table-request-type">${c.requestTypeLabel}</td>
      <td>${getStatusChipHTML(c.status)}</td>
      <td>${getConfidencePillHTML(c.aiConfidence)}</td>
      <td>${getPriorityHTML(c.priority)}</td>
      <td style="color:var(--color-neutral-400); font-size:0.82rem;">${formatTimestamp(c.updatedAt)}</td>
      <td>
        <button class="btn btn--secondary btn--sm" onclick="event.stopPropagation(); openCaseDetail('${c.id}')">View</button>
      </td>
    </tr>
  `;
}

function updateSidebarBadges(metrics) {
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('sidebarTotalBadge',     AppState.getCases().length);
  el('sidebarReviewBadge',    metrics.needsReview);
  el('sidebarInfoBadge',      metrics.needsInfo);
  el('sidebarReadyBadge',     metrics.aiProcessed);
  el('sidebarCompletedBadge', metrics.completed);
}

function refreshDashboard() {
  renderDashboard();
  showToast('Dashboard refreshed', 'success');
}

// ── Case Queue ────────────────────────────────────────────────────────────────

function filterCases(filter, btnEl) {
  StaffState.currentFilter = filter;

  // Update filter buttons
  if (btnEl) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('is-active'));
    btnEl.classList.add('is-active');
  }

  // Update queue title
  const titles = {
    all: 'All Cases', needs_review: 'Needs Review', needs_info: 'Needs Information',
    waiting_user: 'Waiting for User', ready_action: 'Ready for Action', completed: 'Completed',
  };
  const titleEl = document.getElementById('queueTitle');
  if (titleEl) titleEl.textContent = titles[filter] || 'Cases';

  renderCaseQueue();
}

function renderCaseQueue() {
  const filter = StaffState.currentFilter;
  const query  = StaffState.searchQuery.toLowerCase();

  let cases = AppState.getCases();

  if (filter !== 'all') {
    cases = cases.filter(c => {
      if (filter === 'needs_review') return c.status === 'needs_review' || c.status === 'escalated';
      if (filter === 'needs_info')   return c.status === 'needs_info' || c.status === 'waiting_user';
      return c.status === filter;
    });
  }

  if (query) {
    cases = cases.filter(c =>
      c.id.toLowerCase().includes(query) ||
      c.patientName.toLowerCase().includes(query) ||
      c.requestTypeLabel.toLowerCase().includes(query)
    );
  }

  const tbody = document.getElementById('queueCasesTbody');
  if (!tbody) return;

  if (cases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:40px; color:var(--color-neutral-400);">
          No cases match the current filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cases.map(c => queueCaseRow(c)).join('');
}

function queueCaseRow(c) {
  const missing = c.missingInfo && c.missingInfo.length > 0
    ? `<span class="missing-tag">⚠ ${c.missingInfo[0]}${c.missingInfo.length > 1 ? ' +' + (c.missingInfo.length - 1) : ''}</span>`
    : `<span class="none-tag">None</span>`;

  return `
    <tr onclick="openCaseDetail('${c.id}')" ${c.humanReviewRequired ? 'style="background:rgba(220,38,38,0.03);"' : ''}>
      <td><span class="table-case-id">${c.id}</span></td>
      <td>
        <div class="table-patient-name">${c.patientName}</div>
        <div class="table-patient-meta">${c.patientStatus === 'new' ? '🆕 New' : '👤 Existing'} patient</div>
      </td>
      <td class="table-request-type">${c.requestTypeLabel}</td>
      <td>${getStatusChipHTML(c.status)}</td>
      <td>${getConfidencePillHTML(c.aiConfidence)}</td>
      <td>${missing}</td>
      <td>${getPriorityHTML(c.priority)}</td>
      <td style="color:var(--color-neutral-400); font-size:0.82rem; white-space:nowrap;">${formatTimestamp(c.updatedAt)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn--primary btn--sm" onclick="event.stopPropagation(); openCaseDetail('${c.id}')">View Case</button>
        </div>
      </td>
    </tr>
  `;
}

function searchCases(query) {
  StaffState.searchQuery = query;
  if (StaffState.currentView === 'viewCaseQueue') renderCaseQueue();
}

// ── Case Detail ───────────────────────────────────────────────────────────────

function openCaseDetail(caseId) {
  const c = AppState.getCaseById(caseId);
  if (!c) { showToast('Case not found', 'danger'); return; }
  StaffState.currentCaseId = caseId;

  renderCaseDetail(c);
  switchStaffView('viewCaseDetail', null);
  document.getElementById('topbarTitle').textContent = 'Case — ' + caseId;
  document.getElementById('topbarBreadcrumb').textContent = c.patientName + ' · ' + c.requestTypeLabel;
}

function renderCaseDetail(c) {
  const confLevel = getConfidenceLevel(c.aiConfidence);
  const confLabel = getConfidenceLabel(c.aiConfidence);

  const docListHTML = c.documents && c.documents.length > 0
    ? c.documents.map(d => `
        <div class="doc-item">
          <div class="doc-item__icon">📄</div>
          <div class="doc-item__info">
            <div class="doc-item__name">${d.name}</div>
            <div class="doc-item__meta">${d.type} · ${d.size} · ${formatTimestamp(d.uploadedAt)}</div>
          </div>
          <span class="badge badge--success">✓ Verified</span>
        </div>`).join('')
    : '<div style="color:var(--color-neutral-400); font-size:0.85rem;">No documents received</div>';

  const extractedHTML = Object.entries(c.extractedInfo).map(([key, field]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    return `
      <div class="extracted-info-item extracted-info-item--${field.status}">
        <div class="extracted-info-item__key">${field.status === 'confirmed' ? '✓' : field.status === 'missing' ? '✕' : '?'} ${label}</div>
        <div class="extracted-info-item__value">${field.value}</div>
      </div>`;
  }).join('');

  const missingHTML = c.missingInfo && c.missingInfo.length > 0
    ? c.missingInfo.map(m => `
        <div class="check-item check-item--miss">
          <div class="check-item__icon">✕</div>
          <span class="check-item__text">${m}</span>
        </div>`).join('')
    : '<div class="check-item check-item--ok"><div class="check-item__icon">✓</div><span class="check-item__text">All information complete</span></div>';

  const activityHTML = (c.activity || []).map(a => `
    <div class="activity-item activity-item--${a.type}">
      <div class="activity-item__dot"></div>
      <div class="activity-item__text">${a.text}</div>
      <div class="activity-item__time">${formatTimestamp(a.timestamp)}</div>
    </div>`).join('');

  const humanReviewBanner = c.humanReviewRequired ? `
    <div class="review-warning" style="margin-bottom:16px;">
      <span>⚠</span>
      <span>Human review required — low AI confidence</span>
    </div>` : '';

  document.getElementById('caseDetailContent').innerHTML = `
    <!-- Back + Header -->
    <div class="case-detail-header">
      <button class="back-btn" onclick="goBackFromDetail()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
      <span class="case-detail-id">${c.id}</span>
      ${getStatusChipHTML(c.status)}
      ${getPriorityHTML(c.priority)}
      ${c.humanReviewRequired ? '<span class="badge badge--danger">⚠ Review required</span>' : ''}
    </div>

    <!-- Two-column layout -->
    <div class="case-detail-layout">

      <!-- ── Left: Case Information ── -->
      <div class="case-detail-left">

        <!-- Original request -->
        <div class="detail-section">
          <div class="detail-section__header">
            <div class="detail-section__title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Patient Request
            </div>
            <div style="font-size:0.78rem; color:var(--color-neutral-400);">${formatTimestamp(c.createdAt)}</div>
          </div>
          <div class="detail-section__body">
            <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap;">
              <div>
                <div style="font-size:1rem; font-weight:700; color:var(--color-neutral-900); margin-bottom:2px;">${c.patientName}</div>
                <div style="font-size:0.82rem; color:var(--color-neutral-500);">${c.email} · ${c.phone}</div>
                <div style="font-size:0.82rem; color:var(--color-neutral-500); margin-top:2px;">DOB: ${c.dob || 'N/A'} · ${c.patientStatus === 'new' ? 'New patient' : 'Existing patient'}</div>
              </div>
              <div style="margin-left:auto; flex-shrink:0;">
                <span class="badge badge--${c.patientStatus === 'new' ? 'primary' : 'neutral'}">${c.patientStatus === 'new' ? '🆕 New' : '👤 Existing'}</span>
              </div>
            </div>
            <div class="request-text-block">"${c.requestText}"</div>
          </div>
        </div>

        <!-- Extracted Information -->
        <div class="detail-section">
          <div class="detail-section__header">
            <div class="detail-section__title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              AI-Extracted Information
            </div>
            <span class="badge badge--primary">⬡ AI extracted</span>
          </div>
          <div class="detail-section__body">
            <div class="extracted-info-grid">${extractedHTML}</div>
          </div>
        </div>

        <!-- Documents -->
        <div class="detail-section">
          <div class="detail-section__header">
            <div class="detail-section__title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Documents
            </div>
            <span style="font-size:0.78rem; color:var(--color-neutral-400);">${c.documents ? c.documents.length : 0} received</span>
          </div>
          <div class="detail-section__body">
            <div class="doc-list">${docListHTML}</div>
          </div>
        </div>

        <!-- Workflow Timeline -->
        <div class="detail-section">
          <div class="detail-section__header">
            <div class="detail-section__title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Workflow Timeline
            </div>
          </div>
          <div class="detail-section__body">
            <div id="caseTimeline"></div>
          </div>
        </div>

        <!-- Activity Log -->
        <div class="detail-section">
          <div class="detail-section__header">
            <div class="detail-section__title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Activity Log
            </div>
          </div>
          <div class="detail-section__body">
            <div class="activity-log" id="caseActivityLog">${activityHTML}</div>
          </div>
        </div>

      </div>

      <!-- ── Right: AI Action Panel ── -->
      <div class="action-panel" id="actionPanel">

        <!-- AI Summary -->
        <div class="action-panel-card">
          <div class="action-panel-card__header">
            <div class="action-panel-card__header-icon action-panel-card__header-icon--ai">⬡</div>
            <div class="action-panel-card__title">AI Summary</div>
          </div>
          <div class="action-panel-card__body">
            <div class="ai-summary-text">"${c.aiSummary}"</div>

            <div class="intent-row">
              <div class="intent-row__label">Intent</div>
              <div class="intent-row__value">${c.detectedIntent}</div>
            </div>

            <div class="intent-row">
              <div class="intent-row__label">Confidence</div>
              <div class="intent-row__value">
                <span class="confidence-pill confidence-pill--${confLevel}">${c.aiConfidence}% — ${confLabel}</span>
              </div>
            </div>

            <div style="margin-top:12px;" id="summaryConfBar"></div>

            ${c.humanReviewRequired ? `
              <div class="review-warning" style="margin-top:12px;">
                <span>⚠</span>
                <span>Human review recommended</span>
              </div>` : ''}
          </div>
        </div>

        <!-- Missing Information -->
        <div class="action-panel-card" id="missingInfoPanel" ${!c.missingInfo || c.missingInfo.length === 0 ? 'style="display:none"' : ''}>
          <div class="action-panel-card__header">
            <div class="action-panel-card__header-icon action-panel-card__header-icon--warn">⚠</div>
            <div class="action-panel-card__title">Missing Information</div>
          </div>
          <div class="action-panel-card__body">
            <div class="check-list">${missingHTML}</div>
          </div>
        </div>

        <!-- AI Recommendation -->
        <div class="action-panel-card">
          <div class="action-panel-card__header">
            <div class="action-panel-card__header-icon action-panel-card__header-icon--action">💡</div>
            <div class="action-panel-card__title">AI Recommendation</div>
          </div>
          <div class="action-panel-card__body">
            ${humanReviewBanner}
            <div class="recommendation-box">
              <div class="recommendation-box__label">
                <span>⬡</span> Recommended action
              </div>
              <div class="recommendation-box__action" id="recActionText">${c.recommendedAction}</div>
              <div class="recommendation-box__reason" id="recReasonText">${c.actionReason}</div>
              <div class="recommendation-box__confidence" id="recConfBar"></div>
            </div>

            <div class="human-decision-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Human Decision
            </div>

            <div class="decision-buttons">
              <button class="decision-btn decision-btn--approve" id="approveBtn" onclick="actionApprove('${c.id}')">
                <div class="decision-btn__icon">✓</div>
                Approve
              </button>
              <button class="decision-btn decision-btn--edit" onclick="actionEdit('${c.id}')">
                <div class="decision-btn__icon">✏</div>
                Edit Rec.
              </button>
              <button class="decision-btn decision-btn--request" id="requestInfoBtn" onclick="actionRequestInfo('${c.id}')">
                <div class="decision-btn__icon">💬</div>
                Request Info
              </button>
              <button class="decision-btn decision-btn--escalate" onclick="actionEscalate('${c.id}')">
                <div class="decision-btn__icon">↑</div>
                Escalate
              </button>
            </div>

            ${c.status === 'completed' ? '' : `
              <div style="margin-top:12px; border-top:1px solid var(--color-neutral-100); padding-top:12px;">
                <button class="btn btn--secondary btn--sm btn--full" onclick="actionMarkComplete('${c.id}')">
                  Mark as Complete
                </button>
              </div>`}
          </div>
        </div>

        <!-- Case Info Quick View -->
        <div class="action-panel-card">
          <div class="action-panel-card__header">
            <div class="action-panel-card__title" style="font-size:0.78rem; color:var(--color-neutral-500);">Case Information</div>
          </div>
          <div class="action-panel-card__body" style="padding:12px 18px;">
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; font-size:0.82rem;">
                <span style="color:var(--color-neutral-500);">Case ID</span>
                <span style="font-family:monospace; font-weight:700; color:var(--color-primary);">${c.id}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.82rem;">
                <span style="color:var(--color-neutral-500);">Created</span>
                <span style="font-weight:500;">${formatTimestamp(c.createdAt)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.82rem;">
                <span style="color:var(--color-neutral-500);">Updated</span>
                <span style="font-weight:500;">${formatTimestamp(c.updatedAt)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.82rem;">
                <span style="color:var(--color-neutral-500);">Priority</span>
                <span>${getPriorityHTML(c.priority)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.82rem;">
                <span style="color:var(--color-neutral-500);">Workflow</span>
                <span style="font-weight:500; font-size:0.78rem;">${WorkflowStateLabels[c.workflowState] || c.workflowState}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Render confidence bars and timeline after DOM is ready
  renderConfidenceBar(c.aiConfidence, document.getElementById('summaryConfBar'));
  renderConfidenceBar(c.aiConfidence, document.getElementById('recConfBar'));
  renderTimeline(c.timeline, document.getElementById('caseTimeline'));
}

function goBackFromDetail() {
  if (StaffState.currentFilter !== 'all') {
    switchStaffView('viewCaseQueue', document.getElementById('navAllCases'));
  } else {
    switchStaffView('viewCaseQueue', document.getElementById('navAllCases'));
  }
  filterCases(StaffState.currentFilter);
}

// ── Case Actions ──────────────────────────────────────────────────────────────

async function actionApprove(caseId) {
  const c = AppState.getCaseById(caseId);
  if (!c) return;

  try {
    const res = await fetch(`${window.AppConfig.API_BASE_URL}/api/cases/${caseId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' })
    });
    
    if (!res.ok) throw new Error('Network response was not ok');
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Failed to approve');

    // Update local state temporarily for immediate UI response
    AppState.updateCase(caseId, result.caseData);
    
    showToast('Case approved ✓', 'success');
    openCaseDetail(caseId);
    renderDashboard();
  } catch (error) {
    showToast('Error approving case: ' + error.message, 'danger');
  }
}

function actionEdit(caseId) {
  const c = AppState.getCaseById(caseId);
  if (!c) return;

  document.getElementById('editRecAction').value = c.recommendedAction;
  document.getElementById('editRecReason').value = c.actionReason;

  document.getElementById('saveEditRecBtn').onclick = async () => {
    const newAction = document.getElementById('editRecAction').value.trim();
    const newReason = document.getElementById('editRecReason').value.trim();

    if (!newAction) { showToast('Please enter a recommended action', 'warning'); return; }

    const btn = document.getElementById('saveEditRecBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
      const res = await fetch(`${window.AppConfig.API_BASE_URL}/api/cases/${caseId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_recommendation',
          recommendationAction: newAction,
          recommendationReason: newReason
        })
      });

      if (!res.ok) throw new Error('Network error');
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      AppState.updateCase(caseId, result.caseData);
      closeModal('editRecModal');
      showToast('Recommendation updated', 'success');
      openCaseDetail(caseId);
    } catch (error) {
      showToast('Error updating recommendation: ' + error.message, 'danger');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  };

  openModal('editRecModal');
}

function actionRequestInfo(caseId) {
  const c = AppState.getCaseById(caseId);
  if (!c) return;

  // Pre-fill with missing info
  const missing = c.missingInfo && c.missingInfo.length > 0
    ? `Please provide the following to continue processing your request:\n• ${c.missingInfo.join('\n• ')}`
    : 'Please provide any additional information needed for your request.';

  document.getElementById('requestInfoText').value = missing;

  document.getElementById('sendInfoRequestBtn').onclick = async () => {
    const msg = document.getElementById('requestInfoText').value.trim();
    if (!msg) { showToast('Please enter a message', 'warning'); return; }

    const btn = document.getElementById('sendInfoRequestBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
      const res = await fetch(`${window.AppConfig.API_BASE_URL}/api/cases/${caseId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_info',
          requestInfoText: msg
        })
      });

      if (!res.ok) throw new Error('Network error');
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      AppState.updateCase(caseId, result.caseData);
      closeModal('requestInfoModal');
      showToast('Information request sent to patient', 'success');
      openCaseDetail(caseId);
      renderDashboard();
    } catch (error) {
      showToast('Error sending request: ' + error.message, 'danger');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  };

  openModal('requestInfoModal');
}

function actionEscalate(caseId) {
  document.getElementById('confirmModalTitle').textContent = 'Escalate Case';
  document.getElementById('confirmModalBody').innerHTML = `
    <p style="color:var(--color-neutral-600); font-size:0.9rem; margin-bottom:16px;">
      This will escalate the case to a senior staff member or specialist for review.
    </p>
    <div class="form-group">
      <label class="form-label">Escalation reason</label>
      <textarea class="form-textarea" id="escalationReason" rows="3" placeholder="Describe why this case needs escalation..."></textarea>
    </div>
  `;

  const confirmBtn = document.getElementById('confirmModalBtn');
  confirmBtn.className = 'btn btn--danger';
  confirmBtn.textContent = 'Escalate Case';
  confirmBtn.disabled = false;
  
  confirmBtn.onclick = async () => {
    const reason = document.getElementById('escalationReason')?.value || 'No reason provided';
    
    confirmBtn.textContent = 'Escalating...';
    confirmBtn.disabled = true;

    try {
      const res = await fetch(`${window.AppConfig.API_BASE_URL}/api/cases/${caseId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'escalate',
          escalationReason: reason
        })
      });

      if (!res.ok) throw new Error('Network error');
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      AppState.updateCase(caseId, result.caseData);
      closeModal('confirmModal');
      showToast('Case escalated', 'warning');
      openCaseDetail(caseId);
      renderDashboard();
    } catch (error) {
      showToast('Error escalating case: ' + error.message, 'danger');
      confirmBtn.textContent = 'Escalate Case';
      confirmBtn.disabled = false;
    }
  };

  openModal('confirmModal');
}

function actionMarkComplete(caseId) {
  document.getElementById('confirmModalTitle').textContent = 'Mark Case Complete';
  document.getElementById('confirmModalBody').innerHTML = `
    <p style="color:var(--color-neutral-600); font-size:0.9rem;">
      Mark this case as completed. This will move it to the completed queue and notify the patient that their request has been processed.
    </p>
  `;

  const confirmBtn = document.getElementById('confirmModalBtn');
  confirmBtn.className = 'btn btn--success';
  confirmBtn.textContent = 'Mark Complete';
  confirmBtn.disabled = false;
  
  confirmBtn.onclick = async () => {
    confirmBtn.textContent = 'Marking...';
    confirmBtn.disabled = true;

    try {
      const res = await fetch(`${window.AppConfig.API_BASE_URL}/api/cases/${caseId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' })
      });

      if (!res.ok) throw new Error('Network error');
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      AppState.updateCase(caseId, result.caseData);
      closeModal('confirmModal');
      showToast('Case marked complete ✓', 'success');
      openCaseDetail(caseId);
      renderDashboard();
    } catch (error) {
      showToast('Error completing case: ' + error.message, 'danger');
      confirmBtn.textContent = 'Mark Complete';
      confirmBtn.disabled = false;
    }
  };

  openModal('confirmModal');
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderDashboard();

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('staffSidebar');
    const toggle  = document.getElementById('sidebarToggle');
    if (window.innerWidth < 768 && sidebar.classList.contains('is-open')) {
      if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('is-open');
      }
    }
  });
});
