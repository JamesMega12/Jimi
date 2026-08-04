// Deterministic (non-AI) Simplified Technical English checks, built from the
// actual approved-word table and numbered rules in the SLB Techcomms
// handbook (`STE Handbook.pdf`, InTouch 6861590, read in full 2026-07-23 --
// not invented or paraphrased). These are a BACKSTOP: the rewrite prompts
// (see technicalAlertPrompts/*) now embed the same rules directly so the
// model applies them at generation time; this module catches what slips
// through. All findings here are warnings, never blocking -- STE is a
// writing-quality concern, not a safety gate (mandatory-language/uncertainty
// preservation, the actual safety gates, live in technicalAlertObligationGates.ts).

export interface SteFinding {
  rule: string;
  message: string;
}

// The approved/unapproved pairs from the handbook's "Commonly used approved
// word sample" table (page 1), verbs most likely to appear in Technical
// Alert instructional/descriptive text. Format: approved word -> unapproved
// alternatives to flag.
//
// "may" is handled SEPARATELY from the rest of this table (2026-07-23 fix,
// live-reported false positive): the handbook's "can" entry ("Can (v) |
// May (v), able to (v)") is about the PERMISSION/ABILITY sense of "may"
// ("you may use a torque wrench" -> "you can use a torque wrench"), not the
// HEDGING/EPISTEMIC sense ("this damage may be due to X" = "possibly is due
// to X") -- English "may" covers both senses and this checker cannot tell
// them apart by regex. In Reasons/Summary (descriptive content), "may"
// overwhelmingly appears as a hedge -- exactly the uncertainty language the
// safety gates protect -- so flagging it there was actively working against
// the uncertainty-preservation gate's own intent. "able to" has no such
// ambiguity (always capability, never hedging) and stays in the main table.
const MAY_MEANS_PERMISSION_NOT_HEDGE_MODE: 'instructional' = 'instructional';

const APPROVED_WORD_TABLE: Record<string, string[]> = {
  must: ['shall', 'should'], // Rule per handbook table: "must" is approved; "shall/should" are the unapproved alternatives for an obligation.
  can: ['able to'],
  adjust: ['alter', 'modify'],
  align: ['match'],
  apply: ['smear', 'distribute'],
  assemble: ['build', 'reassemble'],
  attach: ['stick'],
  change: ['alter'],
  clear: ['deselect'],
  connect: ['couple', 'join'],
  copy: ['duplicate'],
  cut: ['sever', 'clip', 'trim'],
  disassemble: ['dismantle', 'take apart'],
  discard: ['throw away', 'junk'],
  do: ['perform'],
  examine: ['check', 'evaluate'],
  fill: ['pack'],
  increase: ['raise', 'enlarge'],
  install: ['insert'],
  let: ['permit', 'allow'],
  lift: ['hoist'],
  loosen: ['back off', 'unscrew'],
  lubricate: ['grease', 'oil'],
  'make sure that': ['ascertain', 'confirm', 'ensure'],
  monitor: ['observe', 'track', 'watch'],
  move: ['convey', 'ease', 'slide'],
  pull: ['drag', 'draw'],
  push: ['depress', 'press'],
  put: ['place', 'position'],
  remove: ['unscrew', 'take off'],
  select: ['click', 'press', 'choose'],
  start: ['trigger'],
  stop: ['pause', 'suspend'],
  tighten: ['fasten', 'screw'],
  turn: ['rotate', 'roll'],
  use: ['utilize'],
};

// Word-count limits: Rule 5.1 (procedures/instructions, 20 words), Rule 6.3
// (descriptive writing, 25 words).
export function checkSentenceLength(text: string, mode: 'instructional' | 'descriptive'): SteFinding[] {
  if (!text || !text.trim()) return [];
  const limit = mode === 'instructional' ? 20 : 25;
  const rule = mode === 'instructional' ? 'STE 5.1' : 'STE 6.3';
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  const findings: SteFinding[] = [];
  for (const sentence of sentences) {
    const wordCount = sentence.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > limit) {
      findings.push({
        rule,
        message: `Sentence exceeds the ${limit}-word STE guideline (${wordCount} words): "${sentence.trim().slice(0, 60)}${sentence.length > 60 ? '…' : ''}"`,
      });
    }
  }
  return findings;
}

// Rule 4.2: no contractions or omitted words.
const CONTRACTION_PATTERN = /\b\w+'(t|re|s|ll|ve|d|m)\b/gi;
export function checkContractions(text: string): SteFinding[] {
  if (!text) return [];
  const matches = text.match(CONTRACTION_PATTERN);
  if (!matches || matches.length === 0) return [];
  return [{ rule: 'STE 4.2', message: `Contains contraction(s) not permitted by STE: ${[...new Set(matches)].join(', ')}` }];
}

// Rule 8.1: all standard punctuation except the semicolon.
export function checkSemicolons(text: string): SteFinding[] {
  if (!text || !text.includes(';')) return [];
  return [{ rule: 'STE 8.1', message: 'Contains a semicolon, which STE does not permit -- use two sentences or a connecting word instead.' }];
}

// Approved/unapproved word substitution (page 1 table). Warning-only,
// suggests the approved replacement -- never auto-rewrites the text. `mode`
// gates the "may" -> "can" suggestion (see the comment above
// APPROVED_WORD_TABLE) -- only checked in instructional content, where "may"
// is overwhelmingly the permission sense, not the hedging sense.
export function checkApprovedWords(text: string, mode: 'instructional' | 'descriptive'): SteFinding[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const findings: SteFinding[] = [];
  for (const [approved, unapproved] of Object.entries(APPROVED_WORD_TABLE)) {
    for (const bad of unapproved) {
      const pattern = new RegExp(`\\b${bad.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (pattern.test(lower)) {
        findings.push({
          rule: 'STE 1.1/9.4',
          message: `Consider the STE-approved word "${approved}" instead of "${bad}".`,
        });
      }
    }
  }
  if (mode === MAY_MEANS_PERMISSION_NOT_HEDGE_MODE && /\bmay\b/i.test(lower)) {
    findings.push({ rule: 'STE 1.1/9.4', message: 'Consider the STE-approved word "can" instead of "may".' });
  }
  return findings;
}

/** Runs all deterministic STE checks against a piece of rendered text (a
 * synthesized paragraph or instruction sentence). `mode` selects the
 * applicable sentence-length rule (5.1 for instructions, 6.3 for
 * descriptive prose) and gates the "may"->"can" word check -- everything
 * else applies uniformly. */
export function runSteChecks(text: string | undefined, mode: 'instructional' | 'descriptive'): SteFinding[] {
  if (!text || !text.trim()) return [];
  return [
    ...checkSentenceLength(text, mode),
    ...checkContractions(text),
    ...checkSemicolons(text),
    ...checkApprovedWords(text, mode),
  ];
}
