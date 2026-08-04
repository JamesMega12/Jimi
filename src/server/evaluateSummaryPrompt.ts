import { InstructionPack } from './instructionPacks/types';

export function buildEvaluateSummaryPrompt(summaryPack: InstructionPack): string {
  return `
You are a technical document analyzer for Field Change Orders (FCOs). 
First, normalize the input by ignoring any of these prefix labels: "Summary:", "Purpose/Scope:", "Background:", "Problem:", "Cause:", "Solution:", "Benefit:", "Impact/Risk:", "Corrective Action:", etc. Also, ignore bullet points or numbering. 
Convert any bullet lists into natural phrases (e.g. "x, y, and z").

EXTRACT the following internal structure (PCSB) based on the instructions below.
(Note: The following instruction pack contains rules for both extraction and rewriting. For this task, ONLY perform the extraction (PCSB) and suggestion generation. Ignore the final summary rewrite instructions.)

${summaryPack.content}

RULES FOR EXTRACTION:
- Do not invent technical facts, causes, or benefits for the 'pcsb' extracted fields.
- If a component is not present or unclear, return null in 'pcsb'.
- Extract short source evidence traceable to the original input.
- IMPORTANT FOR SUGGESTIONS: If a field (like cause or benefit) is missing or weak, you MUST generate a plausible, safe generic placeholder suggestion in the 'suggestions' array. Do not leave the suggestion blank. The user will be able to review and edit this suggestion.

CONFIDENCE & COMPLETENESS:
- Determine if fields are missing or weak.
- Missing: No usable component found.
- Weak: Exists but vague, incomplete, generic, or not operationally useful.
- "problem" and "solution" are critical.
- "cause" and "benefit" are non-critical but important.

LEGAL AND POLITICAL SAFETY:
Neutralize any language that assigns fault or blame (e.g. "defective due to supplier fault"). Use factual descriptions.

Input:
{RAW_SUMMARY}

Return a valid JSON object matching this schema exactly:
{
  "pcsb": {
    "problem": "string | null",
    "cause": "string | null",
    "solution": "string | null",
    "benefit": "string | null"
  },
  "sourceEvidence": {
    "problem": "string | null",
    "cause": "string | null",
    "solution": "string | null",
    "benefit": "string | null"
  },
  "missingFields": ["string"],
  "weakFields": ["string"],
  "confidence": {
    "problem": "high" | "medium" | "low" | "missing",
    "cause": "high" | "medium" | "low" | "missing",
    "solution": "high" | "medium" | "low" | "missing",
    "benefit": "high" | "medium" | "low" | "missing"
  },
  "requiresUserConfirmation": boolean,
  "suggestions": [
    {
      "field": "problem" | "cause" | "solution" | "benefit",
      "status": "missing" | "weak",
      "suggestedText": "string",
      "reason": "string",
      "suggestionType": "generic_safe_placeholder" | "factual"
    }
  ]
}
`;


}
