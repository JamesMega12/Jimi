const fs = require('fs');
const file = 'src/server/validationService.ts';
let content = fs.readFileSync(file, 'utf8');

const target1 = `export function validateAndRepairResponse(
  parsed: any,
  reqData: FCORequestData,
  engineType: "gemini" | "local_heuristic",
  forceValidationResult?: ReturnType<typeof validateDraft>,
  repairPasses = 0,
  telemetry?: any,
  retrievedChunks: any[] = []
): FCOApiResponse {
  // Deep copy response
  const res: any = parsed ? JSON.parse(JSON.stringify(parsed)) : {};`;

const replace1 = `export function validateAndRepairResponse(
  parsed: any,
  reqData: FCORequestData,
  engineType: "gemini" | "local_heuristic",
  forceValidationResult?: ReturnType<typeof validateDraft>,
  repairPasses = 0,
  telemetry?: any,
  retrievedChunks: any[] = []
): FCOApiResponse {
  // Deep copy response
  const res: any = parsed ? JSON.parse(JSON.stringify(parsed)) : {};
  const scope = reqData.rewriteScope || 'full';`;

content = content.replace(target1, replace1);

const targetSummarySetup = `  // Ensure rewrittenSummary exists and is normalized
  let summary = res.rewrittenSummary;`;

const replaceSummarySetup = `  // Ensure rewrittenSummary exists and is normalized
  if (scope === 'full' || scope === 'summary') {
  let summary = res.rewrittenSummary;`;

// wait, if I put it in an `if` block, variables will go out of scope. I will manually modify it by parsing strings.
