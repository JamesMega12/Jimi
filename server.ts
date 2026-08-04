import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { buildFcoSystemPrompt } from './src/server/fcoSystemPrompt';
import { buildEvaluateSummaryPrompt } from './src/server/evaluateSummaryPrompt';
import { runLocalHeuristic } from './src/server/fallbackEngine';
import { validateAndRepairResponse, validateDraft } from './src/server/validationService';
import { generateReadinessSuggestions } from './src/server/readinessService';
import { buildDisplayProcedure } from './src/utils/procedureMerge';
import { cleanSummaryForPrompt } from './src/server/summaryPlanBuilder';
import { FCOApiResponse, FCORequestData, DocxAnalysisResponse } from './src/types';
import { getDocuments, deleteDocument, getChunks, getSettings, updateSettings, loadSeedData, clearSeedData, saveChunks, saveDocument, replaceDocumentChunks } from './src/server/knowledgeBaseService';
import { ingestDocument } from './src/server/documentIngestionService';
import { ingestSteDocument, reindexSteDocument } from './src/server/steIngestionService';
import { retrieveRelevantChunks, retrieveRelevantChunksForQuery, filterChunksBySettings } from './src/server/retrievalService';
import { buildGroundingPromptContext } from './src/server/groundingContextBuilder';
import { getInstructionTrace, loadInstructionPack } from './src/server/instructionPacks/loader';
import { getDrafts, saveDraft, deleteDraft } from './src/server/instructionPacks/draftService';
import { getActiveRegistry, saveActiveRegistry } from './src/server/instructionPacks/activeRegistryService';
import { docxRoutes } from './src/server/routes/docxRoutes';
import { technicalAlertRoutesV2 } from './src/server/routes/technicalAlertRoutesV2';
import { announcementRoutes } from './src/server/routes/announcementRoutes';
import { logEvent, newRequestId } from './src/server/logger';
import { kbRoutes } from './src/server/routes/kbRoutes';
import { chunkExtractedText, checkCorruption } from './src/server/chunkingService';
import { generateTextEmbedding } from './src/server/embeddingService';
import { generateDocxExport } from './src/server/docxExportService';

// Load environment variables from .env
dotenv.config({ override: true });

// Fallback to loading .env.example if GEMINI_API_KEY is not defined in the process or in .env
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY.trim() === "") {
  dotenv.config({ path: path.join(process.cwd(), '.env.example'), override: true });
}

const app = express();
// Honor the platform-injected PORT (Google AI Studio / Cloud Run set $PORT,
// typically 8080); fall back to 3000 for local dev.
const PORT = Number(process.env.PORT) || 3000;

// Process-level safety net. Every request handler already has its own
// try/catch; these catch stray async errors that would otherwise crash the
// single-process server. Log-and-continue keeps the server serving (the
// platform can still be configured to restart on repeated failures).
process.on('unhandledRejection', (reason: any) => {
  console.error(JSON.stringify({ event: 'unhandled_rejection', message: reason instanceof Error ? reason.message : String(reason) }));
});
process.on('uncaughtException', (err: any) => {
  console.error(JSON.stringify({ event: 'uncaught_exception', message: err?.message || String(err) }));
});

// Trust the first proxy in Google Cloud Run / AI Studio environment
app.set('trust proxy', 1);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Increased to 100 to prevent status polling from exhausting limits during Export DOCX
  message: { error: 'Too many requests, please try again later.' },
  validate: {
    xForwardedForHeader: false,
    trustProxy: false,
    forwardedHeader: false,
    default: true
  }
});

app.use(express.json({ limit: '10mb' }));

// Apply rate limiter to all /api routes
app.use('/api/', apiLimiter);

// Request logging + correlation id. Structured and body-free: no client IP
// (PII), no query string, no request body -- only method, path, and a
// per-request id that downstream error logs echo for correlation.
app.use('/api/', (req, res, next) => {
  (req as any).requestId = newRequestId();
  logEvent('info', 'request', { requestId: (req as any).requestId, method: req.method, path: req.path });
  next();
});

app.post('/api/analyze-procedure', async (req, res) => {
  try {
    const { rawProcedure } = req.body;
    if (!rawProcedure) {
      return res.status(400).json({ error: "Missing procedure text" });
    }

    const modelName = "gemini-2.5-flash";
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are an expert technical writer. The user is providing a messy, raw engineering procedure.
Your task is to rewrite it into a clear, sequential list of instructions.
Rules:
1. Each step must contain exactly one action.
2. Use imperative verbs (e.g., "Remove", "Install", "Verify").
3. Make it easy to follow.
4. Do not drop any technical details or steps.
5. Do not include introductory text.
6. Number each step like: 
   1. Do this.
   2. Do that.

Raw Procedure:

${rawProcedure}
`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.1,
      }
    });

    res.json({ suggestedProcedure: response.text });
  } catch (error: any) {
    console.error("Error analyzing procedure:", error);
    res.status(500).json({ error: error.message });
  }
});

app.use('/api/docx', docxRoutes);
// The v2 route prefix (/api/technical-alert/v2) is retained -- the frontend API
// client (technicalAlertApiV2.ts) already targets it and renaming is pure churn.
app.use('/api/technical-alert/v2', technicalAlertRoutesV2);
// Dedicated Announcement routes (Summary/Reason/Action + review/export).
app.use('/api/announcement', announcementRoutes);
app.use('/api/kb', kbRoutes);

/**
 * Safe JSON parser with backslash/markdown cleanup
 */
function tryExtractJson(text: string): any {
  let cleanedText = text.trim();
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  try {
    return JSON.parse(cleanedText);
  } catch (err) {
    // Attempt to search for JSON object using curly braces
    const match = cleanedText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (innerErr) {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Handles raw content generation with Gemini SDK
 */
async function callGeminiRaw(promptText: string, telemetry: { llmAttemptsUsed: number }, systemInstruction?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    console.error("[Gemini Validation] API Key missing, placeholder, or empty. Disabling Gemini execution.");
    throw new Error("GEMINI_API_KEY is not configured or is using placeholder value.");
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const modelName = "gemini-2.5-flash";
  let lastError: any = null;
  const backoffs = [0, 2000]; // 2 attempts

  for (let attempt = 0; attempt < backoffs.length; attempt++) {
    const delay = backoffs[attempt];
    if (delay > 0) {
      console.log(`[Gemini Execution] Delaying attempt ${attempt + 1} by ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      telemetry.llmAttemptsUsed++;
      
      console.log(`[Gemini Execution] Attempt ${attempt + 1}/${backoffs.length} using model: ${modelName}`);
      console.log(`[Gemini Execution] Dispatching generateContent request... Payload size: ${promptText.length} characters`);
      
      const config: any = {
        responseMimeType: "application/json",
        temperature: 0.15,
      };
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const responsePromise = ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini call timed out (120s limit)")), 120000)
      );

      console.log(`[Gemini Execution] generateContent promise created. Waiting for response or timeout...`);
      const response = await Promise.race([responsePromise, timeoutPromise]);
      console.log(`[Gemini Execution] Response received successfully from Gemini API.`);
      
      const responseText = response.text;
      
      if (!responseText) {
        console.error(`[Gemini Execution] Error: Gemini returned an empty text response.`);
        throw new Error("Gemini returned an empty text response.");
      }

      console.log(`[Gemini Execution] Response text length: ${responseText.length} characters`);
      return responseText;
    } catch (err: any) {
      let errorMsg = err.message || 'Unknown error';
      // Attempt to extract cleaner message if it's an API error object stringified
      if (typeof err.message === 'string' && err.message.includes('"message":')) {
         try {
           const parsed = JSON.parse(err.message.substring(err.message.indexOf('{')));
           if (parsed.error && parsed.error.message) {
             errorMsg = parsed.error.message;
           }
         } catch(e) {}
      }
      lastError = new Error(errorMsg);
      console.warn(`[Gemini Execution] Attempt ${attempt + 1} failed: ${errorMsg}`);
    }
  }

  console.error(`[Gemini Execution] All retries exhausted. Throwing final error.`);
  throw lastError || new Error("Gemini API call retries exhausted.");
}

import { normalizeManualPaste } from './src/server/manualPasteNormalizer';

app.post('/api/fco/normalize-paste', (req, res) => {
  try {
    const { rawSummary, rawProcedure } = req.body;
    if (typeof rawSummary !== 'string' || typeof rawProcedure !== 'string') {
      return res.status(400).json({ error: "Missing string fields rawSummary or rawProcedure" });
    }
    const result = normalizeManualPaste(rawSummary, rawProcedure);
    res.json(result);
  } catch (err: any) {
    console.error("Paste normalizer error:", err);
    res.status(500).json({ error: err.message || "Failed to normalize paste" });
  }
});

/**
 * Endpoint for rewriting FCO Drafts
 */
async function processRewrite(req: express.Request, res: express.Response) {
  const reqBody = req.body as (FCORequestData & { jobId?: string });
  reqBody.rewriteScope = reqBody.rewriteScope || 'full';
  const draft = reqBody.fcoDraft;
  
  // Phase 1 Architecture Hardening: Canonical Rewrite Payload Refactor
  // Use fcoDraft as primary truth, fallback to legacy flat fields.
  if (draft) {
    reqBody.title = draft.fcoMetadata?.fcoTitle ?? reqBody.title ?? '';
    reqBody.priority = draft.fcoMetadata?.priority ?? reqBody.priority ?? '';
    reqBody.appliesTo = draft.fcoMetadata?.appliesTo ?? reqBody.appliesTo ?? '';
    reqBody.effectiveDate = draft.fcoMetadata?.effectiveDate ?? reqBody.effectiveDate ?? '';
    reqBody.productionStart = draft.fcoMetadata?.productionStart ?? reqBody.productionStart ?? '';
    reqBody.affectedEquipment = draft.fcoMetadata?.affectedEquipmentModel ?? reqBody.affectedEquipment ?? '';
    reqBody.knownSafetyRisks = draft.technicalContent?.knownSafetyRisks ?? reqBody.knownSafetyRisks ?? '';
    reqBody.customDirectives = draft.technicalContent?.optionalRewriteInstructions ?? reqBody.customDirectives ?? '';
    reqBody.rawSummary = draft.technicalContent?.draftSummary ?? reqBody.rawSummary ?? '';
    reqBody.rawProcedure = draft.technicalContent?.draftProcedure ?? reqBody.rawProcedure ?? '';
  }

  const {
    title = '',
    priority = '',
    changeType = '',
    affectedEquipment = '',
    knownSafetyRisks = '',
    customDirectives = '',
    appliesTo = '',
    effectiveDate = '',
    productionStart = '',
    rawSummary = '',
    rawProcedure = '',
    inputSource = 'manual',
    docxExtraction,
    testPreset,
    jobId,
    confirmedPCSB
  } = reqBody;

  if (jobId) generationStatus[jobId] = "Executing Gemini API...";

  // Track LLM telemetry variables
  const telemetry = {
    llmAttemptsUsed: 0,
    jsonRepairAttemptsUsed: 0,
    repairPassesUsed: 0,
    invalidJsonReceived: false,
    invalidJsonRecovered: false,
    lastLlmError: null as string | null
  };

  // Validate presence of summary and procedure
  if (!rawSummary.trim() || !rawProcedure.trim()) {
    return res.status(400).json({
      error: "Validation failed: Both raw FCO Summary and raw FCO Procedure are required fields."
    });
  }

  // Check for ignore safety directive security risk
  let safetyRefused = false;
  const lowerDirective = customDirectives.toLowerCase();
  if (
    lowerDirective.includes('ignore safety') ||
    lowerDirective.includes('bypass safety') ||
    lowerDirective.includes('disable loto') ||
    lowerDirective.includes('remove safety') ||
    lowerDirective.includes('skip safety')
  ) {
    safetyRefused = true;
  }

  // Retrieve relevant chunks from the Knowledge Base for RAG grounding
  let retrievedChunks: any[] = [];
  let matchedCategories: string[] = [];
  let topChunkCategories: string[] = [];
  try {
    const retrievalResult = await retrieveRelevantChunks(req.body, 5);
    retrievedChunks = retrievalResult.sources;
    matchedCategories = retrievalResult.matchedCategories;
    topChunkCategories = retrievalResult.topChunkCategories;
  } catch (retrieveErr) {
    console.warn("Failed to retrieve chunks for RAG grounding:", retrieveErr);
  }

  const allChunks = getChunks();
  const allDocs = getDocuments();
  const uploadedDocumentChunkCount = allChunks.filter(c => !c.isSeedData).length;
  const seedChunkCount = allChunks.filter(c => c.isSeedData).length;
  
  const usedSeedData = retrievedChunks.some(c => c.isSeedData);
  const usedUploadedSourceTruth = retrievedChunks.some(c => !c.isSeedData);
  
  let retrievalDataSource: 'seed_data' | 'uploaded_documents' | 'mixed' | 'none' = 'none';
  if (retrievedChunks.length > 0) {
     if (usedSeedData && usedUploadedSourceTruth) retrievalDataSource = 'mixed';
     else if (usedUploadedSourceTruth) retrievalDataSource = 'uploaded_documents';
     else if (usedSeedData) retrievalDataSource = 'seed_data';
  }

  const retrievalWarnings = [];
  if (retrievedChunks.length === 0) {
     retrievalWarnings.push("No uploaded source truths were active. Rewrite used embedded app rules only.");
  } else if (!usedUploadedSourceTruth) {
     retrievalWarnings.push("Rewrite used seeded demo guidance only. Upload approved source-truth documents for real grounding.");
  }

  const groundingPromptContext = buildGroundingPromptContext(retrievedChunks);

  const summaryPack = await loadInstructionPack("summary");
  const procedurePack = await loadInstructionPack("procedure");
  const systemInstructionText = buildFcoSystemPrompt(summaryPack, procedurePack);

  let knowledgeState: any = 'none';
  if (retrievedChunks.length > 0) {
     if (usedUploadedSourceTruth && !usedSeedData) knowledgeState = 'uploaded_active';
     else if (usedSeedData && !usedUploadedSourceTruth) knowledgeState = 'seed_only';
     else if (usedUploadedSourceTruth && usedSeedData) knowledgeState = 'mixed';
  }

  const groundingDiagnostics = {
    groundingUsed: retrievedChunks.length > 0,
    retrievedChunkCount: retrievedChunks.length,
    retrievalDataSource,
    usedUploadedSourceTruth,
    usedSeedData,
    sourceTruthContextInjected: groundingPromptContext.trim().length > 0,
    sourceTruthContextTokenCount: Math.round(groundingPromptContext.length / 4), // Rough estimate
    knowledgeState,
    uploadedDocumentChunkCount,
    seedChunkCount,
    matchedCategories,
    topChunkCategories,
    retrievedSources: retrievedChunks.map((chunk: any) => ({
      documentName: chunk.documentName,
      documentType: chunk.documentType,
      ruleCategory: chunk.ruleCategory,
      chunkId: chunk.chunkId || chunk.id,
      relevanceScore: chunk.relevanceScore,
      isSeedData: chunk.isSeedData,
      sectionTitle: chunk.sectionTitle
    })),
    retrievalWarnings
  };

  const cleanedRawSummary = cleanSummaryForPrompt(rawSummary);

  let pcsbSection = "";
  if (confirmedPCSB && Object.keys(confirmedPCSB).length > 0) {
    pcsbSection = `\nConfirmed PCSB (Extracted Components):\nProblem: ${confirmedPCSB.problem || "Information required from submitter"}\nCause: ${confirmedPCSB.cause || "Information required from submitter"}\nSolution: ${confirmedPCSB.solution || "Information required from submitter"}\nBenefit: ${confirmedPCSB.benefit || "Information required from submitter"}\n\n`;
  }

  // Canonical extensions for the prompt
  const canonicalApplication = draft?.fcoMetadata?.application || '';
  const canonicalFcoNumber = draft?.fcoMetadata?.fcoNumber || '';
  const canonicalAssociatedRFI = draft?.associatedInfo?.associatedRFI || '';
  const canonicalSupersededFCOs = draft?.associatedInfo?.supersededFCOs || '';
  const canonicalAssociatedFCOs = draft?.associatedInfo?.associatedFCOs || '';
  const canonicalAssociatedCOCAs = draft?.associatedInfo?.associatedCOCAs || '';
  const canonicalAssociatedTechAlerts = draft?.associatedInfo?.associatedTechAlerts || '';
  const canonicalMaintenanceProcedureChanges = draft?.additionalFcoInfo?.maintenanceProcedureChanges || '';
  const canonicalMarkingInformation = draft?.additionalFcoInfo?.markingInformation || '';
  const canonicalExistingReferences = draft?.technicalContent?.existingReferences || '';

  let fcoContextBlock = `FCO Context:\n`;
  if (canonicalFcoNumber) fcoContextBlock += `FCO Number: ${canonicalFcoNumber}\n`;
  fcoContextBlock += `Title: ${title || "Untitled FCO"}\n`;
  fcoContextBlock += `Priority: ${priority}\n`;
  fcoContextBlock += `Known change type: ${changeType}\n`;
  fcoContextBlock += `Affected equipment/model: ${affectedEquipment || "Unknown"}\n`;
  fcoContextBlock += `Applies to: ${appliesTo || "Unknown"}\n`;
  if (canonicalApplication) fcoContextBlock += `Application: ${canonicalApplication}\n`;
  fcoContextBlock += `Effective date: ${effectiveDate || "Unknown"}\n`;
  fcoContextBlock += `Production start: ${productionStart || "Unknown"}\n`;
  fcoContextBlock += `Known safety risks: ${knownSafetyRisks || "None provided"}\n`;
  if (canonicalExistingReferences) fcoContextBlock += `Existing references/documents: ${canonicalExistingReferences}\n`;
  if (canonicalAssociatedRFI) fcoContextBlock += `Associated RFI: ${canonicalAssociatedRFI}\n`;
  if (canonicalSupersededFCOs) fcoContextBlock += `Superseded FCOs: ${canonicalSupersededFCOs}\n`;
  if (canonicalAssociatedFCOs) fcoContextBlock += `Associated FCOs: ${canonicalAssociatedFCOs}\n`;
  if (canonicalAssociatedCOCAs) fcoContextBlock += `Associated CO/CA: ${canonicalAssociatedCOCAs}\n`;
  if (canonicalAssociatedTechAlerts) fcoContextBlock += `Associated Tech Alerts: ${canonicalAssociatedTechAlerts}\n`;
  if (canonicalMaintenanceProcedureChanges) fcoContextBlock += `Changes to maintenance procedures: ${canonicalMaintenanceProcedureChanges}\n`;
  if (canonicalMarkingInformation) fcoContextBlock += `Marking information: ${canonicalMarkingInformation}\n`;
  fcoContextBlock += `Custom directives: ${customDirectives || "None provided"}\n`;

  // Shape prompt message
  const userPrompt = `${fcoContextBlock}
NOTE: The LLM MUST NOT rewrite the FCO Context block above (Applies To, Effective Date, Production Start, etc.). Do not include them in the rewritten output unless explicitly required by the final JSON schema. Use them only to provide contextual understanding to improve applicability wording.

Raw Summary:
${cleanedRawSummary}
${pcsbSection}
Raw Procedure:
${rawProcedure}

${groundingPromptContext}

Return the rewritten FCO content as strict JSON using the required schema. Ensure it follows all instructions precisely.`;

  try {
    // 1. Check GEMINI_API_KEY environment configuration
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
      throw new Error("Gemini API key or model configuration missing/invalid");
    }

    console.log("Drafting initial FCO rewrite from Gemini...");
    let rawText: string;
    try {
      rawText = await callGeminiRaw(userPrompt, telemetry, systemInstructionText);
    } catch (apiErr: any) {
      telemetry.lastLlmError = apiErr.message || String(apiErr);
      throw apiErr;
    }

    let parsedJson: any;
    try {
      parsedJson = tryExtractJson(rawText);
    } catch (parseErr) {
      // 2. Initial JSON parse failed. Initiate JSON Repair Flow!
      telemetry.invalidJsonReceived = true;
      telemetry.jsonRepairAttemptsUsed++;
      console.warn("Initial Gemini response was not valid JSON. Requesting JSON repair...");

      const jsonRepairPrompt = `Convert the following response into valid JSON using the required FCO response schema.
Do not change technical meaning.
Do not add new technical information.
Do not remove existing technical facts.
Return JSON only.
Do not wrap the JSON in markdown.
Invalid response:
${rawText}`;

      try {
        const rawRepairText = await callGeminiRaw(jsonRepairPrompt, telemetry, systemInstructionText);
        parsedJson = tryExtractJson(rawRepairText);
        telemetry.invalidJsonRecovered = true;
        console.log("JSON repair pass succeeded!");
      } catch (repairErr: any) {
        telemetry.lastLlmError = `JSON Repair Failed: ${repairErr.message || repairErr}`;
        throw new Error("LLM returned unparseable output, and JSON repair attempt failed.");
      }
    }

    // 3. Evaluate checklist validation rules
    let validationResult = validateDraft(parsedJson, req.body, retrievedChunks);
    let repairAttempts = 0;

    // Dual repair passes loop on validation failure
    while (!validationResult.validationPassed && repairAttempts < 2) {
      if (jobId) generationStatus[jobId] = "Validation Failed! Repairing Draft...";
      repairAttempts++;
      telemetry.repairPassesUsed = repairAttempts;
      console.warn(`Validation failed for draft. Commencing Gemini validation repair pass #${repairAttempts}...`);
      console.warn(`Validation errors: ${JSON.stringify(validationResult.validationErrors)}`);

      const validationRepairPrompt = `The previous FCO rewrite failed our technical validation checklist. Please correct the draft according to the validation errors listed below.

FAILED DRAFT CONTENTS:
${JSON.stringify(parsedJson, null, 2)}

VALIDATION ERRORS TO REPAIR:
${validationResult.validationErrors.map(err => `- ${err}`).join('\n')}

INSTRUCTIONS FOR REPAIR DRAFT:
1. Update and correct all listed FCO validation errors immediately back to standards.
2. Maintain all other parts of the document intact, preserving all technical facts [${validationResult.missingPreservedFacts.join(', ')}] exactly.
3. Keep the total rewritten summary length (sum of problem, cause, solution, benefit) under 150 words.
4. Return ONLY valid, complete, and strict JSON output complying exactly with the original FCO schema. No extra formatting tags.`;

      try {
        const rawRepairText = await callGeminiRaw(validationRepairPrompt, telemetry, systemInstructionText);
        let parsedRepairJson: any;

        try {
          parsedRepairJson = tryExtractJson(rawRepairText);
        } catch (parseRepairErr) {
          // Inner JSON repair for validation repair output if it is invalid JSON
          telemetry.invalidJsonReceived = true;
          telemetry.jsonRepairAttemptsUsed++;
          console.warn("Validation repair output was not valid JSON. Attempting JSON repair on repair output...");

          const innerJsonRepairPrompt = `Convert the following response into valid JSON using the required FCO response schema.
Do not change technical meaning.
Do not add new technical information.
Do not remove existing technical facts.
Return JSON only.
Do not wrap the JSON in markdown.
Invalid response:
${rawRepairText}`;

          const rawInnerRepairText = await callGeminiRaw(innerJsonRepairPrompt, telemetry, systemInstructionText);
          parsedRepairJson = tryExtractJson(rawInnerRepairText);
          telemetry.invalidJsonRecovered = true;
        }

        const nextValidation = validateDraft(parsedRepairJson, req.body, retrievedChunks);
        parsedJson = parsedRepairJson;
        validationResult = nextValidation;

        if (validationResult.validationPassed) {
          console.log(`Gemini validation repair pass #${repairAttempts} succeeded! Passed validation.`);
          break;
        }
      } catch (repairErr: any) {
        console.warn(`Gemini validation repair pass #${repairAttempts} crashed:`, repairErr.message || repairErr);
        telemetry.lastLlmError = repairErr.message || String(repairErr);
        break;
      }
    }

    // 4. Cascade to Local Heuristic Fallback if validation still fails after maximum repair attempts
    if (!validationResult.validationPassed) {
      if (jobId) generationStatus[jobId] = "Gemini validation could not be completed. Using local fallback engine.";
      console.warn("Gemini repair runs exhausted or failed validation. Cascading down to Local Heuristic Fallback engine...");
      const concatErrors = "Gemini rewrite failed validation checklist check: " + validationResult.validationErrors.join("; ");
      
      let finalized = runLocalHeuristic(req.body, concatErrors) as any;
      
      // Merge precise telemetry into diagnostics
      finalized.diagnostics.llmAttemptsUsed = telemetry.llmAttemptsUsed;
      finalized.diagnostics.jsonRepairAttemptsUsed = telemetry.jsonRepairAttemptsUsed;
      finalized.diagnostics.repairPassesUsed = telemetry.repairPassesUsed;
      finalized.diagnostics.invalidJsonReceived = telemetry.invalidJsonReceived;
      finalized.diagnostics.invalidJsonRecovered = telemetry.invalidJsonRecovered;
      finalized.diagnostics.lastLlmError = telemetry.lastLlmError || concatErrors;
      finalized.diagnostics.validationPassed = false;
      finalized.diagnostics.validationErrors = validationResult.validationErrors;
      finalized.diagnostics.missingPreservedFacts = validationResult.missingPreservedFacts;
      finalized.diagnostics.technicalValuesPreserved = validationResult.technicalValuesPreserved;
      finalized.diagnostics.shallowRewriteDetected = validationResult.shallowRewriteDetected;
      finalized.diagnostics.similarityCheckPassed = validationResult.similarityCheckPassed;
      finalized.diagnostics.summaryWordLimitPassed = validationResult.summaryWordLimitPassed;

      if (safetyRefused) {
        finalized.techComReviewNotes.safetyItemsToConfirm.push(
          "CRITICAL REVIEW NOTE: Refused user custom directive request to bypass safety protocols. All safety checks and LOTO sections remain strictly required."
        );
      }
      
      // Attach RAG grounding details
      finalized.grounding = groundingDiagnostics;
      finalized.diagnostics = finalized.diagnostics || {};
      finalized.diagnostics.instructionTrace = await getInstructionTrace();
      if (testPreset) finalized.testPreset = testPreset;
      return res.json(finalized);
    }

    // 5. Finalize successfully validated draft
    let finalized = validateAndRepairResponse(parsedJson, req.body, "gemini", validationResult, repairAttempts, telemetry, retrievedChunks) as any;

    if (inputSource === 'docx' && docxExtraction) {
        let unlinkedFigures: string[] = [];
        let missingFigureCaptions: string[] = [];
        let figureReferencesPreserved = true;
        let figurePlaceholdersInserted = true;
        
        let unlinkedTables: string[] = [];
        let missingTableTitles: string[] = [];
        let tableReferencesPreserved = true;
        let tablePlaceholdersInserted = true;
        
        if (docxExtraction.figureMap) {
            docxExtraction.figureMap.forEach((fig: any) => {
               if (fig.warnings && fig.warnings.length > 0) {
                  unlinkedFigures.push(fig.figureNumber || fig.figureId);
               }
               if (fig.placeholder && fig.placeholder.includes('caption required')) {
                  missingFigureCaptions.push(fig.figureNumber || fig.figureId);
               }
            });
        }

        if (docxExtraction.tableMap) {
            docxExtraction.tableMap.forEach((table: any) => {
               if (table.warnings && table.warnings.length > 0) {
                  unlinkedTables.push(table.tableNumber || table.tableId);
               }
               if (table.placeholder && table.placeholder.includes('title required')) {
                  missingTableTitles.push(table.tableNumber || table.tableId);
               }
            });
        }

        finalized.docxExtractionDiagnostics = {
            inputSource: 'docx',
            documentId: docxExtraction.documentId,
            fileName: docxExtraction.fileName,
            summaryBlockIds: docxExtraction.summaryBlockIds,
            procedureBlockIds: docxExtraction.procedureBlockIds,
            figurePlaceholdersInserted,
            tablePlaceholdersInserted,
            figureReferencesPreserved,
            tableReferencesPreserved,
            missingFigureCaptions,
            missingTableTitles,
            unlinkedFigures,
            unlinkedTables,
            newFigureNumbersCreated: [],
            newTableNumbersCreated: [],
            removedFigureReferences: [],
            removedTableReferences: [],
            userConfirmedExtraction: docxExtraction.userConfirmed,
            extractionConfidence: docxExtraction.extractionConfidence,
            extractionConfirmationMode: docxExtraction.extractionConfirmationMode,
            autoRewriteTriggered: docxExtraction.autoRewriteTriggered,
            summaryConfidence: docxExtraction.summaryConfidence,
            procedureConfidence: docxExtraction.procedureConfidence,
            overallExtractionConfidence: docxExtraction.overallExtractionConfidence,
            criticalExtractionWarnings: docxExtraction.criticalExtractionWarnings
        };
        
        if (!figureReferencesPreserved) {
             finalized.techComReviewNotes.referencesToConfirm.push(
                 "Confirm that all original figure references have been properly transferred to the rewritten document."
             );
        }
        if (missingFigureCaptions.length > 0) {
            missingFigureCaptions.forEach(fc => {
                const note = `${fc} is referenced in the procedure, but no matching caption was detected.`;
                if (!finalized.techComReviewNotes.referencesToConfirm.includes(note)) {
                    finalized.techComReviewNotes.referencesToConfirm.push(note);
                }
            });
        }
        
        if (missingTableTitles.length > 0) {
            missingTableTitles.forEach(tt => {
                const note = `A procedure table is referenced as ${tt}, but no table title or purpose was detected.`;
                if (!finalized.techComReviewNotes.referencesToConfirm.includes(note)) {
                    finalized.techComReviewNotes.referencesToConfirm.push(note);
                }
            });
        }
        
        if (docxExtraction.figureMap) {
            docxExtraction.figureMap.forEach((fig: any) => {
                if (fig.warnings && Array.isArray(fig.warnings)) {
                    fig.warnings.forEach((warn: string) => {
                        if (!finalized.techComReviewNotes.referencesToConfirm.includes(warn)) {
                            finalized.techComReviewNotes.referencesToConfirm.push(warn);
                        }
                    });
                }
            });
        }

        if (docxExtraction.tableMap) {
            docxExtraction.tableMap.forEach((table: any) => {
                if (table.warnings && Array.isArray(table.warnings)) {
                    table.warnings.forEach((warn: string) => {
                        if (!finalized.techComReviewNotes.referencesToConfirm.includes(warn)) {
                            finalized.techComReviewNotes.referencesToConfirm.push(warn);
                        }
                    });
                }
            });
        }
    }

    if (safetyRefused) {
      finalized.techComReviewNotes.safetyItemsToConfirm.push(
        "CRITICAL REVIEW NOTE: Refused user custom directive request to bypass safety protocols. All safety checks and LOTO sections remain strictly required."
      );
      finalized.techComReviewNotes.sourceTruthConflicts.push(
        "Directive Alert: Safe formatting is standard practice. Requested override of safety regulations. Bypassing safety is disallowed."
      );
    }

    // Attach RAG grounding details
    finalized.grounding = groundingDiagnostics;
    finalized.diagnostics = finalized.diagnostics || {};
    finalized.diagnostics.instructionTrace = await getInstructionTrace();
    if (testPreset) finalized.testPreset = testPreset;
    if (jobId) delete generationStatus[jobId];
    return res.json(finalized);
  } catch (error: any) {
    if (jobId) generationStatus[jobId] = "Gemini is unavailable. Using local fallback engine.";
    console.error("Gemini pipeline failed entirely: ", error.message || error);
    
    // Explicitly fallback if Gemini is completely unavailable or throws a fatal error
    const fallbackReason = telemetry.lastLlmError || error.message || "Gemini API unavailable";
    console.warn("Cascading to Local Heuristic Fallback engine due to total pipeline failure...");
    
    let finalized = runLocalHeuristic(req.body, fallbackReason) as any;
    
    // Merge precise telemetry into diagnostics
    finalized.diagnostics.llmAttemptsUsed = telemetry.llmAttemptsUsed || 1;
    finalized.diagnostics.jsonRepairAttemptsUsed = telemetry.jsonRepairAttemptsUsed || 0;
    finalized.diagnostics.repairPassesUsed = telemetry.repairPassesUsed || 0;
    finalized.diagnostics.invalidJsonReceived = telemetry.invalidJsonReceived || false;
    finalized.diagnostics.invalidJsonRecovered = telemetry.invalidJsonRecovered || false;
    finalized.diagnostics.lastLlmError = telemetry.lastLlmError || fallbackReason;
    finalized.diagnostics.validationPassed = false;
    finalized.diagnostics.validationErrors = [];
    finalized.diagnostics.missingPreservedFacts = [];
    finalized.diagnostics.technicalValuesPreserved = [];
    finalized.diagnostics.shallowRewriteDetected = false;
    finalized.diagnostics.similarityCheckPassed = false;
    finalized.diagnostics.summaryWordLimitPassed = true;

    if (safetyRefused) {
      finalized.techComReviewNotes.safetyItemsToConfirm.push(
        "CRITICAL REVIEW NOTE: Refused user custom directive request to bypass safety protocols. All safety checks and LOTO sections remain strictly required."
      );
    }
    
    finalized.grounding = groundingDiagnostics;
    finalized.diagnostics = finalized.diagnostics || {};
    finalized.diagnostics.instructionTrace = await getInstructionTrace();
    if (testPreset) finalized.testPreset = testPreset;
    
    if (jobId) delete generationStatus[jobId];
    return res.json(finalized);
  }
}

import { summaryInputNormalizer } from './src/server/summaryInputNormalizer';

// Global map for tracking generation status
export const generationStatus: Record<string, string> = {};

app.get('/api/fco/status', (req, res) => {
  const { id } = req.query;
  if (typeof id === 'string' && generationStatus[id]) {
    res.json({ message: generationStatus[id] });
  } else {
    res.json({ message: "Preparing Draft..." });
  }
});

function isDevKnowledgeEndpointEnabled() {
  const isDemoModeEnabled = process.env.ENABLE_KNOWLEDGE_DEMO_MODE === 'true';
  const isDevFlagEnabled = process.env.ENABLE_DEVELOPER_KNOWLEDGE_ENDPOINT === 'true';
  const isLocalDev = process.env.NODE_ENV !== 'production';
  return isDemoModeEnabled || isDevFlagEnabled || isLocalDev;
}

const devKnowledgeGuard = (req: any, res: any, next: any) => {
  if (!isDevKnowledgeEndpointEnabled()) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Developer Knowledge Endpoint is disabled in this environment.' 
    });
  }
  next();
};

app.get('/api/fco/instruction-packs/status', devKnowledgeGuard, async (req, res) => {
  try {
    const summaryPack = await loadInstructionPack("summary");
    const procedurePack = await loadInstructionPack("procedure");
    
    const compiledPromptPreview = buildFcoSystemPrompt(summaryPack, procedurePack);
    const summaryEvaluationPromptPreview = buildEvaluateSummaryPrompt(summaryPack);
    
    const docs = await getDocuments();
    const steDoc = docs.find((d: any) => d.type === 'STE_LANGUAGE_GUIDE');
    const isEnabled = !!steDoc;
    
    const steGuidanceStatus = {
      status: isEnabled ? 'available' : 'missing',
      documentName: steDoc ? steDoc.name : null,
      mode: "ste_only",
      purpose: "writing_guidance_only",
      runtimeRetrievalEnabled: isEnabled,
      indexed: steDoc ? (steDoc.status === 'indexed' || steDoc.status === 'indexed_clean' || steDoc.status === 'indexed_warning') : false,
      chunkCount: steDoc ? steDoc.chunkCount : 0,
      lastIndexedAt: steDoc ? steDoc.indexedAt : null
    };

    const activeRegistry = getActiveRegistry();

    res.json({
      summaryPack,
      procedurePack,
      compiledPromptPreview,
      summaryEvaluationPromptPreview,
      steGuidanceStatus,
      activeRegistry
    });
  } catch (err: any) {
    console.error("Failed to load instruction packs status:", err);
    res.status(500).json({ error: "Failed to load instruction packs status." });
  }
});

app.post('/api/fco/ste-guidance/upload', devKnowledgeGuard, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Missing content.' });
    
    const docs = getDocuments();
    const existing = docs.filter((d: any) => d.type === 'STE_LANGUAGE_GUIDE');
    for (const d of existing) deleteDocument(d.id);
    
    const name = req.body.name || 'STE_QRG_6861590_AC-Sep-2022 Online_6861590_01.pdf';
    const type = 'STE_LANGUAGE_GUIDE';
    const version = '1.0';

    const uploadsDir = path.join(process.cwd(), 'src', 'server', 'data', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const tempPath = path.join(uploadsDir, `ste_source.pdf`);

    let fileBuffer: Buffer;
    if (content.startsWith('data:') && content.includes(';base64,')) {
      fileBuffer = Buffer.from(content.split(';base64,')[1], 'base64');
    } else {
      fileBuffer = Buffer.from(content, 'utf-8');
    }
    fs.writeFileSync(tempPath, fileBuffer);

    const diag = await ingestSteDocument(tempPath, name, type, version);
    fs.unlinkSync(tempPath);
    return res.json({ success: true, diag });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/fco/ste-guidance', devKnowledgeGuard, async (req, res) => {
  try {
    const docs = getDocuments();
    const existing = docs.filter((d: any) => d.name && d.name.includes('STE_QRG_6861590'));
    for (const d of existing) deleteDocument(d.id);
    return res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fco/ste-guidance/reindex', devKnowledgeGuard, async (req, res) => {
  try {
    const docs = getDocuments();
    const existing = docs.find((d: any) => d.name && d.name.includes('STE_QRG_6861590'));
    if (!existing) return res.status(404).json({ error: 'STE Guidance Document not found.' });
    await reindexSteDocument(existing.id);
    return res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fco/instruction-packs/drafts', devKnowledgeGuard, async (req, res) => {
  try { res.json(await getDrafts()); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/fco/instruction-packs/drafts', devKnowledgeGuard, async (req, res) => {
  try { res.json(await saveDraft(req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/fco/instruction-packs/drafts/:id', devKnowledgeGuard, async (req, res) => {
  try { res.json(await saveDraft(req.body)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/fco/instruction-packs/drafts/:id', devKnowledgeGuard, async (req, res) => {
  try { await deleteDraft(req.params.id); res.json({ success: true }); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/fco/instruction-packs/active-registry', devKnowledgeGuard, async (req, res) => {
  try { res.json(getActiveRegistry()); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/fco/instruction-packs/activate', devKnowledgeGuard, async (req, res) => {
  try {
     const reg = getActiveRegistry();
     const { scope, draftId } = req.body;
     if (scope === 'summary') { reg.summary.activePackId = draftId; reg.summary.source = 'configured'; }
     else { reg.procedure.activePackId = draftId; reg.procedure.source = 'configured'; }
     saveActiveRegistry(reg);
     res.json(reg);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/fco/instruction-packs/rollback', devKnowledgeGuard, async (req, res) => {
  try {
     const reg = getActiveRegistry();
     const { scope } = req.body;
     if (scope === 'summary') { reg.summary.activePackId = 'summary-pack-default'; reg.summary.source = 'bundled_default'; }
     else { reg.procedure.activePackId = 'procedure-pack-default'; reg.procedure.source = 'bundled_default'; }
     saveActiveRegistry(reg);
     res.json(reg);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/fco/test/summary', devKnowledgeGuard, async (req, res) => {
   res.json({ mode: "summary", testedPack: { id: "test", name: "test", version: "1" } });
});

app.post('/api/fco/test/procedure', devKnowledgeGuard, async (req, res) => {
   res.json({ mode: "procedure", testedPack: { id: "test", name: "test", version: "1" } });
});

app.post('/api/fco/suggest-title', async (req, res) => {
  try {
    const { draftSummary, draftProcedure, baseProductCode, fcoNumber, affectedEquipmentModel, appliesTo, priority } = req.body;
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY not configured." });
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are an expert technical writer helping to generate a concise, professional title for a Field Change Order (FCO).
Use ONLY the provided information below. Do NOT invent or hallucinate FCO numbers, product codes, model names, locations, part numbers, safety data, or technical facts.
Provided Context:
Draft Summary: ${draftSummary || "Not provided"}
Draft Procedure: ${draftProcedure || "Not provided"}
Base Product Code: ${baseProductCode || "Not provided"}
FCO Number: ${fcoNumber || "Not provided"}
Affected Equipment Model: ${affectedEquipmentModel || "Not provided"}
Applies To: ${appliesTo || "Not provided"}
Priority: ${priority || "Not provided"}
Instructions:
- Return a JSON object with exactly one key "suggestions" which is an array of 1 to 3 string options.
- The title format should ideally be: [Base Product Code] FCO [FCO Number] [Change / Equipment / Scope].
- If key identifiers like Base Product Code or FCO Number are "Not provided", simply omit them from the title. Do NOT invent them.
- If there is not enough information to form a specific title, return a conservative title such as "Draft FCO for [affected equipment or scope]".
- Keep the title concise and professional.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { suggestions: { type: "ARRAY", items: { type: "STRING" } } }, required: ["suggestions"] },
        temperature: 0.2
      }
    });
    const text = response.text;
    res.json(JSON.parse(text));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/api/fco/evaluate-summary', async (req, res) => {
  try { res.json({ success: true, evaluated: true, diagnostics: { instructionTrace: [] } }); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Analyze the raw FCO Summary against the four PCSB components
// (Problem, Cause, Solution, Benefit) WITHOUT rewriting. Returns per-component
// confidence, which fields are missing/weak, and safe suggestions the user can
// review and accept before triggering the summary rewrite.
app.post('/api/fco/analyze-summary', async (req, res) => {
  try {
    const reqBody = req.body as (FCORequestData & { jobId?: string });
    const draft = reqBody.fcoDraft;
    const rawSummary =
      (draft?.technicalContent?.draftSummary ?? reqBody.rawSummary ?? '').toString();

    if (!rawSummary.trim()) {
      return res.status(400).json({ error: "Validation failed: raw FCO Summary is required." });
    }

    const summaryPack = await loadInstructionPack("summary");
    const promptTemplate = buildEvaluateSummaryPrompt(summaryPack);
    const cleanedRawSummary = cleanSummaryForPrompt(rawSummary);
    const userPrompt = promptTemplate.replace("{RAW_SUMMARY}", cleanedRawSummary);

    const telemetry = { llmAttemptsUsed: 0 };
    let rawText = "";
    try {
      rawText = await callGeminiRaw(userPrompt, telemetry);
    } catch (apiErr: any) {
      console.error("[analyze-summary] Gemini API Error:", apiErr);
      return res.status(502).json({ error: "AI analysis is temporarily unavailable. Please try again." });
    }

    let parsed: any;
    try {
      parsed = tryExtractJson(rawText);
    } catch (parseErr) {
      return res.status(502).json({ error: "Could not parse the analysis result. Please try again." });
    }

    const pcsb = parsed.pcsb || {};
    const confidence = parsed.confidence || {};
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    return res.json({
      pcsb: {
        problem: pcsb.problem ?? null,
        cause: pcsb.cause ?? null,
        solution: pcsb.solution ?? null,
        benefit: pcsb.benefit ?? null
      },
      sourceEvidence: parsed.sourceEvidence || {},
      missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : [],
      weakFields: Array.isArray(parsed.weakFields) ? parsed.weakFields : [],
      confidence: {
        problem: confidence.problem ?? "missing",
        cause: confidence.cause ?? "missing",
        solution: confidence.solution ?? "missing",
        benefit: confidence.benefit ?? "missing"
      },
      requiresUserConfirmation: parsed.requiresUserConfirmation ?? true,
      suggestions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function processRewriteSummary(req: express.Request, res: express.Response) {
  const reqBody = req.body as (FCORequestData & { jobId?: string });
  reqBody.rewriteScope = 'summary';
  const draft = reqBody.fcoDraft;
  
  if (draft) {
    reqBody.title = draft.fcoMetadata?.fcoTitle ?? reqBody.title ?? '';
    reqBody.priority = draft.fcoMetadata?.priority ?? reqBody.priority ?? '';
    reqBody.customDirectives = draft.technicalContent?.optionalRewriteInstructions ?? reqBody.customDirectives ?? '';
    reqBody.rawSummary = draft.technicalContent?.draftSummary ?? reqBody.rawSummary ?? '';
  }

  const {
    title = '',
    priority = '',
    customDirectives = '',
    rawSummary = '',
    confirmedPCSB
  } = reqBody;

  if (!rawSummary.trim()) {
    return res.status(400).json({
      error: "Validation failed: raw FCO Summary is required."
    });
  }

  const telemetry = {
    llmAttemptsUsed: 0,
    jsonRepairAttemptsUsed: 0,
    repairPassesUsed: 0,
    invalidJsonReceived: false,
    invalidJsonRecovered: false,
    lastLlmError: null as string | null
  };

  try {
    const summaryPack = await loadInstructionPack("summary");
    const systemInstructionText = buildFcoSystemPrompt(summaryPack, null, 'summary');
    
    const cleanedRawSummary = cleanSummaryForPrompt(rawSummary);
    let userPrompt = `FCO Context:\\n`;
    userPrompt += `Title: ${title || "Untitled FCO"}\\n`;
    userPrompt += `Priority: ${priority}\\n`;
    if (customDirectives) userPrompt += `Custom Directives: ${customDirectives}\\n`;
    userPrompt += `Raw Summary:\\n${cleanedRawSummary}\\n\\n`;
    // Reviewer-confirmed PCSB components from the Analyze Summary popup — an
    // authoritative grounding for each component's wording, not a mandate to
    // discard everything else in the raw summary.
    if (confirmedPCSB && Object.keys(confirmedPCSB).length > 0) {
      userPrompt += `Confirmed PCSB (Reviewer-Confirmed Components):\\n`;
      userPrompt += `Problem: ${confirmedPCSB.problem || "Information required from submitter"}\\n`;
      userPrompt += `Cause: ${confirmedPCSB.cause || "Information required from submitter"}\\n`;
      userPrompt += `Solution: ${confirmedPCSB.solution || "Information required from submitter"}\\n`;
      userPrompt += `Benefit: ${confirmedPCSB.benefit || "Information required from submitter"}\\n\\n`;
    }
    userPrompt += `Return the rewritten FCO content as strict JSON using the required schema. Ensure it follows all instructions precisely.`;

    let rawText = "";
    try {
      rawText = await callGeminiRaw(userPrompt, telemetry, systemInstructionText);
    } catch (apiErr: any) {
      console.warn("Gemini call failed for summary route. Falling back to local heuristic.");
      const fallback = runLocalHeuristic(reqBody, "Gemini call failed");
      return res.json({
         rewriteScope: "summary",
         rewrittenSummary: fallback.rewrittenSummary,
         // Forward the heuristic diagnostics (engineUsed: 'local_fallback',
         // fallbackReason) so the client can flag that this draft was NOT
         // AI-generated — previously omitted, making a fallback invisible.
         diagnostics: fallback.diagnostics,
         whatWasEdited: fallback.whatWasEdited,
         techComReviewNotes: fallback.techComReviewNotes,
         validation: fallback.validation,
         placeholderWarnings: fallback.placeholderWarnings
      });
    }

    let parsedJson: any;
    try {
      parsedJson = tryExtractJson(rawText);
    } catch (parseErr) {
      console.warn("JSON Parse failed for summary route. Falling back to local heuristic.");
      const fallback = runLocalHeuristic(reqBody, "JSON Parse failed");
      return res.json({
         rewriteScope: "summary",
         rewrittenSummary: fallback.rewrittenSummary,
         // Forward the heuristic diagnostics (engineUsed: 'local_fallback',
         // fallbackReason) so the client can flag that this draft was NOT
         // AI-generated — previously omitted, making a fallback invisible.
         diagnostics: fallback.diagnostics,
         whatWasEdited: fallback.whatWasEdited,
         techComReviewNotes: fallback.techComReviewNotes,
         validation: fallback.validation,
         placeholderWarnings: fallback.placeholderWarnings
      });
    }

    const validationResult = validateDraft(parsedJson, reqBody, []);
    const finalized = validateAndRepairResponse(parsedJson, reqBody, "gemini", validationResult, 0, telemetry, []);
    
    return res.json(finalized);

  } catch(err: any) {
     console.error("Summary rewrite route error:", err);
     return res.status(500).json({ error: err.message || "Failed to rewrite summary" });
  }
}

async function processRewriteProcedure(req: express.Request, res: express.Response) {
  const reqBody = req.body as (FCORequestData & { jobId?: string, acceptedSummary?: string });
  reqBody.rewriteScope = 'procedure';
  const draft = reqBody.fcoDraft;
  
  if (draft) {
    reqBody.title = draft.fcoMetadata?.fcoTitle ?? reqBody.title ?? '';
    reqBody.customDirectives = draft.technicalContent?.optionalRewriteInstructions ?? reqBody.customDirectives ?? '';
    reqBody.rawProcedure = draft.technicalContent?.draftProcedure ?? reqBody.rawProcedure ?? '';
    // Deliberately NOT reading priority here — Priority must affect Summary
    // only and must never influence Procedure wording.
    reqBody.affectedEquipment = draft.fcoMetadata?.affectedEquipmentModel ?? reqBody.affectedEquipment ?? '';
    reqBody.appliesTo = draft.fcoMetadata?.appliesTo ?? reqBody.appliesTo ?? '';
  }

  const {
    title = '',
    customDirectives = '',
    rawProcedure = '',
    acceptedSummary = '',
    affectedEquipment = '',
    appliesTo = ''
  } = reqBody;

  if (!rawProcedure.trim()) {
    return res.status(400).json({
      error: "Validation failed: raw FCO Procedure is required."
    });
  }

  const telemetry = {
    llmAttemptsUsed: 0,
    jsonRepairAttemptsUsed: 0,
    repairPassesUsed: 0,
    invalidJsonReceived: false,
    invalidJsonRecovered: false,
    lastLlmError: null as string | null
  };

  try {
    const procedurePack = await loadInstructionPack("procedure");
    const systemInstructionText = buildFcoSystemPrompt(null, procedurePack, 'procedure');
    
    let userPrompt = `FCO Context:\\n`;
    userPrompt += `Title: ${title || "Untitled FCO"}\\n`;
    // Equipment/applicability context only — for resolving generic references
    // like "the unit" or "the pump" in the raw text. Do not invent additional
    // equipment identifiers beyond what appears in the raw procedure itself.
    if (affectedEquipment) userPrompt += `Affected Equipment / Model (context only): ${affectedEquipment}\\n`;
    if (appliesTo) userPrompt += `Applies To (context only): ${appliesTo}\\n`;
    if (customDirectives) userPrompt += `Custom Directives: ${customDirectives}\\n`;
    if (acceptedSummary) userPrompt += `Accepted Summary Context:\\n${acceptedSummary}\\n\\n`;

    // Engineer-declared parts are authoritative: the model must not invent
    // parts beyond this list, only enrich roles/relationships from the text.
    const declaredParts = draft?.technicalContent?.declaredParts;
    if (Array.isArray(declaredParts) && declaredParts.length > 0) {
      userPrompt += `Declared parts (authoritative list provided by the engineer — partsInvolved must contain exactly these, no additions or omissions):\\n`;
      declaredParts.forEach((p: any) => {
        if (p && p.name) {
          userPrompt += `- ${p.name}${p.identifier ? ` | PN: ${p.identifier}` : ''}${p.role ? ` | role: ${p.role}` : ''}\\n`;
        }
      });
      userPrompt += `\\n`;
    }

    userPrompt += `Raw Procedure:\\n${rawProcedure}\\n\\n`;
    userPrompt += `Return the rewritten FCO content as strict JSON using the required schema. Ensure it follows all instructions precisely.`;

    let rawText = "";
    try {
      rawText = await callGeminiRaw(userPrompt, telemetry, systemInstructionText);
    } catch (apiErr: any) {
      console.warn("Gemini call failed for procedure route. Falling back to local heuristic.");
      const fallback = runLocalHeuristic(reqBody, "Gemini call failed");
      return res.json({
         rewriteScope: "procedure",
         rewrittenProcedure: fallback.rewrittenProcedure,
         // Forward the heuristic diagnostics so the client can flag a non-AI
         // fallback draft (previously omitted).
         diagnostics: fallback.diagnostics,
         whatWasEdited: fallback.whatWasEdited,
         techComReviewNotes: fallback.techComReviewNotes,
         validation: fallback.validation,
         placeholderWarnings: fallback.placeholderWarnings
      });
    }

    let parsedJson: any;
    try {
      parsedJson = tryExtractJson(rawText);
    } catch (parseErr) {
      console.warn("JSON Parse failed for procedure route. Falling back to local heuristic.");
      const fallback = runLocalHeuristic(reqBody, "JSON Parse failed");
      return res.json({
         rewriteScope: "procedure",
         rewrittenProcedure: fallback.rewrittenProcedure,
         // Forward the heuristic diagnostics so the client can flag a non-AI
         // fallback draft (previously omitted).
         diagnostics: fallback.diagnostics,
         whatWasEdited: fallback.whatWasEdited,
         techComReviewNotes: fallback.techComReviewNotes,
         validation: fallback.validation,
         placeholderWarnings: fallback.placeholderWarnings
      });
    }

    const validationResult = validateDraft(parsedJson, reqBody, []);
    const finalized = validateAndRepairResponse(parsedJson, reqBody, "gemini", validationResult, 0, telemetry, []);
    
    return res.json(finalized);

  } catch(err: any) {
     console.error("Procedure rewrite route error:", err);
     return res.status(500).json({ error: err.message || "Failed to rewrite procedure" });
  }
}

app.post('/api/fco/rewrite-summary', processRewriteSummary);
app.post('/api/fco/rewrite-procedure', processRewriteProcedure);




app.post('/api/fco/rewrite', processRewrite);
app.post('/api/fco/rewrite-from-docx', processRewrite);

app.post('/api/fco/procedure-readiness', async (req, res) => {
  try {
    const { fcoDraft, rewrittenProcedure } = req.body;
    if (!rewrittenProcedure || !rewrittenProcedure.sections) {
      return res.status(400).json({ error: "Missing rewrittenProcedure in payload" });
    }
    const suggestions = await generateReadinessSuggestions(fcoDraft || {}, rewrittenProcedure);
    res.json({ suggestions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generates the final FCO Word document. Consumed by ExportPanel.
app.post('/api/fco/export-docx', async (req, res) => {
  try {
    const { fcoContext, rewrittenSummary, rewrittenProcedure, diagnostics, developerMode } = req.body;
    if (!rewrittenSummary || !rewrittenProcedure) {
      return res.status(400).json({ error: "Missing rewrittenSummary or rewrittenProcedure in payload." });
    }
    const buffer = await generateDocxExport(
      fcoContext || {},
      rewrittenSummary,
      rewrittenProcedure,
      diagnostics,
      Boolean(developerMode)
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="FCO_Draft.docx"');
    return res.send(buffer);
  } catch (err: any) {
    console.error("FCO export-docx route error:", err);
    return res.status(500).json({ error: err.message || "Failed to export DOCX" });
  }
});

// RESTful pack activation. The draft's own scope determines which slot in the
// active registry is updated, so the client only needs the draft id in the path.
app.post('/api/fco/instruction-packs/drafts/:id/activate', devKnowledgeGuard, async (req, res) => {
  try {
    const draftId = req.params.id;
    const draft = (await getDrafts()).find(d => d.id === draftId);
    if (!draft) {
      return res.status(404).json({ error: "Draft pack not found." });
    }
    const reg = getActiveRegistry();
    const slot = draft.scope === 'summary' ? reg.summary : reg.procedure;
    slot.activePackId = draftId;
    slot.source = 'configured';
    saveActiveRegistry(reg);
    return res.json(reg);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// RESTful rollback to the bundled default for a given scope.
app.post('/api/fco/instruction-packs/:scope/rollback', devKnowledgeGuard, async (req, res) => {
  try {
    const scope = req.params.scope;
    if (scope !== 'summary' && scope !== 'procedure') {
      return res.status(400).json({ error: "Scope must be 'summary' or 'procedure'." });
    }
    const reg = getActiveRegistry();
    if (scope === 'summary') {
      reg.summary.activePackId = 'summary-pack-default';
      reg.summary.source = 'bundled_default';
    } else {
      reg.procedure.activePackId = 'procedure-pack-default';
      reg.procedure.source = 'bundled_default';
    }
    saveActiveRegistry(reg);
    return res.json(reg);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

(async () => {

app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

if (process.env.NODE_ENV !== 'production') {

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}


app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]', err);
  if (req.path.startsWith('/api')) {
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  } else {
    next(err);
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Fail clearly (rather than an unhandled crash) if the port is taken.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[startup] Port ${PORT} is already in use. Free it or set PORT to another value.`);
  } else {
    console.error('[startup] Server failed to start:', err.message);
  }
  process.exit(1);
});

// Graceful shutdown: Cloud Run / AI Studio send SIGTERM before terminating the
// container; close the listener so in-flight requests can drain, with a 10s
// force-exit safety net.
const shutdown = (signal: string) => {
  console.log(`[shutdown] ${signal} received; closing server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
})();
