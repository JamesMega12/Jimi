// Phase 6 test: the control-info -> dependent-sections computation, extracted
// as a pure function specifically so it's testable without a component-test
// harness. Run with: npx tsx test-technical-alert-v2-control-info-dependency.ts
import { computeDependentSectionsFromControlInfoChange } from './src/components/technical-alert/v2/controlInfoDependency';
import { ControlInformation } from './src/components/technical-alert/v2/types';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}

const base: ControlInformation = {
  deadline: '',
  actionBy: [],
  informationFor: [],
  effectiveTiming: '',
  acknowledgementRequired: false,
  quizRequired: false,
};

// deadline -> summary, immediateAction
{
  const result = computeDependentSectionsFromControlInfoChange(base, { ...base, deadline: '2026-08-01' });
  assert(result.has('summary') && result.has('immediateAction'), 'deadline change marks summary + immediateAction');
  assert(!result.has('reasons') && !result.has('followUpAction'), 'deadline change does NOT mark reasons/followUpAction');
}

// effectiveTiming -> summary only
{
  const result = computeDependentSectionsFromControlInfoChange(base, { ...base, effectiveTiming: 'Effective Immediately' });
  assert(result.has('summary') && result.size === 1, 'effectiveTiming change marks ONLY summary');
}

// actionBy -> immediateAction, followUpAction
{
  const result = computeDependentSectionsFromControlInfoChange(base, { ...base, actionBy: ['Operations'] });
  assert(result.has('immediateAction') && result.has('followUpAction') && !result.has('summary'), 'actionBy change marks immediateAction + followUpAction, not summary');
}

// informationFor -> nothing (admin distribution list, no content dependency)
{
  const result = computeDependentSectionsFromControlInfoChange(base, { ...base, informationFor: ['Engineering'] });
  assert(result.size === 0, 'informationFor change marks NOTHING (distribution-only field)');
}

// acknowledgementRequired/quizRequired -> not tracked dependents at all
{
  const result = computeDependentSectionsFromControlInfoChange(base, { ...base, acknowledgementRequired: true, quizRequired: true });
  assert(result.size === 0, 'acknowledgement/quiz flags are not in CONTROL_INFO_DEPENDENTS, so they mark nothing');
}

// No change at all -> nothing
{
  const result = computeDependentSectionsFromControlInfoChange(base, { ...base });
  assert(result.size === 0, 'no actual change produces no dependents');
}

// Multiple simultaneous changes -> union of all affected sections
{
  const result = computeDependentSectionsFromControlInfoChange(base, { ...base, deadline: '2026-08-01', actionBy: ['Ops'] });
  assert(
    result.has('summary') && result.has('immediateAction') && result.has('followUpAction') && result.size === 3,
    'simultaneous deadline + actionBy changes produce the union of both dependency sets'
  );
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
