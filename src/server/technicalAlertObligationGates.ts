import { findDroppedMandatoryTerms } from './technicalAlertSemanticSafety';
import {
  NormalizedActionItem,
  NormalizedExceptionRecord,
  NormalizedImmediateActionResult,
  NormalizedFollowUpActionResult,
  NormalizedReasonsResult,
  NormalizedSummaryResult,
  CauseStatus,
} from './technicalAlertNormalizerV2';

// The five structural rewrite-safety gates from the v2 refactor plan's "AI
// Pipeline Design" section. Each returns a list of human-readable violation
// messages; an empty array means the gate passed. These are deterministic
// checks over structured data -- not prompt wording -- because prompt wording
// alone is not sufficient protection (the refactor plan's central AI-safety
// thesis, and the reason this module exists at all).

export interface GateViolation {
  gate: string;
  message: string;
}

// Gate 1: mandatory-term preservation. Reuses the existing, already-proven
// Phase B implementation unchanged -- no reason to reimplement it.
export function mandatoryTermGate(groundingTexts: any[], outputTexts: any[]): GateViolation[] {
  const dropped = findDroppedMandatoryTerms(groundingTexts, outputTexts);
  return dropped.map(term => ({
    gate: 'mandatoryTerm',
    message: `Mandatory language "${term}" present in the source was not found in the rewrite.`,
  }));
}

// Gate 2: obligation-strength preservation. Matches pre/post action items by
// array position (a legitimate rewrite polishes wording per item, it does not
// reorder or restructure -- see "Section Component Models" in the refactor
// plan). A changed item count is itself a violation: it means items were
// silently merged or dropped.
export function obligationStrengthPreservationGate(
  pre: NormalizedActionItem[],
  post: NormalizedActionItem[]
): GateViolation[] {
  const violations: GateViolation[] = [];
  if (pre.length !== post.length) {
    violations.push({
      gate: 'obligationStrength',
      message: `Rewrite changed the number of action items (${pre.length} → ${post.length}); items must not be silently merged or dropped.`,
    });
    return violations;
  }
  const PROTECTED = new Set(['mandatory', 'prohibited']);
  pre.forEach((preItem, i) => {
    const postItem = post[i];
    if (PROTECTED.has(preItem.obligationStrength) && postItem.obligationStrength !== preItem.obligationStrength) {
      violations.push({
        gate: 'obligationStrength',
        message: `Action item ${i + 1} obligation strength changed from "${preItem.obligationStrength}" to "${postItem.obligationStrength}" without an explicit user edit.`,
      });
    }
  });
  return violations;
}

// Gate 3: exception-detachment. A rewrite must not reduce the limitations,
// approvers, or evidence requirements attached to an exception still in use,
// nor drop the applies-to link -- the structural guarantee that a condition
// can never detach from its exception (locked decision #6).
export function exceptionDetachmentGate(
  pre: NormalizedExceptionRecord[],
  post: NormalizedExceptionRecord[]
): GateViolation[] {
  const violations: GateViolation[] = [];
  if (pre.length > post.length) {
    violations.push({
      gate: 'exceptionDetachment',
      message: `Rewrite dropped ${pre.length - post.length} exception record(s) present in the source.`,
    });
  }
  pre.forEach((preEx, i) => {
    const postEx = post[i];
    if (!postEx) return; // already flagged above
    if (postEx.limitations.length < preEx.limitations.length) {
      violations.push({
        gate: 'exceptionDetachment',
        message: `Exception ${i + 1} lost ${preEx.limitations.length - postEx.limitations.length} limitation(s) in the rewrite.`,
      });
    }
    if (postEx.requiredApprovers.length < preEx.requiredApprovers.length) {
      violations.push({
        gate: 'exceptionDetachment',
        message: `Exception ${i + 1} lost required approver(s) in the rewrite.`,
      });
    }
    if (preEx.appliesTo.length > 0 && postEx.appliesTo.length === 0) {
      violations.push({
        gate: 'exceptionDetachment',
        message: `Exception ${i + 1} became detached from the action item(s) it applies to.`,
      });
    }
  });
  return violations;
}

// Gate 4: uncertainty preservation. Generic hedge-term check applicable to any
// free-text field (not just Reasons' dedicated causeStatus) -- if the source
// hedges ("suspected", "preliminary", "may", "possibly", "under
// investigation", "not confirmed", "unclear"), the rewrite must not silently
// assert certainty. Same literal-matching limitation as the mandatory-term
// gate (see plan Insight I9/I9a) -- a known, accepted precision trade-off for
// this vertical slice, not a hidden one.
// ONE merged class, not one class per term (2026-07-23 fix, live-reported
// false positive: a Reasons rewrite legitimately reworded "possibly" as a
// different hedge word during paraphrase/STE polish -- e.g. "may" -- and was
// wrongly rejected as "asserted as certain" even though the output was still
// hedged, just with different wording). The real invariant to protect is
// "did the text keep SOME uncertainty marker, or did it drop hedging
// entirely and state something as flat fact" -- not "did it keep this exact
// word." Treating each hedge word as its own isolated class (the original
// 2026-07-23 revision, one commit before this one) was over-strict in
// exactly the same way the old literal mandatory-term list was before the
// must/shall synonym-class fix earlier this session -- same root cause,
// same fix shape, applied here too.
const HEDGE_TERM_CLASSES: string[][] = [
  ['suspected', 'preliminary', 'possibly', 'possible', 'under investigation', 'not confirmed', 'unclear', 'may '],
];

export function uncertaintyPreservationGate(groundingTexts: any[], outputTexts: any[]): GateViolation[] {
  const dropped = findDroppedMandatoryTerms(groundingTexts, outputTexts, HEDGE_TERM_CLASSES);
  return dropped.map(() => ({
    gate: 'uncertaintyPreservation',
    message: `Hedging/uncertainty language present in the source no longer appears anywhere in the rewrite -- it may have been asserted as more certain than the source supports.`,
  }));
}

// Gate 5: reference-invention check. Deterministic regex scan for
// standards-doc-like tokens (matches the real pattern seen in both reviewed
// WCF TA PDFs: WEC-SQ-S07-G05-P04, WEC-SQ-S10A) appearing in the output but
// absent from grounding. Per Insight I9, this ships as a WARNING (not a
// rejection) until real usage data establishes an acceptable false-positive
// rate -- a plausible equipment model number or batch code could match the
// same shape and get wrongly flagged.
const REFERENCE_PATTERN = /\b[A-Z]{2,6}(?:-[A-Z0-9]{1,8}){1,5}\b/g;

export function referenceInventionGate(groundingTexts: any[], outputTexts: any[]): GateViolation[] {
  const groundingText = collectText(groundingTexts).toUpperCase();
  const outputText = collectText(outputTexts).toUpperCase();
  const groundingTokens = new Set(groundingText.match(REFERENCE_PATTERN) || []);
  const outputTokens = new Set(outputText.match(REFERENCE_PATTERN) || []);
  const invented = [...outputTokens].filter(t => !groundingTokens.has(t));
  return invented.map(token => ({
    gate: 'referenceInvention',
    message: `Possible invented reference/identifier "${token}" appears in the rewrite but not in the source. Please verify.`,
  }));
}

// Gate 6 (NEW, 2026-07-23): unsupported-addition check -- the missing half of
// the grounding story the original 5 gates never covered. Gates 1-4 only ever
// detect DROPPED content (something present in grounding, absent from
// output); none of them detect an ADDITION -- a value the model invented for
// a field the reviewed components left absent. This is the direct,
// deterministic backstop for Problem 1 ("must not fill missing components
// with invented data").
//
// Deliberately asymmetric vs. gates 1-4: rather than blocking the whole
// rewrite, this STRIPS the unsupported value back to absent and returns a
// warning. An invented single field is a narrower, more common failure mode
// than a genuine safety weakening -- silently correcting it (never letting
// it reach accepted state) is safer AND friendlier than forcing a full retry
// over an otherwise-good rewrite.
const ADDITION_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'that', 'this',
  'with', 'be', 'is', 'are', 'must', 'shall', 'will', 'has', 'have', 'not',
]);
function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 3 && !ADDITION_STOPWORDS.has(w));
}
function isSupportedByGrounding(value: string, groundingText: string): boolean {
  const words = significantWords(value);
  if (words.length === 0) return true; // nothing distinctive enough to check -- don't over-block short/generic values
  const supported = words.filter(w => groundingText.includes(w)).length;
  return supported / words.length >= 0.5; // at least half the distinctive words traceable to the source
}

/**
 * For each field named in `optionalFields`: if it was null/absent in `pre`
 * and is now populated in `post`, checks whether the new value is supported
 * by `groundingTexts`. If not, strips it back to undefined in the returned
 * `cleaned` object and adds a warning -- the field is never silently allowed
 * to reach accepted state ungrounded, but the rest of the rewrite survives.
 */
export function stripUnsupportedAdditions<T extends Record<string, any>>(
  pre: T,
  post: T,
  groundingTexts: any[],
  optionalFields: (keyof T & string)[]
): { cleaned: T; warnings: GateViolation[] } {
  const groundingText = collectText(groundingTexts).toLowerCase();
  const cleaned: T = { ...post };
  const warnings: GateViolation[] = [];
  for (const field of optionalFields) {
    const preVal = pre[field];
    const postVal = cleaned[field];
    const preAbsent = preVal === undefined || preVal === null || (typeof preVal === 'string' && !preVal.trim());
    const postPresent = typeof postVal === 'string' && !!postVal.trim();
    if (preAbsent && postPresent && !isSupportedByGrounding(postVal, groundingText)) {
      warnings.push({
        gate: 'unsupportedAddition',
        message: `"${String(field)}" was added by the rewrite ("${(postVal as string).slice(0, 60)}") but does not appear to be supported by the source -- it was removed. Add it manually if it is correct.`,
      });
      (cleaned as any)[field] = undefined;
    }
  }
  return { cleaned, warnings };
}

/**
 * Grounding check for a synthesized paragraph (Summary's/Reasons' `renderedText`)
 * itself, not just the re-derived breakdown fields (2026-07-28 fix). Unlike
 * `stripUnsupportedAdditions`, `renderedText` is always freshly generated on
 * every rewrite -- there's no "was absent, now present" moment to key off of
 * -- so this checks the paragraph's distinctive words against the union of
 * the (already-cleaned) breakdown field values plus the raw source, the same
 * token-overlap technique as `isSupportedByGrounding` above. If insufficiently
 * supported, returns `text: undefined` (not a partial edit -- there's no safe
 * way to "fix" a paragraph) so the caller drops it entirely and the existing
 * field-list fallback rendering takes over, exactly mirroring the per-item
 * fallback design already proven for Immediate/Follow-Up Action's
 * `instructionText` (`groundInstructionText` below).
 *
 * Known precision limit (same class as every other token-overlap check in
 * this codebase, e.g. Insight I9/I9a): reliably catches a paragraph that is
 * SUBSTANTIALLY invented, but a mostly-grounded paragraph with one small
 * invented clause tacked on can dilute the ratio above the 0.5 threshold and
 * slip through. Warning-only, never blocking, for exactly this reason.
 */
export function groundRenderedText(
  renderedText: string | undefined,
  groundedFieldValues: (string | undefined)[],
  rawText: string
): { text: string | undefined; warning: GateViolation | null } {
  if (!renderedText || !renderedText.trim()) return { text: renderedText, warning: null };
  const groundingText = collectText([...groundedFieldValues, rawText]).toLowerCase();
  if (isSupportedByGrounding(renderedText, groundingText)) return { text: renderedText, warning: null };
  return {
    text: undefined,
    warning: {
      gate: 'unsupportedAddition',
      message: 'The synthesized paragraph did not appear well-supported by the reviewed fields or source -- it was removed; the field-by-field view is shown instead. Try rewriting again, or edit the fields and re-rewrite.',
    },
  };
}

function collectText(values: any[]): string {
  const parts: string[] = [];
  const walk = (v: any) => {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  values.forEach(walk);
  return parts.join(' \n ');
}

export interface GateRunResult {
  blocking: GateViolation[];
  warnings: GateViolation[];
}

/**
 * Per-item grounding check for the new `instructionText` field (Phase 3,
 * 2026-07-23): instructionText is always synthesized fresh on every rewrite
 * (unlike Summary/Reasons' renderedText, it has no "was absent, now
 * present" moment to key off of), so the check is different in shape from
 * stripUnsupportedAdditions -- it verifies the synthesized sentence's
 * distinctive words are substantially covered by that item's OWN reviewed
 * fields (requiredAction/target/timing/condition) plus the raw source,
 * rather than comparing against a prior value. If not well-supported, the
 * field is stripped back to absent (renderers fall back to stitching the
 * structured fields together) and a warning is raised -- never blocking,
 * same asymmetric reasoning as stripUnsupportedAdditions.
 */
export function groundInstructionText(items: NormalizedActionItem[], rawText: string): { cleaned: NormalizedActionItem[]; warnings: GateViolation[] } {
  const warnings: GateViolation[] = [];
  const cleaned = items.map((item, i) => {
    if (!item.instructionText) return item;
    const ownFieldsText = [item.requiredAction, item.target, item.timing, item.condition].filter(Boolean).join(' ');
    const groundingText = `${ownFieldsText} ${rawText}`.toLowerCase();
    if (isSupportedByGrounding(item.instructionText, groundingText)) return item;
    warnings.push({
      gate: 'unsupportedAddition',
      message: `Action item ${i + 1}'s synthesized instruction text ("${item.instructionText.slice(0, 60)}") does not appear well-supported by its own fields or the source -- it was removed, the structured fields will be shown instead.`,
    });
    return { ...item, instructionText: undefined };
  });
  return { cleaned, warnings };
}

/** Runs all 5 gates for an Immediate Action rewrite and separates blocking
 * violations (gates 1-4) from warning-only ones (gate 5, per Insight I9). */
export function runImmediateActionGates(
  groundingTexts: any[],
  pre: NormalizedImmediateActionResult,
  post: NormalizedImmediateActionResult
): GateRunResult {
  const outputTexts = [post];
  const blocking = [
    ...mandatoryTermGate(groundingTexts, outputTexts),
    ...obligationStrengthPreservationGate(pre.items, post.items),
    ...exceptionDetachmentGate(pre.exceptions, post.exceptions),
    ...uncertaintyPreservationGate(groundingTexts, outputTexts),
  ];
  const warnings = referenceInventionGate(groundingTexts, outputTexts);
  return { blocking, warnings };
}

// --- Follow-Up Action gates ------------------------------------------------

const COMPLETED_TENSE_MARKERS = ['has been installed', 'has been implemented', 'has been replaced', 'was installed', 'was implemented', 'was replaced', 'has been completed'];

/** A planned/future engineering control must read as future, never as already
 * in place -- the refactor plan's explicit "must not incorrectly present a
 * future engineering control as already implemented" requirement. Checks
 * BOTH requiredAction and instructionText (2026-07-23) -- instructionText is
 * what actually gets shown/exported once present, so a rewrite that keeps
 * requiredAction future-phrased but slips completed-tense wording into the
 * new synthesized instructionText must still be caught. */
export function futureTenseGate(items: NormalizedActionItem[]): GateViolation[] {
  const violations: GateViolation[] = [];
  items.forEach((it, i) => {
    if (it.followUpCategory !== 'engineering_change') return;
    const texts = [it.requiredAction, it.instructionText].filter(Boolean).map(t => (t as string).toLowerCase());
    for (const text of texts) {
      const matched = COMPLETED_TENSE_MARKERS.find(marker => text.includes(marker));
      if (matched) {
        violations.push({
          gate: 'futureTense',
          message: `Follow-up item ${i + 1} is tagged "engineering_change" (a planned control) but is phrased as already completed ("${matched}"). Planned controls must read as future.`,
        });
        break;
      }
    }
  });
  return violations;
}

export function runFollowUpActionGates(
  groundingTexts: any[],
  pre: NormalizedFollowUpActionResult,
  post: NormalizedFollowUpActionResult
): GateRunResult {
  const outputTexts = [post];
  const blocking = [
    ...mandatoryTermGate(groundingTexts, outputTexts),
    ...obligationStrengthPreservationGate(pre.items, post.items),
    ...uncertaintyPreservationGate(groundingTexts, outputTexts),
    ...futureTenseGate(post.items),
  ];
  const warnings = referenceInventionGate(groundingTexts, outputTexts);
  return { blocking, warnings };
}

// --- Reasons gates -----------------------------------------------------------

const CERTAINTY_RANK: Record<CauseStatus, number> = { unknown: 0, suspected: 1, preliminary: 2, confirmed: 3 };

/** causeStatus must never be silently upgraded toward certainty by a rewrite
 * -- it is a user-owned field once extracted; a rewrite may only change it if
 * the user edited it directly (the caller passes `userEditedCauseStatus` to
 * distinguish that case). */
export function causeStatusPreservationGate(
  preCauseStatus: CauseStatus | undefined,
  postCauseStatus: CauseStatus | undefined,
  userEditedCauseStatus: boolean
): GateViolation[] {
  if (userEditedCauseStatus || !preCauseStatus || !postCauseStatus) return [];
  if (CERTAINTY_RANK[postCauseStatus] > CERTAINTY_RANK[preCauseStatus]) {
    return [
      {
        gate: 'causeStatusPreservation',
        message: `Cause status was silently upgraded from "${preCauseStatus}" to "${postCauseStatus}" without an explicit user edit.`,
      },
    ];
  }
  return [];
}

export function runReasonsGates(
  groundingTexts: any[],
  pre: NormalizedReasonsResult,
  post: NormalizedReasonsResult,
  userEditedCauseStatus: boolean = false
): GateRunResult {
  const outputTexts = [post];
  const blocking = [
    ...mandatoryTermGate(groundingTexts, outputTexts),
    ...uncertaintyPreservationGate(groundingTexts, outputTexts),
    ...causeStatusPreservationGate(pre.narrative?.causeStatus, post.narrative?.causeStatus, userEditedCauseStatus),
  ];
  const warnings = referenceInventionGate(groundingTexts, outputTexts);
  return { blocking, warnings };
}

// --- Summary gates -----------------------------------------------------------

/** Mirrors the obligation-strength gate's intent for Summary's flat fields:
 * a stated central requirement/prohibition/revocation must not silently
 * disappear in a rewrite. */
export function centralClaimPreservationGate(pre: NormalizedSummaryResult, post: NormalizedSummaryResult): GateViolation[] {
  const violations: GateViolation[] = [];
  (['centralRequirement', 'centralProhibition', 'revocation'] as const).forEach(field => {
    if (pre[field] && !post[field]) {
      violations.push({
        gate: 'centralClaimPreservation',
        message: `Summary's "${field}" was present in the prior version but is missing from the rewrite.`,
      });
    }
  });
  return violations;
}

export function runSummaryGates(groundingTexts: any[], pre: NormalizedSummaryResult, post: NormalizedSummaryResult): GateRunResult {
  const outputTexts = [post];
  const blocking = [
    ...mandatoryTermGate(groundingTexts, outputTexts),
    ...uncertaintyPreservationGate(groundingTexts, outputTexts),
    ...centralClaimPreservationGate(pre, post),
  ];
  const warnings = referenceInventionGate(groundingTexts, outputTexts);
  return { blocking, warnings };
}
