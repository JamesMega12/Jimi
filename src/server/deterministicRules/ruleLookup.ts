import fs from 'fs';
import path from 'path';
import { logEvent } from '../logger';

/**
 * Loads the hand-curated, human-reviewed deterministic writing-convention
 * rule set (data/deterministicRules/rules.json) once at first use and caches
 * the compiled result. This is the "100%-correct-by-construction" tier of the
 * hybrid architecture: closed-set / tabular handbook content (unit symbols,
 * disallowed abbreviation expansions, canonical spellings) is enforced as a
 * deterministic post-generation pass rather than left to probabilistic
 * retrieval — see autoCorrectPass.ts and docs/SYSTEM_KNOWLEDGE.md.
 *
 * No runtime PDF parsing, no LLM, no network: the rule set is a committed,
 * versioned, reviewed artifact produced offline by
 * scripts/extractDeterministicRules.ts.
 */

// JIMI_DETERMINISTIC_RULES_DIR lets tests point at a fixture dir. Mirrors the
// committed-registry path convention used by systemKnowledge/manifest.ts.
function rulesDir(): string {
  return process.env.JIMI_DETERMINISTIC_RULES_DIR
    ? path.resolve(process.env.JIMI_DETERMINISTIC_RULES_DIR)
    : path.join(process.cwd(), 'data', 'deterministicRules');
}

function rulesFile(): string {
  return path.join(rulesDir(), 'rules.json');
}

interface RawPattern {
  regex: string;
  replacement: string;
}
interface RawRule {
  ruleId: string;
  ruleType: string;
  patterns: RawPattern[];
  correctForm?: string;
  comment?: string;
}

export interface CompiledPattern {
  regex: RegExp;
  replacement: string;
}
export interface CompiledRule {
  ruleId: string;
  ruleType: string;
  patterns: CompiledPattern[];
}
export interface CompiledRuleSet {
  version: string;
  sourceRange: string;
  rules: CompiledRule[];
}

let cache: CompiledRuleSet | null = null;

function compileRule(raw: RawRule): CompiledRule | null {
  const patterns: CompiledPattern[] = [];
  for (const p of raw.patterns || []) {
    try {
      // Global so every occurrence in a field is corrected, not just the first.
      patterns.push({ regex: new RegExp(p.regex, 'g'), replacement: p.replacement });
    } catch (err: any) {
      logEvent('error', 'deterministic_rules_load', {
        message: `Invalid regex in rule ${raw.ruleId}: ${p.regex} (${err?.message || err})`,
      });
    }
  }
  if (patterns.length === 0) return null;
  return { ruleId: raw.ruleId, ruleType: raw.ruleType, patterns };
}

/**
 * Returns the compiled rule set. Missing/invalid file degrades to an empty
 * rule set (the auto-correct pass then becomes a no-op) rather than throwing —
 * a missing convention table must never break the rewrite endpoint.
 */
export function loadDeterministicRules(): CompiledRuleSet {
  if (cache) return cache;

  const file = rulesFile();
  if (!fs.existsSync(file)) {
    logEvent('info', 'deterministic_rules_load', {
      message: `No deterministic rules file at ${file}; auto-correct pass is a no-op.`,
    });
    cache = { version: 'none', sourceRange: '', rules: [] };
    return cache;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const rules: CompiledRule[] = [];
    for (const group of ['unitSymbols', 'abbreviations', 'spelling'] as const) {
      for (const raw of (parsed[group] || []) as RawRule[]) {
        const compiled = compileRule(raw);
        if (compiled) rules.push(compiled);
      }
    }
    cache = {
      version: parsed.version || 'unknown',
      sourceRange: parsed.sourceRange || '',
      rules,
    };
    logEvent('info', 'deterministic_rules_load', {
      version: cache.version,
      ruleCount: rules.length,
    });
    return cache;
  } catch (err: any) {
    logEvent('error', 'deterministic_rules_load', {
      message: `Failed to load deterministic rules: ${err?.message || err}`,
    });
    cache = { version: 'error', sourceRange: '', rules: [] };
    return cache;
  }
}

/** Test hook: drop the cache so a different fixture dir is picked up. */
export function _resetDeterministicRulesCache(): void {
  cache = null;
}
