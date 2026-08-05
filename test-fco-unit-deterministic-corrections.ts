// Pure unit test for the deterministic writing-convention auto-correct pass
// (src/server/deterministicRules/). Verifies unit-notation and abbreviation
// rules are enforced over reworded fields, the numeric value is never altered,
// verbatim carry-through fields are untouched, corrections are recorded, and
// the pass is idempotent. Offline, no server, no API key.
//   run: npx tsx test-fco-unit-deterministic-corrections.ts
import path from 'path';
import { makeAsserter } from './test-support/systemKnowledgeTestHarness';

// Point the loader at the committed rule set (test-runner runs from repo root).
process.env.JIMI_DETERMINISTIC_RULES_DIR = path.join(process.cwd(), 'data', 'deterministicRules');

const { assert, finish } = makeAsserter();

async function main() {
  const { applyDeterministicCorrections } = await import('./src/server/deterministicRules/autoCorrectPass');
  const { loadDeterministicRules, _resetDeterministicRulesCache } = await import('./src/server/deterministicRules/ruleLookup');
  _resetDeterministicRulesCache();

  const ruleSet = loadDeterministicRules();
  assert(ruleSet.rules.length > 0, `rule set loaded (${ruleSet.rules.length} rules, v=${ruleSet.version})`);

  // --- Case 1: unit notation in summary, number preserved ---
  const draft1: any = {
    rewrittenSummary: {
      paragraph: 'Heat the component to 50°C, then verify at 109°C [228°F] before install.',
    },
    rewrittenProcedure: {
      sections: [{ title: 'A', steps: ['Warm the seal to 50 degrees Celsius.', 'Confirm the reading is 200 degrees F.'] }],
    },
    whatWasEdited: { summaryWordingEdits: ['Changed "50°C" wording'] },
    // verbatim carry-through: must NOT be touched
    rewrittenProcedure_parts: undefined,
  };
  draft1.rewrittenProcedure.partsInvolved = [{ identifier: 'PART-50°C-SPEC', name: 'seal' }];

  const r1 = applyDeterministicCorrections(draft1);
  assert(draft1.rewrittenSummary.paragraph.includes('50 degC'), 'summary: 50°C -> 50 degC');
  assert(draft1.rewrittenSummary.paragraph.includes('109 degC'), 'summary: 109°C -> 109 degC (multi-digit number preserved)');
  assert(draft1.rewrittenSummary.paragraph.includes('228 degF'), 'summary: 228°F -> 228 degF');
  assert(!draft1.rewrittenSummary.paragraph.includes('°C') && !draft1.rewrittenSummary.paragraph.includes('°F'), 'summary: no ° symbols remain');
  assert(draft1.rewrittenProcedure.sections[0].steps[0].includes('50 degC'), 'procedure step: "50 degrees Celsius" -> "50 degC"');
  assert(draft1.rewrittenProcedure.sections[0].steps[1].includes('200 degF'), 'procedure step: "200 degrees F" -> "200 degF"');
  assert(draft1.whatWasEdited.summaryWordingEdits[0].includes('50 degC'), 'whatWasEdited log is corrected to match returned text');

  // number magnitude integrity: 109 stays 109, not 10 / 1099 / etc.
  assert(/\b109 degC\b/.test(draft1.rewrittenSummary.paragraph), 'exact number 109 preserved (not split or merged)');

  // verbatim carry-through untouched
  assert(draft1.rewrittenProcedure.partsInvolved[0].identifier === 'PART-50°C-SPEC', 'verbatim part identifier is NOT corrected');

  // corrections recorded with field + ruleId
  assert(r1.corrections.length > 0, `corrections recorded (${r1.corrections.length})`);
  assert(r1.corrections.every((c: any) => c.field && c.ruleId && c.ruleType), 'every correction has field + ruleId + ruleType');
  assert(r1.corrections.some((c: any) => c.field === 'rewrittenSummary.paragraph' && c.ruleId === 'unit-degC'), 'a correction is attributed to rewrittenSummary.paragraph / unit-degC');

  // --- Case 2: idempotency ---
  const r1again = applyDeterministicCorrections(draft1);
  assert(r1again.corrections.length === 0, 'second pass makes zero further corrections (idempotent)');

  // --- Case 3: bare angular "degrees" must NOT be touched ---
  const draft3: any = { rewrittenSummary: { paragraph: 'Rotate the valve 90 degrees clockwise.' } };
  const r3 = applyDeterministicCorrections(draft3);
  assert(draft3.rewrittenSummary.paragraph === 'Rotate the valve 90 degrees clockwise.', 'bare angular "90 degrees" is NOT converted to a temperature unit');
  assert(r3.corrections.length === 0, 'no corrections for angular degrees');

  // --- Case 4: abbreviation rule ---
  const draft4: any = { rewrittenSummary: { paragraph: 'Schlumberger personnel completed the job.' } };
  applyDeterministicCorrections(draft4);
  assert(draft4.rewrittenSummary.paragraph === 'SLB personnel completed the job.', 'abbreviation: "Schlumberger" -> "SLB"');

  // --- Case 5: clean input is a no-op ---
  const draft5: any = { rewrittenSummary: { paragraph: 'Install the new clamp at 50 degC and record completion.' } };
  const r5 = applyDeterministicCorrections(draft5);
  assert(r5.corrections.length === 0, 'already-correct text produces zero corrections');
  assert(draft5.rewrittenSummary.paragraph === 'Install the new clamp at 50 degC and record completion.', 'already-correct text is unchanged');

  finish('deterministic writing-convention corrections');
}

main().catch((e) => { console.error(e); process.exit(1); });
