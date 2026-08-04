const fs = require('fs');
const file = 'src/server/validationService.ts';
let content = fs.readFileSync(file, 'utf8');

const target1 = `  const res: any = parsed ? JSON.parse(JSON.stringify(parsed)) : {};`;
const replace1 = `  const res: any = parsed ? JSON.parse(JSON.stringify(parsed)) : {};
  const scope = reqData.rewriteScope || 'full';`;

content = content.replace(target1, replace1);

const targetSummarySetup = `  // Ensure rewrittenSummary exists and is normalized
  let summary = res.rewrittenSummary;
  
  if (typeof summary === 'string') {`;

const replaceSummarySetup = `  // Ensure rewrittenSummary exists and is normalized
  let summary = res.rewrittenSummary;
  if (scope === 'full' || scope === 'summary') {
  if (typeof summary === 'string') {`;

content = content.replace(targetSummarySetup, replaceSummarySetup);

const targetSummaryEnd = `  // Ensure rewrittenProcedure exists`;
const replaceSummaryEnd = `  } // end if scope summary
  else {
      // create a dummy summary
      res.rewrittenSummary = {
          paragraph: reqData.rawSummary || "No summary provided.",
          components: { problem: "", cause: "", solution: "", benefit: "" },
          wordCount: 0
      };
      summary = res.rewrittenSummary;
  }
  // Ensure rewrittenProcedure exists`;

content = content.replace(targetSummaryEnd, replaceSummaryEnd);

const targetProcedureSetup = `  // Ensure rewrittenProcedure exists
  if (!res.rewrittenProcedure || typeof res.rewrittenProcedure !== 'object') {
    res.rewrittenProcedure = {};
  }`;

const replaceProcedureSetup = `  // Ensure rewrittenProcedure exists
  if (!res.rewrittenProcedure || typeof res.rewrittenProcedure !== 'object') {
    res.rewrittenProcedure = {};
  }
  if (scope === 'full' || scope === 'procedure') {`;

content = content.replace(targetProcedureSetup, replaceProcedureSetup);

const targetProcedureEnd = `  // Ensure whatWasEdited exists`;
const replaceProcedureEnd = `  } // end if scope procedure
  else {
     // create dummy procedure
     res.rewrittenProcedure = {
        changeType: reqData.changeType || 'Mixed Change',
        sections: []
     };
  }
  // Ensure whatWasEdited exists`;

content = content.replace(targetProcedureEnd, replaceProcedureEnd);

fs.writeFileSync(file, content);
