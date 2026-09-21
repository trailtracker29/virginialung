import { GoogleGenAI, Modality } from '@google/genai';

class VoiceAssistant {
  constructor() {
    this.isActive = false;
    this.session = null;
    this.audioContext = null;
    this.audioQueue = [];
    this.isPlaying = false;
    this.nextAudioTime = 0;
    this.mediaStream = null;
    this.scriptProcessor = null;
    
    // Tools defined for Gemini Live
    this.tools = [
      {
        functionDeclarations: [
          {
            name: "update_form_field",
            description: "Updates a specific form field when the patient confirms an answer.",
            parameters: {
              type: "OBJECT",
              properties: {
                field: {
                  type: "STRING",
                  enum: ["firstName", "lastName", "dateOfBirth", "phone", "email", "patientType", "requestText"]
                },
                value: { type: "STRING" }
              },
              required: ["field", "value"]
            }
          },
          {
            name: "set_request_type",
            description: "Set the patient's intended request type. Call this immediately when the patient's intent is known, before asking for other fields. This changes the UI to show the correct form.",
            parameters: {
              type: "OBJECT",
              properties: {
                requestType: {
                  type: "STRING",
                  enum: ["new_patient", "schedule", "reschedule", "referral", "billing", "other"]
                }
              },
              required: ["requestType"]
            }
          },
          {
            name: "finish_intake",
            description: "Call this ONLY after all required information is collected and the patient has confirmed the final summary.",
            parameters: {
              type: "OBJECT",
              properties: {}
            }
          }
        ]
      }
    ];

    this.systemInstruction = {
      parts: [{
        text: "You are a patient intake assistant. First, determine their request type and call set_request_type. Then, collect exactly these fields: firstName, lastName, dateOfBirth, phone, email, patientType, requestText. Speak naturally. Ask one useful question at a time. Avoid unnecessary medical advice. Use the update_form_field tool when information is explicitly confirmed. Do not call finish_intake until all information is collected and the final summary is confirmed by the patient. Never claim that a submission happened."
      }]
    };
  }

  init() {
    // Bind event listener for voice mode toggle
    const toggleBtn = document.getElementById('voiceToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle();
      });
    }
  }

  async toggle() {
    this.isActive = !this.isActive;
    document.body.classList.toggle('voice-mode-active', this.isActive);
    
    const toggleBtn = document.getElementById('voiceToggleBtn');
    if (toggleBtn) {
      toggleBtn.textContent = this.isActive ? 'Exit Voice Mode' : 'Start Voice Mode';
    }

    if (this.isActive) {
      await this.startVoiceFlow();
    } else {
      this.stopAll();
    }
  }

  stopAll() {
    this.isActive = false;
    if (this.session) {
      try { this.session.close(); } catch (e) {}
      this.session = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
    
    this.updateStatus('Voice mode deactivated.');
    const orb = document.getElementById('voiceOrb');
    if (orb) {
      orb.classList.remove('is-listening', 'is-speaking', 'is-processing');
    }
  }

  async startVoiceFlow() {
    // If not past step 1, simulate selecting "Other" to proceed to form fields
    // (Removed buggy fallback block)
    
    try {
      this.updateStatus('Connecting...');
      
      // Request mic
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Audio context setup (Gemini Live expects 16kHz PCM)
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      console.log('[DEBUG] Microphone stream started');
      // Use script processor for mic recording
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      console.log('[DEBUG] Audio processor started');
      
      let chunkCount = 0;
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isActive) return;
        if (!this.session) {
            if (chunkCount === 0) console.log('[DEBUG] First audio chunk received, but session is missing');
            return;
        }
        const pcmData = e.inputBuffer.getChannelData(0);

        if (chunkCount === 0) {
            console.log('[DEBUG] First audio chunk received with session present. Length:', pcmData.length);
        }

        // Convert Float32 to Int16
        const int16Data = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          let s = Math.max(-1, Math.min(1, pcmData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const b64 = this.arrayBufferToBase64(int16Data.buffer);
        
        try {
          if (chunkCount === 0) console.log('[DEBUG] Calling session.sendRealtimeInput');
          this.session.sendRealtimeInput({
            audio: {
              data: b64,
              mimeType: 'audio/pcm;rate=16000'
            }
          });
        } catch (err) {
          if (chunkCount === 0) console.error('Audio send error:', err);
        }
        chunkCount++;
      };

      // Fetch Ephemeral Token
      const tokenUrl = `${window.AppConfig.API_BASE_URL}/api/voice/token`;
      const res = await fetch(tokenUrl);
      if (!res.ok) throw new Error('Token fetch failed');
      const tokenData = await res.json();
      
      const ephemeralKey = tokenData.name || tokenData.value;

      if (!ephemeralKey) {
          throw new Error('Voice token response did not contain a usable token');
      }

      const ai = new GoogleGenAI({
          apiKey: ephemeralKey
      });
      
      this.session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: this.systemInstruction,
          tools: this.tools
        },
        callbacks: {
          onopen: () => {
            console.log('[VOICE] session opened');
          },
          onmessage: (message) => {
            console.log('[VOICE] session message received');
            if (!this.isActive) return;
            this.handleMessage(message);
          },
          onerror: (error) => {
            console.error('[VOICE] session error:', error);
            if (this.isActive) {
              this.updateStatus('Connection lost.');
              this.stopAll();
            }
          },
          onclose: (event) => {
            console.log('[VOICE] session closed', {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean
            });
            if (this.isActive) {
              this.updateStatus('Connection lost.');
              this.stopAll();
            }
          }
        }
      });
      
      this.updateStatus('Listening...');
      document.getElementById('voiceOrb')?.classList.add('is-listening');

    } catch (e) {
      console.error(e);
      this.updateStatus('Error connecting to Voice Assistant.');
      this.stopAll();
    }
  }
  

  handleMessage(message) {
    console.log('[VOICE DEBUG] message keys:', Object.keys(message || {}));
    console.log('[VOICE DEBUG] toolCall:', message?.toolCall);
    console.log('[VOICE DEBUG] functionCalls:',
        message?.toolCall?.functionCalls?.map(fc => ({
            id: fc.id,
            name: fc.name,
            args: fc.args
        }))
    );

    if (message.serverContent && message.serverContent.modelTurn) {
      const parts = message.serverContent.modelTurn.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData) {
            this.queueAudio(part.inlineData.data);
          }
        }
      }
    }
    
    // The @google/genai Live API sends tool calls asynchronously in message.toolCall
    if (message.toolCall && message.toolCall.functionCalls) {
      for (const functionCall of message.toolCall.functionCalls) {
        console.log('[VOICE TOOL DETECTED]', {
            name: functionCall.name,
            args: functionCall.args
        });
        this.handleToolCall(functionCall);
      }
    }
    
    // Check if interrupted by user
    if (message.serverContent && message.serverContent.interrupted) {
      this.audioQueue = [];
      this.isPlaying = false;
      this.nextAudioTime = 0;
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        
        const oldProcessor = this.scriptProcessor;
        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.scriptProcessor.onaudioprocess = oldProcessor.onaudioprocess;
        
        source.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
        
        document.getElementById('voiceOrb')?.classList.remove('is-speaking');
        document.getElementById('voiceOrb')?.classList.add('is-listening');
        this.updateStatus('Listening...');
      }
    }
  }

  handleToolCall(functionCall) {
    if (!functionCall) return;
    
    console.log(`[VOICE TOOL] received: ${functionCall.name}`);
    console.log('[VOICE TOOL HANDLER]', functionCall.name);
    console.log('[VOICE TOOL ARGS]', functionCall.args);
    
    if (functionCall.name === 'update_form_field') {
      const { field, value } = functionCall.args || {};
      this.updateDOMField(field, value);
      
      if (this.session) {
        try {
          this.session.sendToolResponse({
            functionResponses: [{
              id: functionCall.id || functionCall.name,
              name: functionCall.name,
              response: { result: "ok" }
            }]
          });
        } catch(e) {
          console.error('Error sending tool response:', e);
        }
      }
    } else if (functionCall.name === 'set_request_type') {
      console.log('[VOICE TOOL] set_request_type received');
      console.log('[VOICE TOOL] set_request_type requested:', functionCall.args);
      const { requestType } = functionCall.args || {};
      const card = document.querySelector(`.request-type-card[data-type="${requestType}"]`);
      console.log('[VOICE TOOL] request card found:', card);
      if (card && window.selectRequestType) {
        console.log('[VOICE TOOL] Calling window.selectRequestType');
        window.selectRequestType(card);
        if (window.goToStep2) {
          console.log('[VOICE TOOL] Calling window.goToStep2');
          window.goToStep2();
        }
      } else {
        console.log('[VOICE TOOL] Could not find card or selectRequestType for:', requestType);
      }
      
      if (this.session) {
        try {
          this.session.sendToolResponse({
            functionResponses: [{
              id: functionCall.id || functionCall.name,
              name: functionCall.name,
              response: { result: "ok" }
            }]
          });
        } catch(e) {
          console.error('Error sending tool response:', e);
        }
      }
    } else if (functionCall.name === 'finish_intake') {
      if (this.session) {
        try {
          this.session.sendToolResponse({
            functionResponses: [{
              id: functionCall.id || functionCall.name,
              name: functionCall.name,
              response: { result: "ok" }
            }]
          });
        } catch(e) {
          console.error('Error sending tool response:', e);
        }
      }
      this.finishIntake();
    }
  }

  finishIntake() {
    this.stopAll();
    if (window.goToStep6) {
      window.goToStep6();
    }
  }

  updateDOMField(fieldId, value) {
    console.log('[VOICE TOOL] update_form_field:', {
        fieldId,
        value
    });

    if (fieldId === 'patientType') {
      const type = value.toLowerCase().includes('existing') ? 'existing' : 'new';
      if (window.setPatientType) window.setPatientType(type);
      return;
    }

    let actualId = fieldId;
    if (fieldId === 'dateOfBirth') {
      actualId = 'dob';
    }

    const input = document.getElementById(actualId);
    console.log('[VOICE TOOL] DOM field:', input);
    if (input) {
      let formatted = value;
      if (fieldId === 'email') {
        formatted = value.toLowerCase().replace(/\s+/g, '').replace(/at/g, '@').replace(/dot/g, '.');
      }
      
      input.value = formatted;
      
      // Dispatch input and change events for reactivity
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      if (window.PatientState) {
        window.PatientState[fieldId] = formatted;
      }
      
      input.classList.add('field-confirmed');
      setTimeout(() => input.classList.remove('field-confirmed'), 2000);
    }
  }

  queueAudio(base64Data) {
    this.audioQueue.push(base64Data);
    if (!this.isPlaying) {
      this.playNextAudio();
    }
  }

  async playNextAudio() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      document.getElementById('voiceOrb')?.classList.remove('is-speaking');
      document.getElementById('voiceOrb')?.classList.add('is-listening');
      this.updateStatus('Listening...');
      return;
    }
    
    this.isPlaying = true;
    document.getElementById('voiceOrb')?.classList.remove('is-listening');
    document.getElementById('voiceOrb')?.classList.add('is-speaking');
    this.updateStatus('Speaking...');
    
    const base64Data = this.audioQueue.shift();
    const binaryStr = window.atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    
    if (!this.audioContext) return;
    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 16000);
    audioBuffer.copyToChannel(float32Array, 0);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    source.onended = () => {
      this.playNextAudio();
    };
    
    const currentTime = this.audioContext.currentTime;
    if (this.nextAudioTime < currentTime) {
      this.nextAudioTime = currentTime;
    }
    source.start(this.nextAudioTime);
    this.nextAudioTime += audioBuffer.duration;
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    let bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  updateStatus(text) {
    const statusEl = document.getElementById('voiceStatusText');
    if (statusEl) {
      statusEl.textContent = text;
    }
  }
}

const voiceAssistant = new VoiceAssistant();
document.addEventListener('DOMContentLoaded', () => {
  voiceAssistant.init();
});
