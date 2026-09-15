const AIEngine = require('./ai');

class WorkflowEngine {
  constructor(config, apiKey) {
    this.config = config;
    this.ai = new AIEngine(apiKey);
  }

  generateId() {
    return 'REQ-' + Math.random().toString(36).substr(2, 5).toUpperCase();
  }

  async processIntake(payload) {
    const { requestText, requestType, requestTypeLabel, patientType, firstName, lastName, email, phone, dob } = payload;
    
    // 0. Base Validation
    if (!firstName || !lastName || !email || !phone || !requestText) {
      throw new Error('Validation failed: Missing required basic information (Name, Contact, or Request Details)');
    }

    // 1. AI Understanding
    const structuredData = { firstName, lastName, email, phone, dob, patientType, requestTypeLabel };
    const aiResult = await this.ai.extractIntent(requestText, this.config, structuredData);
    
    // 2. State transition based on config rules & AI
    const missing = aiResult.missing || [];
    
    let state = this.config.states.READY_FOR_REVIEW;
    let status = this.config.statuses.READY_ACTION;
    let actionReason = 'All required information appears complete.';
    let recommendedAction = 'Review request and approve.';
    
    if (missing.length > 0) {
      state = this.config.states.MISSING_INFO;
      status = this.config.statuses.NEEDS_INFO;
      actionReason = `Patient has not provided: ${missing.join(', ')}.`;
      recommendedAction = 'Request missing information from patient.';
    }

    // 3. Validation & Construction
    const priority = aiResult.confidence >= 85 ? 'High' : aiResult.confidence >= 65 ? 'Medium' : 'Low';
    const timestamp = new Date().toISOString();
    const caseId = this.generateId();

    const newCase = {
      id: caseId,
      patient_name: `${firstName} ${lastName}`,
      email,
      phone,
      dob,
      patient_status: patientType,
      request_type: requestType,
      request_type_label: requestTypeLabel,
      request_text: requestText,
      status: status,
      workflow_state: state,
      priority: priority,
      ai_confidence: aiResult.confidence,
      ai_summary: `${aiResult.intent || 'Administrative request'} submitted by ${firstName} ${lastName}. AI has extracted contact information and prepared the case for staff review.`,
      detected_intent: aiResult.intent || 'Administrative request',
      extracted_info: aiResult.extracted,
      missing_info: missing,
      recommended_action: recommendedAction,
      action_reason: actionReason,
      human_review_required: aiResult.confidence < 65,
    };

    const activities = [
      { case_id: caseId, type: 'system', state: 'incoming', label: 'Request received', text: 'Case created from portal submission', completed: true, active: false },
      { case_id: caseId, type: 'ai', state: 'extracted', label: 'Information extracted by AI', text: `AI processed request with ${aiResult.confidence}% confidence`, completed: true, active: false }
    ];

    if (missing.length > 0) {
      activities.push({ case_id: caseId, type: 'ai', state: 'missing_info', label: 'Missing information detected', text: `Missing: ${missing.join(', ')}`, completed: true, active: true });
    } else {
      activities.push({ case_id: caseId, type: 'system', state: 'ready_for_review', label: 'Ready for staff review', text: 'Case prepared for staff', completed: true, active: true });
    }

    return { caseData: newCase, activities };
  }
}

module.exports = WorkflowEngine;
