require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');
const WorkflowEngine = require('./engine/core');
const config = require('./config/virginialung');
const smsService = require('./services/smsService');

const app = express();

const defaultAllowed = [
  'http://localhost:3000', 
  'http://localhost:5500', 
  'http://127.0.0.1:5500', 
  'https://virginialung.vercel.app'
];

let allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : defaultAllowed;

if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.STAFF_FRONTEND_URL && !allowedOrigins.includes(process.env.STAFF_FRONTEND_URL)) {
  allowedOrigins.push(process.env.STAFF_FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser clients (n8n, curl) or explicitly allowed origins.
    // In development, allow all.
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.error(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://urmcfgtnifplhpfmsyiw.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Initialize Engine
const engine = new WorkflowEngine(config, process.env.GEMINI_API_KEY);

// Voice Token endpoint for Gemini Live
app.get('/api/voice/token', async (req, res) => {
  try {
    if (!engine.ai || !engine.ai.ai) {
      return res.status(503).json({ error: 'Gemini AI engine is not configured' });
    }
    
    // Create a dedicated v1beta client since authTokens.create is a v1beta endpoint
    const liveClient = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY
    });

    // Create an expiration time roughly 30 minutes from now (in RFC3339 format)
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    const tokenResponse = await liveClient.authTokens.create({
      config: {
        uses: 1,
        expireTime: expireTime,
        liveConnectConstraints: {
          model: 'gemini-3.8-live',
          config: {
            sessionResumption: {},
            responseModalities: ['AUDIO']
          }
        },
        lockAdditionalFields: []
      }
    });
    res.json(tokenResponse);
  } catch (error) {
    console.error('Voice token generation error details:', {
      name: error.name,
      message: error.message,
      status: error.status || error.code,
      details: error.details || error.response?.data
    });
    res.status(500).json({ error: 'Failed to generate voice token' });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', hasSupabase: !!supabase }));

// Webhook / Intake endpoint (simulating n8n passing to backend, or acting as backend directly)
app.post('/api/intake', async (req, res) => {
  try {
    const payload = req.body;
    
    // Process via Core AI Workflow Engine
    const { caseData, activities } = await engine.processIntake(payload);
    
    // Persist to Supabase if configured
    if (supabase) {
      const { error: caseError } = await supabase.from('cases').insert([caseData]);
      if (caseError) {
        console.error('Supabase case insert error:', caseError);
        return res.status(500).json({ success: false, error: 'Database persistence failed: ' + caseError.message });
      }
      
      const { error: actError } = await supabase.from('activities').insert(activities);
      if (actError) {
        console.error('Supabase activities insert error:', actError);
        return res.status(500).json({ success: false, error: 'Activity persistence failed: ' + actError.message });
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Database persistence not configured');
      } else {
        console.warn('Supabase not configured, skipping persistence');
      }
    }

    res.status(200).json({ success: true, caseData, activities });

    // Trigger SMS asynchronously after successful intake and database insertion
    if (caseData && caseData.phone) {
      smsService.sendSMS(
        caseData.phone,
        "Virginia Lung: Your request has been received and is under review."
      ).catch(err => {
        // Fallback error catch, though sendSMS handles its own exceptions
        console.error('[SMS Fallback Catch]', err);
      });
    }
  } catch (error) {
    console.error('Intake processing error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal processing failed' });
  }
});

// Staff API to fetch cases
app.get('/api/cases', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('cases').select('*, activity:activities(*), documents(*)').order('created_at', { ascending: false });
      if (error) throw error;
      // Map for frontend compatibility
      const formatted = data.map(c => ({
        ...c,
        patientName: c.patient_name,
        patientStatus: c.patient_status,
        requestType: c.request_type,
        requestTypeLabel: c.request_type_label,
        requestText: c.request_text,
        workflowState: c.workflow_state,
        aiConfidence: c.ai_confidence,
        aiSummary: c.ai_summary,
        detectedIntent: c.detected_intent,
        extractedInfo: c.extracted_info,
        missingInfo: c.missing_info,
        recommendedAction: c.recommended_action,
        actionReason: c.action_reason,
        humanReviewRequired: c.human_review_required,
        updatedAt: c.updated_at,
        createdAt: c.created_at,
        timeline: c.activity // Map activity back to timeline for frontend
      }));
      res.json(formatted);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Staff API to fetch specific case and its activities
app.get('/api/cases/:id', async (req, res) => {
  try {
    if (supabase) {
      const { data: caseData, error: caseError } = await supabase.from('cases').select('*, activity:activities(*), documents(*)').eq('id', req.params.id).single();
      if (caseError) throw caseError;
      
      const c = caseData;
      const formatted = {
        ...c,
        patientName: c.patient_name,
        patientStatus: c.patient_status,
        requestType: c.request_type,
        requestTypeLabel: c.request_type_label,
        requestText: c.request_text,
        workflowState: c.workflow_state,
        aiConfidence: c.ai_confidence,
        aiSummary: c.ai_summary,
        detectedIntent: c.detected_intent,
        extractedInfo: c.extracted_info,
        missingInfo: c.missing_info,
        recommendedAction: c.recommended_action,
        actionReason: c.action_reason,
        humanReviewRequired: c.human_review_required,
        updatedAt: c.updated_at,
        createdAt: c.created_at,
        timeline: c.activity
      };
      res.json(formatted);
    } else {
      res.json(null);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Staff API to post a case action
app.post('/api/cases/:id/action', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { action, recommendationAction, recommendationReason, requestInfoText, escalationReason } = req.body;

    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase is not configured' });
    }

    const allowedActions = ['approve', 'edit_recommendation', 'request_info', 'escalate', 'complete'];
    if (!allowedActions.includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    let updateData = {};
    let activityText = '';

    switch (action) {
      case 'approve':
        updateData = { status: 'ready_action', workflow_state: 'approved' };
        activityText = 'Staff approved recommendation. Case marked ready for action.';
        break;
      case 'edit_recommendation':
        updateData = {
          recommended_action: recommendationAction,
          action_reason: recommendationReason
        };
        activityText = `Staff edited AI recommendation: "${recommendationAction}"`;
        break;
      case 'request_info':
        updateData = { status: 'waiting_user', workflow_state: 'waiting_user' };
        activityText = `Information request sent to patient: "${requestInfoText}"`;
        break;
      case 'escalate':
        updateData = {
          status: 'escalated',
          workflow_state: 'escalated',
          human_review_required: true
        };
        activityText = `Case escalated: "${escalationReason || 'No reason provided'}"`;
        break;
      case 'complete':
        updateData = { status: 'completed', workflow_state: 'completed' };
        activityText = 'Case marked as completed by staff.';
        break;
    }

    updateData.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('cases')
      .update(updateData)
      .eq('id', caseId);

    if (updateError) {
      throw updateError;
    }

    const activityData = {
      id: require('crypto').randomUUID(),
      case_id: caseId,
      type: 'staff',
      text: activityText,
      timestamp: new Date().toISOString(),
      completed: true,
      active: true
    };

    if (action === 'approve') activityData.label = 'Approved by staff';
    else if (action === 'request_info') activityData.label = 'Waiting for patient response';
    else if (action === 'escalate') activityData.label = 'Escalated to specialist';
    else if (action === 'complete') activityData.label = 'Case completed';
    else if (action === 'edit_recommendation') activityData.label = 'Recommendation edited';
    
    // For states that update timeline
    if (['approve', 'request_info', 'escalate', 'complete'].includes(action)) {
       activityData.state = action === 'request_info' ? 'waiting_user' : action;
    }

    const { error: actError } = await supabase.from('activities').insert([activityData]);
    if (actError) {
      console.error('Failed to insert activity:', actError);
    }

    // Deactivate previous activities
    if (activityData.state) {
      await supabase
        .from('activities')
        .update({ active: false })
        .eq('case_id', caseId)
        .neq('id', activityData.id);
    }

    // Fetch the updated case to return
    const { data: caseData, error: fetchError } = await supabase
      .from('cases')
      .select('*, activity:activities(*), documents(*)')
      .eq('id', caseId)
      .single();

    if (fetchError) throw fetchError;

    const c = caseData;
    const formatted = {
      ...c,
      patientName: c.patient_name,
      patientStatus: c.patient_status,
      requestType: c.request_type,
      requestTypeLabel: c.request_type_label,
      requestText: c.request_text,
      workflowState: c.workflow_state,
      aiConfidence: c.ai_confidence,
      aiSummary: c.ai_summary,
      detectedIntent: c.detected_intent,
      extractedInfo: c.extracted_info,
      missingInfo: c.missing_info,
      recommendedAction: c.recommended_action,
      actionReason: c.action_reason,
      humanReviewRequired: c.human_review_required,
      updatedAt: c.updated_at,
      createdAt: c.created_at,
      timeline: c.activity
    };

    res.json({ success: true, caseData: formatted });
  } catch (error) {
    console.error('Action processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Virginia Lung Backend listening on port ${PORT}`);
});
