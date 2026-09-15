const { GoogleGenAI } = require('@google/genai');

class AIEngine {
  constructor(apiKey) {
    if (!apiKey) {
      console.warn('No GEMINI_API_KEY provided, using mock AI engine');
      this.ai = null;
    } else {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async extractIntent(text, rules) {
    if (!this.ai) {
      // Mock logic for local testing without key
      return {
        intent: 'General Request',
        confidence: 85,
        extracted: [],
        missing: [],
        raw_text: text
      };
    }

    const prompt = `
You are an AI Intake Engine for a healthcare workflow.
Analyze the following patient request.
Rules: ${JSON.stringify(rules.extractionRules)}

Extract the intent, confidence (0-100), structured information found, and missing required information based on the rules.
Respond ONLY with a valid JSON object matching this schema:
{
  "intent": "string",
  "confidence": number,
  "extracted": [{"label": "string", "found": boolean, "value": "string"}],
  "missing": ["string"]
}

Patient Request:
"${text}"
`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const responseText = response.text;
      return JSON.parse(responseText);
    } catch (e) {
      console.error('Gemini extraction failed:', e);
      throw new Error('AI extraction failed');
    }
  }
}

module.exports = AIEngine;
