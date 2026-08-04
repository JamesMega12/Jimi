import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { fcoSystemPrompt } from './src/server/fcoSystemPrompt.js';

dotenv.config();

// Fallback to loading .env.example if GEMINI_API_KEY is not defined in the process or in .env
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY.trim() === "") {
  dotenv.config({ path: '.env.example' });
}

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Is GEMINI_API_KEY set?", !!apiKey);
  if (!apiKey) {
    console.log("No key found, testing local fallback...");
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  console.log("Using model:", modelName);

  const payload = {
    title: "SLB-3100-XP Flow Controller Firmware Upgrade",
    priority: "Urgent",
    changeTypeOverride: "Software / Configuration Change",
    affectedEquipment: "SLB-3100-XP Electronic Flow Panel v1.2",
    knownSafetyRisks: "Sudden reset can cause system trip. Configuration parameters must be recorded before upgrade to prevent engine misalignment.",
    existingReferences: "IT-876543, Software Config Guide v3.2",
    customDirectives: "Highlight safety or access control credential rules. Do not clear the NVRAM variables map.",
    rawSummary: "The v1.2 flow firmware contains a math glitch where calculation overflow occurs when flow speed climbs over 120 liters/min. The solution is writing and installing upgraded flow firmware version v12.1.2. The advantage will be correct flow records without system trips.",
    rawProcedure: "Log into the control panel admin interface using your level 2 technical ID and safety passcode. Choose 'Settings' and navigate to 'Diagnostics'. Write down or screenshot the existing NVRAM speed parameters map values. Save a current configuration backup file named 'config_backup_v1.2.txt' to external flash drive. Slide flow panel safety switch SW1 to maintenance state. Use controller firmware loader console utility on maintenance laptop. Upload version v12.1.2 firmware update image file. Restart standard unit. Wait for display to show system version v12.1.2. Check standard parameters match original map variables correctly. Switch SW1 back to run mode. Test flow test sequence from laptop up to 100 liters/min and verify normal logs."
  };

  const userPrompt = `FCO Context:
Title: ${payload.title}
Priority: ${payload.priority}
Known change type override: ${payload.changeTypeOverride}
Affected equipment/model: ${payload.affectedEquipment}
Known safety risks: ${payload.knownSafetyRisks}
Existing references: ${payload.existingReferences}
Custom directives: ${payload.customDirectives}

Raw Summary:
${payload.rawSummary}

Raw Procedure:
${payload.rawProcedure}

Return the rewritten FCO content as strict JSON using the required schema. Ensure it follows all instructions precisely.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: userPrompt,
      config: {
        systemInstruction: fcoSystemPrompt,
        responseMimeType: "application/json",
        temperature: 0.15,
      }
    });

    console.log("SUCCESS calling Gemini!");
    console.log("Response text:", response.text);
  } catch (err) {
    console.error("Gemini call error:", err.message || err);
  }
}

run();
