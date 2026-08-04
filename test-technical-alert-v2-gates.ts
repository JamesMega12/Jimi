// Phase 2 tests for the v2 Technical Alert refactor: deterministic adversarial
// fixture tests for the 5 structural rewrite-safety gates, and normalizer unit
// tests. Deliberately NOT dependent on live LLM output (that's covered
// separately by manual live round-trips against real Gemini and real WCF TA
// text) -- these must be repeatable and fast. Run with:
// npx tsx test-technical-alert-v2-gates.ts
import {
  mandatoryTermGate,
  obligationStrengthPreservationGate,
  exceptionDetachmentGate,
  uncertaintyPreservationGate,
  referenceInventionGate,
} from './src/server/technicalAlertObligationGates';
import { normalizeImmediateActionResult, NormalizedActionItem, NormalizedExceptionRecord } from './src/server/technicalAlertNormalizerV2';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}

function item(overrides: Partial<NormalizedActionItem>): NormalizedActionItem {
  return { id: 'x', actor: [], requiredAction: 'do the thing', obligationStrength: 'mandatory', ...overrides };
}
function exception(overrides: Partial<NormalizedExceptionRecord>): NormalizedExceptionRecord {
  return { id: 'e', appliesTo: [], condition: 'c', limitations: [], requiredApprovers: [], requiredEvidence: [], ...overrides };
}

// ===== Gate 1: mandatory-term =====
assert(
  mandatoryTermGate(['Operators must stop work immediately.'], ['Operators should consider stopping work.']).length > 0,
  'gate1 (mandatoryTerm): weakened "must"/"stop" language is caught'
);
assert(
  mandatoryTermGate(['Operators must stop work immediately.'], ['Operators must stop work immediately, per updated wording.']).length === 0,
  'gate1 (mandatoryTerm): preserved mandatory language passes cleanly'
);

// ===== Gate 2: obligation-strength preservation =====
const preActions = [item({ id: 'a1', obligationStrength: 'mandatory' }), item({ id: 'a2', obligationStrength: 'prohibited' })];
const postDowngraded = [item({ id: 'a1', obligationStrength: 'advisory' }), item({ id: 'a2', obligationStrength: 'prohibited' })];
const postPreserved = [item({ id: 'a1', obligationStrength: 'mandatory' }), item({ id: 'a2', obligationStrength: 'prohibited' })];
const postDroppedItem = [item({ id: 'a1', obligationStrength: 'mandatory' })];

assert(
  obligationStrengthPreservationGate(preActions, postDowngraded).length === 1,
  'gate2 (obligationStrength): a mandatory item silently downgraded to advisory is caught'
);
assert(
  obligationStrengthPreservationGate(preActions, postPreserved).length === 0,
  'gate2 (obligationStrength): preserved obligation strengths pass cleanly'
);
assert(
  obligationStrengthPreservationGate(preActions, postDroppedItem).length === 1,
  'gate2 (obligationStrength): a silently dropped action item (count mismatch) is caught'
);
assert(
  obligationStrengthPreservationGate(
    [item({ id: 'a1', obligationStrength: 'advisory' })],
    [item({ id: 'a1', obligationStrength: 'mandatory' })]
  ).length === 0,
  'gate2 (obligationStrength): upgrading advisory->mandatory is NOT flagged (only protects mandatory/prohibited from being weakened, not the reverse)'
);

// ===== Gate 3: exception-detachment (THE required adversarial case) =====
const preException = exception({
  id: 'e1',
  appliesTo: ['a2'],
  limitations: ['Submit exemption request in QUEST', 'Requires Expert approver sign-off', 'Requires risk assessment', 'Requires replacement plan'],
  requiredApprovers: ['WC Fluids OI Manager', 'OCC PSD Fluids Cementing Support'],
});

// Adversarial: rewrite silently drops 2 of 4 limitations and 1 of 2 approvers.
const postExceptionDropped = exception({
  id: 'e1',
  appliesTo: ['a2'],
  limitations: ['Submit exemption request in QUEST', 'Requires Expert approver sign-off'],
  requiredApprovers: ['WC Fluids OI Manager'],
});
const droppedViolations = exceptionDetachmentGate([preException], [postExceptionDropped]);
assert(
  droppedViolations.some(v => v.message.includes('limitation')),
  'gate3 (exceptionDetachment): REQUIRED CASE — rewrite that drops limitations from an exception is rejected'
);
assert(
  droppedViolations.some(v => v.message.toLowerCase().includes('approver')),
  'gate3 (exceptionDetachment): rewrite that drops required approvers from an exception is also rejected'
);

// Adversarial: rewrite detaches the exception from its action entirely.
const postExceptionDetached = exception({ id: 'e1', appliesTo: [], limitations: preException.limitations, requiredApprovers: preException.requiredApprovers });
assert(
  exceptionDetachmentGate([preException], [postExceptionDetached]).some(v => v.message.toLowerCase().includes('detached')),
  'gate3 (exceptionDetachment): rewrite that detaches an exception from its action (empties appliesTo) is rejected'
);

// Adversarial: rewrite drops the entire exception record.
assert(
  exceptionDetachmentGate([preException], []).some(v => v.message.toLowerCase().includes('dropped')),
  'gate3 (exceptionDetachment): rewrite that drops an entire exception record is rejected'
);

// Positive case: a faithful rewrite (same or more content) passes cleanly.
const postExceptionPreserved = exception({
  id: 'e1',
  appliesTo: ['a2'],
  limitations: [...preException.limitations],
  requiredApprovers: [...preException.requiredApprovers],
});
assert(
  exceptionDetachmentGate([preException], [postExceptionPreserved]).length === 0,
  'gate3 (exceptionDetachment): a faithful rewrite that preserves all limitations/approvers/linkage passes cleanly'
);

// ===== Gate 4: uncertainty preservation =====
assert(
  uncertaintyPreservationGate(['The root cause is suspected to be material fatigue, under investigation.'], ['The root cause is material fatigue.']).length > 0,
  'gate4 (uncertaintyPreservation): a rewrite that silently asserts certainty over a "suspected"/"under investigation" source is caught'
);
assert(
  uncertaintyPreservationGate(['The root cause is suspected to be material fatigue.'], ['The root cause is suspected to be material fatigue, pending confirmation.']).length === 0,
  'gate4 (uncertaintyPreservation): preserved hedging language passes cleanly'
);

// ===== Gate 5: reference-invention (warning-only per Insight I9) =====
assert(
  referenceInventionGate(['Comply with WEC-SQ-S10A.'], ['Comply with WEC-SQ-S10A and ABC-99-XYZ.']).length > 0,
  'gate5 (referenceInvention): a reference-shaped token not present in the source is flagged'
);
assert(
  referenceInventionGate(['Comply with WEC-SQ-S10A.'], ['Please comply with WEC-SQ-S10A as required.']).length === 0,
  'gate5 (referenceInvention): a preserved reference does not falsely trigger'
);

// ===== normalizeImmediateActionResult: appliesTo resolution =====

// Fresh model output: appliesTo are 0-based indices, ids don't exist yet.
const freshModelOutput = {
  items: [
    { requiredAction: 'Stop work', obligationStrength: 'prohibited' },
    { requiredAction: 'Quarantine equipment', obligationStrength: 'mandatory' },
  ],
  exceptions: [{ appliesTo: ['1'], condition: 'if X', limitations: ['must approve'] }],
};
const freshNormalized = normalizeImmediateActionResult(freshModelOutput);
assert(
  freshNormalized.exceptions[0].appliesTo.length === 1 && freshNormalized.exceptions[0].appliesTo[0] === freshNormalized.items[1].id,
  'normalizer: index-based appliesTo ("1") correctly resolves to the second item\'s freshly-generated id'
);
assert(
  freshNormalized.items[1].exceptionRef === freshNormalized.exceptions[0].id,
  'normalizer: back-link sets exceptionRef on the referenced item'
);

// Already-normalized client-supplied state (a rewrite's "components" grounding):
// real ids must be preserved, and appliesTo entries that are already real ids
// must resolve directly -- this is the exact bug found via live testing this
// phase (a hand-constructed appliesTo:["i2","i3"] was silently dropped to []
// before this fix, because the old code only ever tried index-parsing it).
const alreadyNormalized = {
  items: [
    { id: 'i1', requiredAction: 'Stop work', obligationStrength: 'prohibited' },
    { id: 'i2', requiredAction: 'Quarantine equipment', obligationStrength: 'mandatory' },
  ],
  exceptions: [{ id: 'e1', appliesTo: ['i2'], condition: 'if X', limitations: ['must approve'] }],
};
const reNormalized = normalizeImmediateActionResult(alreadyNormalized);
assert(reNormalized.items[0].id === 'i1' && reNormalized.items[1].id === 'i2', 'normalizer: caller-supplied ids are preserved, not regenerated');
assert(
  reNormalized.exceptions[0].appliesTo.length === 1 && reNormalized.exceptions[0].appliesTo[0] === 'i2',
  'REGRESSION GUARD: id-based appliesTo ("i2") resolves directly instead of being silently dropped (the bug found via live testing)'
);
assert(reNormalized.exceptions[0].id === 'e1', 'normalizer: caller-supplied exception id is preserved');

// Malformed/invented obligationStrength and controlType are coerced, not passed through.
const malformed = normalizeImmediateActionResult({
  items: [{ requiredAction: 'x', obligationStrength: 'super-mandatory', controlType: ['red_tag', 'made_up_tag'] }],
  exceptions: [],
});
assert(malformed.items[0].obligationStrength === 'unclear', 'normalizer: an invalid obligationStrength value is coerced to "unclear", never passed through as-is');
assert(
  malformed.items[0].controlType?.length === 1 && malformed.items[0].controlType[0] === 'red_tag',
  'normalizer: an invented controlType tag is stripped while a valid one is kept'
);

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
