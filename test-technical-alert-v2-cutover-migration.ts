// Phase 9 test: the actual migration integration point used at app startup
// (loadOrMigrateTechnicalAlertStateV2), not just the underlying pure
// migrateTechnicalAlertDraftV1ToV2 function (already covered in Phase 1's
// test-technical-alert-v2-migration.ts). This exercises the real localStorage
// read/write wiring with a minimal shim, since that code is browser-only
// (`typeof window === 'undefined'` guards make it a no-op under plain Node).
// Run with: npx tsx test-technical-alert-v2-cutover-migration.ts

// --- minimal localStorage shim, installed before importing the module under test ---
class FakeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}
(global as any).window = { localStorage: new FakeLocalStorage() };
// Node 24+ already provides global crypto.randomUUID natively; no shim needed.

import { technicalAlertSamplePreset } from './src/components/technical-alert/technicalAlertPreset';
import {
  loadOrMigrateTechnicalAlertStateV2,
  saveTechnicalAlertStateV2,
  clearPersistedTechnicalAlertStateV2,
} from './src/lib/technicalAlertPersistenceV2';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}

function resetStorage() {
  (global.window as any).localStorage = new FakeLocalStorage();
}

// ===== No state at all -> null, no migration =====
resetStorage();
{
  const { state, migrationFindings } = loadOrMigrateTechnicalAlertStateV2();
  assert(state === null && migrationFindings === null, 'fresh install (no localStorage keys): loads null, no migration attempted');
}

// ===== A v1 draft exists, no v2 draft yet -> migration runs =====
resetStorage();
{
  window.localStorage.setItem(
    'ta_workflow_state_v1',
    JSON.stringify({ draft: technicalAlertSamplePreset, uiState: { currentStep: 'step1_control_summary' } })
  );
  const { state, migrationFindings } = loadOrMigrateTechnicalAlertStateV2();
  assert(state !== null, 'v1 draft present, no v2 yet: migration produces a valid v2 state');
  assert(state?.administrativeMetadata.title === technicalAlertSamplePreset.metadata.title, 'migrated state carries over the real title from the v1 sample');
  assert(state?.sections.summary.accepted?.value.subject === technicalAlertSamplePreset.summary.issueOrRestriction, 'migrated state carries over summary content');
  assert(!!migrationFindings && migrationFindings.length > 0, 'migration findings are surfaced (not silently dropped) for the caller to display');
  // Confirm the old v1 key was NOT deleted -- left as a safety net per the migration strategy.
  assert(window.localStorage.getItem('ta_workflow_state_v1') !== null, 'REQUIRED: the old v1 key is left untouched, never deleted, as a safety net');
}

// ===== After saving v2 state, subsequent loads use v2 directly (no re-migration) =====
resetStorage();
{
  window.localStorage.setItem('ta_workflow_state_v1', JSON.stringify({ draft: technicalAlertSamplePreset, uiState: {} }));
  const first = loadOrMigrateTechnicalAlertStateV2();
  saveTechnicalAlertStateV2({
    administrativeMetadata: { ...first.state!.administrativeMetadata, title: 'Manually Edited Title' },
    controlInformation: first.state!.controlInformation,
    supportingContent: first.state!.supportingContent,
    sections: first.state!.sections,
    stage: 'drafting',
  });
  const second = loadOrMigrateTechnicalAlertStateV2();
  assert(second.migrationFindings === null, 'once v2 state is saved, subsequent loads do NOT re-run migration');
  assert(second.state?.administrativeMetadata.title === 'Manually Edited Title', 'subsequent loads read the saved v2 state, not a fresh re-migration of v1');
}

// ===== Corrupt v1 JSON -> fails gracefully, does not throw =====
resetStorage();
{
  window.localStorage.setItem('ta_workflow_state_v1', '{ this is not valid JSON');
  let threw = false;
  let result: ReturnType<typeof loadOrMigrateTechnicalAlertStateV2> | undefined;
  try {
    result = loadOrMigrateTechnicalAlertStateV2();
  } catch {
    threw = true;
  }
  assert(!threw, 'corrupt v1 localStorage content does not throw -- fails open to a fresh start');
  assert(result?.state === null, 'corrupt v1 content results in null state (fresh start), not a crash or garbage data');
}

// ===== clearPersistedTechnicalAlertStateV2 only clears v2, never v1 =====
resetStorage();
{
  window.localStorage.setItem('ta_workflow_state_v1', 'v1-data');
  window.localStorage.setItem('ta_workflow_state_v2', 'v2-data');
  clearPersistedTechnicalAlertStateV2();
  assert(window.localStorage.getItem('ta_workflow_state_v2') === null, 'clearPersistedTechnicalAlertStateV2 clears the v2 key');
  assert(window.localStorage.getItem('ta_workflow_state_v1') === 'v1-data', 'clearPersistedTechnicalAlertStateV2 never touches the v1 key');
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
