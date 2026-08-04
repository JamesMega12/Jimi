import { randomUUID } from 'crypto';

function str(v: any): string {
  return typeof v === 'string' ? v : '';
}
function strArray(v: any): string[] {
  return Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : [];
}
function optStr(v: any): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

const OBLIGATION_STRENGTHS = new Set(['mandatory', 'prohibited', 'conditional', 'advisory', 'unclear']);
const CONTROL_TYPES = new Set(['removal_from_service', 'red_tag', 'quarantine', 'escalation']);

export interface NormalizedActionItem {
  id: string;
  actor: string[];
  requiredAction: string;
  target?: string;
  timing?: string;
  condition?: string;
  obligationStrength: string;
  controlType?: string[];
  followUpCategory?: string;
  // Only present on a rewrite response (never analyze) -- see types.ts
  // ActionItem.instructionText.
  instructionText?: string;
  requiredEvidence?: string;
  references?: string[];
  exceptionRef?: string;
}

export interface NormalizedExceptionRecord {
  id: string;
  appliesTo: string[];
  condition: string;
  limitations: string[];
  requiredApprovers: string[];
  requiredEvidence: string[];
  submissionSystem?: string;
  relatedStandard?: string;
}

export interface NormalizedImmediateActionResult {
  items: NormalizedActionItem[];
  exceptions: NormalizedExceptionRecord[];
}

function normalizeControlType(v: any): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const tags = v.filter((x: any) => typeof x === 'string' && CONTROL_TYPES.has(x));
  return tags.length > 0 ? tags : undefined;
}

const FOLLOW_UP_CATEGORIES = new Set(['monitoring', 'reporting', 'procedural_update', 'replacement', 'engineering_change', 'way_forward']);
function normalizeFollowUpCategory(v: any): string | undefined {
  return typeof v === 'string' && FOLLOW_UP_CATEGORIES.has(v) ? v : undefined;
}

// Preserves a caller-supplied id when present (this is used both to normalize
// fresh model output, which has no ids yet, AND to re-normalize
// already-normalized client-supplied "components" grounding for a rewrite
// call -- minting a new id every time would silently break appliesTo
// references from a prior normalize pass).
function normalizeActionItem(a: any): NormalizedActionItem {
  return {
    id: typeof a?.id === 'string' && a.id.trim() ? a.id : randomUUID(),
    actor: strArray(a?.actor),
    requiredAction: str(a?.requiredAction),
    target: optStr(a?.target),
    timing: optStr(a?.timing),
    condition: optStr(a?.condition),
    obligationStrength: OBLIGATION_STRENGTHS.has(a?.obligationStrength) ? a.obligationStrength : 'unclear',
    controlType: normalizeControlType(a?.controlType),
    followUpCategory: normalizeFollowUpCategory(a?.followUpCategory),
    instructionText: optStr(a?.instructionText),
    requiredEvidence: optStr(a?.requiredEvidence),
    references: strArray(a?.references).length > 0 ? strArray(a?.references) : undefined,
  };
}

/**
 * Normalizes the model's { items, exceptions } response for Immediate Action.
 * Strips unrecognized fields (defense against invented structure), coerces
 * types, and -- critically -- remaps the model's 0-based-index `appliesTo`
 * references (it doesn't know real ids yet) into the real generated
 * ActionItem ids, so ExceptionRecord.appliesTo/ActionItem.exceptionRef are
 * consistent by the time this returns.
 */
export function normalizeImmediateActionResult(result: any): NormalizedImmediateActionResult {
  const rawItems: any[] = Array.isArray(result?.items) ? result.items : [];
  const items: NormalizedActionItem[] = rawItems.map(normalizeActionItem);

  const itemIds = new Set(items.map(i => i.id));

  // appliesTo entries are one of two things depending on the caller:
  //  - a real item id, if this is already-normalized client-supplied state
  //    (a rewrite's "components" grounding) -- used as-is;
  //  - a 0-based index into `items`, if this is fresh model output (the model
  //    doesn't know real ids yet -- see immediateActionPrompt.ts).
  function resolveAppliesToRef(ref: string): string | null {
    if (itemIds.has(ref)) return ref;
    const idx = Number.parseInt(ref, 10);
    return Number.isInteger(idx) && idx >= 0 && idx < items.length ? items[idx].id : null;
  }

  const rawExceptions: any[] = Array.isArray(result?.exceptions) ? result.exceptions : [];
  const exceptions: NormalizedExceptionRecord[] = rawExceptions.map((e: any) => {
    const indexRefs: string[] = strArray(e?.appliesTo);
    const resolvedIds = indexRefs.map(resolveAppliesToRef).filter((id): id is string => id !== null);
    return {
      id: typeof e?.id === 'string' && e.id.trim() ? e.id : randomUUID(),
      appliesTo: resolvedIds,
      condition: str(e?.condition),
      limitations: strArray(e?.limitations),
      requiredApprovers: strArray(e?.requiredApprovers),
      requiredEvidence: strArray(e?.requiredEvidence),
      submissionSystem: optStr(e?.submissionSystem),
      relatedStandard: optStr(e?.relatedStandard),
    };
  });

  // Back-link: for every exception, stamp exceptionRef on the action items it applies to.
  for (const exception of exceptions) {
    for (const itemId of exception.appliesTo) {
      const item = items.find(i => i.id === itemId);
      if (item) item.exceptionRef = exception.id;
    }
  }

  return { items, exceptions };
}

// --- Follow-Up Action ---------------------------------------------------------

export interface NormalizedFollowUpActionResult {
  items: NormalizedActionItem[];
  notApplicable: boolean;
}

/** Follow-Up Action shares ActionItem's shape but has no exceptions of its own
 * (locked decision: exceptions are scoped to Immediate Action only) and adds
 * an explicit, auditable `notApplicable` flag rather than allowing silent
 * omission (per the refactor plan's readiness design). */
export function normalizeFollowUpActionResult(result: any): NormalizedFollowUpActionResult {
  const rawItems: any[] = Array.isArray(result?.items) ? result.items : [];
  return {
    items: rawItems.map(normalizeActionItem),
    notApplicable: result?.notApplicable === true,
  };
}

// --- Reasons -------------------------------------------------------------------

export type CauseStatus = 'confirmed' | 'preliminary' | 'suspected' | 'unknown';
const CAUSE_STATUSES = new Set<CauseStatus>(['confirmed', 'preliminary', 'suspected', 'unknown']);

export interface NormalizedReasonsNarrative {
  technicalBasis?: string;
  complianceBasis?: string;
  consequence?: string;
  causeStatus: CauseStatus;
  references?: string[];
  // Only present on a rewrite response (never analyze) -- see types.ts
  // ReasonsNarrative.renderedText.
  renderedText?: string;
}
export interface NormalizedEvidenceItem {
  id: string;
  component: string;
  concern: string;
  evidence?: string;
  imageRef?: string;
}
export interface NormalizedReasonsResult {
  narrative?: NormalizedReasonsNarrative;
  evidenceItems?: NormalizedEvidenceItem[];
}

export const REASONS_NARRATIVE_OPTIONAL_FIELDS: (keyof NormalizedReasonsNarrative)[] = ['technicalBasis', 'complianceBasis', 'consequence'];

/** Never lets causeStatus default to "confirmed" -- an invalid or missing
 * value is coerced to "unknown", the conservative choice, never the most
 * certain one. */
export function normalizeReasonsResult(result: any): NormalizedReasonsResult {
  const normalized: NormalizedReasonsResult = {};

  if (result?.narrative && typeof result.narrative === 'object') {
    // Deliberately no "hasContent" gate here (2026-07-23 fix): a narrative
    // the user added but hasn't filled in yet (e.g. just clicked "Add
    // Narrative", set only causeStatus) must still count as "a narrative
    // exists" going INTO a rewrite -- otherwise the rewrite route's
    // must-not-invent-a-narrative-from-nothing safeguard would incorrectly
    // treat a real, deliberately-started narrative as if it never existed,
    // and strip whatever the AI legitimately fills in. The model's own
    // ANALYZE prompt is separately instructed to return `narrative: null`
    // (not an empty object) when the source has no narrative content, so
    // this doesn't reopen the door to inventing placeholder narratives from
    // analysis of a source that has none.
    const n = result.narrative;
    const causeStatus: CauseStatus = CAUSE_STATUSES.has(n?.causeStatus) ? n.causeStatus : 'unknown';
    normalized.narrative = {
      technicalBasis: optStr(n?.technicalBasis),
      complianceBasis: optStr(n?.complianceBasis),
      consequence: optStr(n?.consequence),
      causeStatus,
      references: strArray(n?.references).length > 0 ? strArray(n?.references) : undefined,
      renderedText: optStr(n?.renderedText),
    };
  }

  const rawEvidence: any[] = Array.isArray(result?.evidenceItems) ? result.evidenceItems : [];
  const evidenceItems: NormalizedEvidenceItem[] = rawEvidence
    .filter((e: any) => optStr(e?.component) || optStr(e?.concern))
    .map((e: any) => ({
      id: typeof e?.id === 'string' && e.id.trim() ? e.id : randomUUID(),
      component: str(e?.component),
      concern: str(e?.concern),
      evidence: optStr(e?.evidence),
      imageRef: optStr(e?.imageRef),
    }));
  if (evidenceItems.length > 0) normalized.evidenceItems = evidenceItems;

  return normalized;
}

// --- Summary ---------------------------------------------------------------

export interface NormalizedSummaryResult {
  subject: string;
  affectedScope: string;
  riskOrIssue?: string;
  centralRequirement?: string;
  centralProhibition?: string;
  revocation?: string;
  effectiveTiming?: string;
  exceptionNote?: string;
  // Only present on a rewrite response (never on analyze) -- see types.ts
  // SummaryFields.renderedText for the full rationale.
  renderedText?: string;
}

export const SUMMARY_OPTIONAL_FIELDS: (keyof NormalizedSummaryResult)[] = [
  'riskOrIssue',
  'centralRequirement',
  'centralProhibition',
  'revocation',
  'effectiveTiming',
  'exceptionNote',
];

export function normalizeSummaryResultV2(result: any): NormalizedSummaryResult {
  return {
    subject: str(result?.subject),
    affectedScope: str(result?.affectedScope),
    riskOrIssue: optStr(result?.riskOrIssue),
    centralRequirement: optStr(result?.centralRequirement),
    centralProhibition: optStr(result?.centralProhibition),
    revocation: optStr(result?.revocation),
    effectiveTiming: optStr(result?.effectiveTiming),
    exceptionNote: optStr(result?.exceptionNote),
    renderedText: optStr(result?.renderedText),
  };
}
