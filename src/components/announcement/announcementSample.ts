import { createEmptySectionWorkspace } from "./lib/sectionLifecycle";
import { AnnouncementMetadata, SupportingContent, AnnouncementSections, SummaryAccepted, ReasonAccepted, ActionAccepted } from "./announcementTypes";

// Fictional sample, same "rough notes only" convention as Technical Alert
// v2's createTechnicalAlertSampleV2 (technicalAlertPresetV2.ts): ONLY `raw`
// is pre-filled per section -- analysis.components and accepted stay null,
// so a loaded sample starts in the exact same empty-state UI a brand-new
// draft sees ("Ask AI to help" / "Fill in manually"). Two earlier Technical
// Alert UX passes got this wrong first (pre-filling `accepted` showed
// "Accepted" with nothing reviewed; pre-filling `analysis.components`
// bypassed the empty-state gate) -- don't repeat either mistake here. No AI
// is invoked and nothing is exported automatically by loading it.
export function createAnnouncementSample(): {
  metadata: AnnouncementMetadata;
  supportingContent: SupportingContent;
  sections: AnnouncementSections;
} {
  const metadata: AnnouncementMetadata = {
    title: "IRI Pressure Gauge Adapter Thread Wear -- Interim Restriction",
    announcementNumber: "WCF-AN 2026-99",
    inTouchId: "9012345",
    date: "11-Aug-2026",
    gemsNo: "N/A",
    classification: "SLB-Private",
  };

  const supportingContent: SupportingContent = {
    figures: [
      { id: "sample-fig-1", number: 1, caption: "Adapter thread wear pattern" },
      { id: "sample-fig-2", number: 2, caption: "Adapter assembly exploded view" },
    ],
  };

  const sections: AnnouncementSections = {
    summary: (() => {
      const ws = createEmptySectionWorkspace<SummaryAccepted, SummaryAccepted>();
      ws.raw =
        "A few field locations reported the pressure gauge adapter on the IRI 450 manifold leaking during high-pressure testing. Notable because this adapter has been in service for several years with no prior leak reports.";
      return ws;
    })(),
    reason: (() => {
      const ws = createEmptySectionWorkspace<ReasonAccepted, ReasonAccepted>();
      ws.raw =
        "Preliminary findings suggest the thread engagement on the adapter may be wearing faster than expected, possibly linked to a recent change in the thread lubricant used during assembly. Root cause not yet confirmed.";
      return ws;
    })(),
    action: (() => {
      const ws = createEmptySectionWorkspace<ActionAccepted, ActionAccepted>();
      ws.raw =
        "If an adapter is found leaking during pressure testing: remove it from service and replace with a new adapter.\n" +
        "- Old adapters should not be reused or re-threaded in the field.\n" +
        "- Short-term: inspect thread engagement visually before every job.\n" +
        "- Long-term: engineering is evaluating an updated thread lubricant spec.\n" +
        "- Operator instruction: torque the adapter to spec by hand, do not use an impact wrench.";
      return ws;
    })(),
  };

  return { metadata, supportingContent, sections };
}
