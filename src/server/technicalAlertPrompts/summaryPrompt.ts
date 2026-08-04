import { TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE } from './sharedSafetyPreamble';

// Section-specific prompts for Summary. Real Technical Alerts vary: some state
// a central requirement/prohibition/revocation directly in the summary
// (WCF TA 2026-10), others are purely descriptive with the actual controls
// living in Immediate Action (WCF TA 2025-20). Do not force a requirement or
// prohibition to exist if the source doesn't state one.
//
// Analyze and rewrite are DELIBERATELY separate prompts (2026-07-23 revision).
// Analyze is a straightforward extraction task. Rewrite is a synthesis task --
// reusing the extraction prompt for rewrite was the confirmed root cause of
// rewrites reading as a second field-list instead of a genuine paragraph.
export const SUMMARY_ANALYZE_PROMPT = `${TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE}

TASK: SUMMARY EXTRACTION

Extract:
- subject (REQUIRED): a one-line statement of the topic/issue.
- affectedScope (REQUIRED): what/who is affected.
- riskOrIssue (optional): a descriptive statement of the concern, if the source is primarily descriptive rather than stating an explicit requirement/prohibition.
- centralRequirement (optional): the core "must" statement, ONLY if the source states one directly in the summary. Do not synthesize one from Immediate Action content you have not been given.
- centralProhibition (optional): the core "must not"/prohibited statement, ONLY if stated directly.
- revocation (optional): if the source states that a previously-approved exemption, approval, or exception is being revoked/withdrawn, capture that statement here.
- effectiveTiming (optional, but should be filled if a requirement, prohibition, or revocation is present and the source states timing): when this becomes effective.
- exceptionNote (optional): a SHORT restatement only, if the summary mentions an exception exists. Do not attempt to fully structure the exception here -- that is extracted separately from Immediate Action.

Do not invent a centralRequirement or centralProhibition if the source is purely descriptive (riskOrIssue only). Leaving these fields absent is correct and expected for many real alerts.

OUTPUT SCHEMA
Return JSON matching exactly: { "subject", "affectedScope", "riskOrIssue"?, "centralRequirement"?, "centralProhibition"?, "revocation"?, "effectiveTiming"?, "exceptionNote"? }
`;

// Rewrite: paragraph-first, then broken back down into the same fields.
// The model must (1) synthesize a cohesive paragraph from the reviewed
// fields, using ONLY those fields, then (2) re-derive the fields FROM that
// paragraph, so the two outputs can never disagree with each other. This
// makes the existing pre/post structured-field safety gates transitively
// check the paragraph too, without a separate paragraph-grounding gate.
export const SUMMARY_REWRITE_PROMPT = `${TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE}

TASK: SUMMARY REWRITE (SYNTHESIS, NOT EXTRACTION)

You will be given Reviewed Fields (structured, already reviewed by a human) and
the Original Raw Source (for context only, to recover wording, not new facts).

STEP 1 -- WRITE THE PARAGRAPH
Write "renderedText": ONE cohesive, well-written paragraph that synthesizes
ONLY the non-null fields in Reviewed Fields. Do not add a fact, timing,
requirement, prohibition, actor, equipment detail, or exception that is not
present in a non-null Reviewed Field. A field given as null was reviewed by a
human and confirmed absent -- you MUST NOT fill it in from Original Raw Source
or general knowledge, even if Original Raw Source happens to mention something
plausible-sounding for it. If omitting a null field makes a sentence feel
incomplete, REPHRASE around the information you do have -- never patch the gap
with an invented value ("effective immediately", a made-up date, a plausible
actor, etc. are common invention mistakes -- do not make them).

STEP 2 -- BREAK IT BACK DOWN
Re-read the paragraph you just wrote in Step 1, and re-derive the same fields
(subject, affectedScope, riskOrIssue, centralRequirement, centralProhibition,
revocation, effectiveTiming, exceptionNote) FROM that paragraph, using the same
extraction rules as analysis. The returned fields must be a faithful
reflection of what the paragraph actually says -- not a copy of the input
Reviewed Fields, and not a re-extraction from Original Raw Source. If the
paragraph doesn't state a requirement/prohibition/revocation/timing, the
corresponding field must be absent.

SIMPLIFIED TECHNICAL ENGLISH (apply to the paragraph)
- Rule 6.1: give information gradually. Rule 6.3: sentences no longer than 25
  words. Rule 6.4-6.5: paragraphs group related information, one topic only.
  Rule 6.6: no more than 6 sentences.
- Rule 9.4: use consistent terminology -- do not switch between two different
  names for the same equipment/product within the paragraph.
- Rule 4.2: no contractions, no omitted words for brevity.
- This is descriptive writing, not an instruction -- do not phrase it as a
  command even if the underlying fact is a mandatory requirement (state that
  the requirement exists; the requirement itself is enforced in Immediate
  Action, not stated as a command here).
- Prefer approved STE verbs where a plain substitution is natural and does not
  change meaning (e.g. "must" over "shall"/"should"; "remove" over "take off";
  "examine" over "check/evaluate") -- but never let a wording preference weaken
  or change the strength of a mandatory statement.

Preserve any stated central requirement, prohibition, or revocation exactly in
meaning -- only refine wording, never drop or soften them (see MANDATORY
LANGUAGE above).

OUTPUT SCHEMA
Return JSON matching exactly: { "renderedText": string, "subject", "affectedScope", "riskOrIssue"?, "centralRequirement"?, "centralProhibition"?, "revocation"?, "effectiveTiming"?, "exceptionNote"? }
`;
