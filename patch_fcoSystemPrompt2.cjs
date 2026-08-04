const fs = require('fs');
const file = 'src/server/fcoSystemPrompt.ts';
let content = fs.readFileSync(file, 'utf8');

const splitIndex = content.indexOf('TASK');
if (splitIndex === -1) {
    console.error("Could not find TASK block in fcoSystemPrompt.ts");
    process.exit(1);
}

// Ensure the signature is correct
content = content.replace(
  `export function buildFcoSystemPrompt(summaryPack: InstructionPack, procedurePack: InstructionPack): string {`,
  `export function buildFcoSystemPrompt(summaryPack: InstructionPack | null, procedurePack: InstructionPack | null, rewriteScope: "summary" | "procedure" | "full" = "full"): string {`
);

// We need to fetch the split again because we replaced the string above
const splitIndex2 = content.indexOf('TASK');
const baseContent = content.substring(0, splitIndex2);

const dynamicContent = `
  let taskDesc = "rewrite only the Summary and Procedure";
  if (rewriteScope === 'summary') taskDesc = "rewrite only the Summary";
  if (rewriteScope === 'procedure') taskDesc = "rewrite only the Procedure";

  let packContent = "";
  if (rewriteScope === 'summary' && summaryPack) packContent = summaryPack.content;
  else if (rewriteScope === 'procedure' && procedurePack) packContent = procedurePack.content;
  else {
    packContent = (summaryPack ? summaryPack.content : "") + "\\n" + (procedurePack ? procedurePack.content : "");
  }

  let jsonFormat = "";
  if (rewriteScope === 'summary') {
    jsonFormat = \`{
  "rewrittenSummary": {
    "paragraph": "string (the final one-paragraph natural summary)",
    "components": {
      "problem": "string",
      "cause": "string",
      "solution": "string",
      "benefit": "string",
      "references": ["string"]
    },
    "wordCount": number,
    "withinWordLimit": boolean
  }
}\`;
  } else if (rewriteScope === 'procedure') {
    jsonFormat = \`{
  "rewrittenProcedure": {
    "changeType": "Physical / Hardware Change | Software / Configuration Change | Policy / Process Change",
    "toolsMaterialsRequired": {
      "confirmedFromInput": ["string"],
      "suggestedToConfirm": ["string"]
    },
    "sections": [
      {
        "title": "A. Safety",
        "steps": ["string"]
      }
    ]
  }
}\`;
  } else {
    jsonFormat = \`{
  "rewrittenSummary": {
    "paragraph": "string",
    "components": {
      "problem": "string",
      "cause": "string",
      "solution": "string",
      "benefit": "string",
      "references": ["string"]
    },
    "wordCount": number,
    "withinWordLimit": boolean
  },
  "rewrittenProcedure": {
    "changeType": "string",
    "toolsMaterialsRequired": {
      "confirmedFromInput": ["string"],
      "suggestedToConfirm": ["string"]
    },
    "sections": [
      {
        "title": "string",
        "steps": ["string"]
      }
    ]
  },
  "whatWasEdited": {
    "changeTypeIdentified": "string",
    "summaryWordingEdits": [
      {
        "original": "string",
        "rewritten": "string"
      }
    ],
    "procedureWordingEdits": [
      {
        "original": "string",
        "rewritten": "string"
      }
    ],
    "structuralEdits": ["string"],
    "preservedTechnicalInformation": ["string"]
  },
  "techComReviewNotes": {
    "missingInformation": ["string"],
    "safetyItemsToConfirm": ["string"],
    "referencesToConfirm": ["string"],
    "technicalItemsToConfirm": ["string"],
    "toolsMaterialsToConfirm": ["string"],
    "changeTypeConfirmation": ["string"],
    "directiveConfirmation": ["string"]
  }
}\`;
  }

  return \`\${baseContent.replace(/\`$/, '')}\${packContent}

TASK
When the user provides raw FCO content, \${taskDesc}.
Always return valid JSON using the required schema.

MISSING INFORMATION RULE
Do not hallucinate missing technical information. If details are missing, use [Information required from submitter] inside the rewritten content, OR list the missing item under TechCom Review Notes.

JSON OUTPUT FORMAT
You must respond with valid JSON that matches this exact typescript interface structure:
\${jsonFormat}

Do not wrap JSON in Markdown tick marks block like \\\\\`\\\\\`\\\\\`json. Return only raw JSON.\`;
}
`;

content = baseContent.substring(0, baseContent.lastIndexOf('return `')) + dynamicContent;
fs.writeFileSync(file, content);
