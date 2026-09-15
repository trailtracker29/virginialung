module.exports = {
  // Workflow States: Represent the internal orchestration step in the AI engine pipeline.
  // These track where the case is in the automated process (e.g., waiting for AI, waiting for user, ready for a human to review).
  states: {
    MISSING_INFO: 'missing_info',
    READY_FOR_REVIEW: 'ready_for_review',
    ESCALATED: 'escalated',
    WAITING_USER: 'waiting_user'
  },
  
  // Operational Statuses: Represent the human-facing priority and filter category for staff.
  // Staff filter their dashboard by these statuses (e.g., what needs my review vs what is ready for action).
  statuses: {
    NEEDS_INFO: 'needs_info',
    READY_ACTION: 'ready_action',
    ESCALATED: 'escalated'
  },
  extractionRules: {
    requiredFields: [
      { field: 'Name', required: true },
      { field: 'Contact', required: true },
      { field: 'DOB', required: true }
    ],
    conditionalFields: [
      { type: 'referral', requires: ['Referral document'] },
      { type: 'new_patient', requires: ['Insurance information', 'Referral document'] },
      { type: 'schedule', requires: ['Appointment request'] }
    ]
  }
};
