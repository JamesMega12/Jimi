// Unit tests for computeChangedGroundedNeighbors -- the fix for neighbor-change
// staleness firing when a neighbor was UNACCEPTED at Summary-grounding time and
// is accepted later (the Summary was never written from it). Run with:
// npx tsx test-technical-alert-v2-summary-grounding.ts
import { computeChangedGroundedNeighbors } from './src/components/technical-alert/v2/summaryGrounding';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}
function eqArr<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// The bug: a neighbor unaccepted at grounding time (null) that is accepted later
// must NOT be flagged -- the Summary was never grounded on it.
assert(
  eqArr(computeChangedGroundedNeighbors({ reasons: null }, { reasons: '{"x":1}' }), []),
  'neighbor unaccepted at grounding time then accepted later is NOT flagged',
);

// A neighbor missing entirely from the snapshot behaves like null (not grounded).
assert(
  eqArr(computeChangedGroundedNeighbors({}, { reasons: '{"x":1}' }), []),
  'neighbor absent from grounding snapshot is NOT flagged',
);

// A genuinely grounded neighbor whose content changed IS flagged.
assert(
  eqArr(computeChangedGroundedNeighbors({ reasons: '{"x":1}' }, { reasons: '{"x":2}' }), ['reasons']),
  'grounded neighbor whose content changed IS flagged',
);

// A grounded neighbor later removed (value -> null) IS flagged.
assert(
  eqArr(computeChangedGroundedNeighbors({ reasons: '{"x":1}' }, { reasons: null }), ['reasons']),
  'grounded neighbor later removed (value -> null) IS flagged',
);

// A grounded neighbor that is unchanged is NOT flagged.
assert(
  eqArr(computeChangedGroundedNeighbors({ reasons: '{"x":1}' }, { reasons: '{"x":1}' }), []),
  'grounded neighbor with identical content is NOT flagged',
);

// Undefined grounding snapshot -> nothing flagged.
assert(
  eqArr(computeChangedGroundedNeighbors(undefined, { reasons: '{"x":1}' }), []),
  'undefined grounding snapshot yields no changed neighbors',
);

// Mixed: only the grounded-and-changed neighbors are returned, in key order.
assert(
  eqArr(
    computeChangedGroundedNeighbors(
      { reasons: '{"a":1}', immediateAction: null, followUpAction: '{"b":1}' },
      { reasons: '{"a":2}', immediateAction: '{"c":1}', followUpAction: '{"b":1}' },
    ),
    ['reasons'],
  ),
  'mixed set returns only grounded neighbors that actually changed (reasons), excluding null->value (immediateAction) and unchanged (followUpAction)',
);

console.log(failures === 0 ? '\nAll summary-grounding tests passed.' : `\n${failures} summary-grounding test(s) FAILED.`);
process.exit(failures ? 1 : 0);
