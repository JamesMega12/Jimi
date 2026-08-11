// Announcement Action vertical-slice assertions (Phase 3).
// Run: npx tsx test-announcement-action.ts
// Pure, deterministic checks -- no server or API key required.

import { normalizeActionResult } from "./src/server/announcementNormalizer";
import { actionStructureWarnings, identifierInventionWarnings } from "./src/server/announcementGrounding";
import { actionItemLine } from "./src/components/announcement/announcementActionRender";
import { buildAnnouncementSnapshot } from "./src/components/announcement/announcementSnapshot";
import { computeAnnouncementReadiness } from "./src/components/announcement/announcementReadiness";

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

const meta = { title: "T", announcementNumber: "WCF-AN 2026-01", inTouchId: "1", date: "d", gemsNo: "N/A", classification: "SLB-Private" };
const supportingContent = { figures: [] };
const okSummary = { accepted: { value: { centralMessage: "m", renderedText: "M." } }, freshness: "fresh" as const };
const okReason = { accepted: { value: { rationale: "r" } }, freshness: "fresh" as const };

console.log("\nnormalizeActionResult:");
{
  const r = normalizeActionResult({ lead: " Do the following. ", items: [
    { kind: "restriction", text: "Do not order PN 816345." },
    { kind: "bogus-kind", text: "Replace with a plug." },
    { kind: "operator", text: "" },
    { text: "Record in InTrack by 31 Dec 2026.", deadline: "31 Dec 2026" },
  ]});
  assert(r.lead === "Do the following.", "lead trimmed");
  assert(r.items.length === 3, "empty-text items dropped");
  assert(r.items[0].kind === "restriction", "valid kind kept");
  assert(r.items[1].kind === "requirement", "unknown kind defaults to requirement (item not dropped)");
  assert(typeof r.items[0].id === "string" && r.items[0].id.length > 0, "ids assigned");
  assert(r.items[2].deadline === "31 Dec 2026", "per-item deadline captured");
}

console.log("\nactionStructureWarnings (no merge/drop/re-categorize):");
{
  const pre = [{ kind: "restriction", text: "a" }, { kind: "short-term", text: "b" }, { kind: "long-term", text: "c" }];
  const same = actionStructureWarnings(pre, [{ kind: "restriction", text: "A." }, { kind: "short-term", text: "B." }, { kind: "long-term", text: "C." }]);
  assert(same.length === 0, "same count + kinds, polished text => no warning");
  const dropped = actionStructureWarnings(pre, [{ kind: "restriction", text: "A." }, { kind: "short-term", text: "B and C merged." }]);
  assert(dropped.some((w) => w.gate === "actionItemCount"), "merged/dropped item => count warning");
  const recat = actionStructureWarnings(pre, [{ kind: "requirement", text: "A." }, { kind: "short-term", text: "B." }, { kind: "long-term", text: "C." }]);
  assert(recat.some((w) => w.gate === "actionKindChange"), "restriction re-categorized to requirement => kind-change warning");
}

console.log("\nidentifier preservation (Action):");
{
  const clean = identifierInventionWarnings(["do not order PN 816345"], [{ items: [{ text: "Do not order part 816345." }] }]);
  assert(clean.length === 0, "preserved part number (PN dropped) not flagged");
  const invented = identifierInventionWarnings(["replace the fitting"], [{ items: [{ text: "Use part PN 424242 instead." }] }]);
  assert(invented.some((w) => /424242/.test(w.message)), "invented part number flagged");
}

console.log("\nactionItemLine (review==export shared render):");
{
  const line = actionItemLine({ id: "1", kind: "restriction", text: "Do not order PN 816345.", deadline: "now", reference: "InTouch 99281" });
  assert(line === "Restriction: Do not order PN 816345. (Deadline: now; Ref: InTouch 99281)", "labeled line with inline metadata");
  const plain = actionItemLine({ id: "2", kind: "requirement", text: "Record in InTrack." });
  assert(plain === "Requirement: Record in InTrack.", "no metadata => no parenthetical");
}

console.log("\nAction readiness + snapshot:");
{
  const okAction = { accepted: { value: { items: [{ id: "1", kind: "restriction" as const, text: "Do not order." }] } }, freshness: "fresh" as const };
  const view = (p: any = {}) => ({ summary: okSummary, reason: okReason, action: okAction, ...p });

  const noAction = computeAnnouncementReadiness({ metadata: meta, supportingContent, sections: view({ action: { accepted: null, freshness: "fresh" } }) });
  assert(noAction.status === "Blocked" && noAction.blockingIssues.some((i) => /action has no accepted/i.test(i)), "no accepted Action => Blocked");

  const emptyItems = computeAnnouncementReadiness({ metadata: meta, supportingContent, sections: view({ action: { accepted: { value: { items: [] } }, freshness: "fresh" } }) });
  assert(emptyItems.blockingIssues.some((i) => /action is empty/i.test(i)), "accepted Action with no items/lead => Blocked");

  const ok = computeAnnouncementReadiness({ metadata: meta, supportingContent, sections: view() });
  assert(ok.blockingIssues.length === 0, "all sections accepted + title => not blocked");

  const staleAction = computeAnnouncementReadiness({ metadata: meta, supportingContent, sections: view({ action: { accepted: okAction.accepted, freshness: "stale" } }) });
  assert(staleAction.blockingIssues.some((i) => /action is accepted but needs another look/i.test(i)), "stale accepted Action => Blocked");

  const snap = buildAnnouncementSnapshot({ metadata: meta, supportingContent, sections: view() });
  assert(snap.action?.items[0].text === "Do not order.", "snapshot carries accepted Action items");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
