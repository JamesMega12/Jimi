// Test for Technical Alert V2 Clear Draft flow
// Verifies that clearing the draft removes both V2 and V1 keys,
// preventing the "old draft resurrected" bug.

import { clearPersistedTechnicalAlertStateV2, saveTechnicalAlertStateV2, loadOrMigrateTechnicalAlertStateV2 } from './src/lib/technicalAlertPersistenceV2';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}

// Mock window and localStorage
const mockStorage = new Map<string, string>();
global.window = {
  localStorage: {
    getItem: (k: string) => mockStorage.get(k) || null,
    setItem: (k: string, v: string) => mockStorage.set(k, v),
    removeItem: (k: string) => mockStorage.delete(k)
  }
} as any;

console.log("=== Testing Clear Draft Persistence ===");

// Seed V1 state (the old draft)
mockStorage.set('ta_workflow_state_v1', JSON.stringify({ draft: { title: 'Old V1 Draft' } }));

// Clear draft (what happens when the user clicks the button)
clearPersistedTechnicalAlertStateV2();

assert(!mockStorage.has('ta_workflow_state_v2'), 'V2 key should be removed');
assert(!mockStorage.has('ta_workflow_state_v1'), 'V1 key should be removed to prevent resurrection');

// Verify that if we navigate away and come back, it doesn't load V1
const result = loadOrMigrateTechnicalAlertStateV2();
assert(result.state === null, 'Load result should be null (clean state)');

if (failures > 0) {
  console.error(`\nFAILED: ${failures} assertions failed.`);
  process.exit(1);
} else {
  console.log('\nSUCCESS: All tests passed.');
}
