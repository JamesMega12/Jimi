// Announcement Reason vertical-slice assertions (Phase 2).
// Run: npx tsx test-announcement-reason.ts
// Pure, deterministic checks -- no server or API key required.

import { normalizeReasonResult } from "./src/server/announcementNormalizer";
import { resolveCauseStatus, uncertaintyPreservationWarnings } from "./src/server/announcementGrounding";
import { buildAnnouncementSnapshot } from "./src/components/announcement/announcementSnapshot";
import { computeAnnouncementReadiness } from "./src/components/announcement/announcementReadiness";

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

const meta = { title: "T", announcementNumber: "WCF-AN 2026-02", inTouchId: "1", date: "d", gemsNo: "N/A", classification: "SLB-Private" };
const supportingContent = { figures: [] };
const okSummary = { accepted: { value: { centralMessage: "m", renderedText: "M." } }, freshness: "fresh" as const };

console.log("\nnormalizeReasonResult:");
{
  const r = normalizeReasonResult({ rationale: " because ", triggeringObservation: "", causeStatus: "suspected", junk: 1 });
  assert(r.rationale === "because" && r.triggeringObservation === undefined && r.causeStatus === "suspected", "trims, drops empty optional, keeps valid causeStatus");
  const bad = normalizeReasonResult({ rationale: "x", causeStatus: "totally-made-up" });
  assert(bad.causeStatus === undefined, "invalid causeStatus dropped");
  const none = normalizeReasonResult({ rationale: "objectives only" });
  assert(none.causeStatus === undefined, "no causeStatus when none asserted (objectives-style)");
}

console.log("\nresolveCauseStatus (certainty preservation):");
{
  const up = resolveCauseStatus("suspected", "confirmed", false);
  assert(up.causeStatus === "suspected" && up.warning !== null, "silent upgrade suspected->confirmed reverted + warned");
  const upOk = resolveCauseStatus("suspected", "confirmed", true);
  assert(upOk.causeStatus === "confirmed" && upOk.warning === null, "upgrade allowed when user edited");
  const down = resolveCauseStatus("confirmed", "suspected", false);
  assert(down.causeStatus === "suspected" && down.warning === null, "downgrade toward less certainty allowed");
  const same = resolveCauseStatus("preliminary", "preliminary", false);
  assert(same.causeStatus === "preliminary" && same.warning === null, "unchanged status passes");
  const introduced = resolveCauseStatus(undefined, "confirmed", false);
  assert(introduced.causeStatus === "confirmed", "no pre status => post passes (introduction handled by prompt/null-grounding)");
}

console.log("\nuncertaintyPreservationWarnings:");
{
  const dropped = uncertaintyPreservationWarnings(["preliminary findings indicate a seal issue"], [{ renderedText: "The seal issue is caused by poor manufacturing." }]);
  assert(dropped.length === 1, "source hedged + output not hedged => warning");
  const kept = uncertaintyPreservationWarnings(["preliminary findings indicate a seal issue"], [{ renderedText: "Preliminary findings indicate a seal issue." }]);
  assert(kept.length === 0, "hedge preserved => no warning");
  const paraphrased = uncertaintyPreservationWarnings(["the cause is suspected"], [{ renderedText: "The cause may be the seal." }]);
  assert(paraphrased.length === 0, "hedge paraphrased (suspected->may) still counts as preserved");
  const neverHedged = uncertaintyPreservationWarnings(["standardize the process for all locations"], [{ renderedText: "All locations must standardize the process." }]);
  assert(neverHedged.length === 0, "non-hedged source => no uncertainty warning");
}

const okAction = { accepted: { value: { items: [{ id: "1", kind: "requirement" as const, text: "do x" }] } }, freshness: "fresh" as const };
function view(p: any = {}) { return { summary: okSummary, reason: { accepted: { value: { rationale: "r" } }, freshness: "fresh" as const }, action: okAction, ...p }; }

console.log("\nReason readiness + snapshot:");
{
  const noReason = computeAnnouncementReadiness({ metadata: meta, supportingContent, sections: view({ reason: { accepted: null, freshness: "fresh" } }) });
  assert(noReason.status === "Blocked" && noReason.blockingIssues.some((i) => /reason has no accepted/i.test(i)), "no accepted Reason => Blocked");

  const ok = computeAnnouncementReadiness({ metadata: meta, supportingContent, sections: view({ reason: { accepted: { value: { rationale: "r", renderedText: "R." } }, freshness: "fresh" } }) });
  assert(ok.blockingIssues.length === 0, "all sections accepted + title => not blocked");

  const staleReason = computeAnnouncementReadiness({ metadata: meta, supportingContent, sections: view({ reason: { accepted: { value: { rationale: "r" } }, freshness: "stale" } }) });
  assert(staleReason.blockingIssues.some((i) => /reason is accepted but needs another look/i.test(i)), "stale accepted Reason => Blocked");

  const suspectedNoObs = computeAnnouncementReadiness({ metadata: meta, supportingContent, sections: view({ reason: { accepted: { value: { rationale: "r", causeStatus: "suspected" } }, freshness: "fresh" } }) });
  assert(suspectedNoObs.warnings.some((w) => /suspected cause/i.test(w)), "suspected cause with no triggering observation => warning");

  const snap = buildAnnouncementSnapshot({ metadata: meta, supportingContent, sections: view({ reason: { accepted: { value: { rationale: "r", renderedText: "Reason prose.", causeStatus: "preliminary" } }, freshness: "fresh" } }) });
  assert(snap.reason?.renderedText === "Reason prose." && snap.reason?.causeStatus === "preliminary", "snapshot carries accepted Reason incl. causeStatus");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
