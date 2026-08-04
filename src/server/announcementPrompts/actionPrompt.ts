import { ANNOUNCEMENT_SHARED_SAFETY_PREAMBLE } from "./safetyPreamble";

// Announcement Action prompts (plan §10, Option B hybrid). The reference
// documents show Action ranges from categorized solution-stages (doc 1:
// old-part restriction / short-term / long-term / operator instruction) to
// numbered process requirements with deadlines and roles (docs 2, 3). So Action
// is modeled as a LIST of items, each tagged with a detected kind -- never
// forced into the doc-1 category set. The single most important rule: only use a
// kind the source actually supports; do not invent a restriction/solution-stage
// just because it is common in other announcements.

const KIND_GUIDE = `
Item kinds (choose the ONE that best fits each item; only use a kind the source supports):
- "immediate": an action to take right now / on discovery.
- "restriction": a prohibition or old-part restriction (e.g. "do not order", "do not use").
- "short-term": an explicitly short-term or interim solution.
- "long-term": an explicitly long-term or permanent solution.
- "operator": an instruction directed at the operator/technician performing the work.
- "requirement": a mandatory requirement or numbered process step (the common case for process/compliance announcements).
- "condition": a condition or limitation that governs validity (e.g. "missing confirmation = invalid").
When unsure, use "requirement". Do NOT invent restriction/short-term/long-term/operator items if the source does not clearly state them.`;

export const ANNOUNCEMENT_ACTION_ANALYZE_PROMPT = `${ANNOUNCEMENT_SHARED_SAFETY_PREAMBLE}

TASK: ANNOUNCEMENT ACTION EXTRACTION

Break the raw Action content into a list of discrete action items. Keep each
distinct instruction, restriction, or solution stage as its OWN item -- do not
merge them.
${KIND_GUIDE}

For each item capture:
- kind (see above)
- text: the action itself, faithfully.
- deadline (optional): a date/deadline stated for THIS item.
- responsibleRole (optional): who must do it, if a role is named (e.g. DGM, TLM).
- reference (optional): an InTouch ID, question number, standard, or link tied to this item.

Also capture an optional "lead": a single overview sentence if the source opens
the Action with one before the itemized actions. Preserve exact identifiers
(part numbers, InTouch IDs, question numbers) verbatim.

OUTPUT SCHEMA
Return JSON matching exactly: { "lead"?: string, "items": [ { "kind", "text", "deadline"?, "responsibleRole"?, "reference"? } ] }
`;

export const ANNOUNCEMENT_ACTION_REWRITE_PROMPT = `${ANNOUNCEMENT_SHARED_SAFETY_PREAMBLE}

TASK: ANNOUNCEMENT ACTION REWRITE (POLISH, NOT RESTRUCTURE)

You are given Reviewed Items (already reviewed by a human) and the Original Raw
Source (wording context only). Improve the wording of each item into clear,
operator-friendly, imperative language -- but DO NOT change the structure:

- Return EXACTLY the same number of items, in the SAME order, with the SAME
  "kind" and the SAME id for each. Do not merge, split, drop, add, or
  re-categorize items. Distinct instructions/restrictions/solution-stages must
  stay distinct.
- Keep each item's deadline/responsibleRole/reference unchanged unless the
  wording is merely tidied. Preserve exact identifiers verbatim (part numbers,
  InTouch IDs, question numbers, standards).
- Do not add a fact, deadline, role, product, or identifier not present in the
  reviewed item or the raw source.
- Polish the optional "lead" sentence too, if present.

Do not flatten the list into one dense paragraph -- the itemized structure is
intentional. This is publication-ready operator guidance; keep it precise.

OUTPUT SCHEMA
Return JSON matching exactly: { "lead"?: string, "items": [ { "id", "kind", "text", "deadline"?, "responsibleRole"?, "reference"? } ] }
`;
