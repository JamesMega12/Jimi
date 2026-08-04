// Pure unit tests for the FCO stale-response guard (no server, no API key).
// Wired into `npm test` via test-runner.mjs (test-fco-unit-* glob).
//
// Run directly: npx tsx test-fco-unit-request-guard.ts

import {
  createGuard,
  begin,
  bump,
  isCurrent,
  isInFlight,
  settle,
  ownsLoading,
} from './src/hooks/fcoRequestGuard';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

// 1. Happy path: a request begun and not disturbed is current and can apply.
(() => {
  const g = createGuard();
  const { id } = begin(g);
  assert(isInFlight(g), 'happy: in flight after begin');
  assert(isCurrent(g, id), 'happy: response is current when nothing changed');
  settle(g, id);
  assert(!isInFlight(g), 'happy: not in flight after settle');
  assert(ownsLoading(g, id), 'happy: owns loading after settle (idle) → clears spinner');
})();

// 2. Edit-during-flight: a bump between begin and resolve drops the response.
(() => {
  const g = createGuard();
  const { id } = begin(g);
  bump(g); // user edits the source mid-flight
  assert(!isCurrent(g, id), 'edit-during-flight: stale response is dropped');
  assert(!isInFlight(g), 'edit-during-flight: bump cleared in flight');
  assert(ownsLoading(g, id), 'edit-during-flight: owner check lets the aborted req clear loading');
})();

// 3. Superseded by a newer request: only the newest is current.
(() => {
  const g = createGuard();
  const { id: a } = begin(g);
  const { id: b } = begin(g); // supersedes A (aborts it)
  assert(!isCurrent(g, a), 'superseded: older request A is not current');
  assert(isCurrent(g, b), 'superseded: newer request B is current');
  assert(!ownsLoading(g, a), 'superseded: A does not own loading (B still running)');
  assert(ownsLoading(g, b), 'superseded: B owns loading');
})();

// 4. requestId mismatch is never current.
(() => {
  const g = createGuard();
  begin(g);
  assert(!isCurrent(g, 'not-a-real-id'), 'mismatch: unknown id is not current');
})();

// 5. A settled request cannot resurrect state on a late duplicate.
(() => {
  const g = createGuard();
  const { id } = begin(g);
  settle(g, id);
  assert(!isCurrent(g, id), 'settled: a settled id is no longer current');
})();

// 6. settle() by a superseded request must not clear the newer owner's marker.
(() => {
  const g = createGuard();
  const { id: a } = begin(g);
  const { id: b } = begin(g);
  settle(g, a); // stale A tries to settle
  assert(isInFlight(g), 'settle-guard: stale settle did not clear B');
  assert(isCurrent(g, b), 'settle-guard: B remains current after stale settle');
})();

// 7. revision monotonicity: multiple bumps keep advancing; old ids stay stale.
(() => {
  const g = createGuard();
  const { id } = begin(g);
  bump(g);
  bump(g);
  assert(g.revision === 2, 'monotonic: revision advanced by two bumps');
  assert(!isCurrent(g, id), 'monotonic: original id still stale after repeated bumps');
})();

console.log(`\nfco request guard: ${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
process.exit(failures ? 1 : 0);
