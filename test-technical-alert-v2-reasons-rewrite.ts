// Phase 2 (Reasons vertical slice) tests: the narrative unsupported-addition
// strip, and the same normalizer/renderedText pass-through pattern as
// Summary. Run with: npx tsx test-technical-alert-v2-reasons-rewrite.ts

import { stripUnsupportedAdditions, uncertaintyPreservationGate } from './src/server/technicalAlertObligationGates';
import { normalizeReasonsResult, REASONS_NARRATIVE_OPTIONAL_FIELDS } from './src/server/technicalAlertNormalizerV2';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}

// ===== normalizer: renderedText pass-through =====
{
  const result = normalizeReasonsResult({
    narrative: { technicalBasis: 'Basis', causeStatus: 'suspected', renderedText: 'A cohesive paragraph.' },
  });
  assert(result.narrative?.renderedText === 'A cohesive paragraph.', 'normalizer: renderedText is passed through on the narrative');
}
{
  const result = normalizeReasonsResult({ narrative: { technicalBasis: 'Basis', causeStatus: 'suspected' } });
  assert(result.narrative?.renderedText === undefined, 'normalizer: renderedText is absent when the model does not return one (e.g. analyze)');
}
{
  const result = normalizeReasonsResult({ narrative: null, evidenceItems: [{ component: 'Reamer Shoe', concern: 'Nose detached' }] });
  assert(result.narrative === undefined, 'normalizer: a null narrative stays absent (evidence-table-only shape preserved)');
  assert(result.evidenceItems?.length === 1, 'normalizer: evidenceItems still populate when narrative is null');
}

// ===== stripUnsupportedAdditions on narrative fields =====
{
  const raw = 'The plug material may not be maintaining its expected profile. The root cause has not been confirmed.';
  const pre = normalizeReasonsResult({ narrative: { causeStatus: 'suspected' } }).narrative!; // no technicalBasis/consequence yet
  const invented = { ...pre, consequence: 'This will cause a full wellbore blowout resulting in loss of the rig.' };
  const { cleaned, warnings } = stripUnsupportedAdditions(pre, invented, [raw, pre], REASONS_NARRATIVE_OPTIONAL_FIELDS);
  assert(cleaned.consequence === undefined, 'reasons narrative: an ungrounded invented consequence is stripped');
  assert(warnings.length === 1, 'reasons narrative: a warning is raised for the stripped consequence');
}
{
  const raw = 'Loss of pressure integrity during bumping is possible if this is not addressed.';
  const pre = normalizeReasonsResult({ narrative: { causeStatus: 'suspected' } }).narrative!;
  const grounded = { ...pre, consequence: 'Loss of pressure integrity during bumping' };
  const { cleaned, warnings } = stripUnsupportedAdditions(pre, grounded, [raw, pre], REASONS_NARRATIVE_OPTIONAL_FIELDS);
  assert(cleaned.consequence === 'Loss of pressure integrity during bumping', 'reasons narrative: a grounded consequence survives');
  assert(warnings.length === 0, 'reasons narrative: no warning for a grounded addition');
}

// ===== Live-reported bug fix, 2026-07-23: hedge-term synonym substitution
// must not be flagged as "asserted as certain" =====
{
  const grounding = ['The plug material possibly failed due to elevated temperature exposure.'];
  const output = ['The plug material may have failed due to elevated temperature exposure.'];
  const violations = uncertaintyPreservationGate(grounding, output);
  assert(violations.length === 0, 'uncertaintyPreservationGate: "possibly" reworded as "may" (a synonym hedge, not certainty) is NOT flagged');
}
{
  const grounding = ['The root cause is preliminary and under investigation.'];
  const output = ['The root cause is possibly linked to material fatigue.'];
  const violations = uncertaintyPreservationGate(grounding, output);
  assert(violations.length === 0, 'uncertaintyPreservationGate: swapping one hedge term for a different one is NOT flagged, as long as SOME hedge remains');
}
{
  const grounding = ['The root cause is possibly material fatigue.'];
  const output = ['The root cause is material fatigue.'];
  const violations = uncertaintyPreservationGate(grounding, output);
  assert(violations.length === 1, 'uncertaintyPreservationGate: hedging dropped ENTIRELY (no hedge word survives) is still correctly flagged');
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
