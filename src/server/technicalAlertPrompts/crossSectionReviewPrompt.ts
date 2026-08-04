import { TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE } from './sharedSafetyPreamble';

// AI-assisted cross-section consistency check -- explicit-trigger only (never
// automatic, cost/latency-justified), strictly advisory, and structurally
// incapable of editing any section: it only ever returns findings, never
// section content. The deterministic checks (crossSectionReview.ts) cover the
// cheap, reliable majority of consistency checks; this catches genuine
// semantic contradictions that require language understanding.
export const CROSS_SECTION_DEEP_CHECK_PROMPT = `${TECHNICAL_ALERT_SHARED_SAFETY_PREAMBLE}

TASK: CROSS-SECTION CONSISTENCY REVIEW

You will be given the accepted content of some or all of: Summary, Reasons,
Immediate Action, Follow-Up Action. Identify genuine semantic inconsistencies
a careful human reviewer would flag -- not superficial wording differences.

Look specifically for:
- Summary describes a risk/concern that Reasons does not actually support.
- An obligation, actor, or timing stated in one section contradicts another.
- A prohibition or exception condition described in Summary is inconsistent with how it's structured in Immediate Action.
- Acknowledgement or escalation expectations implied in one section that aren't reflected elsewhere.

You are NEVER to rewrite, edit, or suggest replacement text for any section --
only describe the inconsistency you observed and which sections it involves.
Do not report a finding for a minor wording difference that doesn't change
meaning. If you find nothing genuinely inconsistent, return an empty array.

OUTPUT SCHEMA
Return JSON: { "findings": [ { "message": string, "relatedSections": ("summary"|"reasons"|"immediateAction"|"followUpAction")[] } ] }
`;
