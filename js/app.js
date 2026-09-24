/**
 * AI Workflow Engine — Global App Utilities
 * Shared functions used by both portals
 */

// ── Configuration ──────────────────────────────────────────────────────────────
window.AppConfig = {
  // Default to local backend.
  // For production, set API_BASE_URL to your Render backend URL.
  API_BASE_URL: 'https://virginialung-backend.onrender.com',
  
  // Production n8n Webhook for Intake
  INTAKE_WEBHOOK_URL: null,

  // Voice Configuration
  VOICE_NAME: 'Aoede'
};

// ── Toast Notifications ───────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', warning: '⚠', danger: '✕', info: 'ℹ' };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animationPlayState = 'running';
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ── Modal Handling ────────────────────────────────────────────────────────────

function openModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';

  overlay.addEventListener('click', function closeOnBackdrop(e) {
    if (e.target === overlay) {
      closeModal(overlayId);
      overlay.removeEventListener('click', closeOnBackdrop);
    }
  });
}

function closeModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
}

// ── Confidence Helpers ────────────────────────────────────────────────────────

function getConfidenceLevel(pct) {
  if (pct >= 80) return 'high';
  if (pct >= 60) return 'medium';
  return 'low';
}

function getConfidenceLabel(pct) {
  if (pct >= 80) return 'High';
  if (pct >= 60) return 'Medium';
  return 'Low';
}

function renderConfidenceBar(pct, container) {
  if (!container) return;
  const level = getConfidenceLevel(pct);
  const label = getConfidenceLabel(pct);
  container.innerHTML = `
    <div class="confidence-bar">
      <div class="confidence-bar__header">
        <span class="confidence-bar__label">AI Confidence</span>
        <span class="confidence-bar__value text-${level === 'high' ? 'success' : level === 'medium' ? 'warning' : 'danger'}">${pct}%</span>
      </div>
      <div class="confidence-bar__track">
        <div class="confidence-bar__fill confidence-bar__fill--${level}" style="width: 0%"></div>
      </div>
    </div>
  `;
  // Animate fill
  requestAnimationFrame(() => {
    const fill = container.querySelector('.confidence-bar__fill');
    if (fill) fill.style.width = pct + '%';
  });
}

// ── Status Rendering ──────────────────────────────────────────────────────────

function getStatusChipHTML(status) {
  const labels = {
    new: 'New',
    ai_processed: 'AI Processed',
    needs_info: 'Needs Info',
    waiting_user: 'Waiting for User',
    needs_review: 'Needs Review',
    ready_action: 'Ready for Action',
    completed: 'Completed',
    escalated: 'Escalated',
  };
  const icons = {
    new: '●',
    ai_processed: '⬡',
    needs_info: '⚠',
    waiting_user: '⏳',
    needs_review: '👁',
    ready_action: '✓',
    completed: '✔',
    escalated: '↑',
  };
  const label = labels[status] || status;
  const icon = icons[status] || '●';
  return `<span class="status-chip status-chip--${status}">${icon} ${label}</span>`;
}

function getPriorityHTML(priority) {
  return `<span class="priority-dot priority-dot--${priority}">${priority.charAt(0).toUpperCase() + priority.slice(1)}</span>`;
}

function getConfidencePillHTML(pct) {
  const level = getConfidenceLevel(pct);
  return `<span class="confidence-pill confidence-pill--${level}">${pct}%</span>`;
}

// ── Timeline Rendering ────────────────────────────────────────────────────────

function renderTimeline(timeline, container) {
  if (!container) return;
  container.innerHTML = timeline.map((item, idx) => {
    const isLast = idx === timeline.length - 1;
    const cls = item.active ? 'timeline-item--active' : item.completed ? 'timeline-item--completed' : 'timeline-item--pending';
    const icon = item.active ? '●' : item.completed ? '✓' : '';
    return `
      <div class="timeline-item ${cls}">
        ${!isLast ? '<div class="timeline-item__line"></div>' : ''}
        <div class="timeline-item__dot">${icon}</div>
        <div class="timeline-item__content">
          <div class="timeline-item__label">${item.label}</div>
          ${item.timestamp ? `<div class="timeline-item__time">${formatTimestamp(item.timestamp)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Info Check Rendering ──────────────────────────────────────────────────────

function renderCheckList(fields, container) {
  if (!container) return;
  const items = Object.entries(fields).map(([key, field]) => {
    const isOk   = field.status === 'confirmed';
    const isMiss = field.status === 'missing';
    const cls    = isOk ? 'check-item--ok' : isMiss ? 'check-item--miss' : 'check-item--warn';
    const icon   = isOk ? '✓' : isMiss ? '✕' : '?';
    const label  = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    return `
      <div class="check-item ${cls}">
        <div class="check-item__icon">${icon}</div>
        <span class="check-item__text">${label}: ${field.value || '—'}</span>
      </div>
    `;
  }).join('');
  container.innerHTML = `<div class="check-list">${items}</div>`;
}

// ── Delay Helper ──────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Format Relative Time ──────────────────────────────────────────────────────
// (defined in mock-data.js, duplicated safe guard)
if (typeof formatTimestamp === 'undefined') {
  window.formatTimestamp = function(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now2 = new Date();
    const diffMs = now2 - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
}
