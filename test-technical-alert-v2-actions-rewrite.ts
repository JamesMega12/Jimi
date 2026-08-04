// Phase 3 (Immediate Action + Follow-Up Action vertical slice) tests: the
// per-item instructionText grounding check, and futureTenseGate extended to
// also check instructionText. Run with:
// npx tsx test-technical-alert-v2-actions-rewrite.ts

import { groundInstructionText, futureTenseGate } from './src/server/technicalAlertObligationGates';
import { NormalizedActionItem } from './src/server/technicalAlertNormalizerV2';

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
  return { id: 'i1', actor: [], requiredAction: 'Remove the affected plugs from service.', obligationStrength: 'mandatory', ...overrides };
}

// ===== groundInstructionText =====
{
  const raw = 'Effective immediately, remove the affected plugs from service.';
  const items = [item({ requiredAction: 'Remove the affected plugs from service.', timing: 'Effective immediately', instructionText: 'Effective immediately, remove the affected plugs from service.' })];
  const { cleaned, warnings } = groundInstructionText(items, raw);
  assert(cleaned[0].instructionText === 'Effective immediately, remove the affected plugs from service.', 'groundInstructionText: a well-supported instructionText survives');
  assert(warnings.length === 0, 'groundInstructionText: no warning for a grounded instructionText');
}
{
  const raw = 'Remove the affected plugs from service.';
  const items = [item({ requiredAction: 'Remove the affected plugs from service.', instructionText: 'Notify the regional compliance director and file an incident report within 24 hours of discovery.' })];
  const { cleaned, warnings } = groundInstructionText(items, raw);
  assert(cleaned[0].instructionText === undefined, 'groundInstructionText: an ungrounded instructionText (invented facts) is stripped');
  assert(warnings.length === 1 && warnings[0].gate === 'unsupportedAddition', 'groundInstructionText: a warning is raised for the stripped instructionText');
}
{
  const raw = 'Some unrelated raw text.';
  const items = [item({ requiredAction: 'Do not use the tool.', instructionText: undefined })];
  const { cleaned, warnings } = groundInstructionText(items, raw);
  assert(cleaned[0].instructionText === undefined, 'groundInstructionText: an item with no instructionText at all is left alone (manual/pre-rewrite path)');
  assert(warnings.length === 0, 'groundInstructionText: no warning when there is nothing to check');
}

// ===== futureTenseGate now also checks instructionText =====
{
  const items = [item({
    followUpCategory: 'engineering_change',
    requiredAction: 'Engineering will design and install a revised seal assembly.',
    instructionText: 'The revised seal assembly has been installed by Engineering.', // completed-tense slipped into instructionText only
  })];
  const violations = futureTenseGate(items);
  assert(violations.length === 1, 'futureTenseGate: completed-tense language in instructionText is caught, even when requiredAction is correctly future-phrased');
}
{
  const items = [item({
    followUpCategory: 'engineering_change',
    requiredAction: 'Engineering will design and install a revised seal assembly.',
    instructionText: 'Engineering will design and install a revised seal assembly next quarter.',
  })];
  const violations = futureTenseGate(items);
  assert(violations.length === 0, 'futureTenseGate: correctly future-phrased instructionText raises no violation');
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
