const fs = require('fs');
let code = fs.readFileSync('src/server/routes/techComRoutes.ts', 'utf8');

const readinessBlock = `    // Compute Readiness
    if (result.readiness.blockingIssues.length > 0) {
      result.readiness.status = "Blocked";
      result.readiness.summary = "Required fields are missing and should be completed before rewrite.";
    } else {
      let warningCount = result.readiness.warnings.length;
      if (result.analysis.summary?.warnings?.length > 0) warningCount += result.analysis.summary.warnings.length;
      if (result.analysis.action?.warnings?.length > 0) warningCount += result.analysis.action.warnings.length;
      
      const missingCount = (result.analysis.metadata?.missingFields?.length || 0) + (result.analysis.summary?.missingFields?.length || 0);

      if (missingCount > 0 || warningCount >= 3) {
        result.readiness.status = "Needs major fixes";
        result.readiness.summary = "The draft needs more information before rewrite, especially affected scope or action details.";
      } else if (warningCount > 0 || result.suggestedRewriteFocus?.length > 0) {
        result.readiness.status = "Needs minor fixes";
        result.readiness.summary = "The draft is usable, but the rewrite should clarify action wording and affected scope.";
      } else {
        result.readiness.status = "Ready to rewrite";
        result.readiness.summary = "The draft contains enough information to proceed to rewrite.";
      }
    }`;

// Replace readinessBlock in /rewrite and /suggest-title with just empty string.
const rewriteIndex = code.indexOf("techComRoutes.post('/rewrite'");
const suggestIndex = code.indexOf("techComRoutes.post('/suggest-title'");

if (rewriteIndex !== -1) {
  const suggestBlockStart = suggestIndex !== -1 ? suggestIndex : code.length;
  let part1 = code.substring(0, rewriteIndex);
  let part2 = code.substring(rewriteIndex, suggestBlockStart).replace(readinessBlock, '');
  let part3 = code.substring(suggestBlockStart).replace(readinessBlock, '');
  code = part1 + part2 + part3;
}

fs.writeFileSync('src/server/routes/techComRoutes.ts', code);
