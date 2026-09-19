/**
 * Patient Portal — Voice-First Logic
 * Adds optional voice-driven intake using Web Speech API
 */

class VoiceAssistant {
  constructor() {
    this.isActive = false;
    this.currentStepIndex = 0;
    
    // Check support
    this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.synthesis = window.speechSynthesis;
    
    this.flow = [
      { id: 'firstName', q: "What is your first name?", step: 2 },
      { id: 'lastName', q: "What is your last name?", step: 2 },
      { id: 'dob', q: "What is your date of birth?", step: 2 },
      { id: 'phone', q: "What is your phone number?", step: 2 },
      { id: 'email', q: "What is your email address?", step: 2 },
      { id: 'patientType', q: "Are you a new or existing patient?", step: 2 },
      { id: 'requestText', q: "Please tell me in your own words why you are contacting the clinic.", step: 3 }
    ];
  }

  init() {
    if (!this.SpeechRecognition || !this.synthesis) {
      console.warn("Web Speech API not supported in this browser.");
      return;
    }
  }

  toggle() {
    this.isActive = !this.isActive;
    document.body.classList.toggle('voice-mode-active', this.isActive);
    
    const toggleBtn = document.getElementById('voiceToggleBtn');
    if (toggleBtn) {
      toggleBtn.textContent = this.isActive ? 'Exit Voice Mode' : 'Start Voice Mode';
    }

    if (this.isActive) {
      this.startVoiceFlow();
    } else {
      this.stopAll();
    }
  }

  stopAll() {
    this.synthesis.cancel();
    if (this.recognition) {
      this.recognition.stop();
    }
    this.updateStatus('Voice mode deactivated.');
  }

  async startVoiceFlow() {
    // If not past step 1, simulate selecting "Other" to proceed to form fields
    if (PatientState.currentStep < 2) {
      const otherBtn = document.querySelector('.request-type-card[data-type="other"]');
      if (otherBtn) selectRequestType(otherBtn);
      goToStep2();
    }
    
    this.currentStepIndex = 0;
    await this.processNextField();
  }

  async processNextField() {
    if (!this.isActive) return;

    if (this.currentStepIndex >= this.flow.length) {
      await this.speakAndDisplay("I have all the information needed. Please review your request and click submit.");
      goToStep4(); // Navigate to Check step
      return;
    }

    const field = this.flow[this.currentStepIndex];
    
    // Ensure UI is on the correct step card
    if (PatientState.currentStep !== field.step) {
      showStepCard(field.step);
    }

    // Loop until confirmed
    let confirmed = false;
    while (!confirmed && this.isActive) {
      await this.speakAndDisplay(field.q);
      const answer = await this.listen();
      
      if (!this.isActive) return;
      if (!answer) {
        await this.speakAndDisplay("I didn't catch that. Let's try again.");
        continue;
      }

      await this.speakAndDisplay(`I heard ${answer}. Is that correct?`);
      const confirmAns = await this.listen();
      
      if (!this.isActive) return;
      
      if (confirmAns && confirmAns.toLowerCase().includes("yes")) {
        this.updateDOMField(field.id, answer);
        confirmed = true;
      } else {
        await this.speakAndDisplay("Okay, let's try again.");
      }
    }

    if (this.isActive) {
      this.currentStepIndex++;
      this.processNextField();
    }
  }

  updateDOMField(fieldId, value) {
    if (fieldId === 'patientType') {
      const type = value.toLowerCase().includes('existing') ? 'existing' : 'new';
      setPatientType(type);
      return;
    }

    const input = document.getElementById(fieldId);
    if (input) {
      // Basic formatting
      let formatted = value;
      if (fieldId === 'email') {
        formatted = value.toLowerCase().replace(/\s+/g, '');
        formatted = formatted.replace(/at/g, '@').replace(/dot/g, '.');
      }
      
      input.value = formatted;
      input.classList.add('field-confirmed');
      setTimeout(() => input.classList.remove('field-confirmed'), 2000);
    }
  }

  speakAndDisplay(text) {
    return new Promise((resolve) => {
      this.updateStatus(text);
      this.synthesis.cancel(); // clear queue
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = resolve;
      utterance.onerror = resolve;
      this.synthesis.speak(utterance);
    });
  }

  listen() {
    return new Promise((resolve) => {
      this.recognition = new this.SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      
      this.updateStatus("Listening...");
      document.getElementById('voiceOrb')?.classList.add('is-listening');

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };

      this.recognition.onerror = (e) => {
        console.error("Speech recognition error", e.error);
        resolve(null);
      };

      this.recognition.onend = () => {
        document.getElementById('voiceOrb')?.classList.remove('is-listening');
        resolve(null); // Resolve with null if nothing was picked up
      };

      try {
        this.recognition.start();
      } catch (e) {
        console.error("Failed to start recognition", e);
        resolve(null);
      }
    });
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

function toggleVoiceMode() {
  voiceAssistant.toggle();
}
