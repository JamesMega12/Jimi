import { TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE } from './sharedSafetyPreamble';

// Section-specific prompts for Immediate Action -- the section carrying the
// most new structural complexity in the v2 refactor (obligationStrength,
// controlType tags, exception linkage). See plans/role-you-are-working-
// delightful-cupcake.md "AI Pipeline Design" and "Section Component Models".
//
// Analyze and rewrite are separate prompts (2026-07-23 revision, same
// rationale as Summary/Reasons -- see summaryPrompt.ts).
export const IMMEDIATE_ACTION_ANALYZE_PROMPT = `${TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE}

TASK: IMMEDIATE ACTION EXTRACTION

Extract every distinct actionable instruction from the source as a separate
action item. Do not merge two instructions into one item if they differ in
timing, actor, condition, or obligation strength. Do not split one instruction
into multiple items if it is genuinely a single obligation.

For each action item, determine:
- actor: who performs it (array of role/team names explicitly stated or clearly implied by context: e.g. "Operations", "P&SC"). Do not invent an actor if none is stated.
- requiredAction: the instruction itself, preserved in strength (see MANDATORY LANGUAGE above).
- target (optional): what/where the action applies to, if the source specifies it distinctly from the instruction itself.
- timing (optional): when it must happen, if stated.
- condition (optional): a qualifier of the form "if X, then..." that is NOT an exception (see EXCEPTIONS below) -- e.g. "if business continuity requires...".
- obligationStrength: exactly one of "mandatory" | "prohibited" | "conditional" | "advisory" | "unclear".
  - "prohibited" only for explicit "do not" / "must not" / "stop" / "prohibited" language.
  - "mandatory" for explicit "must" / "shall" / "required" language that is not a prohibition.
  - "conditional" when the obligation only applies under a stated condition.
  - "advisory" for genuinely optional/recommended language ("should", "consider").
  - "unclear" if the source does not make the obligation strength determinable -- never guess mandatory or prohibited when the source is ambiguous.
- controlType (optional array): tag with "removal_from_service", "red_tag", "quarantine", and/or "escalation" ONLY when the source text explicitly calls for that specific action. Do not infer these from general context.
- requiredEvidence (optional): what evidence/documentation the action requires, if stated.
- references (optional array): any standard/document identifiers cited for this specific action.

EXCEPTIONS
If the source describes an exception, exemption, or condition under which the
prohibition/requirement does NOT apply, extract it as a SEPARATE exception
record (not inline on the action item), with:
- appliesTo: the id(s) of the action item(s) it modifies (you will not know final ids -- use the 0-based index of the action item in your own "items" output array, as a string, e.g. "0" for the first item).
- condition: what must be true for the exception to apply.
- limitations: every condition, requirement, or restriction attached to the exception, as separate array entries. Do not drop, merge, or generalize limitations. Preserve every named approver, evidence requirement, submission system, and standard exactly.
- requiredApprovers, requiredEvidence: as separate arrays.
- submissionSystem, relatedStandard: if named.
Never let a condition or limitation exist unattached to its exception record.
Never broaden an exception beyond what the source states.

OUTPUT SCHEMA
Return JSON: { "items": ActionItem[], "exceptions": ExceptionRecord[] }
where ActionItem and ExceptionRecord match the field descriptions above
exactly. Return an empty array for "exceptions" if the source describes no
exception.
`;

// Rewrite: the structured fields (actor/requiredAction/target/timing/
// condition/obligationStrength/controlType/etc.) are finalized EXACTLY as in
// analysis -- rewrite must preserve the item count, obligation strength, and
// exception structure unchanged (the existing safety gates enforce this).
// The one new thing rewrite adds is `instructionText` per item: a single,
// complete, STE-quality sentence that folds target/timing/condition INTO the
// instruction itself, closing a confirmed defect where the DOCX export and
// review UI silently dropped those fields entirely (they were captured in
// data but never shown). instructionText is a rendering convenience derived
// from the structured fields -- it never becomes the fields' source of
// truth, and the fields are never re-derived from it (unlike Summary/Reasons'
// paragraph-then-breakdown, which doesn't apply here: actions are already
// atomic structured records, not prose to decompose).
export const IMMEDIATE_ACTION_REWRITE_PROMPT = `${TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE}

TASK: IMMEDIATE ACTION REWRITE (SYNTHESIS, NOT EXTRACTION)

You will be given Reviewed Fields: an "items" array and an "exceptions" array,
already reviewed by a human, plus the Original Raw Source for context only.

Preserve the reviewed items and exceptions EXACTLY: the same number of items,
the same obligationStrength per item, the same exceptions with the same
limitations/approvers/appliesTo links. Do not restructure, merge, split, add,
or remove items or exceptions. You may only refine the wording of
requiredAction and the new "instructionText" field described below.

FOR EACH ITEM, WRITE "instructionText":
One complete, STE-compliant instruction sentence that folds the item's target,
timing, and condition (if any) INTO the sentence -- do not leave them as
separate unstated facts. Examples of the pattern (illustrative only, do not
copy wording): "Effective immediately, remove the affected plugs from
service." / "Before returning the tool to service, complete a risk
assessment." Use ONLY the facts already present in that item's own reviewed
fields (actor, requiredAction, target, timing, condition) and Original Raw
Source -- never introduce a new actor, timing, condition, or requirement not
already present in the item.

SIMPLIFIED TECHNICAL ENGLISH (apply to instructionText)
- Rule 5.1: no more than 20 words.
- Rule 5.2: one instruction per sentence, unless two or more actions genuinely occur at the same time.
- Rule 5.3: imperative form ("Remove...", "Do not use...", not "The tool should be removed...").
- Rule 5.4: if the sentence opens with a descriptive/conditional clause before the command, separate it with a comma ("Effective immediately, remove...").
- Rule 4.2: no contractions.
- Prefer STE-approved verbs where a plain substitution does not change meaning (e.g. "remove" over "take off", "examine" over "check/evaluate", "must" over "shall") -- never let a wording preference weaken a prohibition or mandatory obligation.
- Preserve the item's obligationStrength meaning: a "prohibited" item must read as a clear prohibition, not a softened recommendation; a "conditional" item must keep its condition visible in the sentence, not imply it always applies.

OUTPUT SCHEMA
Return JSON: { "items": ActionItem[] (each including "instructionText"), "exceptions": ExceptionRecord[] }
`;
