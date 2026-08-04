// Announcement Summary vertical-slice assertions (Phase 1).
// Run: npx tsx test-announcement-summary.ts
// No server or API key required -- these are pure, deterministic checks over the
// section-lifecycle engine, the readiness rules, and the snapshot builder.

import {
  createEmptySectionWorkspace,
  editRaw,
  editComponents,
  beginRequest,
  applyAnalysisResult,
  applySuggestion,
  acceptSuggestion,
  manualAccept,
  dismissSuggestion,
  isResponseCurrent,
  isStale,
} from "./src/components/announcement/lib/sectionLifecycle";
import { SummaryAccepted } from "./src/components/announcement/announcementTypes";
import { buildAnnouncementSnapshot, isAnnouncementSnapshotExportable } from "./src/components/announcement/announcementSnapshot";
import { computeAnnouncementReadiness } from "./src/components/announcement/announcementReadiness";
import {
  stripUnsupportedAdditions,
  groundRenderedText,
  identifierInventionWarnings,
} from "./src/server/announcementGrounding";

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

type Ws = ReturnType<typeof createEmptySectionWorkspace<SummaryAccepted, SummaryAccepted>>;
const meta = { title: "T", announcementNumber: "WCF-AN 2026-01", inTouchId: "1", date: "d", gemsNo: "N/A", classification: "SLB-Private" };

console.log("\nSection lifecycle:");
{
  let ws = createEmptySectionWorkspace<SummaryAccepted, SummaryAccepted>();
  assert(ws.currentRevision.revision === 0 && ws.accepted === null, "empty workspace starts fresh, unaccepted, rev 0");

  ws = editRaw(ws, "some rough notes");
  assert(ws.currentRevision.revision === 1, "editRaw bumps revision");

  // analyze round-trip with stale-response guard
  const reqA = "req-a";
  ws = beginRequest(ws, reqA);
  assert(isResponseCurrent(ws, reqA), "response is current right after beginRequest");
  const wsEditedMidflight = editRaw(ws, "edited while request in flight");
  assert(!isResponseCurrent(wsEditedMidflight, reqA), "stale-response guard: edit during flight invalidates the response");

  ws = applyAnalysisResult(ws, { centralMessage: "core message" }, []);
  assert(ws.analysis.components?.centralMessage === "core message" && ws.accepted === null, "analysis populates components, never accepted");

  // rewrite -> pending suggestion -> accept
  const reqR = "req-r";
  ws = beginRequest(ws, reqR);
  ws = applySuggestion(ws, { centralMessage: "core message", renderedText: "A polished paragraph." }, reqR);
  assert(ws.suggestion.value !== null && ws.accepted === null, "rewrite lands as pending suggestion, not accepted");

  const beforeAccept = ws;
  ws = acceptSuggestion(ws);
  assert(ws.accepted?.value.renderedText === "A polished paragraph." && ws.accepted.source === "ai", "accept promotes suggestion to accepted (source ai)");
  assert(ws.suggestion.value === null, "accept clears the pending suggestion");
  assert(!isStale(ws), "freshly accepted content is not stale");

  // editing raw after acceptance stales, does not delete
  const wsAfterEdit = editRaw(ws, "changed source after acceptance");
  assert(wsAfterEdit.accepted !== null && isStale(wsAfterEdit), "editing raw after acceptance keeps accepted but marks stale");

  // editComponents drops any pending suggestion
  const wsWithPending = applySuggestion(beginRequest(beforeAccept, "x"), { centralMessage: "y" }, "x");
  const wsAfterComp = editComponents(wsWithPending, { centralMessage: "hand edited" });
  assert(wsAfterComp.suggestion.value === null, "editComponents discards pending suggestion");

  // manual accept path
  let wm = createEmptySectionWorkspace<SummaryAccepted, SummaryAccepted>();
  wm = editRaw(wm, "typed final content");
  wm = editComponents(wm, { centralMessage: "manual central message" });
  wm = manualAccept(wm, wm.analysis.components!);
  assert(wm.accepted?.source === "manual", "manualAccept records source 'manual'");

  // dismiss keeps prior accepted
  let wd = acceptSuggestion(applySuggestion(beginRequest(applyAnalysisResult(editRaw(createEmptySectionWorkspace<SummaryAccepted, SummaryAccepted>(), "r"), { centralMessage: "c" }, []), "d"), { centralMessage: "c", renderedText: "p" }, "d"));
  const reqD2 = "d2";
  wd = applySuggestion(beginRequest(wd, reqD2), { centralMessage: "c2", renderedText: "p2" }, reqD2);
  wd = dismissSuggestion(wd);
  assert(wd.suggestion.value === null && wd.accepted?.value.renderedText === "p", "dismiss drops suggestion, keeps prior accepted");
}

// Satisfied non-focus sections, so Summary-focused cases isolate summary/title
// (Reason and Action are separately-required sections since Phase 2/3). `view`
// fills defaults; each case overrides only the section it is testing.
const okSummary = { accepted: { value: { centralMessage: "hello", renderedText: "Hello paragraph." } }, freshness: "fresh" as const };
const okReason = { accepted: { value: { rationale: "because" } }, freshness: "fresh" as const };
const okAction = { accepted: { value: { items: [{ id: "1", kind: "requirement" as const, text: "do x" }] } }, freshness: "fresh" as const };
function view(p: any = {}) { return { summary: okSummary, reason: okReason, action: okAction, ...p }; }

console.log("\nReadiness:");
{
  const r1 = computeAnnouncementReadiness({ metadata: meta, sections: view({ summary: { accepted: null, freshness: "fresh" } }) });
  assert(r1.status === "Blocked" && r1.blockingIssues.some((i) => /summary has no accepted/i.test(i)), "no accepted Summary => Blocked");

  const r2 = computeAnnouncementReadiness({ metadata: meta, sections: view() });
  assert(r2.blockingIssues.length === 0, "all sections accepted + title => not blocked");

  const r3 = computeAnnouncementReadiness({ metadata: meta, sections: view({ summary: { accepted: { value: { centralMessage: "hello" } }, freshness: "stale" } }) });
  assert(r3.status === "Blocked" && r3.blockingIssues.some((i) => /summary was edited/i.test(i)), "stale accepted Summary => Blocked");

  const noTitle = computeAnnouncementReadiness({ metadata: { ...meta, title: "" }, sections: view() });
  assert(noTitle.blockingIssues.some((i) => /title/i.test(i)), "missing title => Blocked");

  const noReason = computeAnnouncementReadiness({ metadata: meta, sections: view({ reason: { accepted: null, freshness: "fresh" } }) });
  assert(noReason.blockingIssues.some((i) => /reason has no accepted/i.test(i)), "no accepted Reason => Blocked");

  const noAction = computeAnnouncementReadiness({ metadata: meta, sections: view({ action: { accepted: null, freshness: "fresh" } }) });
  assert(noAction.blockingIssues.some((i) => /action has no accepted/i.test(i)), "no accepted Action => Blocked");
}

console.log("\nSnapshot (review == export source):");
{
  const snap = buildAnnouncementSnapshot({ metadata: meta, sections: view({ summary: { accepted: { value: { centralMessage: "msg", renderedText: "Para." } }, freshness: "fresh" } }) });
  assert(snap.summary?.renderedText === "Para.", "snapshot reads accepted summary value");
  assert(isAnnouncementSnapshotExportable(snap) === (snap.readiness.blockingIssues.length === 0), "isExportable agrees with readiness blocking issues");

  const blockedSnap = buildAnnouncementSnapshot({ metadata: { ...meta, title: "" }, sections: view() });
  assert(!isAnnouncementSnapshotExportable(blockedSnap), "snapshot not exportable when readiness blocks");
}

console.log("\nGrounding backstops:");
{
  // stripUnsupportedAdditions: an invented optional field absent from grounding is stripped.
  const pre = { centralMessage: "valve seal issue", affectedScope: undefined as string | undefined };
  const post = { centralMessage: "valve seal issue", affectedScope: "Completely unrelated helicopter rotor assemblies worldwide" };
  const { cleaned, warnings } = stripUnsupportedAdditions(pre, post, ["valve seal issue on pump"], ["affectedScope"]);
  assert(cleaned.affectedScope === undefined && warnings.length === 1, "stripUnsupportedAdditions removes an ungrounded invented field");

  // supported addition survives
  const post2 = { centralMessage: "valve seal issue", affectedScope: "valve seal" };
  const { cleaned: c2, warnings: w2 } = stripUnsupportedAdditions(pre, post2, ["the valve seal on the pump failed"], ["affectedScope"]);
  assert(c2.affectedScope === "valve seal" && w2.length === 0, "stripUnsupportedAdditions keeps a grounded field");

  // groundRenderedText drops an unsupported paragraph
  const g1 = groundRenderedText("Unrelated marketing copy about quarterly revenue targets and shareholders.", ["valve seal"], "valve seal failed on pump");
  assert(g1.text === undefined && g1.warning !== null, "groundRenderedText drops an unsupported paragraph");
  const g2 = groundRenderedText("The valve seal failed on the pump.", ["valve seal"], "valve seal failed on pump");
  assert(g2.text !== undefined && g2.warning === null, "groundRenderedText keeps a supported paragraph");

  // identifier invention warning
  const idw = identifierInventionWarnings(["replace grease fitting"], [{ renderedText: "Replace part PN 999888 immediately." }]);
  assert(idw.length === 1 && /999888/.test(idw[0].message), "identifierInventionWarnings flags an invented part number");
  const idw2 = identifierInventionWarnings(["remove part PN 816345"], [{ renderedText: "Remove part PN 816345." }]);
  assert(idw2.length === 0, "identifierInventionWarnings does not flag a preserved source identifier");
  // Regression (live false positive): source "PN 816345", output drops the PN
  // prefix -> the bare number is still grounded, must NOT be flagged.
  const idw3 = identifierInventionWarnings(["old part grease fitting PN 816345 do not order"], [{ renderedText: "Old part number 816345 should no longer be ordered." }]);
  assert(idw3.length === 0, "identifierInventionWarnings does not flag a number whose PN-prefixed form is in the source");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
