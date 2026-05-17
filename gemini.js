import { GoogleGenAI } from '@google/genai';

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function stripMarkdown(text) {
  if (!text) return text;
  return text.replace(/^```json\n?/g, '').replace(/^```\n?/g, '').replace(/```$/g, '').trim();
}

export async function analyzeComplaint(complaintData) {
  const prompt = `
You are an "Akuntabilitas Auditor" analyzing a citizen's complaint and the government's response.
Your task is to classify whether the government's response was a genuine action or a "Fake Close".

RULES:
- Classify as GENUINE_ACTION, CLARIFICATION_REQUEST, BUCK_PASSING, or CANNED_DISMISSAL.
- A response is CANNED_DISMISSAL if it has NO specific action, NO timeline, and contains phrases like "menjadi bahan", "mekanisme yang berlaku".

COMPLAINT DATA:
Title: ${complaintData.title}
Content: ${complaintData.content}
Agency: ${complaintData.agency}
Government Response: ${complaintData.response_text || 'NO RESPONSE'}

Respond strictly with a JSON object in this format, and nothing else (no markdown wrappers):
{
  "verdict": "GENUINE_ACTION | CLARIFICATION_REQUEST | BUCK_PASSING | CANNED_DISMISSAL",
  "is_bs": boolean,
  "confidence_score": integer (0-100),
  "red_flags": ["[array of string red flag phrases or empty]"],
  "explanation": "Brief explanation of your verdict"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    });

    const responseText = response.text;
    const cleanJson = stripMarkdown(responseText);
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Error in analyzeComplaint:', error);
    throw error;
  }
}
