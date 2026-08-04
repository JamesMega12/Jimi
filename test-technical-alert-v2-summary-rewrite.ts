// Phase 1 (Summary vertical slice) tests: the unsupported-addition gate, the
// mandatory-term synonym-equivalence-class fix, and the deterministic STE
// checks. Run with: npx tsx test-technical-alert-v2-summary-rewrite.ts

import { stripUnsupportedAdditions, groundRenderedText } from './src/server/technicalAlertObligationGates';
import { findDroppedMandatoryTerms } from './src/server/technicalAlertSemanticSafety';
import { runSteChecks, checkApprovedWords, checkSentenceLength, checkContractions, checkSemicolons } from './src/server/technicalAlertSteRules';
import { normalizeSummaryResultV2, SUMMARY_OPTIONAL_FIELDS } from './src/server/technicalAlertNormalizerV2';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}

// ===== stripUnsupportedAdditions =====
{
  const raw = 'Creston molded wiper plugs must not be used for HPHT cementing applications.';
  const pre = normalizeSummaryResultV2({ subject: 's', affectedScope: 'a' }); // effectiveTiming absent
  const invented = normalizeSummaryResultV2({ subject: 's', affectedScope: 'a', effectiveTiming: 'Effective immediately upon receipt of this notice' });
  const { cleaned, warnings } = stripUnsupportedAdditions(pre, invented, [raw, pre], SUMMARY_OPTIONAL_FIELDS.filter(f => f !== 'renderedText'));
  assert(cleaned.effectiveTiming === undefined, 'stripUnsupportedAdditions: an ungrounded added field is stripped back to absent');
  assert(warnings.length === 1 && warnings[0].gate === 'unsupportedAddition', 'stripUnsupportedAdditions: a warning is raised for the stripped field');
}
{
  const raw = 'Effective immediately, do not use the affected plugs for HPHT cementing.';
  const pre = normalizeSummaryResultV2({ subject: 's', affectedScope: 'a' });
  const grounded = normalizeSummaryResultV2({ subject: 's', affectedScope: 'a', effectiveTiming: 'Effective immediately' });
  const { cleaned, warnings } = stripUnsupportedAdditions(pre, grounded, [raw, pre], SUMMARY_OPTIONAL_FIELDS.filter(f => f !== 'renderedText'));
  assert(cleaned.effectiveTiming === 'Effective immediately', 'stripUnsupportedAdditions: a grounded added field survives unchanged');
  assert(warnings.length === 0, 'stripUnsupportedAdditions: no warning for a grounded addition');
}
{
  const raw = 'Do not use the affected plugs.';
  const pre = normalizeSummaryResultV2({ subject: 's', affectedScope: 'a', effectiveTiming: 'Effective immediately' });
  const post = normalizeSummaryResultV2({ subject: 's', affectedScope: 'a', effectiveTiming: 'Effective immediately' }); // unchanged, not a fresh addition
  const { cleaned, warnings } = stripUnsupportedAdditions(pre, post, [raw, pre], SUMMARY_OPTIONAL_FIELDS.filter(f => f !== 'renderedText'));
  assert(cleaned.effectiveTiming === 'Effective immediately', 'stripUnsupportedAdditions: a field already present pre-rewrite is never touched, even if not independently grounded in raw');
  assert(warnings.length === 0, 'stripUnsupportedAdditions: only NEW additions (absent pre, present post) are checked, not carried-over fields');
}

// ===== Synonym-equivalence-class fix (shall -> must) =====
{
  const grounding = ['The crane shall be inspected before use.'];
  const output = ['The crane must be inspected before use.'];
  const dropped = findDroppedMandatoryTerms(grounding, output);
  assert(dropped.length === 0, 'mandatory-term gate: "shall"->"must" (STE-preferred) is NOT flagged as a dropped mandatory term');
}
{
  const grounding = ['The crane must be inspected before use.'];
  const output = ['The crane should be inspected before use.'];
  const dropped = findDroppedMandatoryTerms(grounding, output);
  assert(dropped.length === 1, 'mandatory-term gate: "must"->"should" (a genuine weakening, not an STE synonym) IS still flagged');
}
{
  const grounding = ['Operators must stop all welding repairs immediately.'];
  const output = ['Operators should consider stopping welding repairs.'];
  const dropped = findDroppedMandatoryTerms(grounding, output);
  assert(dropped.length > 0, 'mandatory-term gate: an actual weakening (must+stop -> should consider) is still caught');
}

// ===== STE deterministic checks =====
{
  const findings = checkApprovedWords('The crane shall be used to lift the tool.', 'instructional');
  assert(findings.some(f => f.message.includes('must')), 'STE approved-word check: flags "shall" and suggests "must"');
}
{
  const findings = checkApprovedWords('Examine the tool before use.', 'instructional');
  assert(findings.length === 0, 'STE approved-word check: an already-approved word ("examine") is not flagged');
}

// ===== Live-reported false positive, 2026-07-23: "may" as a hedge (not
// permission) must not trigger the "can" suggestion in descriptive content =====
{
  const findings = checkApprovedWords('This damage may be due to elevated temperature exposure.', 'descriptive');
  assert(findings.length === 0, 'STE approved-word check: "may" used as a hedge in descriptive text (Summary/Reasons) is NOT flagged -- it is protected uncertainty language, not a permission modal');
}
{
  const findings = checkApprovedWords('Operators may continue using the tool if the risk assessment is complete.', 'instructional');
  assert(findings.some(f => f.message.includes('can')), 'STE approved-word check: "may" used as permission in instructional text (Immediate/Follow-Up Action) IS still flagged, suggesting "can"');
}
{
  const longSentence = 'This is a very long sentence that goes on and on and on with far too many words in a single sentence for the STE descriptive writing guideline of twenty five words to permit without a warning being raised here today.';
  const findings = checkSentenceLength(longSentence, 'descriptive');
  assert(findings.length === 1 && findings[0].rule === 'STE 6.3', 'STE sentence-length check: flags a descriptive sentence over 25 words');
}
{
  const shortSentence = 'Remove the affected plugs from service.';
  const findings = checkSentenceLength(shortSentence, 'instructional');
  assert(findings.length === 0, 'STE sentence-length check: a short instructional sentence is not flagged');
}
{
  const findings = checkContractions("Don't use the affected plugs.");
  assert(findings.length === 1, 'STE contraction check: flags a contraction');
}
{
  const findings = checkSemicolons('Stop the test; remove the tool.');
  assert(findings.length === 1, 'STE semicolon check: flags a semicolon');
}
{
  const findings = runSteChecks(undefined, 'descriptive');
  assert(findings.length === 0, 'STE checks: absent text produces no findings (never invents a warning about nothing)');
}

// ===== Bug fix, 2026-07-28: groundRenderedText -- the paragraph itself was
// previously never grounding-checked, only the re-derived breakdown fields
// (TECHNICAL_ALERT_BUG_REPORT.md finding #3) =====
{
  const raw = 'Creston molded wiper plugs must not be used for HPHT cementing applications.';
  const grounded = ['Creston molded wiper plugs must not be used for HPHT cementing applications.'];
  const result = groundRenderedText('Creston molded wiper plugs must not be used for HPHT cementing applications.', grounded, raw);
  assert(result.text !== undefined && result.warning === null, 'groundRenderedText: a paragraph fully supported by grounding survives with no warning');
}
{
  // Known precision limit (same class as every other token-overlap check in
  // this codebase, e.g. Insight I9/I9a): this catches a paragraph that is
  // SUBSTANTIALLY invented, not a mostly-grounded paragraph with one small
  // invented clause tacked on -- the surrounding grounded words dilute the
  // ratio below the 0.5 threshold in that narrower case. Ship as a warning
  // for exactly this reason (never blocking).
  const raw = 'The plug material was possibly damaged due to elevated temperature exposure.';
  const grounded = ['The plug material was possibly damaged due to elevated temperature exposure.'];
  const invented = 'The regional compliance director has been notified per escalation procedure 4.2 and will file a report with corporate risk management within 24 hours.';
  const result = groundRenderedText(invented, grounded, raw);
  assert(result.text === undefined, 'groundRenderedText: a substantially invented, ungrounded paragraph is dropped entirely (not partially edited)');
  assert(result.warning !== null && result.warning.gate === 'unsupportedAddition', 'groundRenderedText: a warning is raised for the dropped paragraph');
}
{
  const result = groundRenderedText(undefined, ['x'], 'raw text');
  assert(result.text === undefined && result.warning === null, 'groundRenderedText: absent renderedText passes through with no warning (nothing to check)');
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
