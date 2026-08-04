import { TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE } from './sharedSafetyPreamble';

// Section-specific prompts for Reasons. Real Technical Alerts use two genuinely
// different shapes for this section (see plan §9a): prose reasoning
// (technicalBasis/complianceBasis/consequence/causeStatus), and/or a
// component/concern/evidence table (WCF TA 2025-20's actual structure, where
// the "reasons" ARE the evidence table -- there is no separate prose section
// at all). Both may be populated; both may be absent for a given source.
//
// Analyze and rewrite are separate prompts (2026-07-23 revision, same
// rationale as Summary -- see summaryPrompt.ts).
export const REASONS_ANALYZE_PROMPT = `${TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE}

TASK: REASONS EXTRACTION

The source may describe why the alert is being issued as prose reasoning, as a
list of specific component/concern/evidence observations, or both. Extract
whichever is actually present -- do not force one shape if the source clearly
uses the other, and do not invent the missing shape.

If the source contains prose reasoning, extract a "narrative" object:
- technicalBasis (optional): the technical mechanism or explanation, if stated.
- complianceBasis (optional): a standards/compliance rationale, if stated.
- consequence (optional): what happens if the concern is not addressed, if stated.
- causeStatus (REQUIRED whenever narrative is present): exactly one of "confirmed" | "preliminary" | "suspected" | "unknown".
  - Use "confirmed" ONLY if the source explicitly states the cause is confirmed/established/verified.
  - Use "preliminary" or "suspected" if the source uses hedging language (suspected, believed, appears, may be, possibly).
  - Use "unknown" if the source does not state a cause or explicitly says the cause is not yet determined.
  - NEVER default to "confirmed". When genuinely unsure, use "unknown" -- do not upgrade uncertainty into certainty.
- references (optional array): standard/document identifiers cited.

If the source contains specific component-level observations (e.g. "Reamer
Shoe: nose detached during operation, see attached photo"), extract each as a
separate "evidenceItems" entry:
- component: the specific item/part/product described.
- concern: the specific issue/observation about it.
- evidence (optional): supporting detail, test result, or field report reference, if stated.
Do not invent a component or concern not present in the source.

OUTPUT SCHEMA
Return JSON: { "narrative": {...} | null, "evidenceItems": [...] | null }
Return null for whichever shape the source does not use -- do not return an
empty placeholder object for a shape that has no real content.
`;

// Rewrite: for the narrative half only (evidenceItems is polished in place,
// wording only, no restructuring -- it's already a table, not prose, and the
// brief's own guidance is not to force it into paragraph form). If the
// reviewed narrative is null, the rewrite MUST NOT invent one -- the calling
// route additionally enforces this deterministically, not just via prompt
// instruction (see technicalAlertRoutesV2.ts).
export const REASONS_REWRITE_PROMPT = `${TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE}

TASK: REASONS REWRITE (SYNTHESIS, NOT EXTRACTION)

You will be given Reviewed Fields: a "narrative" object (or null) and an
"evidenceItems" array (or null), already reviewed by a human, plus the
Original Raw Source for context only.

IF "narrative" IS NOT NULL:
STEP 1 -- WRITE THE PARAGRAPH
Write "narrative.renderedText": one or more cohesive paragraphs synthesizing
ONLY the non-null fields of the reviewed narrative (technicalBasis,
complianceBasis, consequence) at the certainty level given by causeStatus. A
field given as null was reviewed and confirmed absent -- do not fill it in
from Original Raw Source or general reasoning. Preserve causeStatus's meaning
in the prose exactly: if causeStatus is "suspected" or "preliminary", the
paragraph must not assert the cause as confirmed or certain.

STEP 2 -- BREAK IT BACK DOWN
Re-derive technicalBasis, complianceBasis, consequence, and causeStatus from
the paragraph you just wrote, using the same rules as analysis. Do not
silently upgrade causeStatus toward "confirmed" -- if the user has not
explicitly changed it, it must match the reviewed value exactly.

IF "narrative" IS NULL: return "narrative": null. Do not invent a narrative
that was not in Reviewed Fields, even if Original Raw Source contains
prose-like text -- the human reviewer already determined this alert's reasons
are evidence-table-shaped, not narrative-shaped.

IF "evidenceItems" IS PRESENT: return the same items, wording polished only
(no restructuring, no merging, no invented items, no invented component or
concern not present in Reviewed Fields or Original Raw Source).

SIMPLIFIED TECHNICAL ENGLISH (apply to renderedText)
- Rule 6.1: give information gradually. Rule 6.3: sentences no longer than 25
  words. Rule 6.5: one topic per paragraph. Rule 6.6: no more than 6 sentences
  per paragraph.
- Rule 5.5: this is explanatory, not instructional -- write it as
  information, never as a command, even when it explains why a mandatory
  action is necessary.
- Rule 9.4: consistent terminology for the same equipment/product throughout.
- Rule 4.2: no contractions.

OUTPUT SCHEMA
Return JSON: { "narrative": { "renderedText", "technicalBasis"?, "complianceBasis"?, "consequence"?, "causeStatus", "references"? } | null, "evidenceItems": [...] | null }
`;
