// Announcement persistence assertions (Phase E). Pure -- mocks localStorage.
// Run: npx tsx test-announcement-persistence.ts

const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  },
};

import { loadAnnouncementState, saveAnnouncementState, clearAnnouncementState } from "./src/lib/announcementPersistence";
import { createEmptySectionWorkspace } from "./src/components/announcement/lib/sectionLifecycle";
import type { AnnouncementDraft } from "./src/components/announcement/announcementTypes";

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

function makeDraft(): AnnouncementDraft {
  return {
    documentType: "Announcement",
    schemaVersion: 1,
    identity: { id: "id1", createdAt: "t" },
    metadata: { title: "My Announcement", announcementNumber: "WCF-AN 2026-01", inTouchId: "", date: "", gemsNo: "", classification: "SLB-Private" },
    sections: {
      summary: {
        ...createEmptySectionWorkspace(),
        raw: "rough summary notes",
        accepted: { value: { centralMessage: "the message" }, source: "manual", basedOn: { revision: 1 }, acceptedAt: "t" },
        // transient fields that must NOT be restored:
        loading: true,
        inFlightRequest: { requestId: "x", revisionAtRequestTime: { revision: 1 } },
        error: "boom",
      },
      reason: createEmptySectionWorkspace(),
      action: createEmptySectionWorkspace(),
    },
    workflow: { currentStage: "drafting" },
  } as AnnouncementDraft;
}

console.log("\nsave / load round-trip:");
{
  store.clear();
  assert(loadAnnouncementState() === null, "no state => null");

  saveAnnouncementState(makeDraft(), "details");
  const r = loadAnnouncementState();
  assert(r !== null, "loads after save");
  assert(r!.stage === "details", "stage restored");
  assert(r!.draft.metadata.title === "My Announcement", "metadata restored");
  assert(r!.draft.sections.summary.raw === "rough summary notes", "raw source restored");
  assert(r!.draft.sections.summary.accepted?.value.centralMessage === "the message", "accepted content restored");
}

console.log("\ntransient fields sanitized on load (no stuck spinner):");
{
  const r = loadAnnouncementState()!;
  assert(r.draft.sections.summary.loading === false, "loading reset to false");
  assert(r.draft.sections.summary.inFlightRequest === null, "inFlightRequest reset to null");
  assert(r.draft.sections.summary.error === null, "error reset to null");
}

console.log("\nclear:");
{
  clearAnnouncementState();
  assert(loadAnnouncementState() === null, "cleared => null");
}

console.log("\ncorrupt / version guards => fresh start (never throw):");
{
  store.set("announcement_workflow_state_v1", "{not valid json");
  assert(loadAnnouncementState() === null, "corrupt JSON => null");
  store.set("announcement_workflow_state_v1", JSON.stringify({ schemaVersion: 99, draft: {}, stage: "drafting" }));
  assert(loadAnnouncementState() === null, "wrong schemaVersion => null");
  store.set("announcement_workflow_state_v1", JSON.stringify({ schemaVersion: 1, stage: "drafting" }));
  assert(loadAnnouncementState() === null, "missing draft.sections => null");
}

console.log("\nquota-full degrades gracefully (no throw):");
{
  store.clear();
  const original = (globalThis as any).window.localStorage.setItem;
  (globalThis as any).window.localStorage.setItem = () => { throw new DOMException("QuotaExceededError"); };
  let threw = false;
  try { saveAnnouncementState(makeDraft(), "drafting"); } catch { threw = true; }
  (globalThis as any).window.localStorage.setItem = original;
  assert(!threw, "save does not throw when quota is exceeded");
  assert(loadAnnouncementState() === null, "nothing persisted, but session unaffected");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
