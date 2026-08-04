// Pure unit test for FCO draft persistence (Phase 4). Mocks localStorage (Node
// has no window) and verifies: round-trip of the canonical draft + step,
// clear(), and that corrupt / wrong-schema / shapeless payloads fall through to
// a fresh start (null) instead of partially restoring. The step is clamped to a
// valid page.
//
// Run: npx tsx test-fco-unit-persistence.ts

const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  },
};

import { loadFcoState, saveFcoState, clearFcoState } from './src/lib/fcoPersistence';

const KEY = 'fco_workflow_state_v1'; // must match fcoPersistence.ts

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

function reset() { store.clear(); }

const draft: any = {
  title: 'SLB-400 O-ring Upgrade',
  rawSummary: 'raw',
  fcoDraft: {
    fcoMetadata: { fcoTitle: 'SLB-400 O-ring Upgrade', priority: 'Required' },
    technicalContent: { draftSummary: 'raw summary', acceptedSummary: 'ACCEPTED summary paragraph.' },
  },
};

console.log('\nEmpty store:');
reset();
assert(loadFcoState() === null, 'load with nothing stored returns null');

console.log('\nRound-trip:');
reset();
saveFcoState(draft, 2);
const loaded = loadFcoState();
assert(!!loaded, 'load after save returns a value');
assert(loaded?.currentStep === 2, 'currentStep round-trips');
assert(loaded?.formData?.fcoDraft?.technicalContent?.acceptedSummary === 'ACCEPTED summary paragraph.', 'accepted canonical content round-trips');
assert(loaded?.formData?.title === 'SLB-400 O-ring Upgrade', 'top-level draft field round-trips');

console.log('\nclear():');
clearFcoState();
assert(loadFcoState() === null, 'load after clear returns null');

console.log('\nCorrupt / incompatible payloads fall through to fresh start:');
reset();
store.set(KEY, '{not valid json');
assert(loadFcoState() === null, 'corrupt JSON returns null (no throw)');

reset();
store.set(KEY, JSON.stringify({ schemaVersion: 2, formData: draft, currentStep: 1 }));
assert(loadFcoState() === null, 'wrong schemaVersion returns null');

reset();
store.set(KEY, JSON.stringify({ schemaVersion: 1, formData: { title: 'x' }, currentStep: 1 }));
assert(loadFcoState() === null, 'missing fcoDraft returns null (shape guard)');

console.log('\nStep clamping:');
reset();
store.set(KEY, JSON.stringify({ schemaVersion: 1, formData: draft, currentStep: 99 }));
assert(loadFcoState()?.currentStep === 1, 'out-of-range step clamps to 1');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
