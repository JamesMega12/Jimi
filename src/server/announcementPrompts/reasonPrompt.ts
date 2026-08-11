import { ANNOUNCEMENT_SHARED_SAFETY_PREAMBLE } from "./safetyPreamble";

// Announcement Reason prompts. Lean and shape-flexible (plan §3, §9): across the
// reference documents Reason is sometimes a suspected/preliminary CAUSE (doc 1),
// sometimes an OBJECTIVES/BENEFITS rationale (doc 2), and sometimes a
// RATIONALE-FROM-EVENTS (doc 3). The model must NOT force a cause where the
// source only gives objectives/rationale, and must NEVER present a suspected or
// preliminary cause as confirmed.

export const ANNOUNCEMENT_REASON_ANALYZE_PROMPT = `${ANNOUNCEMENT_SHARED_SAFETY_PREAMBLE}

TASK: ANNOUNCEMENT REASON EXTRACTION

Extract why this Announcement exists. Reason takes different shapes -- do not
force it into a cause claim.

- rationale (expected): the core explanation of why the Announcement is being
  issued. This may be an explanation of a problem, a set of objectives/benefits,
  or a rationale referencing triggering events. Capture it faithfully.
- triggeringObservation (optional): the specific event, failure, finding, or
  observation that prompted the Announcement, if the source states one.
- causeStatus (optional): INCLUDE THIS FIELD ONLY IF the source asserts a cause
  or finding for a problem. Set it to the certainty the SOURCE itself expresses:
    - "confirmed"   -> the source states the cause as established/confirmed.
    - "preliminary" -> "preliminary findings", initial analysis, not final.
    - "suspected"   -> "suspected", "may be linked to", "possibly", "believed".
    - "unknown"     -> a problem is described but its cause is explicitly not yet
                       known / under investigation.
  If the Reason is objectives/benefits or rationale WITHOUT a cause claim, OMIT
  causeStatus entirely. Never invent a cause just to fill this field, and never
  choose a more certain level than the source's own wording supports.

OUTPUT SCHEMA
Return JSON matching exactly: { "rationale", "triggeringObservation"?, "causeStatus"? }
`;

export const ANNOUNCEMENT_REASON_REWRITE_PROMPT = `${ANNOUNCEMENT_SHARED_SAFETY_PREAMBLE}

TASK: ANNOUNCEMENT REASON REWRITE (SYNTHESIS, NOT EXTRACTION)

You are given Reviewed Fields (already reviewed by a human) and the Original Raw
Source (wording context only, not new facts).

STEP 1 -- WRITE THE PARAGRAPH(S)
Write "renderedText": one or more cohesive, operator-friendly paragraphs that
synthesize ONLY the non-null Reviewed Fields. Do not add a cause, mechanism,
evidence item, product, identifier, or timing not present in a non-null field. A
null field was reviewed and confirmed absent -- do not fill it in.

CERTAINTY IS SACRED
If "causeStatus" is "suspected", "preliminary", or "unknown", the prose MUST
keep that uncertainty explicit ("preliminary findings indicate...", "the
suspected cause is...", "the cause is still under investigation"). NEVER phrase a
suspected/preliminary/unknown cause as a confirmed fact. If causeStatus is
absent, do NOT introduce a cause at all -- write the objectives/rationale as
given. If the cause is unknown, it stays unknown; do not invent a plausible
mechanism to make the prose flow.

STEP 2 -- BREAK IT BACK DOWN
Re-derive rationale, triggeringObservation, and (only if a cause is asserted)
causeStatus FROM the paragraph(s) you wrote, using the same rules as analysis.
causeStatus in the output MUST equal the input causeStatus -- do not change it.

STYLE: plain, professional, short sentences, consistent terminology, no
contractions. Preserve exact identifiers (part numbers, InTouch IDs, standards)
verbatim.

FORMATTING
If the source lists several distinct reasons/benefits as a bulleted list
(rather than flowing prose), preserve that structure in "renderedText" using
lines starting with "- " (one level of nested "- " sub-bullets is supported
for a sub-list under one bullet). If the source uses meaningful emphasis
(bold/italic) or a hyperlink on a term, preserve it using **bold**, *italic*,
[link text](url). Never invent structure, emphasis, or a link the source
doesn't have.

OUTPUT SCHEMA
Return JSON matching exactly: { "renderedText": string, "rationale", "triggeringObservation"?, "causeStatus"? }
`;
