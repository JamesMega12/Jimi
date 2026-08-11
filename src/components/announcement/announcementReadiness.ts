// Deterministic Announcement readiness (plan §16). No AI opinion gates export
// -- these are pure, testable checks over accepted-only section state plus
// document-control metadata. Phase 1 scope: Summary + title only (Reason/Action
// checks are added when those sections land).

import { ActionAccepted, AnnouncementAcceptedSectionsView, AnnouncementMetadata, Readiness, ReasonAccepted, SectionAcceptedView, SummaryAccepted, SupportingContent } from "./announcementTypes";
import { staleReasons } from "./lib/sectionLifecycle";
import { describeStaleReasons } from "./announcementStaleReasonCopy";

export interface ReadinessInput {
  metadata: AnnouncementMetadata;
  sections: AnnouncementAcceptedSectionsView;
  // Threaded through so buildAnnouncementSnapshot can populate the snapshot,
  // but never read here -- figures are always optional, never blocking
  // (matches Technical Alert v2's readiness.ts, which never references
  // supportingContent.figures either).
  supportingContent: SupportingContent;
}

// Announcement has one stale cause ('self-edit') today, always blocking; no
// warning-only stale cause exists because no neighbor-synthesis construct
// exists yet (see the parity plan's neighbor-change scoping decision, and
// lib/sectionLifecycle.ts's header comment). Shaped so a warn branch can be
// added later without restructuring -- mirrors Technical Alert v2's
// hasBlockingStale/hasNeighborStale split in readiness.ts.
function staleBlockingMessage(label: string, view: Pick<SectionAcceptedView<unknown>, "freshness">): string | null {
  const codes = staleReasons(view);
  if (codes.length === 0) return null;
  const clauses = describeStaleReasons(view);
  return `${label} is accepted but needs another look (${clauses.join("; ")}) -- re-accept before export.`;
}

export function summaryHasContent(value: SummaryAccepted | undefined | null): boolean {
  if (!value) return false;
  return !!(value.renderedText?.trim() || value.centralMessage?.trim());
}

export function reasonHasContent(value: ReasonAccepted | undefined | null): boolean {
  if (!value) return false;
  return !!(value.renderedText?.trim() || value.rationale?.trim());
}

export function actionHasContent(value: ActionAccepted | undefined | null): boolean {
  if (!value) return false;
  return value.items.some((i) => i.text?.trim()) || !!value.lead?.trim();
}

export function computeAnnouncementReadiness(input: ReadinessInput): Readiness {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  const summary = input.sections.summary;

  // Blocking: required section must have accepted, non-empty content.
  if (!summary.accepted) {
    blockingIssues.push("Summary has no accepted content.");
  } else if (!summaryHasContent(summary.accepted.value)) {
    blockingIssues.push("Accepted Summary is empty.");
  }

  // Blocking: accepted content must not be stale (source/components edited
  // after acceptance -- review before export).
  if (summary.accepted) {
    const msg = staleBlockingMessage("Summary", summary);
    if (msg) blockingIssues.push(msg);
  }

  const reason = input.sections.reason;

  // Blocking: Reason is a required section for every Announcement (all three
  // reference documents have one; the legacy backend also required it).
  if (!reason.accepted) {
    blockingIssues.push("Reason has no accepted content.");
  } else if (!reasonHasContent(reason.accepted.value)) {
    blockingIssues.push("Accepted Reason is empty.");
  }
  if (reason.accepted) {
    const msg = staleBlockingMessage("Reason", reason);
    if (msg) blockingIssues.push(msg);
  }

  const action = input.sections.action;

  // Blocking: Action is a required section for every Announcement.
  if (!action.accepted) {
    blockingIssues.push("Action has no accepted content.");
  } else if (!actionHasContent(action.accepted.value)) {
    blockingIssues.push("Accepted Action is empty.");
  }
  if (action.accepted) {
    const msg = staleBlockingMessage("Action", action);
    if (msg) blockingIssues.push(msg);
  }

  // Blocking: document-control minimum.
  if (!input.metadata.title?.trim()) {
    blockingIssues.push("Document title is required.");
  }

  // Warnings (non-blocking).
  if (summary.accepted && !input.metadata.announcementNumber?.trim()) {
    warnings.push("Announcement number is not set.");
  }
  if (summary.accepted && summaryHasContent(summary.accepted.value) && !summary.accepted.value.affectedScope?.trim()) {
    warnings.push("Summary does not state an affected scope.");
  }
  // Uncertainty-aware warning: a suspected/preliminary cause with no triggering
  // observation to support it is worth flagging (plan §16).
  if (reason.accepted) {
    const rv = reason.accepted.value;
    if ((rv.causeStatus === "suspected" || rv.causeStatus === "preliminary") && !rv.triggeringObservation?.trim()) {
      warnings.push(`Reason states a ${rv.causeStatus} cause but no triggering observation/evidence is recorded.`);
    }
  }

  const status: Readiness["status"] =
    blockingIssues.length > 0
      ? "Blocked"
      : warnings.length > 2
      ? "Needs major fixes"
      : warnings.length > 0
      ? "Needs minor fixes"
      : "Ready";

  return { status, blockingIssues, warnings };
}
