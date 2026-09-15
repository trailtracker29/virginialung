require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const WorkflowEngine = require('./engine/core');
const config = require('./config/virginialung');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser clients (n8n, curl) or explicitly allowed origins.
    // In development, allow all.
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Virginia Lung Backend listening on port ${PORT}`);
});
