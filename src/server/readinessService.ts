import { GoogleGenAI, Type, Schema } from '@google/genai';
import { FCORequestData, FCOProcedure, ProcedureReadinessSuggestion } from '../types';
import dotenv from 'dotenv';
dotenv.config({ override: true });

function getAiClient() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const READINESS_PROMPT = `You are a strict technical safety and compliance reviewer for field change procedures.
Your job is to review the provided FCO draft procedure and identify any missing essential sections or checks that are typically required for safe, complete execution.

You will evaluate the procedure against these categories:
1. "pre_installation" - Missing preparation, tools gathered, or equipment staging.
2. "safety_preparation" - Missing safety checks, isolation (LOTO), or specific hazard preparation (e.g. skin injection, gas).
3. "parts_check" - Missing confirmation of correct parts, kits, or versions before start.
4. "post_installation_check" - Missing immediate physical checks after installation (e.g. torque, seal, visual inspection).
5. "functional_check" - Missing system-level functional test, leak test, or operation check.
6. "completion_verification" - Missing final sign-off, restoration of service, or cleanup.
7. "documentation_impact" - Missing instructions to update manuals, drawings, or software records.

RULES:
- Suggest ONLY missing elements. If a category is already covered by an existing step, do NOT suggest it.
- DO NOT invent technical specifics (e.g. part numbers, torque values, test pressures, SWI IDs).
- If a value or reference is needed but not provided in the input context, use exactly: [To be confirmed by submitter] or [Reference required from submitter].
- DO NOT suggest "Verify equipment is offline" unless the input explicitly requires it. Use generic wording like "Verify the equipment is in the required state before starting work. [Required state to be confirmed by submitter]" if applicable.
- Return a JSON array of suggestions.
- Do not output markdown code blocks outside of the JSON payload. Ensure valid JSON.

Schema per suggestion:
{
  "category": "pre_installation" | "safety_preparation" | "parts_check" | "post_installation_check" | "functional_check" | "completion_verification" | "documentation_impact",
  "targetSection": "Safety and Preparation" | "Installation Steps" | "Post-Installation / Functional Check",
  "suggestedText": "string",
  "reason": "string"
}
`;

export async function generateReadinessSuggestions(
  fcoDraft: any,
  rewrittenProcedure: FCOProcedure
): Promise<ProcedureReadinessSuggestion[]> {
  try {
    const procedureText = rewrittenProcedure.sections
      .map(s => {
        const groupText = (s.stepGroups || [])
          .map(g => `${g.title}:\n${g.steps.map(st => `- ${st}`).join('\n')}`)
          .join('\n');
        const flatText = (s.steps || []).map((step, i) => `${i + 1}. ${step}`).join('\n');
        return `[${s.title}]\n${[groupText, flatText].filter(Boolean).join('\n')}`;
      })
      .join('\n\n');

    const inputContext = `
FCO Title: ${fcoDraft.fcoMetadata?.fcoTitle || ''}
Change Type: ${rewrittenProcedure.changeType || ''}
Known Safety Risks: ${fcoDraft.technicalContent?.knownSafetyRisks || ''}

Current Procedure:
${procedureText}
`;

    const response = await getAiClient().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: 'user', parts: [{ text: READINESS_PROMPT + "\\n\\n" + inputContext }] }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              targetSection: { type: Type.STRING },
              suggestedText: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ["category", "targetSection", "suggestedText", "reason"]
          }
        }
      }
    });

    const text = response.text || "[]";
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.warn("Failed to parse Gemini response for readiness suggestions:", e);
      return [];
    }

    const suggestions: ProcedureReadinessSuggestion[] = [];
    for (const item of parsed) {
      // Validate
      if (!item.category || !item.targetSection || !item.suggestedText || !item.suggestedText.trim()) {
        continue;
      }
      
      const validCategories = ["pre_installation", "safety_preparation", "parts_check", "post_installation_check", "functional_check", "completion_verification", "documentation_impact"];
      if (!validCategories.includes(item.category)) continue;

      const validTargetSections = ["Safety and Preparation", "Installation Steps", "Post-Installation / Functional Check", "Safety", "Preparation", "Implementation", "Verification", "Completion"];
      let targetSec = item.targetSection;
      
      // try to map it roughly if we can
      if (!validTargetSections.includes(targetSec)) {
        if (targetSec.toLowerCase().includes('safety')) targetSec = "Safety";
        else if (targetSec.toLowerCase().includes('prep')) targetSec = "Preparation";
        else if (targetSec.toLowerCase().includes('install') || targetSec.toLowerCase().includes('implement')) targetSec = "Implementation";
        else if (targetSec.toLowerCase().includes('post') || targetSec.toLowerCase().includes('verif') || targetSec.toLowerCase().includes('check')) targetSec = "Verification";
        else if (targetSec.toLowerCase().includes('complet')) targetSec = "Completion";
      }

      suggestions.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        category: item.category,
        targetSection: targetSec,
        suggestedText: item.suggestedText,
        reason: item.reason || "",
        status: "pending",
        source: "ai_suggestion",
        requiresUserConfirmation: true,
        createdAt: new Date().toISOString()
      });
    }

    return suggestions;
  } catch (error) {
    console.error("Error generating readiness suggestions:", error);
    return [];
  }
}
