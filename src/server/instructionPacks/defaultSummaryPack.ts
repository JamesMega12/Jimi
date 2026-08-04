import { InstructionPack } from './types';

export const defaultSummaryPack: InstructionPack = {
  id: "summary-pack-default",
  name: "Summary Instruction Pack (Default)",
  scope: "summary",
  version: "1.0.0",
  status: "bundled_default",
  isSystemDefault: true,
  locked: false,
  description: "Default instructions for FCO Summary generation.",
  content: `
SUMMARY PCSB ANALYSIS:
Problem: The operational issue, risk, nonconformance, performance gap, or condition that needs action.
Cause: The stated or implied reason for the issue. Do NOT invent a cause based on assumptions.
Solution: The change, implementation, replacement, installation, update, inspection, or field action to be adopted.
Benefit: The expected operational, safety, reliability, quality, compliance, or risk-reduction value.

Missing information suggestions:
- For each missing or weak component, generate a conservative suggestion.
- No hallucinated facts, no blame, no speculation, no definitive liability language.
- Use neutral operational wording. Use only facts from input where possible.
- If insufficient facts exist, use a placeholder: "[Information required from submitter]"

SECTION 1: REWRITTEN FCO SUMMARY

Write the final rewritten FCO Summary as one concise, natural paragraph.
Do not use bullet points or numbering in the summary.
Maximum word limit: 150 words.

If "Confirmed PCSB" data (Problem, Cause, Solution, Benefit) is provided in the input context, you MUST use that information directly to form the summary paragraph.
Do not output "Problem:", "Cause:", "Solution:", or "Benefit:" labels in the final text. Connect the ideas naturally into a single cohesive paragraph.
You MUST begin the summary paragraph with one of the following priority prefixes, depending on the priority given in the input context:
- For Urgent priority: "This urgent Field Change Order (FCO) requires immediate field execution to"
- For Required priority: "This required Field Change Order (FCO) requires field execution to"
- For Preferred priority: "This preferred Field Change Order (FCO) proposes field implementation to"

Example: "This required Field Change Order (FCO) requires field execution to address [Problem] caused by [Cause]. Field teams must [Solution] in order to [Benefit]."

Rules for the summary paragraph:
- Keep the wording simple, concise, and field-friendly.
- Focus on execution and field impact.
- Do not include long incident storytelling.
- Do not include unnecessary engineering theory.
- If any critical component is missing and you cannot resolve it from the input, explicitly state the missing information needs review.
- Maintain a professional and neutral tone.
- Use legally cautious wording: avoid blame, speculation, or admissions of liability.
- Preserve all technical facts exactly.
- Do not invent references or technical values.
`
};
