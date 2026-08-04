// Mirrors the "Do not weaken" list in technicalAlertSystemPrompt.ts, plus red tag (a control
// verb identified as unprotected during the Technical Alert workflow audit, 2026-07).
//
// 2026-07-23 revision: terms are grouped into SYNONYM-EQUIVALENCE CLASSES,
// not checked as isolated literal strings. Evidence: the SLB STE Handbook's
// approved-word table lists "must" as the approved term and "shall"/"should"
// as the unapproved alternatives for an obligation -- so a rewrite that
// correctly converts source "shall" into STE-preferred "must" is a SAFE,
// meaning-preserving substitution, not weakened language. Checking "shall"
// and "must" as two independent literal terms (the pre-revision behavior)
// would wrongly reject that rewrite as having dropped mandatory language.
// A class is "present" if ANY term in it is present; "dropped" only if NONE
// of its terms survive into the output.
const MANDATORY_TERM_CLASSES: string[][] = [
  ["must", "shall", "required"],
  ["prohibited", "must not", "shall not"],
  ["do not"],
  ["stop", "cease", "halt", "discontinue"],
  ["remove from service"],
  ["quarantine"],
  ["effective immediately"],
  ["revoked"],
  ["red tag"],
];

function collectText(...values: any[]): string {
  const parts: string[] = [];
  const walk = (v: any) => {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  values.forEach(walk);
  return parts.join(' \n ').toLowerCase();
}

function termPresent(term: string, text: string): boolean {
  if (term.includes(' ')) return text.includes(term);
  return new RegExp(`\\b${term}\\b`).test(text);
}

function classPresent(termClass: string[], text: string): boolean {
  return termClass.some(term => termPresent(term, text));
}

/**
 * Compares term CLASSES present in the grounding (raw source + prior analysis)
 * against the AI's rewritten output. Returns the canonical (first) term of any
 * class that appeared in grounding but has no surviving member in the output,
 * so a rewrite can be rejected before it reaches canonical state. A class with
 * a different member surviving (e.g. grounding said "shall", output says
 * "must") is NOT reported -- that's a safe synonym substitution, not a drop.
 * Defaults to the mandatory/control term classes; pass `termClasses` to check
 * a different vocabulary (e.g. hedging/uncertainty language -- see
 * technicalAlertObligationGates.ts). Each class may be a single term if no
 * meaningful synonym exists (most hedge terms).
 */
export function findDroppedMandatoryTerms(
  groundingValues: any[],
  outputValues: any[],
  termClasses: string[][] = MANDATORY_TERM_CLASSES
): string[] {
  const groundingText = collectText(...groundingValues);
  const outputText = collectText(...outputValues);
  return termClasses
    .filter(cls => classPresent(cls, groundingText) && !classPresent(cls, outputText))
    .map(cls => cls[0]);
}
