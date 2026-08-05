import { CorrectionRecord } from '../../types';
import { loadDeterministicRules, CompiledRule } from './ruleLookup';
import { logEvent } from '../logger';

/**
 * Post-generation deterministic auto-correct pass.
 *
 * Runs AFTER the model call and JSON parse/repair, BEFORE the response is
 * returned. Enforces the handbook's closed-set writing conventions (unit
 * notation, disallowed abbreviation expansions, canonical spellings) that the
 * deterministic rule set owns — the tier deliberately kept out of RAG because
 * probabilistic retrieval can't guarantee it.
 *
 * Boundary (see fcoSystemPrompt.ts "Preserve ... values exactly"): this pass
 * only rewrites unit *notation* / spelling *tokens*. The numeric magnitude is
 * never altered — the unit patterns capture and re-emit the trailing digit
 * (e.g. "109°C" -> "109 degC"), so "109" is preserved verbatim.
 *
 * Scope: applied only to fields the model freely rewords (summary prose,
 * procedure steps/notes/cautions/warnings, and the model's own whatWasEdited
 * log so it doesn't misreport the returned text). Verbatim carry-through
 * fields (part identifiers, tool lists, "[... required from submitter]"
 * placeholders) are never walked.
 */

function correctString(
  value: string,
  fieldPath: string,
  rules: CompiledRule[],
  out: CorrectionRecord[],
): string {
  if (typeof value !== 'string' || value.length === 0) return value;
  let current = value;
  for (const rule of rules) {
    const before = current;
    for (const p of rule.patterns) {
      p.regex.lastIndex = 0; // global regexes carry state between .replace calls
      current = current.replace(p.regex, p.replacement);
    }
    if (current !== before) {
      out.push({
        field: fieldPath,
        before,
        after: current,
        ruleType: rule.ruleType,
        ruleId: rule.ruleId,
      });
    }
  }
  return current;
}

function correctStringArray(
  arr: any,
  fieldPath: string,
  rules: CompiledRule[],
  out: CorrectionRecord[],
): void {
  if (!Array.isArray(arr)) return;
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] === 'string') {
      arr[i] = correctString(arr[i], `${fieldPath}[${i}]`, rules, out);
    }
  }
}

export interface DeterministicCorrectionResult {
  corrected: any;
  corrections: CorrectionRecord[];
}

/**
 * Mutates `finalized` in place, applying the deterministic rules to the
 * reworded text fields, and returns it alongside the list of corrections
 * actually made (empty if no rules fired or no rule set is present).
 */
export function applyDeterministicCorrections(finalized: any): DeterministicCorrectionResult {
  const corrections: CorrectionRecord[] = [];
  if (!finalized || typeof finalized !== 'object') {
    return { corrected: finalized, corrections };
  }

  const rules = loadDeterministicRules().rules;
  if (rules.length === 0) {
    return { corrected: finalized, corrections };
  }

  // --- rewrittenSummary: paragraph + the four PCSB component strings ---
  const summary = finalized.rewrittenSummary;
  if (summary && typeof summary === 'object') {
    for (const key of ['paragraph', 'problem', 'cause', 'solution', 'benefit']) {
      if (typeof summary[key] === 'string') {
        summary[key] = correctString(summary[key], `rewrittenSummary.${key}`, rules, corrections);
      }
    }
  }

  // --- rewrittenProcedure: section steps/notes/cautions/warnings + stepGroups ---
  const proc = finalized.rewrittenProcedure;
  if (proc && Array.isArray(proc.sections)) {
    proc.sections.forEach((section: any, si: number) => {
      if (!section || typeof section !== 'object') return;
      const base = `rewrittenProcedure.sections[${si}]`;
      correctStringArray(section.steps, `${base}.steps`, rules, corrections);
      correctStringArray(section.notes, `${base}.notes`, rules, corrections);
      correctStringArray(section.cautions, `${base}.cautions`, rules, corrections);
      correctStringArray(section.warnings, `${base}.warnings`, rules, corrections);
      if (Array.isArray(section.stepGroups)) {
        section.stepGroups.forEach((group: any, gi: number) => {
          if (group && Array.isArray(group.steps)) {
            correctStringArray(group.steps, `${base}.stepGroups[${gi}].steps`, rules, corrections);
          }
        });
      }
    });
  }

  // --- whatWasEdited: keep the model's self-reported edit log consistent with
  //     the text actually returned (otherwise it misreports the output). ---
  const edited = finalized.whatWasEdited;
  if (edited && typeof edited === 'object') {
    correctStringArray(edited.summaryWordingEdits, 'whatWasEdited.summaryWordingEdits', rules, corrections);
    correctStringArray(edited.procedureWordingEdits, 'whatWasEdited.procedureWordingEdits', rules, corrections);
  }

  if (corrections.length > 0) {
    logEvent('info', 'deterministic_corrections', {
      count: corrections.length,
      ruleIds: Array.from(new Set(corrections.map((c) => c.ruleId))),
    });
  }

  return { corrected: finalized, corrections };
}
