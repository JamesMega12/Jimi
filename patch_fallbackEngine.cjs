const fs = require('fs');
const file = 'src/server/fallbackEngine.ts';
let content = fs.readFileSync(file, 'utf8');

const target1 = `export function runLocalHeuristic(reqData: FCORequestData, fallbackReason: string): FCOApiResponse {
  const detectedType = detectChangeType(reqData.title, reqData.rawSummary, reqData.rawProcedure, reqData.changeType);`;

const replace1 = `export function runLocalHeuristic(reqData: FCORequestData, fallbackReason: string): FCOApiResponse {
  const detectedType = detectChangeType(reqData.title, reqData.rawSummary, reqData.rawProcedure, reqData.changeType);
  const scope = reqData.rewriteScope || 'full';`;

content = content.replace(target1, replace1);

const targetSummary = `  // Summary processing
  const summaryParts = processHeuristicSummary(reqData.rawSummary);`;

const replaceSummary = `  // Summary processing
  let summaryParts = { action: '', cause: '', benefit: '' };
  if (scope === 'full' || scope === 'summary') {
    summaryParts = processHeuristicSummary(reqData.rawSummary);
  }`;

content = content.replace(targetSummary, replaceSummary);

const targetProcedure = `  // Procedure processing
  const proceduralSections = processHeuristicProcedure(reqData.rawProcedure, detectedType);`;

const replaceProcedure = `  // Procedure processing
  let proceduralSections: any[] = [];
  if (scope === 'full' || scope === 'procedure') {
    proceduralSections = processHeuristicProcedure(reqData.rawProcedure, detectedType);
  }`;

content = content.replace(targetProcedure, replaceProcedure);

fs.writeFileSync(file, content);
