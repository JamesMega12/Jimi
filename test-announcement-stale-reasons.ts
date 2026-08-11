// Unit tests for Announcement's structured stale-reason model: staleReasons()
// codes, the isStale()/staleReasons() parity that guards every existing
// caller, the transitions that set/clear the cause, and describeStaleReasons
// wording. Mirrors test-technical-alert-v2-stale-reasons.ts, trimmed to
// Announcement's 1-member StaleReasonCode union ('self-edit' only -- see
// lib/sectionLifecycle.ts's header comment for why 'control-change' and
// 'neighbor-change' don't apply here).
// Run with: npx tsx test-announcement-stale-reasons.ts

import {
  createEmptySectionWorkspace,
  editRaw,
  editComponents,
  acceptSuggestion,
  manualAccept,
  editAcceptedDirectly,
  applySuggestion,
  staleReasons,
  isStale,
} from "./src/components/announcement/lib/sectionLifecycle";
import { describeStaleReasons } from "./src/components/announcement/announcementStaleReasonCopy";
import { SectionWorkspace } from "./src/components/announcement/announcementTypes";

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

function acceptedWs(stale: boolean): SectionWorkspace<string, string> {
  const ws = createEmptySectionWorkspace<string, string>();
  ws.accepted = { value: "v", source: "manual", basedOn: ws.currentRevision, acceptedAt: new Date().toISOString() };
  if (stale) ws.freshness = "stale";
  return ws;
}

// ===== staleReasons() codes: fresh vs. stale =====
assert(eqArr(staleReasons({ freshness: "fresh" }), []), "fresh -> no reasons");
assert(eqArr(staleReasons({ freshness: "stale" }), ["self-edit"]), "stale -> self-edit");

// ===== isStale()/staleReasons() parity =====
assert(isStale(acceptedWs(false)) === (staleReasons(acceptedWs(false)).length > 0), "isStale agrees with staleReasons when fresh");
assert(isStale(acceptedWs(true)) === (staleReasons(acceptedWs(true)).length > 0), "isStale agrees with staleReasons when stale");

// ===== Transitions that SET the cause =====
{
  const accepted = acceptedWs(false);
  assert(staleReasons(editRaw(accepted, "new raw")).includes("self-edit"), "editRaw on accepted content sets self-edit");
  assert(staleReasons(editComponents(accepted, "new comps")).includes("self-edit"), "editComponents on accepted content sets self-edit");
}

// ===== Transitions that CLEAR the cause (re-acceptance) =====
{
  const dirty = acceptedWs(true);
  const dirtyWithSuggestion = applySuggestion(dirty, "newval", "r1");

  for (const [label, next] of [
    ["acceptSuggestion", acceptSuggestion(dirtyWithSuggestion)],
    ["manualAccept", manualAccept(dirty, "manual")],
    ["editAcceptedDirectly", editAcceptedDirectly(dirty, "edited")],
  ] as const) {
    assert(eqArr(staleReasons(next), []), `${label} clears the stale cause`);
  }
}

// ===== describeStaleReasons wording =====
assert(eqArr(describeStaleReasons({ freshness: "fresh" }), []), "describeStaleReasons: fresh -> no clauses");
assert(
  describeStaleReasons({ freshness: "stale" })[0] === "you edited this section after accepting it",
  "describeStaleReasons: stale -> self-edit clause"
);

console.log(failures === 0 ? "\nAll Announcement stale-reason tests passed." : `\n${failures} stale-reason test(s) FAILED.`);
process.exit(failures ? 1 : 0);
