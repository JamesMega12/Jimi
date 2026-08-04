const fs = require('fs');
const file = 'src/server/validationService.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `export function validateDraft(
  parsed: any,
  reqData: FCORequestData,
  retrievedChunks: any[] = []
): {`;

const replaceWith = `export function validateDraft(
  parsed: any,
  reqData: FCORequestData,
  retrievedChunks: any[] = []
): {`;

const targetBody = `  const summary = parsed.rewrittenSummary;
  const procedure = parsed.rewrittenProcedure;

  if (!summary || typeof summary !== 'object') {
    errors.push("Missing required field 'rewrittenSummary' or it is not an object.");
  } else {
    const problem = summary.components?.problem || summary.problem;
    const solution = summary.components?.solution || summary.solution;
    
    if (!problem || problem.includes('[Information required')) errors.push("Summary is missing the required 'Problem' component.");
    if (!solution || solution.includes('[Information required')) errors.push("Summary is missing the required 'Solution' component.");
  }

  const finalChangeType = parsed.rewrittenProcedure?.changeType || reqData.changeType || "Mixed Change";

  if (!procedure || typeof procedure !== 'object') {
    errors.push("Missing required field 'rewrittenProcedure' or it is not an object.");
  } else {
    if (!procedure.sections || !Array.isArray(procedure.sections) || procedure.sections.length === 0) {
      errors.push("Procedure must contain at least one valid subsection.");
    }
  }`;

const replaceBody = `  const summary = parsed.rewrittenSummary;
  const procedure = parsed.rewrittenProcedure;
  const scope = reqData.rewriteScope || 'full';

  if (scope === 'full' || scope === 'summary') {
    if (!summary || typeof summary !== 'object') {
      errors.push("Missing required field 'rewrittenSummary' or it is not an object.");
    } else {
      const problem = summary.components?.problem || summary.problem;
      const solution = summary.components?.solution || summary.solution;
      
      if (!problem || problem.includes('[Information required')) errors.push("Summary is missing the required 'Problem' component.");
      if (!solution || solution.includes('[Information required')) errors.push("Summary is missing the required 'Solution' component.");
    }
  }

  const finalChangeType = parsed.rewrittenProcedure?.changeType || reqData.changeType || "Mixed Change";

  if (scope === 'full' || scope === 'procedure') {
    if (!procedure || typeof procedure !== 'object') {
      errors.push("Missing required field 'rewrittenProcedure' or it is not an object.");
    } else {
      if (!procedure.sections || !Array.isArray(procedure.sections) || procedure.sections.length === 0) {
        errors.push("Procedure must contain at least one valid subsection.");
      }
    }
  }`;

content = content.replace(targetBody, replaceBody);
fs.writeFileSync(file, content);
