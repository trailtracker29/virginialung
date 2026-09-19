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
        text: "You are a patient intake assistant. Collect exactly these 7 fields: firstName, lastName, dateOfBirth, phone, email, patientType, requestText. Speak naturally. Ask one useful question at a time. Avoid unnecessary medical advice, diagnosing, or inventing info. Clarify uncertain values. Use the update_form_field tool when information is explicitly confirmed. Do not call finish_intake until all information is collected and the final summary is confirmed by the patient. Never claim that a submission happened."
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
    if (window.PatientState && window.PatientState.currentStep < 2) {
      const otherBtn = document.querySelector('.request-type-card[data-type="other"]');
      if (otherBtn && window.selectRequestType) window.selectRequestType(otherBtn);
      if (window.goToStep2) window.goToStep2();
    }
    
    try {
      this.updateStatus('Connecting...');
      
      // Request mic
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Audio context setup (Gemini Live expects 16kHz PCM)
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Use script processor for mic recording
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isActive || !this.session) return;
        const pcmData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16
        const int16Data = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          let s = Math.max(-1, Math.min(1, pcmData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const b64 = this.arrayBufferToBase64(int16Data.buffer);
        
        try {
          this.session.send({
            realtimeInput: {
              mediaChunks: [{
                mimeType: "audio/pcm;rate=16000",
                data: b64
              }]
            }
          });
        } catch (err) {}
      };

      // Fetch Ephemeral Token
      const res = await fetch('/api/voice/token');
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
        }
      });
      
      this.updateStatus('Listening...');
      document.getElementById('voiceOrb')?.classList.add('is-listening');
      
      this.listenToSession();

    } catch (e) {
      console.error(e);
      this.updateStatus('Error connecting to Voice Assistant.');
      this.stopAll();
    }
  }
  
  async listenToSession() {
    if (!this.session) return;
    try {
      for await (const message of this.session) {
        if (!this.isActive) break;
        this.handleMessage(message);
      }
    } catch (e) {
      console.error('Session error or closed:', e);
      if (this.isActive) {
        this.updateStatus('Connection lost.');
        this.stopAll();
      }
    }
  }

  handleMessage(message) {
    if (message.serverContent && message.serverContent.modelTurn) {
      const parts = message.serverContent.modelTurn.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData) {
            this.queueAudio(part.inlineData.data);
          }
        }
      }
    } else if (message.toolCall) {
      this.handleToolCall(message.toolCall);
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
        source.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
        
        document.getElementById('voiceOrb')?.classList.remove('is-speaking');
        document.getElementById('voiceOrb')?.classList.add('is-listening');
        this.updateStatus('Listening...');
      }
    }
  }

  handleToolCall(toolCall) {
    const functionCalls = toolCall.functionCalls;
    if (!functionCalls) return;
    
    for (const call of functionCalls) {
      if (call.name === 'update_form_field') {
        const { field, value } = call.args;
        this.updateDOMField(field, value);
        
        if (this.session) {
          try {
            this.session.send({
              toolResponse: {
                functionResponses: [{
                  id: call.id,
                  response: { result: "ok" }
                }]
              }
            });
          } catch(e) {}
        }
      } else if (call.name === 'finish_intake') {
        if (this.session) {
          try {
            this.session.send({
              toolResponse: {
                functionResponses: [{
                  id: call.id,
                  response: { result: "ok" }
                }]
              }
            });
          } catch(e) {}
        }
        this.finishIntake();
      }
    }
  }

  finishIntake() {
    this.stopAll();
    if (window.goToStep6) {
      window.goToStep6();
    }
  }

  updateDOMField(fieldId, value) {
    if (fieldId === 'patientType') {
      const type = value.toLowerCase().includes('existing') ? 'existing' : 'new';
      if (window.setPatientType) window.setPatientType(type);
      return;
    }

    const input = document.getElementById(fieldId);
    if (input) {
      let formatted = value;
      if (fieldId === 'email') {
        formatted = value.toLowerCase().replace(/\s+/g, '').replace(/at/g, '@').replace(/dot/g, '.');
      }
      
      input.value = formatted;
      
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
