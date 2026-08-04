// Deterministic (non-AI) cross-section consistency checks. Pure function, no
// Express/React dependency -- runs client-side directly (no network round
// trip needed for checks that require no AI and no secrets), and could be
// imported server-side too if ever needed (same rationale as the Phase 8
// snapshot builder). See plans/role-you-are-working-delightful-cupcake.md
// "Cross-Section Review" for the design.
//
// Scoped to what's actually available in the v2 workflow today: the 4
// sections' accepted content. Checks that depend on controlInformation
// (actor/deadline consistency against Action By / Deadline) are deferred
// until Phase 6 wires that state into TechnicalAlertWorkflowV2 -- the data
// doesn't exist in this workflow's state yet, so a check against it would be
// meaningless, not just premature.

import { CrossSectionFinding, AcceptedSectionsView, SectionId } from './types';

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `finding-${Math.random().toString(36).slice(2)}`;
}

function makeFinding(message: string, relatedSections: SectionId[], blocking: boolean): CrossSectionFinding {
  return {
    id: newId(),
    severity: blocking ? 'resolution_required' : 'review_recommended',
    message,
    relatedSections,
    source: 'deterministic',
    blocking,
    dismissed: false,
    stale: false,
  };
}

const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'that', 'this', 'with', 'be', 'is', 'are', 'must', 'shall']);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t))
  );
}

function tokenOverlapRatio(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach(t => {
    if (tb.has(t)) shared++;
  });
  return shared / Math.min(ta.size, tb.size);
}

/** Catches "an immediate control was moved to (or duplicated in) follow-up" --
 * the exact miscategorization risk the refactor plan singles out. */
function checkImmediateFollowUpDuplication(sections: AcceptedSectionsView): CrossSectionFinding[] {
  const immediateItems = sections.immediateAction.accepted?.value.items || [];
  const followUpItems = sections.followUpAction.accepted?.value.items || [];
  const findings: CrossSectionFinding[] = [];
  for (const imm of immediateItems) {
    for (const fu of followUpItems) {
      if (tokenOverlapRatio(imm.requiredAction, fu.requiredAction) > 0.7) {
        findings.push(
          makeFinding(
            `An Immediate Action item ("${imm.requiredAction.slice(0, 60)}...") appears duplicated in Follow-Up Action -- a control should not be split or repeated across both sections.`,
            ['immediateAction', 'followUpAction'],
            true // blocking: this is the one deterministic check the plan explicitly elevates to blocking
          )
        );
      }
    }
  }
  return findings;
}

/** Every exceptionRef must resolve to a real ExceptionRecord in the same
 * section -- catches the structural bug class Phase 2's normalizer fix was
 * built to prevent from ever landing in accepted state. */
function checkExceptionRefValidity(sections: AcceptedSectionsView): CrossSectionFinding[] {
  const content = sections.immediateAction.accepted?.value;
  if (!content) return [];
  const exceptionIds = new Set(content.exceptions.map(e => e.id));
  const findings: CrossSectionFinding[] = [];
  for (const item of content.items) {
    if (item.exceptionRef && !exceptionIds.has(item.exceptionRef)) {
      findings.push(
        makeFinding(
          `Action item "${item.requiredAction.slice(0, 60)}" references an exception that no longer exists.`,
          ['immediateAction'],
          true // blocking: a dangling exception reference is a structural integrity failure
        )
      );
    }
  }
  return findings;
}

/** Summary's stated central requirement/prohibition should be echoed by at
 * least one Immediate Action item -- "Summary states a requirement absent
 * from Immediate Action" from the refactor plan's candidate check list. */
function checkSummaryEchoedInActions(sections: AcceptedSectionsView): CrossSectionFinding[] {
  const summary = sections.summary.accepted?.value;
  const items = sections.immediateAction.accepted?.value.items || [];
  if (!summary || items.length === 0) return [];
  const findings: CrossSectionFinding[] = [];
  (['centralRequirement', 'centralProhibition'] as const).forEach(field => {
    const claim = summary[field];
    if (!claim) return;
    const echoed = items.some(item => tokenOverlapRatio(claim, item.requiredAction) > 0.3);
    if (!echoed) {
      findings.push(
        makeFinding(
          `Summary states a ${field === 'centralRequirement' ? 'requirement' : 'prohibition'} ("${claim.slice(0, 60)}...") that isn't reflected in any Immediate Action item.`,
          ['summary', 'immediateAction'],
          false
        )
      );
    }
  });
  return findings;
}

/** Summary's stated risk/concern should be supported by something in Reasons
 * -- only fires if Reasons has content (it's an optional section; an empty
 * Reasons section is not itself a finding here, per the readiness model). */
function checkSummarySupportedByReasons(sections: AcceptedSectionsView): CrossSectionFinding[] {
  const summary = sections.summary.accepted?.value;
  const reasons = sections.reasons.accepted?.value;
  if (!summary || !reasons) return [];
  const claim = summary.riskOrIssue || summary.centralProhibition || summary.centralRequirement;
  if (!claim) return [];
  const reasonsText = [
    reasons.narrative?.technicalBasis,
    reasons.narrative?.consequence,
    ...(reasons.evidenceItems || []).map(e => `${e.component} ${e.concern}`),
  ]
    .filter(Boolean)
    .join(' ');
  if (!reasonsText) return [];
  if (tokenOverlapRatio(claim, reasonsText) < 0.15) {
    return [makeFinding('Summary\'s stated risk/concern does not appear to be supported by anything in Reasons.', ['summary', 'reasons'], false)];
  }
  return [];
}

/** Loose consistency check on named equipment/products between Summary's
 * affected scope and what Immediate Action items target. */
function checkAffectedScopeConsistency(sections: AcceptedSectionsView): CrossSectionFinding[] {
  const summary = sections.summary.accepted?.value;
  const items = sections.immediateAction.accepted?.value.items || [];
  if (!summary?.affectedScope || items.length === 0) return [];
  const anyOverlap = items.some(item => item.target && tokenOverlapRatio(summary.affectedScope, item.target) > 0.2);
  const anyTargetsAtAll = items.some(item => !!item.target);
  if (anyTargetsAtAll && !anyOverlap) {
    return [makeFinding('Summary\'s affected scope does not obviously match the target(s) named in Immediate Action.', ['summary', 'immediateAction'], false)];
  }
  return [];
}

export function runDeterministicCrossSectionChecks(sections: AcceptedSectionsView): CrossSectionFinding[] {
  return [
    ...checkImmediateFollowUpDuplication(sections),
    ...checkExceptionRefValidity(sections),
    ...checkSummaryEchoedInActions(sections),
    ...checkSummarySupportedByReasons(sections),
    ...checkAffectedScopeConsistency(sections),
  ];
}
