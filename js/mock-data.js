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
  READY_REVIEW: 'ready_review',
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
  ready_review: 'Ready for Review',
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

const seedCases = [
  {
    id: 'REQ-10482',
    patientName: 'John Smith',
    email: 'john.smith@email.com',
    phone: '+1 (555) 234-7890',
    dob: '1985-03-14',
    patientStatus: 'new',
    requestType: 'new_patient',
    requestTypeLabel: 'New Patient Appointment',
    requestText: 'I am a new patient and would like to schedule an appointment. My doctor gave me a referral and I also have my insurance information ready.',
    status: CaseStatus.READY_ACTION,
    workflowState: WorkflowStates.READY_REVIEW,
    priority: Priority.HIGH,
    aiConfidence: 94,
    aiSummary: 'This appears to be a new patient appointment request. The user has provided contact information, insurance information, and stated that they have a referral. All required administrative information appears complete.',
    detectedIntent: 'New patient appointment scheduling',
    extractedInfo: {
      name: { value: 'John Smith', status: 'confirmed' },
      contact: { value: 'john.smith@email.com / +1 (555) 234-7890', status: 'confirmed' },
      dob: { value: 'March 14, 1985', status: 'confirmed' },
      patientStatus: { value: 'New patient', status: 'confirmed' },
      insurance: { value: 'Blue Cross Blue Shield', status: 'confirmed' },
      referral: { value: 'Dr. Peterson, Primary Care', status: 'confirmed' },
    },
    missingInfo: [],
    recommendedAction: 'Review request and approve for scheduling.',
    actionReason: 'Required administrative information appears complete. Insurance and referral documents have been received.',
    documents: [
      { name: 'insurance_card.pdf', type: 'Insurance Card', status: 'verified', size: '1.2 MB', uploadedAt: daysAgo(1) },
      { name: 'referral_dr_peterson.pdf', type: 'Referral', status: 'verified', size: '0.8 MB', uploadedAt: daysAgo(1) },
    ],
    timeline: [
      { state: 'incoming', label: 'Request received', timestamp: daysAgo(2), completed: true },
      { state: 'understanding', label: 'AI processing request', timestamp: daysAgo(2), completed: true },
      { state: 'extracted', label: 'Information extracted', timestamp: daysAgo(2), completed: true },
      { state: 'validation', label: 'Validation complete', timestamp: daysAgo(1), completed: true },
      { state: 'ready_review', label: 'Ready for staff review', timestamp: daysAgo(1), completed: true, active: true },
    ],
    activity: [
      { type: 'system', text: 'Case created from patient submission', timestamp: daysAgo(2) },
      { type: 'ai', text: 'AI processed request with 94% confidence', timestamp: daysAgo(2) },
      { type: 'ai', text: 'Documents verified: insurance card and referral', timestamp: daysAgo(1) },
      { type: 'system', text: 'Case marked Ready for Review', timestamp: daysAgo(1) },
    ],
    updatedAt: daysAgo(1),
    createdAt: daysAgo(2),
    humanReviewRequired: false,
  },
  {
    id: 'REQ-10483',
    patientName: 'Sarah Miller',
    email: 'sarah.miller@email.com',
    phone: '+1 (555) 876-5432',
    dob: '1990-07-22',
    patientStatus: 'existing',
    requestType: 'referral',
    requestTypeLabel: 'Referral / Authorization',
    requestText: 'I need a referral for a specialist. My primary care doctor said I need to see a pulmonologist.',
    status: CaseStatus.NEEDS_INFO,
    workflowState: WorkflowStates.MISSING_INFO,
    priority: Priority.MEDIUM,
    aiConfidence: 81,
    aiSummary: 'Existing patient requesting a specialist referral to a pulmonologist. Contact and patient status are confirmed. A referral document from the primary care physician is required to proceed but has not been received.',
    detectedIntent: 'Specialist referral request',
    extractedInfo: {
      name: { value: 'Sarah Miller', status: 'confirmed' },
      contact: { value: 'sarah.miller@email.com / +1 (555) 876-5432', status: 'confirmed' },
      dob: { value: 'July 22, 1990', status: 'confirmed' },
      patientStatus: { value: 'Existing patient', status: 'confirmed' },
      insurance: { value: 'Aetna', status: 'confirmed' },
      referral: { value: 'Not yet provided', status: 'missing' },
    },
    missingInfo: ['Referral document from primary care physician'],
    recommendedAction: 'Request referral document from patient.',
    actionReason: 'Patient stated a referral exists from their primary care physician but no document has been received.',
    documents: [],
    timeline: [
      { state: 'incoming', label: 'Request received', timestamp: daysAgo(3), completed: true },
      { state: 'understanding', label: 'AI processing request', timestamp: daysAgo(3), completed: true },
      { state: 'extracted', label: 'Information extracted', timestamp: daysAgo(3), completed: true },
      { state: 'missing_info', label: 'Missing information detected', timestamp: daysAgo(3), completed: true, active: true },
    ],
    activity: [
      { type: 'system', text: 'Case created from patient submission', timestamp: daysAgo(3) },
      { type: 'ai', text: 'AI processed request with 81% confidence', timestamp: daysAgo(3) },
      { type: 'ai', text: 'Missing: Referral document from primary care physician', timestamp: daysAgo(3) },
    ],
    updatedAt: daysAgo(3),
    createdAt: daysAgo(3),
    humanReviewRequired: false,
  },
  {
    id: 'REQ-10484',
    patientName: 'Michael Brown',
    email: 'mbrown@webmail.com',
    phone: '+1 (555) 345-9012',
    dob: '1978-11-05',
    patientStatus: 'unknown',
    requestType: 'other',
    requestTypeLabel: 'Other Administrative Request',
    requestText: 'I have a question about my records and also maybe an appointment. Not sure where to start.',
    status: CaseStatus.NEEDS_REVIEW,
    workflowState: WorkflowStates.VALIDATION,
    priority: Priority.LOW,
    aiConfidence: 48,
    aiSummary: 'Request contains multiple possible intents — medical records inquiry and possible appointment scheduling. Patient status is unclear. Low confidence due to ambiguous intent. Human review is recommended to determine the appropriate next step.',
    detectedIntent: 'Multiple intents — records inquiry / appointment (ambiguous)',
    extractedInfo: {
      name: { value: 'Michael Brown', status: 'confirmed' },
      contact: { value: 'mbrown@webmail.com / +1 (555) 345-9012', status: 'confirmed' },
      dob: { value: 'November 5, 1978', status: 'confirmed' },
      patientStatus: { value: 'Unknown', status: 'uncertain' },
      insurance: { value: 'Not provided', status: 'missing' },
      requestIntent: { value: 'Ambiguous', status: 'uncertain' },
    },
    missingInfo: ['Patient status (new or existing)', 'Specific request type', 'Insurance information'],
    recommendedAction: 'Request clarification from patient or handle manually.',
    actionReason: 'The request contains multiple possible intents. AI confidence is low. A staff member should review and determine the appropriate course of action.',
    documents: [],
    timeline: [
      { state: 'incoming', label: 'Request received', timestamp: daysAgo(1), completed: true },
      { state: 'understanding', label: 'AI processing request', timestamp: daysAgo(1), completed: true },
      { state: 'validation', label: 'Validation — low confidence', timestamp: daysAgo(1), completed: true, active: true },
    ],
    activity: [
      { type: 'system', text: 'Case created from patient submission', timestamp: daysAgo(1) },
      { type: 'ai', text: 'AI processed request with 48% confidence — ambiguous intent detected', timestamp: daysAgo(1) },
      { type: 'ai', text: 'Human review recommended due to low confidence', timestamp: daysAgo(1) },
    ],
    updatedAt: daysAgo(1),
    createdAt: daysAgo(1),
    humanReviewRequired: true,
  },
  {
    id: 'REQ-10480',
    patientName: 'Emily Chen',
    email: 'emily.chen@email.com',
    phone: '+1 (555) 678-2345',
    dob: '1995-04-17',
    patientStatus: 'existing',
    requestType: 'reschedule',
    requestTypeLabel: 'Reschedule Appointment',
    requestText: 'I need to reschedule my appointment from next Tuesday. I have a work conflict and cannot make that time.',
    status: CaseStatus.COMPLETED,
    workflowState: WorkflowStates.COMPLETED,
    priority: Priority.LOW,
    aiConfidence: 97,
    aiSummary: 'Existing patient requesting a reschedule of a previously booked appointment. All required information is present. Case has been completed.',
    detectedIntent: 'Appointment reschedule',
    extractedInfo: {
      name: { value: 'Emily Chen', status: 'confirmed' },
      contact: { value: 'emily.chen@email.com / +1 (555) 678-2345', status: 'confirmed' },
      dob: { value: 'April 17, 1995', status: 'confirmed' },
      patientStatus: { value: 'Existing patient', status: 'confirmed' },
      insurance: { value: 'On file', status: 'confirmed' },
    },
    missingInfo: [],
    recommendedAction: 'Appointment rescheduled.',
    actionReason: 'All information complete. Appointment has been rescheduled per patient request.',
    documents: [],
    timeline: [
      { state: 'incoming', label: 'Request received', timestamp: daysAgo(5), completed: true },
      { state: 'understanding', label: 'AI processing request', timestamp: daysAgo(5), completed: true },
      { state: 'extracted', label: 'Information extracted', timestamp: daysAgo(5), completed: true },
      { state: 'validation', label: 'Validation complete', timestamp: daysAgo(5), completed: true },
      { state: 'ready_review', label: 'Ready for staff review', timestamp: daysAgo(4), completed: true },
      { state: 'approved', label: 'Approved by staff', timestamp: daysAgo(4), completed: true },
      { state: 'completed', label: 'Completed', timestamp: daysAgo(3), completed: true, active: true },
    ],
    activity: [
      { type: 'system', text: 'Case created', timestamp: daysAgo(5) },
      { type: 'ai', text: 'AI processed with 97% confidence', timestamp: daysAgo(5) },
      { type: 'staff', text: 'Staff approved. Appointment rescheduled.', timestamp: daysAgo(4) },
      { type: 'system', text: 'Case marked complete', timestamp: daysAgo(3) },
    ],
    updatedAt: daysAgo(3),
    createdAt: daysAgo(5),
    humanReviewRequired: false,
  },
  {
    id: 'REQ-10479',
    patientName: 'Robert Davis',
    email: 'rdavis@email.com',
    phone: '+1 (555) 901-3456',
    dob: '1960-09-30',
    patientStatus: 'existing',
    requestType: 'billing',
    requestTypeLabel: 'Insurance / Billing',
    requestText: 'I received a bill that I do not understand. I thought my insurance covered this. Can someone help?',
    status: CaseStatus.ESCALATED,
    workflowState: WorkflowStates.ESCALATED,
    priority: Priority.HIGH,
    aiConfidence: 72,
    aiSummary: 'Billing dispute from existing patient. Patient believes their insurance should have covered a charge. AI has low-medium confidence on the specific billing code in question. Escalated for senior staff review.',
    detectedIntent: 'Billing dispute / insurance coverage question',
    extractedInfo: {
      name: { value: 'Robert Davis', status: 'confirmed' },
      contact: { value: 'rdavis@email.com / +1 (555) 901-3456', status: 'confirmed' },
      dob: { value: 'September 30, 1960', status: 'confirmed' },
      patientStatus: { value: 'Existing patient', status: 'confirmed' },
      insurance: { value: 'Medicare Part B', status: 'confirmed' },
      billingCode: { value: 'Unknown — patient did not specify', status: 'uncertain' },
    },
    missingInfo: ['Specific invoice number', 'Service date in question'],
    recommendedAction: 'Escalate to billing specialist.',
    actionReason: 'Billing disputes require verification of coverage and service details. Specialist review needed.',
    documents: [],
    timeline: [
      { state: 'incoming', label: 'Request received', timestamp: daysAgo(4), completed: true },
      { state: 'understanding', label: 'AI processing request', timestamp: daysAgo(4), completed: true },
      { state: 'extracted', label: 'Information extracted', timestamp: daysAgo(4), completed: true },
      { state: 'escalated', label: 'Escalated to specialist', timestamp: daysAgo(2), completed: true, active: true },
    ],
    activity: [
      { type: 'system', text: 'Case created', timestamp: daysAgo(4) },
      { type: 'ai', text: 'AI processed with 72% confidence', timestamp: daysAgo(4) },
      { type: 'staff', text: 'Escalated to billing specialist', timestamp: daysAgo(2) },
    ],
    updatedAt: daysAgo(2),
    createdAt: daysAgo(4),
    humanReviewRequired: true,
  },
  {
    id: 'REQ-10478',
    patientName: 'Lisa Anderson',
    email: 'lisa.a@email.com',
    phone: '+1 (555) 222-5678',
    dob: '1988-12-09',
    patientStatus: 'new',
    requestType: 'new_patient',
    requestTypeLabel: 'New Patient Appointment',
    requestText: 'I am a new patient looking to schedule a consultation. I do not have a referral but I have my insurance.',
    status: CaseStatus.WAITING_USER,
    workflowState: WorkflowStates.WAITING_USER,
    priority: Priority.MEDIUM,
    aiConfidence: 88,
    aiSummary: 'New patient requesting a consultation. Insurance information has been provided. AI has identified that a referral may be required depending on the insurance plan. Patient has been contacted to clarify referral requirements.',
    detectedIntent: 'New patient consultation scheduling',
    extractedInfo: {
      name: { value: 'Lisa Anderson', status: 'confirmed' },
      contact: { value: 'lisa.a@email.com / +1 (555) 222-5678', status: 'confirmed' },
      dob: { value: 'December 9, 1988', status: 'confirmed' },
      patientStatus: { value: 'New patient', status: 'confirmed' },
      insurance: { value: 'United Healthcare', status: 'confirmed' },
      referral: { value: 'Not provided', status: 'missing' },
    },
    missingInfo: ['Referral document (may be required by insurance)'],
    recommendedAction: 'Await patient response on referral requirement.',
    actionReason: 'Staff sent request to patient for referral clarification. Awaiting response.',
    documents: [
      { name: 'insurance_card_united.jpg', type: 'Insurance Card', status: 'verified', size: '0.6 MB', uploadedAt: daysAgo(6) },
    ],
    timeline: [
      { state: 'incoming', label: 'Request received', timestamp: daysAgo(7), completed: true },
      { state: 'understanding', label: 'AI processing request', timestamp: daysAgo(7), completed: true },
      { state: 'extracted', label: 'Information extracted', timestamp: daysAgo(7), completed: true },
      { state: 'missing_info', label: 'Possible missing referral detected', timestamp: daysAgo(6), completed: true },
      { state: 'waiting_user', label: 'Waiting for patient response', timestamp: daysAgo(5), completed: true, active: true },
    ],
    activity: [
      { type: 'system', text: 'Case created', timestamp: daysAgo(7) },
      { type: 'ai', text: 'AI processed with 88% confidence', timestamp: daysAgo(7) },
      { type: 'staff', text: 'Information request sent to patient', timestamp: daysAgo(5) },
    ],
    updatedAt: daysAgo(5),
    createdAt: daysAgo(7),
    humanReviewRequired: false,
  },
  {
    id: 'REQ-10477',
    patientName: 'James Wilson',
    email: 'jwilson@email.com',
    phone: '+1 (555) 333-8901',
    dob: '1972-06-25',
    patientStatus: 'existing',
    requestType: 'documents',
    requestTypeLabel: 'Upload Documents',
    requestText: 'I need to upload my new insurance card. My insurance changed last month.',
    status: CaseStatus.AI_PROCESSED,
    workflowState: WorkflowStates.READY_REVIEW,
    priority: Priority.LOW,
    aiConfidence: 96,
    aiSummary: 'Existing patient updating insurance information. New insurance card has been uploaded and verified. Case is ready for administrative update.',
    detectedIntent: 'Insurance document update',
    extractedInfo: {
      name: { value: 'James Wilson', status: 'confirmed' },
      contact: { value: 'jwilson@email.com / +1 (555) 333-8901', status: 'confirmed' },
      dob: { value: 'June 25, 1972', status: 'confirmed' },
      patientStatus: { value: 'Existing patient', status: 'confirmed' },
      insurance: { value: 'Cigna (updated)', status: 'confirmed' },
    },
    missingInfo: [],
    recommendedAction: 'Update patient insurance record in the system.',
    actionReason: 'New insurance card verified. Administrative update required.',
    documents: [
      { name: 'cigna_insurance_card.pdf', type: 'Insurance Card', status: 'verified', size: '0.4 MB', uploadedAt: hoursAgo(4) },
    ],
    timeline: [
      { state: 'incoming', label: 'Request received', timestamp: hoursAgo(5), completed: true },
      { state: 'understanding', label: 'AI processing request', timestamp: hoursAgo(5), completed: true },
      { state: 'extracted', label: 'Information extracted', timestamp: hoursAgo(4), completed: true },
      { state: 'validation', label: 'Document verified', timestamp: hoursAgo(4), completed: true },
      { state: 'ready_review', label: 'Ready for staff action', timestamp: hoursAgo(3), completed: true, active: true },
    ],
    activity: [
      { type: 'system', text: 'Case created', timestamp: hoursAgo(5) },
      { type: 'ai', text: 'AI processed with 96% confidence', timestamp: hoursAgo(5) },
      { type: 'ai', text: 'Document verified: Cigna insurance card', timestamp: hoursAgo(4) },
    ],
    updatedAt: hoursAgo(3),
    createdAt: hoursAgo(5),
    humanReviewRequired: false,
  },
  {
    id: 'REQ-10476',
    patientName: 'Maria Garcia',
    email: 'mgarcia@email.com',
    phone: '+1 (555) 444-2345',
    dob: '2001-02-14',
    patientStatus: 'new',
    requestType: 'new_patient',
    requestTypeLabel: 'New Patient Appointment',
    requestText: 'I want to make an appointment. I am new.',
    status: CaseStatus.NEEDS_INFO,
    workflowState: WorkflowStates.MISSING_INFO,
    priority: Priority.MEDIUM,
    aiConfidence: 79,
    aiSummary: 'New patient requesting an appointment. The request is brief and lacks several required details. Insurance information, referral status, and preferred appointment type are all missing.',
    detectedIntent: 'New patient appointment scheduling',
    extractedInfo: {
      name: { value: 'Maria Garcia', status: 'confirmed' },
      contact: { value: 'mgarcia@email.com / +1 (555) 444-2345', status: 'confirmed' },
      dob: { value: 'February 14, 2001', status: 'confirmed' },
      patientStatus: { value: 'New patient', status: 'confirmed' },
      insurance: { value: 'Not provided', status: 'missing' },
      referral: { value: 'Not provided', status: 'missing' },
    },
    missingInfo: ['Insurance information', 'Referral (if applicable)', 'Preferred appointment type / reason'],
    recommendedAction: 'Request additional information from patient.',
    actionReason: 'Multiple required fields are missing. Patient should be contacted to complete intake.',
    documents: [],
    timeline: [
      { state: 'incoming', label: 'Request received', timestamp: hoursAgo(8), completed: true },
      { state: 'understanding', label: 'AI processing request', timestamp: hoursAgo(8), completed: true },
      { state: 'missing_info', label: 'Missing information detected', timestamp: hoursAgo(8), completed: true, active: true },
    ],
    activity: [
      { type: 'system', text: 'Case created', timestamp: hoursAgo(8) },
      { type: 'ai', text: 'AI processed with 79% confidence — multiple fields missing', timestamp: hoursAgo(8) },
    ],
    updatedAt: hoursAgo(8),
    createdAt: hoursAgo(8),
    humanReviewRequired: false,
  },
  {
    id: 'REQ-10475',
    patientName: 'David Thompson',
    email: 'dthompson@email.com',
    phone: '+1 (555) 555-6789',
    dob: '1955-08-18',
    patientStatus: 'existing',
    requestType: 'referral',
    requestTypeLabel: 'Referral / Authorization',
    requestText: 'My doctor sent a referral for me. I need to make an appointment with a specialist.',
    status: CaseStatus.AI_PROCESSED,
    workflowState: WorkflowStates.READY_REVIEW,
    priority: Priority.HIGH,
    aiConfidence: 91,
    aiSummary: 'Existing patient with a referral from their primary care physician, requesting an appointment with a specialist. Referral document received. All required information appears to be in order.',
    detectedIntent: 'Specialist appointment via referral',
    extractedInfo: {
      name: { value: 'David Thompson', status: 'confirmed' },
      contact: { value: 'dthompson@email.com / +1 (555) 555-6789', status: 'confirmed' },
      dob: { value: 'August 18, 1955', status: 'confirmed' },
      patientStatus: { value: 'Existing patient', status: 'confirmed' },
      insurance: { value: 'Medicare Advantage', status: 'confirmed' },
      referral: { value: 'Received — Dr. Kim, Internal Medicine', status: 'confirmed' },
    },
    missingInfo: [],
    recommendedAction: 'Verify referral and schedule specialist appointment.',
    actionReason: 'All information complete. Referral document verified.',
    documents: [
      { name: 'referral_dr_kim.pdf', type: 'Referral', status: 'verified', size: '0.5 MB', uploadedAt: hoursAgo(2) },
    ],
    timeline: [
      { state: 'incoming', label: 'Request received', timestamp: hoursAgo(3), completed: true },
      { state: 'understanding', label: 'AI processing request', timestamp: hoursAgo(3), completed: true },
      { state: 'extracted', label: 'Information extracted', timestamp: hoursAgo(2), completed: true },
      { state: 'validation', label: 'Validation complete', timestamp: hoursAgo(2), completed: true },
      { state: 'ready_review', label: 'Ready for staff review', timestamp: hoursAgo(1), completed: true, active: true },
    ],
    activity: [
      { type: 'system', text: 'Case created', timestamp: hoursAgo(3) },
      { type: 'ai', text: 'AI processed with 91% confidence', timestamp: hoursAgo(3) },
      { type: 'ai', text: 'Referral document verified', timestamp: hoursAgo(2) },
    ],
    updatedAt: hoursAgo(1),
    createdAt: hoursAgo(3),
    humanReviewRequired: false,
  },
  {
    id: 'REQ-10474',
    patientName: 'Jennifer Martinez',
    email: 'jmartinez@email.com',
    phone: '+1 (555) 666-3456',
    dob: '1983-10-31',
    patientStatus: 'existing',
    requestType: 'reschedule',
    requestTypeLabel: 'Reschedule Appointment',
    requestText: 'I need to reschedule. I am out of town this week and next week.',
    status: CaseStatus.COMPLETED,
    workflowState: WorkflowStates.COMPLETED,
    priority: Priority.LOW,
    aiConfidence: 99,
    aiSummary: 'Existing patient reschedule request. All information present. Appointment successfully rescheduled.',
    detectedIntent: 'Appointment reschedule',
    extractedInfo: {
      name: { value: 'Jennifer Martinez', status: 'confirmed' },
      contact: { value: 'jmartinez@email.com / +1 (555) 666-3456', status: 'confirmed' },
      dob: { value: 'October 31, 1983', status: 'confirmed' },
      patientStatus: { value: 'Existing patient', status: 'confirmed' },
      insurance: { value: 'On file', status: 'confirmed' },
    },
    missingInfo: [],
    recommendedAction: 'Rescheduled.',
    actionReason: 'Appointment has been rescheduled.',
    documents: [],
    timeline: [
      { state: 'incoming', label: 'Request received', timestamp: daysAgo(10), completed: true },
      { state: 'understanding', label: 'AI processing request', timestamp: daysAgo(10), completed: true },
      { state: 'extracted', label: 'Information extracted', timestamp: daysAgo(10), completed: true },
      { state: 'validation', label: 'Validation complete', timestamp: daysAgo(10), completed: true },
      { state: 'approved', label: 'Approved by staff', timestamp: daysAgo(9), completed: true },
      { state: 'completed', label: 'Completed', timestamp: daysAgo(9), completed: true, active: true },
    ],
    activity: [
      { type: 'system', text: 'Case created', timestamp: daysAgo(10) },
      { type: 'ai', text: 'AI processed with 99% confidence', timestamp: daysAgo(10) },
      { type: 'staff', text: 'Appointment rescheduled', timestamp: daysAgo(9) },
      { type: 'system', text: 'Case marked complete', timestamp: daysAgo(9) },
    ],
    updatedAt: daysAgo(9),
    createdAt: daysAgo(10),
    humanReviewRequired: false,
  },
];

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
