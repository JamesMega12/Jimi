import sys

with open('server.ts', 'r') as f:
    lines = f.readlines()

insert_idx = -1
for i, line in enumerate(lines):
    if "app.post('/api/fco/rewrite', processRewrite);" in line:
        insert_idx = i
        break

if insert_idx == -1:
    print("Could not find insert marker")
    sys.exit(1)

new_routes = """
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
    rawSummary = ''
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
         whatWasEdited: fallback.whatWasEdited,
         techComReviewNotes: fallback.techComReviewNotes,
         validation: fallback.validation,
         placeholderWarnings: fallback.placeholderWarnings
      });
    }

    const validationResult = validateDraft(parsedJson, reqBody, []);
    const finalized = validateAndRepairResponse(parsedJson, reqBody, "gemini", validationResult, 0, telemetry, []);
    
    return res.json({
      rewriteScope: "summary",
      rewrittenSummary: finalized.rewrittenSummary,
      whatWasEdited: finalized.whatWasEdited,
      techComReviewNotes: finalized.techComReviewNotes,
      validation: finalized.validation,
      placeholderWarnings: finalized.placeholderWarnings
    });

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
  }

  const {
    title = '',
    customDirectives = '',
    rawProcedure = '',
    acceptedSummary = ''
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
    if (customDirectives) userPrompt += `Custom Directives: ${customDirectives}\\n`;
    if (acceptedSummary) userPrompt += `Accepted Summary Context:\\n${acceptedSummary}\\n\\n`;
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
         whatWasEdited: fallback.whatWasEdited,
         techComReviewNotes: fallback.techComReviewNotes,
         validation: fallback.validation,
         placeholderWarnings: fallback.placeholderWarnings
      });
    }

    const validationResult = validateDraft(parsedJson, reqBody, []);
    const finalized = validateAndRepairResponse(parsedJson, reqBody, "gemini", validationResult, 0, telemetry, []);
    
    return res.json({
      rewriteScope: "procedure",
      rewrittenProcedure: finalized.rewrittenProcedure,
      whatWasEdited: finalized.whatWasEdited,
      techComReviewNotes: finalized.techComReviewNotes,
      validation: finalized.validation,
      placeholderWarnings: finalized.placeholderWarnings
    });

  } catch(err: any) {
     console.error("Procedure rewrite route error:", err);
     return res.status(500).json({ error: err.message || "Failed to rewrite procedure" });
  }
}

app.post('/api/fco/rewrite-summary', processRewriteSummary);
app.post('/api/fco/rewrite-procedure', processRewriteProcedure);
"""

lines.insert(insert_idx, new_routes)

with open('server.ts', 'w') as f:
    f.writelines(lines)

