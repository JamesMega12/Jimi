const fs = require('fs');
const file = 'src/types.ts';
let content = fs.readFileSync(file, 'utf8');

const newTypes = `
export interface FcoSummaryRewriteResponse {
  rewriteScope: "summary";
  rewrittenSummary: FCOSummary;
  whatWasEdited: Omit<WhatWasEdited, "procedureWordingEdits" | "changeTypeIdentified">;
  techComReviewNotes: Omit<TechComReviewNotes, "toolsMaterialsToConfirm" | "changeTypeConfirmation">;
  validation?: FCOValidation;
  placeholderWarnings?: string[];
}

export interface FcoProcedureRewriteResponse {
  rewriteScope: "procedure";
  rewrittenProcedure: FCOProcedure;
  whatWasEdited: Omit<WhatWasEdited, "summaryWordingEdits">;
  techComReviewNotes: Omit<TechComReviewNotes, "missingInformation">;
  validation?: FCOValidation;
  placeholderWarnings?: string[];
}
`;

content = content + newTypes;
fs.writeFileSync(file, content);
