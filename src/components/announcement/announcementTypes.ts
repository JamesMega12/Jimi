// Announcement (dedicated module) domain model.
//
// Phase 1 of the Announcement refactor (plans/expressive-snuggling-pond.md):
// a NEW module, fully separate from the legacy generic "TechCom" engine
// (TechComWorkflow.tsx) that currently backs Announcement, and carrying NONE
// of Technical Alert's semantics (no mandatory-language/exemption/
// acknowledgement/obligation-strength constructs). Only the *Summary* section
// is wired end-to-end in this phase; Reason and Action are intentionally
// absent from `sections` until later phases.
//
// The section-lifecycle envelope (SectionWorkspace) is the domain-neutral
// engine ported from Technical Alert v2 (copied, not imported -- see
// lib/sectionLifecycle.ts for why), instantiated here with Announcement's own
// lean, source-driven component types.

export type SectionId = "summary" | "reason" | "action";

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

// --- Section lifecycle envelope ----------------------------------------------
//
// One generic envelope, instantiated per section with its own TComponents/
// TAccepted domain type. Separates raw source, analysis (editable structured
// components), a *pending* suggestion (never canonical), and *accepted*
// canonical content -- with revision + in-flight request tracking so a stale
// async response can never overwrite newer edits.

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
  } | null;
  freshness: "fresh" | "stale";
  currentRevision: RevisionRef;
  // Set when an analyze/rewrite request is *issued* (before any response has
  // landed) so a response can be checked for staleness against the revision
  // current at issue time -- see isResponseCurrent in lib/sectionLifecycle.ts.
  inFlightRequest: { requestId: string; revisionAtRequestTime: RevisionRef } | null;
  loading: boolean;
  error: string | null;
}

// --- Summary (lean, source-driven) -------------------------------------------
//
// Deliberately lean per the reference-document evidence (plan §3, §8): the
// accepted *prose* is what's canonical; the structured fields are optional
// drafting guidance derived from the source, never a required schema. No
// certainty model, no action categories -- those belong to Reason/Action.

export interface SummaryFields {
  // The core message: what changed / what the concern is. The one field
  // treated as "central" (not stripped by the grounding backstop), but still
  // not hard-required at the component level.
  centralMessage: string;
  affectedScope?: string;
  impact?: string;
  implementationTiming?: string;
  // Only ever populated by rewrite (never analyze, never hand-typed): a
  // cohesive paragraph synthesized from the fields above, then the fields are
  // re-derived from that same paragraph in the same model response so the two
  // cannot drift. Absent for manually-accepted content or pre-rewrite
  // analysis -- renderers fall back to the field-by-field display, never blank.
  renderedText?: string;
}
export type SummaryComponents = SummaryFields;
export type SummaryAccepted = SummaryFields;

// --- Reason (lean, uncertainty-aware) ----------------------------------------
//
// Per the reference-document evidence (plan §3, §9) Reason flexes between a
// suspected/preliminary CAUSE (doc 1), an OBJECTIVES/BENEFITS rationale (doc 2),
// and a RATIONALE-FROM-EVENTS (doc 3). So there is no fixed event/evidence/cause
// schema: just a free `rationale` (canonical prose), an optional triggering
// observation, and a certainty tag that is present ONLY when the source asserts
// a cause/finding. When no cause is asserted (objectives/rationale style),
// `causeStatus` is simply absent -- the UI never shows the certainty control.

export type CauseStatus = "confirmed" | "preliminary" | "suspected" | "unknown";

export interface ReasonFields {
  // The core explanation of why this Announcement exists -- the canonical
  // content (like Summary's centralMessage). Not hard-required at the
  // component level, but the accepted prose must be non-empty for readiness.
  rationale: string;
  // The event/observation/finding that prompted the Announcement, if the
  // source states one.
  triggeringObservation?: string;
  // Present ONLY when the source asserts a cause or finding. Absent = the
  // Reason is objectives/rationale-shaped, not a cause claim. A rewrite must
  // never upgrade this toward certainty without an explicit user edit.
  causeStatus?: CauseStatus;
  // Rewrite-only cohesive paragraph(s); see SummaryFields.renderedText.
  renderedText?: string;
}
export type ReasonComponents = ReasonFields;
export type ReasonAccepted = ReasonFields;

// --- Action (lean; Option B hybrid) ------------------------------------------
//
// Per plan §10: one rough Action editor -> analysis reveals ONLY the item types
// it actually finds. Action is fundamentally a list of items, each tagged with a
// detected kind, never forced into the doc-1 category set. The kinds cover the
// evidence (hardware-change categories AND process/compliance requirements)
// without inventing categories the source doesn't support.

export type ActionKind =
  | "immediate" // an immediate action/instruction
  | "restriction" // old-part / prohibition ("Do Not order")
  | "short-term" // short-term solution
  | "long-term" // long-term solution
  | "operator" // operator instruction
  | "requirement" // a mandatory requirement or numbered step (process announcements)
  | "condition"; // a condition/limitation ("Missing confirmation = invalid LTO")

export interface ActionItem {
  id: string;
  kind: ActionKind;
  text: string;
  // Optional per-item facts that live inline in real announcements (deadlines,
  // responsible roles, references) rather than in global metadata.
  deadline?: string;
  responsibleRole?: string;
  reference?: string;
}

export interface ActionFields {
  // Optional lead/overview sentence before the itemized actions.
  lead?: string;
  items: ActionItem[];
}
export type ActionComponents = ActionFields;
export type ActionAccepted = ActionFields;

// --- Metadata (document-control only) ----------------------------------------
//
// Administrative doc-control fields only (plan §15). Content-affecting facts
// (part numbers, deadlines, scope) live inside their owning section's
// components, never duplicated here.

export interface AnnouncementMetadata {
  title: string;
  announcementNumber: string;
  inTouchId: string;
  date: string;
  gemsNo: string;
  classification: string;
}

// --- Draft -------------------------------------------------------------------

export interface AnnouncementSections {
  summary: SectionWorkspace<SummaryComponents, SummaryAccepted>;
  reason: SectionWorkspace<ReasonComponents, ReasonAccepted>;
  action: SectionWorkspace<ActionComponents, ActionAccepted>;
}

export interface AnnouncementDraft {
  documentType: "Announcement";
  schemaVersion: 1;
  identity: { id: string; createdAt: string };
  metadata: AnnouncementMetadata;
  sections: AnnouncementSections;
  workflow: { currentStage: WorkflowStage };
}

export type WorkflowStage = "drafting" | "details" | "reviewExport";

// --- Accepted-only view + snapshot -------------------------------------------
//
// Structural guarantee against "pending mistaken for accepted": this narrowed
// view exposes ONLY accepted/freshness from each section -- suggestion/
// analysis/raw are not part of the type at all. Readiness and the snapshot
// builder consume this shape, so they can never accidentally read pending
// content, and it is exactly the payload shape the backend export route
// accepts (the client can only ever send accepted state to build an export).

export interface SectionAcceptedView<T> {
  accepted: { value: T } | null;
  freshness: "fresh" | "stale";
}

export interface AnnouncementAcceptedSectionsView {
  summary: SectionAcceptedView<SummaryAccepted>;
  reason: SectionAcceptedView<ReasonAccepted>;
  action: SectionAcceptedView<ActionAccepted>;
}

export type ReadinessStatus = "Ready" | "Needs minor fixes" | "Needs major fixes" | "Blocked";

export interface Readiness {
  status: ReadinessStatus;
  blockingIssues: string[];
  warnings: string[];
}

export interface AnnouncementSnapshot {
  metadata: AnnouncementMetadata;
  summary: SummaryAccepted | null;
  reason: ReasonAccepted | null;
  action: ActionAccepted | null;
  readiness: Readiness;
}
