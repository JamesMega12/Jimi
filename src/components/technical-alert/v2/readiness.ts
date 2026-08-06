import {
  AdministrativeMetadata,
  ControlInformation,
  SupportingContent,
  Readiness,
  AcceptedSectionsView,
  SectionAcceptedView,
} from './types';
import { runDeterministicCrossSectionChecks } from './crossSectionReview';

// Deterministic (non-AI) readiness gate for the v2 draft -- extends the proven
// Phase D pattern (computeTechnicalAlertReadiness in the v1 backend) to the
// section/exception/cross-section-aware model. See plans/role-you-are-
// working-delightful-cupcake.md "Readiness" for the full design.
//
// Structural guarantee against "pending mistaken for accepted": `sections` is
// typed as AcceptedSectionsView, which exposes ONLY accepted/freshness/
// staleDueToControlChange from each section -- `suggestion`/`analysis`/`raw`
// are not part of the type at all, for any caller (including the backend
// export route, which uses this same type as its request-body contract), not
// merely excluded by convention within one file.
export interface ReadinessInput {
  administrativeMetadata: AdministrativeMetadata;
  controlInformation: ControlInformation;
  supportingContent: SupportingContent;
  sections: AcceptedSectionsView;
}

function isStaleView(v: SectionAcceptedView<unknown>): boolean {
  return v.freshness === 'stale' || v.staleDueToControlChange || v.staleDueToNeighborChange;
}

export function computeTechnicalAlertReadinessV2(input: ReadinessInput): Readiness {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  const { summary, reasons, immediateAction, followUpAction } = input.sections;

  // --- Blocking ---
  if (!input.administrativeMetadata.title.trim()) {
    blockingIssues.push('Title is required.');
  }

  if (!summary.accepted || !summary.accepted.value.subject.trim() || !summary.accepted.value.affectedScope.trim()) {
    blockingIssues.push('Summary must be accepted with at least a subject and affected scope.');
  }

  if (!immediateAction.accepted || immediateAction.accepted.value.items.length === 0) {
    blockingIssues.push('Immediate Action must be accepted with at least one action item (Immediate Action cannot be marked Not Applicable).');
  } else {
    const emptyInstructions = immediateAction.accepted.value.items.filter(i => !i.requiredAction.trim()).length;
    if (emptyInstructions > 0) blockingIssues.push(`${emptyInstructions} Immediate Action item(s) have no instruction text.`);

    // Dangling exceptionRef validity is NOT checked here (2026-07-28 fix) --
    // it was previously duplicated with crossSectionReview.ts's
    // checkExceptionRefValidity, which is already merged into blockingIssues
    // below via runDeterministicCrossSectionChecks, producing two differently
    // -worded messages for the same problem (confirmed via live testing).
    // That check alone is sufficient; this file only owns the two checks
    // below that have no cross-section-check equivalent.
    for (const exception of immediateAction.accepted.value.exceptions) {
      if (!exception.condition.trim()) {
        blockingIssues.push('An exception record has no condition specified.');
        break;
      }
    }
  }

  ([['summary', summary], ['reasons', reasons], ['immediateAction', immediateAction], ['followUpAction', followUpAction]] as const).forEach(
    ([name, view]) => {
      if (view.accepted && isStaleView(view)) {
        blockingIssues.push(`${name === 'immediateAction' ? 'Immediate Action' : name === 'followUpAction' ? 'Follow-Up Action' : name[0].toUpperCase() + name.slice(1)} is accepted but stale -- review and re-accept before export.`);
      }
    }
  );

  if (input.controlInformation.acknowledgementRequired) {
    const ack = input.supportingContent.acknowledgement;
    if (!ack || !ack.completionInstructions.trim()) {
      blockingIssues.push('Acknowledgement is marked required but has no completion instructions.');
    }
  }

  // Deterministic cross-section findings in the blocking subset (duplication,
  // exceptionRef validity) are recomputed fresh here -- a blocking structural
  // issue is never bypassable by dismissing its notification card in the UI,
  // only the visual badge is dismissible, not the underlying gate.
  const crossSectionBlocking = runDeterministicCrossSectionChecks(input.sections).filter(f => f.blocking);
  crossSectionBlocking.forEach(f => blockingIssues.push(f.message));

  // --- Warnings ---
  if (!reasons.accepted) {
    warnings.push('No reasons/background provided (optional for some alert types).');
  } else if (reasons.accepted.value.evidenceItems?.some(e => !e.evidence?.trim())) {
    const missing = reasons.accepted.value.evidenceItems.filter(e => !e.evidence?.trim()).length;
    warnings.push(`${missing} evidence item(s) are missing supporting evidence.`);
  }

  if (!followUpAction.accepted || (followUpAction.accepted.value.items.length === 0 && !followUpAction.accepted.value.notApplicable)) {
    warnings.push('Follow-Up Action is empty and not marked Not Applicable.');
  }

  if (!input.controlInformation.deadline.trim() && !input.controlInformation.effectiveTiming.trim()) {
    warnings.push('No deadline or effective timing specified.');
  }
  if (input.controlInformation.actionBy.length === 0) {
    warnings.push('No "Action By" audience specified.');
  }

  const crossSectionWarnings = runDeterministicCrossSectionChecks(input.sections).filter(f => !f.blocking);
  crossSectionWarnings.forEach(f => warnings.push(f.message));

  let status: Readiness['status'];
  if (blockingIssues.length > 0) status = 'Blocked';
  else if (warnings.length >= 3) status = 'Needs major fixes';
  else if (warnings.length > 0) status = 'Needs minor fixes';
  else status = 'Ready';

  return { status, blockingIssues, warnings };
}
