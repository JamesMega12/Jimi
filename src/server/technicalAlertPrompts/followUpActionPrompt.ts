import { TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE } from './sharedSafetyPreamble';

// Section-specific prompts for Follow-Up Action. Shares the ActionItem shape
// with Immediate Action (same repeatable structure), but is a separate,
// independent section -- content must never be duplicated between the two,
// and a future/planned control must never be phrased as already implemented.
//
// Analyze and rewrite are separate prompts (2026-07-23 revision, same
// rationale as Immediate Action -- see immediateActionPrompt.ts).
export const FOLLOW_UP_ACTION_ANALYZE_PROMPT = `${TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE}

TASK: FOLLOW-UP ACTION EXTRACTION

Extract every distinct follow-up obligation (monitoring, reporting, procedural
updates, replacement activities, long-term controls, engineering changes,
way-forward items) as a separate action item, using the same field meanings as
Immediate Action:
- actor, requiredAction, target (optional), timing (optional), condition (optional).
- obligationStrength: "mandatory" | "prohibited" | "conditional" | "advisory" | "unclear". Follow-up items are more often "advisory" than immediate actions, but classify strictly from the source language -- do not default to advisory if the source uses "must"/"shall".
- followUpCategory (optional): exactly one of "monitoring" | "reporting" | "procedural_update" | "replacement" | "engineering_change" | "way_forward", if the item clearly fits one.

CRITICAL: If an item is tagged "engineering_change" (a planned/future
engineering control), the requiredAction text MUST be phrased as a future
action ("will be installed", "is planned", "to be implemented") and MUST NOT
be phrased as already completed ("has been installed", "was implemented").
Never present a planned control as if it is already in place.

Do NOT include any item that is really an Immediate Action (something required
right now, with no delay) -- that belongs in the Immediate Action section, not
here. If you are unsure whether an item is immediate or follow-up, classify by
the source's own stated timing.

Exceptions/exemptions are not extracted here -- Follow-Up Action has no
exception structure of its own.

OUTPUT SCHEMA
Return JSON: { "items": ActionItem[] }
`;

// Rewrite: same instructionText-synthesis pattern as Immediate Action (see
// there for the full rationale) -- structured fields stay authoritative and
// unchanged in count/obligationStrength; the new instructionText per item
// folds target/timing/condition into one STE-quality sentence.
export const FOLLOW_UP_ACTION_REWRITE_PROMPT = `${TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE}

TASK: FOLLOW-UP ACTION REWRITE (SYNTHESIS, NOT EXTRACTION)

You will be given Reviewed Fields: an "items" array, already reviewed by a
human, plus the Original Raw Source for context only.

Preserve the reviewed items EXACTLY: the same number of items, the same
obligationStrength and followUpCategory per item. Do not restructure, merge,
split, add, or remove items. You may only refine the wording of
requiredAction and the new "instructionText" field described below.

FOR EACH ITEM, WRITE "instructionText":
One complete, STE-compliant sentence that folds the item's target, timing, and
condition (if any) INTO the sentence. Use ONLY facts already present in that
item's own reviewed fields and Original Raw Source -- never introduce a new
actor, timing, condition, or requirement.

CRITICAL -- FUTURE VS COMPLETED: if the item's followUpCategory is
"engineering_change", instructionText MUST be phrased as a future action
("will install", "is planned to be implemented") and MUST NOT be phrased as
already completed ("has been installed", "was implemented"). This applies to
instructionText even if requiredAction was already correctly future-phrased --
do not let the rewrite accidentally introduce completed-tense language.

SIMPLIFIED TECHNICAL ENGLISH (apply to instructionText)
- Rule 5.1: no more than 20 words. Rule 5.2: one instruction per sentence.
  Rule 5.3: imperative form where the item is a genuine instruction (skip for
  "advisory" items, which may read as guidance rather than a command).
  Rule 5.4: comma after a leading descriptive/conditional clause.
  Rule 4.2: no contractions.
- Prefer STE-approved verbs where a plain substitution does not change
  meaning -- never let a wording preference weaken an obligation.

OUTPUT SCHEMA
Return JSON: { "items": ActionItem[] (each including "instructionText") }
`;
