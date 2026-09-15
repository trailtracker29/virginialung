/**
 * AI Workflow Engine — Shared Mock Data & State
 * This module owns all case state. Both patient and staff portals
 * read/write through this single source of truth.
 */

const WorkflowStates = {
  INCOMING: 'incoming',
  UNDERSTANDING: 'understanding',
  EXTRACTED: 'extracted',
  VALIDATION: 'validation',
  MISSING_INFO: 'missing_info',
  WAITING_USER: 'waiting_user',
  REVALIDATION: 'revalidation',
  ready_for_review: 'ready_for_review',
  APPROVED: 'approved',
  COMPLETED: 'completed',
  ESCALATED: 'escalated',
};

const WorkflowStateLabels = {
  incoming: 'Incoming',
  understanding: 'AI Understanding',
  extracted: 'Information Extracted',
  validation: 'Validation',
  missing_info: 'Missing Information',
  waiting_user: 'Waiting for User',
  revalidation: 'Re-validation',
  ready_for_review: 'Ready for Review',
  approved: 'Approved',
  completed: 'Completed',
  escalated: 'Escalated',
};

const CaseStatus = {
  NEW: 'new',
  AI_PROCESSED: 'ai_processed',
  NEEDS_INFO: 'needs_info',
  WAITING_USER: 'waiting_user',
  NEEDS_REVIEW: 'needs_review',
  READY_ACTION: 'ready_action',
  COMPLETED: 'completed',
  ESCALATED: 'escalated',
};

const StatusLabels = {
  new: 'New',
  ai_processed: 'AI Processed',
  needs_info: 'Needs Information',
  waiting_user: 'Waiting for User',
  needs_review: 'Needs Review',
  ready_action: 'Ready for Action',
  completed: 'Completed',
  escalated: 'Escalated',
};

const Priority = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

function generateId() {
  return 'REQ-' + Math.floor(10000 + Math.random() * 90000);
}

function now() { return new Date().toISOString(); }

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgo(n) {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

// ─── Seed Cases ──────────────────────────────────────────────────────────────

const seedCases = [];


// ─── State Manager ────────────────────────────────────────────────────────────

const AppState = {
  cases: [...seedCases],
  currentPatientCase: null,

  getCases() { return this.cases; },

  getCaseById(id) { return this.cases.find(c => c.id === id) || null; },

  addCase(caseData) {
    this.cases.unshift(caseData);
    return caseData;
  },

  updateCase(id, updates) {
    const idx = this.cases.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.cases[idx] = { ...this.cases[idx], ...updates, updatedAt: now() };
      return this.cases[idx];
    }
    return null;
  },

  addActivity(id, activity) {
    const c = this.getCaseById(id);
    if (c) {
      c.activity.push({ ...activity, timestamp: now() });
      c.updatedAt = now();
    }
  },

  addTimelineEntry(id, entry) {
    const c = this.getCaseById(id);
    if (c) {
      c.timeline.forEach(t => { t.active = false; });
      c.timeline.push({ ...entry, timestamp: now(), completed: true, active: true });
      c.updatedAt = now();
    }
  },

  getDashboardMetrics() {
    const cases = this.cases;
    return {
      total: cases.length,
      new: cases.filter(c => c.status === CaseStatus.NEW).length,
      aiProcessed: cases.filter(c => c.status === CaseStatus.AI_PROCESSED || c.status === CaseStatus.READY_ACTION).length,
      needsInfo: cases.filter(c => c.status === CaseStatus.NEEDS_INFO || c.status === CaseStatus.WAITING_USER).length,
      needsReview: cases.filter(c => c.status === CaseStatus.NEEDS_REVIEW || c.status === CaseStatus.ESCALATED).length,
      completed: cases.filter(c => c.status === CaseStatus.COMPLETED).length,
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso) {
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
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Backend Sync ──────────────────────────────────────────────────────────────
setInterval(async () => {
  try {
    const res = await fetch(`${window.AppConfig.API_BASE_URL}/api/cases`);
    const data = await res.json();
    if (data && Array.isArray(data)) {
      AppState.cases = data;
      // Trigger dashboard render if active
      if (typeof renderDashboard === 'function' && document.getElementById('viewDashboard')?.classList.contains('is-active')) {
        renderDashboard();
      }
      if (typeof renderCaseQueue === 'function' && document.getElementById('viewCaseQueue')?.classList.contains('is-active')) {
        renderCaseQueue();
      }
    }
  } catch (e) {
    // console.error('Failed to sync backend', e);
  }
}, 3000);
