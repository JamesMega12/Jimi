// Target (v2) Technical Alert domain model.
//
// This module is purely additive during Phase 1: it introduces the types and
// section-lifecycle envelope the refactor plan calls for, without touching the
// live v1 workflow (TechnicalAlertWorkflow.tsx, Step1-4, the existing routes).
// See plans/role-you-are-working-delightful-cupcake.md "Target State Model" and
// "Section Component Models" for the design rationale.

export type SectionId = "summary" | "reasons" | "immediateAction" | "followUpAction";

export type FindingSeverity = "review_recommended" | "resolution_required";

export interface Finding {
  id: string;
  field?: string;
  severity: FindingSeverity;
  message: string;
}

export interface RevisionRef {
  revision: number;
}

// --- Section lifecycle envelope ------------------------------------------------
//
// One generic envelope instantiated four times (Summary/Reasons/ImmediateAction/
// FollowUpAction), each with its own TComponents/TAccepted domain type. This is
// what replaces the current hand-duplicated pending/acceptedSections/stale state
// in TechnicalAlertWorkflow.tsx (built in Phase C of the prior stabilization plan).

export interface SectionWorkspace<TComponents, TAccepted> {
  raw: string;
  analysis: {
    components: TComponents | null;
    findings: Finding[];
    ranAt: RevisionRef | null;
  };
  suggestion: {
    value: TAccepted | null;
    basedOn: RevisionRef | null;
    requestId: string | null;
  };
  accepted: {
    value: TAccepted;
    source: "ai" | "manual";
    basedOn: RevisionRef;
    acceptedAt: string;
    // Summary-only: a snapshot (JSON-stringified per neighbor section id, or
    // null if that neighbor wasn't accepted) of the neighbor sections' values
    // as of the rewrite call that produced this accepted content, when it was
    // AI-generated using them as read-only synthesis grounding (locked
    // decision #5). Lets staleness be detected if a neighbor is later
    // re-accepted with different content (RC7, 2026-08-06) -- undefined for
    // every other section, and for manually-authored Summary content.
    groundedOnNeighbors?: Record<string, string | null>;
  } | null;
  freshness: "fresh" | "stale";
  staleDueToControlChange: boolean;
  // Distinct from staleDueToControlChange: set when a neighbor section this
  // content was AI-grounded on changes after acceptance (RC7, 2026-08-06).
  staleDueToNeighborChange: boolean;
  currentRevision: RevisionRef;
  // Set when an analyze/rewrite request is *issued* (before any response has
  // landed), so a response can be checked for staleness against the revision
  // that was current at issue time -- not just against whatever suggestion.*
  // happens to be sitting in state when the response arrives.
  inFlightRequest: { requestId: string; revisionAtRequestTime: RevisionRef } | null;
  loading: boolean;
  error: string | null;
}

// --- Summary ---------------------------------------------------------------
//
// Analysis and accepted share one shape (unlike Reasons, where analysis is
// intentionally looser before rewrite tightens it) because Summary's fields are
// already atomic strings with no meaningful "meta vs final" distinction.

export interface SummaryFields {
  subject: string;
  affectedScope: string;
  riskOrIssue?: string;
  centralRequirement?: string;
  centralProhibition?: string;
  revocation?: string;
  effectiveTiming?: string;
  exceptionNote?: string;
  // Only ever populated by rewrite (never by analyze, never hand-typed): a
  // cohesive paragraph synthesized from the fields above, then the fields
  // above are re-derived from that same paragraph in the same model
  // response, so the two can never drift. Absent for manually-accepted
  // content or pre-rewrite analysis -- renderers must fall back to the
  // field-by-field display in that case, never show a blank section.
  renderedText?: string;
}
export type SummaryComponents = SummaryFields;
export type SummaryAccepted = SummaryFields;

// --- Reasons -----------------------------------------------------------------

export type CauseStatus = "confirmed" | "preliminary" | "suspected" | "unknown";

export interface ReasonsNarrative {
  technicalBasis?: string;
  complianceBasis?: string;
  consequence?: string;
  causeStatus: CauseStatus;
  references?: string[];
  // Same paragraph-first/breakdown mechanism as SummaryFields.renderedText
  // (see there for the full rationale), scoped to the narrative only --
  // evidenceItems (the WCF-TA-2025-20-style component/concern/evidence table)
  // has no prose form and is never touched by this. Only ever populated by
  // rewrite, never analyze, never hand-typed.
  renderedText?: string;
}

export interface EvidenceItem {
  id: string;
  component: string;
  concern: string;
  evidence?: string;
  imageRef?: string;
}

export interface ReasonsFields {
  narrative?: ReasonsNarrative;
  evidenceItems?: EvidenceItem[];
}
export type ReasonsComponents = ReasonsFields;
export type ReasonsAccepted = ReasonsFields;

// --- Immediate / Follow-Up Action --------------------------------------------

export type ObligationStrength = "mandatory" | "prohibited" | "conditional" | "advisory" | "unclear";
export type ControlType = "removal_from_service" | "red_tag" | "quarantine" | "escalation";
export type FollowUpCategory = "monitoring" | "reporting" | "procedural_update" | "replacement" | "engineering_change" | "way_forward";

export interface ActionItem {
  id: string;
  actor: string[];
  requiredAction: string;
  target?: string;
  timing?: string;
  condition?: string;
  obligationStrength: ObligationStrength;
  controlType?: ControlType[];
  followUpCategory?: FollowUpCategory;
  // Only ever populated by rewrite (never analyze, never hand-typed): one
  // complete, STE-quality instruction sentence that folds target/timing/
  // condition INTO the sentence -- what the review/export renderers now
  // prefer to show/print, closing a confirmed defect where those fields were
  // captured in data but silently dropped at export. Structured fields
  // remain the editable, gated source of truth; this is derived from them,
  // never the reverse (unlike Summary/Reasons' paragraph-then-breakdown --
  // action items are already atomic records, not prose to decompose).
  // Absent for manually-authored or pre-rewrite items; renderers must fall
  // back to stitching the fields together in that case.
  instructionText?: string;
  requiredEvidence?: string;
  references?: string[];
  exceptionRef?: string;
}

// Exceptions are scoped to Immediate Action's section workspace and referenced
// (never duplicated) by the ActionItems they modify, via `appliesTo` /
// `ActionItem.exceptionRef`. This is what prevents a condition from being able
// to detach from its exception (locked decision #6 in the refactor plan) --
// today's floating, disconnected `exemption` block cannot make that guarantee.
export interface ExceptionRecord {
  id: string;
  appliesTo: string[];
  condition: string;
  limitations: string[];
  requiredApprovers: string[];
  requiredEvidence: string[];
  submissionSystem?: string;
  relatedStandard?: string;
}

export interface ImmediateActionContent {
  items: ActionItem[];
  exceptions: ExceptionRecord[];
}
export type ImmediateActionComponents = ImmediateActionContent;
export type ImmediateActionAccepted = ImmediateActionContent;

export interface FollowUpActionContent {
  items: ActionItem[];
  notApplicable: boolean;
}
export type FollowUpActionComponents = FollowUpActionContent;
export type FollowUpActionAccepted = FollowUpActionContent;

// --- Control information / supporting content / metadata ---------------------

export interface ControlInformation {
  deadline: string;
  actionBy: string[];
  informationFor: string[];
  effectiveTiming: string;
  acknowledgementRequired: boolean;
  quizRequired: boolean;
}

export type ControlInfoField = "deadline" | "effectiveTiming" | "actionBy" | "informationFor";

export const CONTROL_INFO_DEPENDENTS: Record<ControlInfoField, SectionId[]> = {
  deadline: ["summary", "immediateAction"],
  effectiveTiming: ["summary"],
  actionBy: ["immediateAction", "followUpAction"],
  informationFor: [],
};

export interface AdministrativeMetadata {
  title: string;
  documentNumber: string;
  inTouchId: string;
  date: string;
  gemsNo: string;
  classification: string;
}

export interface AcknowledgementBlock {
  completionMethod: string;
  applicationOrSystem: string;
  completionDeadline: string;
  targetAudience: string[];
  completionInstructions: string;
}

export interface Figure {
  id: string;
  number: number;
  caption: string;
}

export interface TableRef {
  id: string;
  number: number;
  caption: string;
  columns: string[];
}

export interface Reference {
  id: string;
  label: string;
  url?: string;
  note?: string;
}

export interface SupportingContent {
  acknowledgement: AcknowledgementBlock | null;
  figures: Figure[];
  tables: TableRef[];
  references: Reference[];
}

// --- Cross-section review & readiness -----------------------------------------

export interface CrossSectionFinding extends Finding {
  relatedSections: SectionId[];
  source: "deterministic" | "ai";
  blocking: boolean;
  dismissed: boolean;
  stale: boolean;
}

export type ReadinessStatus = "Ready" | "Needs minor fixes" | "Needs major fixes" | "Blocked";

export interface Readiness {
  status: ReadinessStatus;
  blockingIssues: string[];
  warnings: string[];
}

// --- Draft ---------------------------------------------------------------------

// "crossSectionReview" was a 4th stage/variant here, removed 2026-07-23 when
// the dedicated Cross-Section Review page was relocated into Final Review &
// Export (its advisory findings + AI deep-check button now live there; its
// blocking checks were already independently wired into readiness and never
// depended on the page existing at all).
export type WorkflowStage =
  | "drafting"
  | "metadataAndSupportingContent"
  | "finalReviewExport";

export interface TechnicalAlertSections {
  summary: SectionWorkspace<SummaryComponents, SummaryAccepted>;
  reasons: SectionWorkspace<ReasonsComponents, ReasonsAccepted>;
  immediateAction: SectionWorkspace<ImmediateActionComponents, ImmediateActionAccepted>;
  followUpAction: SectionWorkspace<FollowUpActionComponents, FollowUpActionAccepted>;
}

// Structural guarantee against "pending mistaken for accepted": this narrowed
// view exposes ONLY accepted/freshness/staleDueToControlChange from each
// section -- `suggestion`/`analysis`/`raw` are not part of the type at all,
// for any caller, not merely excluded by convention within one file. Used by
// readiness, cross-section review, and the snapshot builder, and is exactly
// the payload shape the backend export route expects (so the client can only
// ever send accepted state to construct an export, structurally).
export interface SectionAcceptedView<T> {
  accepted: { value: T } | null;
  freshness: 'fresh' | 'stale';
  staleDueToControlChange: boolean;
  staleDueToNeighborChange: boolean;
}
export interface AcceptedSectionsView {
  summary: SectionAcceptedView<SummaryAccepted>;
  reasons: SectionAcceptedView<ReasonsAccepted>;
  immediateAction: SectionAcceptedView<ImmediateActionAccepted>;
  followUpAction: SectionAcceptedView<FollowUpActionAccepted>;
}

export interface TechnicalAlertDraftV2 {
  documentType: "Technical Alert";
  schemaVersion: 2;
  identity: {
    id: string;
    createdAt: string;
  };
  sections: TechnicalAlertSections;
  controlInformation: ControlInformation;
  supportingContent: SupportingContent;
  administrativeMetadata: AdministrativeMetadata;
  workflow: {
    currentStage: WorkflowStage;
  };
}
