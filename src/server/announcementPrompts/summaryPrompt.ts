import { ANNOUNCEMENT_SHARED_SAFETY_PREAMBLE } from "./safetyPreamble";

// Announcement Summary prompts. Lean and source-driven (plan §8): the reference
// documents show Summary is 1-3 short paragraphs conveying the central message,
// the affected scope, and why it matters -- occasionally with timing. There is
// no fixed schema to force; optional fields stay absent when the source doesn't
// support them.
//
// Analyze and rewrite are DELIBERATELY separate prompts. Analyze is extraction;
// rewrite is synthesis. Reusing one for both is what makes rewrites read as a
// second field-list instead of genuine prose (a lesson already learned in the
// Technical Alert v2 work).

export const ANNOUNCEMENT_SUMMARY_ANALYZE_PROMPT = `${ANNOUNCEMENT_SHARED_SAFETY_PREAMBLE}

TASK: ANNOUNCEMENT SUMMARY EXTRACTION

Extract these fields from the raw source. Only "centralMessage" is expected in
almost every Announcement; the rest are optional and must be left absent when
the source does not clearly support them.

- centralMessage (expected): a one-to-two sentence statement of what is being
  announced -- the change, update, requirement, or concern at the heart of it.
- affectedScope (optional): what/who is affected (products, equipment,
  locations, teams, operations). Leave absent if the source does not say.
- impact (optional): why it matters -- the effect on users or operations. Leave
  absent if not stated.
- implementationTiming (optional): when this takes effect or a stated deadline,
  ONLY if the source states one. Do not infer or invent a date.

Do not invent an affectedScope, impact, or timing that the source does not
state. Leaving optional fields absent is correct and expected.

OUTPUT SCHEMA
Return JSON matching exactly: { "centralMessage", "affectedScope"?, "impact"?, "implementationTiming"? }
`;

// Rewrite: paragraph-first, then broken back down into the same fields, so the
// prose and the re-derived fields cannot disagree (same mechanism proven in
// Technical Alert v2 Summary).
export const ANNOUNCEMENT_SUMMARY_REWRITE_PROMPT = `${ANNOUNCEMENT_SHARED_SAFETY_PREAMBLE}

TASK: ANNOUNCEMENT SUMMARY REWRITE (SYNTHESIS, NOT EXTRACTION)

You are given Reviewed Fields (structured, already reviewed by a human) and the
Original Raw Source (for wording context only, not new facts).

STEP 1 -- WRITE THE PARAGRAPH
Write "renderedText": one or two cohesive, well-written paragraphs (short --
this is a Summary, not the whole Announcement) that synthesize ONLY the non-null
Reviewed Fields. Do not add a fact, scope, impact, timing, cause, product, or
identifier that is not present in a non-null Reviewed Field. A field given as
null was reviewed by a human and confirmed absent -- you MUST NOT fill it in
from the Original Raw Source or general knowledge, even if the source mentions
something plausible. If omitting a null field makes a sentence feel incomplete,
REPHRASE around what you have -- never patch the gap with an invented value.

STEP 2 -- BREAK IT BACK DOWN
Re-read the paragraph(s) you just wrote and re-derive the same fields
(centralMessage, affectedScope, impact, implementationTiming) FROM that text,
using the same extraction rules as analysis. The returned fields must faithfully
reflect what the paragraph actually says -- not a copy of the input Reviewed
Fields, and not a re-extraction from the Original Raw Source. If the paragraph
does not state a scope/impact/timing, that field must be absent.

STYLE
- Operator-friendly, plain, professional. Short sentences. One topic per
  paragraph. No contractions. Consistent terminology (do not switch between two
  names for the same product/equipment).
- Preserve any exact identifier (part number, InTouch ID, standard, deadline)
  verbatim. Preserve source uncertainty -- do not state a suspected or
  preliminary point as confirmed.

OUTPUT SCHEMA
Return JSON matching exactly: { "renderedText": string, "centralMessage", "affectedScope"?, "impact"?, "implementationTiming"? }
`;
