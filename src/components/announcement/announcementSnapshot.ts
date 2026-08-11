// The single canonical snapshot builder -- the core review==export fix from
// the plan (§17). A pure function with no React/Express dependency, reading
// ONLY accepted section values (AnnouncementAcceptedSectionsView) plus
// document-control metadata. Both the frontend review render (AnnouncementReview
// .tsx) and the backend export route (announcementRoutes.ts /export-docx) call
// this SAME function, so review and export cannot drift the way the legacy
// TechCom preview and DOCX builder do (two independent renderers today).
//
// Shareable across the frontend/backend boundary for the same reason
// src/types.ts already is: plain TS, no framework import.

import { AnnouncementSnapshot } from "./announcementTypes";
import { computeAnnouncementReadiness, ReadinessInput } from "./announcementReadiness";

export function buildAnnouncementSnapshot(input: ReadinessInput): AnnouncementSnapshot {
  const readiness = computeAnnouncementReadiness(input);
  return {
    metadata: input.metadata,
    summary: input.sections.summary.accepted?.value ?? null,
    reason: input.sections.reason.accepted?.value ?? null,
    action: input.sections.action.accepted?.value ?? null,
    supportingContent: input.supportingContent,
    readiness,
  };
}

/** Export is only allowed once readiness has zero blocking issues -- both the
 * frontend export button and the backend route check this identically. */
export function isAnnouncementSnapshotExportable(snapshot: AnnouncementSnapshot): boolean {
  return snapshot.readiness.blockingIssues.length === 0;
}
