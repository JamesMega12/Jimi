// Announcement figures (Phase 4): numbered caption placeholders, mirroring
// Technical Alert v2's actual SupportingContent.figures pattern -- no image
// bytes anywhere. Covers add/remove/caption-edit through persistence and the
// snapshot builder. The UI and DOCX export are currently hidden behind
// ANNOUNCEMENT_FIGURES_ENABLED (announcementFeatureFlags.ts) -- the
// underlying data model/persistence/snapshot threading stays intact and
// tested here; only the export-suppression assertions below reflect the
// flag being off.
// Run: npx tsx test-announcement-figures.ts

import { buildAnnouncementSnapshot } from "./src/components/announcement/announcementSnapshot";
import { generateAnnouncementDocx } from "./src/server/announcementDocxExportService";
import { Figure } from "./src/components/announcement/announcementTypes";
import { ANNOUNCEMENT_FIGURES_ENABLED } from "./src/components/announcement/announcementFeatureFlags";

const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  },
};

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

(async () => {
  const { loadAnnouncementState, saveAnnouncementState } = await import("./src/lib/announcementPersistence");
  const { createEmptySectionWorkspace } = await import("./src/components/announcement/lib/sectionLifecycle");

  console.log("\nPersistence round-trip:");
  {
    const figures: Figure[] = [
      { id: "f1", number: 1, caption: "Tattle tale grease fitting" },
      { id: "f2", number: 2, caption: "" },
    ];
    const draft: any = {
      documentType: "Announcement",
      schemaVersion: 1,
      identity: { id: "id1", createdAt: "t" },
      metadata: { title: "T", announcementNumber: "", inTouchId: "", date: "", gemsNo: "", classification: "SLB-Private" },
      sections: {
        summary: createEmptySectionWorkspace(),
        reason: createEmptySectionWorkspace(),
        action: createEmptySectionWorkspace(),
      },
      supportingContent: { figures },
      workflow: { currentStage: "drafting" },
    };
    saveAnnouncementState(draft, "details");
    const restored = loadAnnouncementState();
    assert(restored?.draft.supportingContent.figures.length === 2, "both figures survive a save/load round-trip");
    assert(restored?.draft.supportingContent.figures[0].caption === "Tattle tale grease fitting", "caption text survives round-trip");

    // Backward compat: a draft persisted before figures shipped has no
    // supportingContent field at all.
    const { supportingContent, ...withoutSupportingContent } = draft;
    saveAnnouncementState(withoutSupportingContent as any, "details");
    const restoredOld = loadAnnouncementState();
    assert(Array.isArray(restoredOld?.draft.supportingContent.figures) && restoredOld?.draft.supportingContent.figures.length === 0, "a pre-figures persisted draft loads with an empty figures array, not a crash");
  }

  console.log("\nSnapshot + readiness (figures never block):");
  {
    const meta = { title: "T", announcementNumber: "WCF-AN 2026-01", inTouchId: "1", date: "d", gemsNo: "N/A", classification: "SLB-Private" };
    const view = {
      summary: { accepted: { value: { centralMessage: "m", renderedText: "M." } }, freshness: "fresh" as const },
      reason: { accepted: { value: { rationale: "r" } }, freshness: "fresh" as const },
      action: { accepted: { value: { items: [{ id: "1", kind: "requirement" as const, text: "do x" }] } }, freshness: "fresh" as const },
    };
    const noFigures = buildAnnouncementSnapshot({ metadata: meta, sections: view, supportingContent: { figures: [] } });
    assert(noFigures.readiness.blockingIssues.length === 0, "no figures => not blocked");
    assert(noFigures.readiness.warnings.length === 0 || !noFigures.readiness.warnings.some((w) => /figure/i.test(w)), "no figures => no figure-related warning either");

    const withFigures = buildAnnouncementSnapshot({
      metadata: meta,
      sections: view,
      supportingContent: { figures: [{ id: "f1", number: 1, caption: "Tattle tale grease fitting" }] },
    });
    assert(withFigures.readiness.blockingIssues.length === 0, "a figure present => still not blocked");
    assert(withFigures.supportingContent.figures.length === 1, "snapshot carries the figure through");
  }

  console.log("\nDOCX export placeholder (currently suppressed by ANNOUNCEMENT_FIGURES_ENABLED):");
  {
    const meta = { title: "T", announcementNumber: "WCF-AN 2026-01", inTouchId: "1", date: "d", gemsNo: "N/A", classification: "SLB-Private" };
    const view = {
      summary: { accepted: { value: { centralMessage: "m", renderedText: "M." } }, freshness: "fresh" as const },
      reason: { accepted: { value: { rationale: "r" } }, freshness: "fresh" as const },
      action: { accepted: { value: { items: [{ id: "1", kind: "requirement" as const, text: "do x" }] } }, freshness: "fresh" as const },
    };
    const AdmZip = (await import("adm-zip")).default;
    const snapWithFigure = buildAnnouncementSnapshot({
      metadata: meta,
      sections: view,
      supportingContent: { figures: [{ id: "f1", number: 1, caption: "Tattle tale grease fitting" }] },
    });
    const buf = await generateAnnouncementDocx(snapWithFigure);
    const xml = new AdmZip(buf).readAsText("word/document.xml");
    const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    assert(ANNOUNCEMENT_FIGURES_ENABLED === false, "sanity check: this assertion block assumes the flag is currently off");
    assert(!/FIGURES/.test(text), "FIGURES heading suppressed while the flag is off, even though figure data is present in the snapshot");
    assert(!text.includes("Tattle tale grease fitting"), "figure caption does not leak into export while the flag is off");

    const snapNoFigures = buildAnnouncementSnapshot({ metadata: meta, sections: view, supportingContent: { figures: [] } });
    const bufNoFigures = await generateAnnouncementDocx(snapNoFigures);
    const xmlNoFigures = new AdmZip(bufNoFigures).readAsText("word/document.xml");
    assert(!/FIGURES/.test(xmlNoFigures.replace(/<[^>]+>/g, " ")), "no FIGURES heading when there are no figures either");
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
