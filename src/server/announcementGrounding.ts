// Deterministic grounding backstops for Announcement rewrites -- the safety
// layer the plan (§11) calls the difference that matters: prompt wording alone
// is not enough. These are domain-neutral, token-overlap checks adapted from
// Technical Alert v2's technicalAlertObligationGates.ts (stripUnsupportedAdditions
// / groundRenderedText / referenceInventionGate), copied rather than imported so
// the Announcement module stays decoupled from the Technical Alert module.
//
// Known precision limit (shared by every token-overlap check in this codebase):
// they reliably catch a SUBSTANTIALLY invented value, but a mostly-grounded
// value with a small invented clause can dilute the ratio and slip through. The
// additive checks here are therefore warning-only, never blocking -- they strip
// the unsupported value back to absent and surface a warning, never reject an
// otherwise-good rewrite.

export interface GroundingWarning {
  gate: string;
  message: string;
}

const ADDITION_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "that", "this",
  "with", "be", "is", "are", "must", "shall", "will", "has", "have", "not",
]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !ADDITION_STOPWORDS.has(w));
}

function isSupportedByGrounding(value: string, groundingText: string): boolean {
  const words = significantWords(value);
  if (words.length === 0) return true; // nothing distinctive to check
  const supported = words.filter((w) => groundingText.includes(w)).length;
  return supported / words.length >= 0.5;
}

function collectText(values: any[]): string {
  const parts: string[] = [];
  const walk = (v: any) => {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  values.forEach(walk);
  return parts.join(" \n ");
}

/**
 * For each field in `optionalFields`: if it was absent in `pre` and is now
 * populated in `post`, and the new value is not supported by `groundingTexts`,
 * strip it back to undefined and add a warning. The rest of the rewrite
 * survives -- an invented single field is a narrow, common failure mode best
 * corrected silently (never letting it reach accepted state) rather than
 * forcing a full retry.
 */
export function stripUnsupportedAdditions<T extends Record<string, any>>(
  pre: T,
  post: T,
  groundingTexts: any[],
  optionalFields: (keyof T & string)[]
): { cleaned: T; warnings: GroundingWarning[] } {
  const groundingText = collectText(groundingTexts).toLowerCase();
  const cleaned: T = { ...post };
  const warnings: GroundingWarning[] = [];
  for (const field of optionalFields) {
    const preVal = pre[field];
    const postVal = cleaned[field];
    const preAbsent = preVal === undefined || preVal === null || (typeof preVal === "string" && !preVal.trim());
    const postPresent = typeof postVal === "string" && !!postVal.trim();
    if (preAbsent && postPresent && !isSupportedByGrounding(postVal, groundingText)) {
      warnings.push({
        gate: "unsupportedAddition",
        message: `"${String(field)}" was added by the rewrite ("${(postVal as string).slice(0, 60)}") but does not appear supported by the source -- it was removed. Add it manually if it is correct.`,
      });
      (cleaned as any)[field] = undefined;
    }
  }
  return { cleaned, warnings };
}

/**
 * Grounding check for a synthesized paragraph (renderedText). Unlike
 * stripUnsupportedAdditions there is no "was absent, now present" moment --
 * renderedText is freshly generated on every rewrite -- so this checks the
 * paragraph's distinctive words against the union of the (already-cleaned)
 * field values plus the raw source. If insufficiently supported, returns
 * text: undefined so the caller drops it and the field-list fallback renders.
 */
export function groundRenderedText(
  renderedText: string | undefined,
  groundedFieldValues: (string | undefined)[],
  rawText: string
): { text: string | undefined; warning: GroundingWarning | null } {
  if (!renderedText || !renderedText.trim()) return { text: renderedText, warning: null };
  const groundingText = collectText([...groundedFieldValues, rawText]).toLowerCase();
  if (isSupportedByGrounding(renderedText, groundingText)) return { text: renderedText, warning: null };
  return {
    text: undefined,
    warning: {
      gate: "unsupportedAddition",
      message:
        "The synthesized paragraph did not appear well-supported by the reviewed fields or source -- it was removed; the field-by-field view is shown instead. Try rewriting again, or edit the fields and re-rewrite.",
    },
  };
}

// Identifier/reference preservation: Announcements carry exact part numbers,
// InTouch IDs, standards, and question numbers that must never be invented or
// altered (plan §10/§11). Deterministic scan for standards-doc-like tokens and
// long digit runs appearing in the output but absent from grounding.
//
// Two INDEPENDENT patterns rather than one alternation on purpose: a combined
// regex consumes "PN 816345" as a single token, so the bare number "816345"
// would never be captured separately -- and a rewrite that legitimately drops
// the "PN " prefix ("part number 816345") would then be wrongly flagged as
// having invented "816345" (a confirmed false positive seen in live testing).
// Capturing the digit run on its own on BOTH sides makes "816345" match
// "PN 816345" in the source. Warning-only regardless (a plausible model/batch
// code could match the same shape), matching Technical Alert v2's policy.
const CODE_PATTERN = /\b[A-Z]{2,6}(?:-[A-Z0-9]{1,8}){1,5}\b/g;
const DIGIT_RUN_PATTERN = /\d{5,}/g;

function identifierTokens(text: string): Set<string> {
  const upper = text.toUpperCase();
  return new Set([...(upper.match(CODE_PATTERN) || []), ...(upper.match(DIGIT_RUN_PATTERN) || [])]);
}

export function identifierInventionWarnings(groundingTexts: any[], outputTexts: any[]): GroundingWarning[] {
  const groundingTokens = identifierTokens(collectText(groundingTexts));
  const outputTokens = identifierTokens(collectText(outputTexts));
  const invented = [...outputTokens].filter((t) => !groundingTokens.has(t));
  return invented.map((token) => ({
    gate: "identifierInvention",
    message: `Possible invented identifier/reference "${token}" appears in the rewrite but not in the source. Please verify.`,
  }));
}

// --- Reason-specific safeguards ----------------------------------------------

// Certainty ranking (matches Technical Alert v2's convention). A rewrite must
// never silently move a cause toward certainty; if the user explicitly edited
// the status that is allowed.
const CERTAINTY_RANK: Record<string, number> = { unknown: 0, suspected: 1, preliminary: 2, confirmed: 3 };

/**
 * Deterministic causeStatus preservation. If a rewrite upgraded the certainty
 * (e.g. suspected -> confirmed) without an explicit user edit, this REVERTS it
 * to the pre value and returns a warning -- the "must not present a suspected
 * cause as confirmed" invariant enforced in code, not just prompt wording.
 * Returns the status the caller should actually use.
 */
export function resolveCauseStatus(
  pre: string | undefined,
  post: string | undefined,
  userEdited: boolean
): { causeStatus: string | undefined; warning: GroundingWarning | null } {
  if (userEdited || !pre || !post) return { causeStatus: post, warning: null };
  if ((CERTAINTY_RANK[post] ?? 0) > (CERTAINTY_RANK[pre] ?? 0)) {
    return {
      causeStatus: pre,
      warning: {
        gate: "causeStatusUpgrade",
        message: `The rewrite moved the cause certainty from "${pre}" to a more certain "${post}" without an explicit change -- it was reverted to "${pre}". Edit the certainty yourself if the stronger claim is justified.`,
      },
    };
  }
  return { causeStatus: post, warning: null };
}

// Hedge-term classes for uncertainty preservation. One merged class (not one per
// term): the invariant is "did the text keep SOME uncertainty marker", not "did
// it keep this exact word" -- a paraphrase from "possibly" to "may" is fine.
const HEDGE_TERMS = ["suspected", "preliminary", "possibly", "possible", "may be", "may ", "under investigation", "not confirmed", "not yet confirmed", "unclear", "believed to"];

/**
 * If the grounding text hedges (any hedge term) but the output no longer
 * contains ANY hedge term, warn -- the rewrite may have asserted something as
 * more certain than the source supports. Warning-only (same literal-matching
 * precision limit as every token check here).
 */
// --- Action-specific safeguards ----------------------------------------------

interface ActionItemLike {
  kind: string;
  text: string;
}

/**
 * A legitimate Action rewrite polishes each item's wording; it must not merge or
 * drop items (which loses distinct instructions/restrictions/solution-stages --
 * plan §10) or silently re-categorize them. Compares pre/post by array position
 * (a rewrite keeps order). Warning-only, matching Announcement's lean posture:
 * the user reviews the pending suggestion before accepting.
 */
export function actionStructureWarnings(pre: ActionItemLike[], post: ActionItemLike[]): GroundingWarning[] {
  const warnings: GroundingWarning[] = [];
  if (pre.length !== post.length) {
    warnings.push({
      gate: "actionItemCount",
      message: `The rewrite changed the number of action items (${pre.length} -> ${post.length}). Distinct instructions, restrictions, and solution stages must not be merged or dropped -- please verify none were lost.`,
    });
  }
  const n = Math.min(pre.length, post.length);
  for (let i = 0; i < n; i++) {
    if (pre[i].kind !== post[i].kind) {
      warnings.push({
        gate: "actionKindChange",
        message: `Action item ${i + 1} changed category from "${pre[i].kind}" to "${post[i].kind}" -- verify the meaning was preserved (e.g. a restriction must not become a plain requirement).`,
      });
    }
  }
  return warnings;
}

export function uncertaintyPreservationWarnings(groundingTexts: any[], outputTexts: any[]): GroundingWarning[] {
  const grounding = collectText(groundingTexts).toLowerCase();
  const output = collectText(outputTexts).toLowerCase();
  const groundingHedged = HEDGE_TERMS.some((t) => grounding.includes(t));
  if (!groundingHedged) return [];
  const outputHedged = HEDGE_TERMS.some((t) => output.includes(t));
  if (outputHedged) return [];
  return [
    {
      gate: "uncertaintyPreservation",
      message: "The source used hedging/uncertainty language but the rewrite does not -- verify it has not stated a suspected or preliminary point as confirmed fact.",
    },
  ];
}
