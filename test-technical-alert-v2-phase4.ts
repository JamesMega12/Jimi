// Phase 4 tests: normalizer + gate unit tests for Reasons, Summary, and
// Follow-Up Action -- the three sections added this phase, replicating Phase
// 2's proven pattern. Deterministic/fixture-based, no live LLM dependency
// (live validation was done separately against real WCF TA 2025-20/2026-10
// text). Run with: npx tsx test-technical-alert-v2-phase4.ts
import {
  normalizeFollowUpActionResult,
  normalizeReasonsResult,
  normalizeSummaryResultV2,
} from './src/server/technicalAlertNormalizerV2';
import {
  futureTenseGate,
  causeStatusPreservationGate,
  centralClaimPreservationGate,
  runFollowUpActionGates,
  runReasonsGates,
  runSummaryGates,
} from './src/server/technicalAlertObligationGates';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}

// ===== normalizeFollowUpActionResult =====
const fu1 = normalizeFollowUpActionResult({ items: [{ requiredAction: 'monitor', obligationStrength: 'advisory', followUpCategory: 'monitoring' }] });
assert(fu1.items.length === 1 && fu1.notApplicable === false, 'normalizer(followUp): basic item + notApplicable default false');
assert(fu1.items[0].followUpCategory === 'monitoring', 'normalizer(followUp): valid followUpCategory preserved');

const fu2 = normalizeFollowUpActionResult({ items: [{ requiredAction: 'x', obligationStrength: 'advisory', followUpCategory: 'made_up_category' }] });
assert(fu2.items[0].followUpCategory === undefined, 'normalizer(followUp): invalid followUpCategory stripped, not passed through');

const fu3 = normalizeFollowUpActionResult({ notApplicable: true });
assert(fu3.notApplicable === true && fu3.items.length === 0, 'normalizer(followUp): notApplicable:true with no items handled cleanly');

// ===== normalizeReasonsResult =====
const r1 = normalizeReasonsResult({ narrative: { technicalBasis: 'x', causeStatus: 'suspected' }, evidenceItems: [] });
assert(r1.narrative?.causeStatus === 'suspected', 'normalizer(reasons): valid causeStatus preserved');
assert(r1.evidenceItems === undefined, 'normalizer(reasons): empty evidenceItems array normalized to undefined, not an empty array (matches "may be absent" design)');

const r2 = normalizeReasonsResult({ narrative: { technicalBasis: 'x', causeStatus: 'super-duper-confirmed' } });
assert(r2.narrative?.causeStatus === 'unknown', 'normalizer(reasons): invalid causeStatus coerced to "unknown", NEVER defaulted to "confirmed"');

// 2026-07-23: this used to assert the narrative was DROPPED when only
// causeStatus was set (no basis/consequence text yet). That was wrong for
// the Phase 2 rewrite flow: a user who clicks "Add Narrative" and sets
// causeStatus before typing anything else has a real, deliberately-started
// narrative -- dropping it would make the rewrite route's "must not invent a
// narrative from nothing" safeguard incorrectly strip whatever the AI fills
// in for a narrative the user genuinely started. The model's own ANALYZE
// prompt separately returns `narrative: null` (not an empty object) when the
// source has no narrative content, so analysis still never invents a
// placeholder narrative -- see test-technical-alert-v2-reasons-rewrite.ts.
const r3 = normalizeReasonsResult({ narrative: { causeStatus: 'confirmed' } });
assert(r3.narrative?.causeStatus === 'confirmed', 'normalizer(reasons): a narrative with only causeStatus set (no basis/consequence yet) is KEPT, not dropped -- it is a real, user-started narrative');

const r4 = normalizeReasonsResult({ evidenceItems: [{ component: 'Reamer Shoe', concern: 'nose detached' }, { component: '', concern: '' }] });
assert(r4.evidenceItems?.length === 1, 'normalizer(reasons): evidence items with no real content are filtered out');

const r5 = normalizeReasonsResult({});
assert(r5.narrative === undefined && r5.evidenceItems === undefined, 'normalizer(reasons): fully empty input produces no invented content');

// ===== normalizeSummaryResultV2 =====
const s1 = normalizeSummaryResultV2({ subject: 'x', affectedScope: 'y' });
assert(s1.centralRequirement === undefined && s1.centralProhibition === undefined, 'normalizer(summary): optional fields absent by default, never invented');

// ===== futureTenseGate (adversarial) =====
const badFuture = futureTenseGate([
  { id: '1', actor: [], requiredAction: 'The new seal design has been installed on all units.', obligationStrength: 'mandatory', followUpCategory: 'engineering_change' },
]);
assert(badFuture.length === 1, 'gate(futureTense): REQUIRED CASE — a completed-tense engineering_change item is rejected');

const goodFuture = futureTenseGate([
  { id: '1', actor: [], requiredAction: 'Engineering will design and roll out a redesigned seal.', obligationStrength: 'mandatory', followUpCategory: 'engineering_change' },
]);
assert(goodFuture.length === 0, 'gate(futureTense): future-tense phrasing (the real live-tested Gemini output) passes cleanly');

const nonEngChange = futureTenseGate([
  { id: '1', actor: [], requiredAction: 'The audit has been completed.', obligationStrength: 'mandatory', followUpCategory: 'reporting' },
]);
assert(nonEngChange.length === 0, 'gate(futureTense): completed-tense language on a NON-engineering_change item is not flagged (only applies to planned controls)');

// ===== causeStatusPreservationGate =====
assert(
  causeStatusPreservationGate('suspected', 'confirmed', false).length === 1,
  'gate(causeStatus): a silent upgrade from suspected->confirmed without a user edit is rejected'
);
assert(
  causeStatusPreservationGate('suspected', 'confirmed', true).length === 0,
  'gate(causeStatus): the same upgrade is allowed when the user explicitly edited causeStatus themselves'
);
assert(
  causeStatusPreservationGate('confirmed', 'suspected', false).length === 0,
  'gate(causeStatus): downgrading toward MORE uncertainty is never flagged (only guards against false certainty)'
);
assert(
  causeStatusPreservationGate(undefined, 'confirmed', false).length === 0,
  'gate(causeStatus): no prior causeStatus (first-ever analysis) is not treated as a violation'
);

// ===== centralClaimPreservationGate =====
const preSummary = { subject: 's', affectedScope: 'a', centralProhibition: 'Must not use welded couplings.', revocation: 'Prior exemptions revoked.' };
const postDroppedProhibition = { subject: 's', affectedScope: 'a', revocation: 'Prior exemptions revoked.' };
assert(
  centralClaimPreservationGate(preSummary, postDroppedProhibition).length === 1,
  'gate(centralClaim): a rewrite that silently drops centralProhibition is rejected'
);
const postPreserved = { subject: 's', affectedScope: 'a', centralProhibition: 'Welded couplings must not be used.', revocation: 'Prior exemptions revoked.' };
assert(
  centralClaimPreservationGate(preSummary, postPreserved).length === 0,
  'gate(centralClaim): a faithful rewrite (reworded but present) passes cleanly'
);

// ===== Integration: run*Gates blocking vs warning separation =====
const fuGateResult = runFollowUpActionGates(
  ['Engineering will design a new seal.'],
  { items: [{ id: '1', actor: [], requiredAction: 'x', obligationStrength: 'mandatory' }], notApplicable: false },
  { items: [{ id: '1', actor: [], requiredAction: 'The seal has been installed.', obligationStrength: 'mandatory', followUpCategory: 'engineering_change' }], notApplicable: false }
);
assert(fuGateResult.blocking.some(v => v.gate === 'futureTense'), 'integration(followUp): runFollowUpActionGates surfaces a futureTense violation as blocking');

const reasonsGateResult = runReasonsGates(
  ['suspected'],
  { narrative: { causeStatus: 'suspected', technicalBasis: 'x' } },
  { narrative: { causeStatus: 'confirmed', technicalBasis: 'x' } },
  false
);
assert(reasonsGateResult.blocking.some(v => v.gate === 'causeStatusPreservation'), 'integration(reasons): runReasonsGates surfaces a causeStatus violation as blocking');

const summaryGateResult = runSummaryGates(
  ['must not'],
  { subject: 's', affectedScope: 'a', centralProhibition: 'must not do X' },
  { subject: 's', affectedScope: 'a' }
);
assert(summaryGateResult.blocking.some(v => v.gate === 'centralClaimPreservation'), 'integration(summary): runSummaryGates surfaces a centralClaim violation as blocking');
assert(Array.isArray(summaryGateResult.warnings), 'integration(summary): warnings array present (reference-invention check, separate from blocking)');

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
