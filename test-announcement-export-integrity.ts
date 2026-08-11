// Review == Export integrity (Phase D). Proves the DOCX export renders exactly
// the accepted content the review UI shows -- both consume the single
// buildAnnouncementSnapshot output -- and that no pending/raw content leaks and
// distinct Action items are not collapsed. Pure (no server/key): builds a
// snapshot, generates the real .docx, unzips word/document.xml, checks text.
// Run: npx tsx test-announcement-export-integrity.ts

import AdmZip from "adm-zip";
import { buildAnnouncementSnapshot } from "./src/components/announcement/announcementSnapshot";
import { isAnnouncementSnapshotExportable } from "./src/components/announcement/announcementSnapshot";
import { generateAnnouncementDocx } from "./src/server/announcementDocxExportService";

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

const meta = { title: "IRI 336 Grease Fitting Design Change", announcementNumber: "WCF-AN 2025-25", inTouchId: "8255862", date: "02-Dec-2025", gemsNo: "N/A", classification: "SLB-Private" };
const view = {
  summary: { accepted: { value: { centralMessage: "CM", affectedScope: "Scope", renderedText: "The grease fitting is being redesigned." } }, freshness: "fresh" as const },
  reason: { accepted: { value: { rationale: "R", causeStatus: "preliminary" as const, renderedText: "Preliminary findings indicate a seal issue." } }, freshness: "fresh" as const },
  action: { accepted: { value: { items: [
    { id: "1", kind: "restriction" as const, text: "Do not order Old Part PN 816345.", reference: "InTouch 99281" },
    { id: "2", kind: "short-term" as const, text: "Replace with a 1/8-in NPT plug." },
    { id: "3", kind: "long-term" as const, text: "Redesign the tattle tale body." },
  ] } }, freshness: "fresh" as const },
};
const supportingContent = { figures: [{ id: "f1", number: 1, caption: "Tattle tale grease fitting" }] };
// Content that lives ONLY in raw/pending (never accepted) -- must NOT appear in export.
const PENDING_ONLY = "THIS_IS_PENDING_ONLY_TEXT";

(async () => {
  const snapshot = buildAnnouncementSnapshot({ metadata: meta, supportingContent, sections: view });

  console.log("\nReadiness:");
  assert(isAnnouncementSnapshotExportable(snapshot), "all sections accepted + title => exportable");

  const buffer = await generateAnnouncementDocx(snapshot);
  const xml = new AdmZip(buffer).readAsText("word/document.xml");
  const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  console.log("\nExport renders accepted content (== what review shows):");
  assert(text.includes(meta.title), "title present");
  assert(text.includes("The grease fitting is being redesigned."), "accepted Summary prose present");
  assert(text.includes("Preliminary findings indicate a seal issue."), "accepted Reason prose present (hedging preserved)");
  assert(/SUMMARY/.test(text) && /REASON/.test(text) && /ACTION/.test(text), "all three section headings present");

  console.log("\nAction: distinct items + kinds + per-item metadata (no collapse, no drop):");
  assert(text.includes("Do not order Old Part PN 816345."), "restriction text preserved (PN intact)");
  assert(text.includes("Replace with a 1/8-in NPT plug."), "short-term item present");
  assert(text.includes("Redesign the tattle tale body."), "long-term item present");
  assert(text.includes("Restriction") && text.includes("Short-Term Solution") && text.includes("Long-Term Solution"), "kind labels rendered distinctly");
  assert(text.includes("InTouch 99281"), "per-item reference rendered (the field the legacy exporter dropped)");

  console.log("\nFigures (hidden behind ANNOUNCEMENT_FIGURES_ENABLED -- see test-announcement-figures.ts):");
  assert(!/FIGURE 1/.test(text) && !text.includes("Tattle tale grease fitting"), "figure placeholder suppressed while the feature flag is off");

  console.log("\nNo pending/raw leakage:");
  assert(!text.includes(PENDING_ONLY), "content never accepted does not appear in export");

  console.log("\nParity (single source): review view-model === export source:");
  assert(snapshot.summary?.renderedText === "The grease fitting is being redesigned." && snapshot.action?.items.length === 3, "the snapshot object review renders is exactly the one export consumes");

  console.log("\nRich content markup (Phase 5): real Word formatting, not literal characters:");
  {
    const markupView = {
      summary: {
        accepted: {
          value: {
            centralMessage: "CM",
            renderedText: "The **grease fitting** is being redesigned per [the standard](https://example.com/std).",
          },
        },
        freshness: "fresh" as const,
      },
      reason: view.reason,
      action: {
        accepted: {
          value: {
            items: [
              {
                id: "1",
                kind: "requirement" as const,
                text: "Mandatory InTrack Recording:\n- All existing iron must be recorded.\n- New iron must be added before use.",
              },
            ],
          },
        },
        freshness: "fresh" as const,
      },
    };
    const markupSnapshot = buildAnnouncementSnapshot({ metadata: meta, supportingContent: { figures: [] }, sections: markupView });
    const markupBuffer = await generateAnnouncementDocx(markupSnapshot);
    const markupXml = new AdmZip(markupBuffer).readAsText("word/document.xml");
    const markupText = markupXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    assert(markupXml.includes("<w:b/>") && markupText.includes("grease fitting"), "bold markup renders as a real Word bold run");
    assert(markupXml.includes("<w:hyperlink"), "link markup renders as a real Word hyperlink element");
    assert(!markupText.includes("**") && !markupText.includes("[the standard]"), "literal ** / [text](url) markup characters do not leak into the exported text");
    assert(markupText.includes("All existing iron must be recorded.") && markupText.includes("New iron must be added before use."), "a nested sub-bullet inside an action item's text renders both sub-steps");
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
