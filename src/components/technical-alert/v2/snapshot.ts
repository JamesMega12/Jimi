import {
  AdministrativeMetadata,
  ControlInformation,
  SupportingContent,
  AcceptedSectionsView,
  SummaryAccepted,
  ReasonsAccepted,
  ImmediateActionContent,
  FollowUpActionContent,
  Readiness,
} from './types';
import { computeTechnicalAlertReadinessV2, ReadinessInput } from './readiness';

// The single canonical snapshot builder -- the most important structural fix
// in the v2 refactor plan. A pure function with no React/Express dependency,
// reading ONLY accepted section values (AcceptedSectionsView, the same
// narrowed type readiness/cross-section review use) plus administrative
// metadata/control info/supporting content. Both the frontend review render
// (FinalReviewPanel.tsx) and the backend export route
// (technicalAlertRoutesV2.ts /export-docx) call this SAME function -- there
// is no independent reconstruction path, so review and export cannot drift
// the way v1's hand-synced Step4.tsx/docxExportService.ts could (and, before
// Phase A of the prior stabilization plan, didn't even try to).
//
// Shareable across the frontend/backend boundary for the same reason
// src/types.ts already is in this codebase: plain TS, no framework import.

export interface TechnicalAlertSnapshot {
  administrativeMetadata: AdministrativeMetadata;
  controlInformation: ControlInformation;
  supportingContent: SupportingContent;
  summary: SummaryAccepted | null;
  reasons: ReasonsAccepted | null;
  immediateAction: ImmediateActionContent | null;
  followUpAction: FollowUpActionContent | null;
  readiness: Readiness;
}

export function buildTechnicalAlertSnapshot(input: ReadinessInput): TechnicalAlertSnapshot {
  const readiness = computeTechnicalAlertReadinessV2(input);
  return {
    administrativeMetadata: input.administrativeMetadata,
    controlInformation: input.controlInformation,
    supportingContent: input.supportingContent,
    summary: input.sections.summary.accepted?.value ?? null,
    reasons: input.sections.reasons.accepted?.value ?? null,
    immediateAction: input.sections.immediateAction.accepted?.value ?? null,
    followUpAction: input.sections.followUpAction.accepted?.value ?? null,
    readiness,
  };
}

/** Export is only allowed once readiness has zero blocking issues -- callers
 * (both the frontend export button and the backend route) should check this
 * before treating a snapshot as exportable. Kept as a tiny separate function
 * rather than inlined so both sides check it identically. */
export function isSnapshotExportable(snapshot: TechnicalAlertSnapshot): boolean {
  return snapshot.readiness.blockingIssues.length === 0;
}
