import { FCOProcedure, ProcedureCheck, ProcedureSection } from '../types';

// Single source of truth for "which of the 3 bands does this section/check
// belong to, and where within that band" — used by BOTH the DOCX exporter
// (docxExportService.ts) and the on-screen review preview (RewrittenDraft.tsx)
// so what's previewed always matches what's exported. Do not duplicate this
// logic in either consumer; extend it here instead.

export type BandKey = 'safetyAndPrep' | 'installation' | 'completion';

export const BAND_TITLES: Record<BandKey, string> = {
  safetyAndPrep: 'Safety and Preparation',
  installation: 'Installation Steps',
  completion: 'Completion / Functional Check'
};

export interface ProcedureStepRow {
  title?: string;
  texts: string[];
  stepGroupId?: string;
}

export interface ComputedBand {
  key: BandKey;
  title: string;
  sections: ProcedureSection[];
  stepRows: ProcedureStepRow[];
  preambleChecks: ProcedureCheck[];
  fallbackBeforeChecks: ProcedureCheck[];
  fallbackAfterChecks: ProcedureCheck[];
  checksByStepGroupId: Map<string, { before: ProcedureCheck[]; after: ProcedureCheck[] }>;
}

// There is no "post installation" band — post_installation_check is already
// handled as an AI-suggested, part-scoped check, not a structural section, so
// the third band only ever holds functional/closeout content (raw
// D. Verification / E. Completion sections).
function bucketSections(procedure: FCOProcedure | null | undefined): Record<BandKey, ProcedureSection[]> {
  const bands: Record<BandKey, ProcedureSection[]> = { safetyAndPrep: [], installation: [], completion: [] };
  if (procedure?.sections && Array.isArray(procedure.sections)) {
    for (const section of procedure.sections) {
      const tLower = (section.title || '').toLowerCase();
      if (tLower.includes('safety') || tLower.includes('preparation')) {
        bands.safetyAndPrep.push(section);
      } else if (tLower.includes('implementation') || tLower.includes('update') || tLower.includes('install') || tLower.includes('backup')) {
        bands.installation.push(section);
      } else {
        bands.completion.push(section);
      }
    }
  }
  return bands;
}

function buildStepRows(sections: ProcedureSection[]): ProcedureStepRow[] {
  const stepRows: ProcedureStepRow[] = [];
  for (const section of sections) {
    if (Array.isArray(section.stepGroups)) {
      for (const g of section.stepGroups) {
        if (g && Array.isArray(g.steps) && g.steps.length > 0) {
          stepRows.push({ title: g.title, texts: g.steps, stepGroupId: g.id });
        }
      }
    }
    if (Array.isArray(section.steps)) {
      for (const st of section.steps) {
        const text = typeof st === 'string' ? st : (st as any)?.text || '';
        if (text) stepRows.push({ texts: [text] });
      }
    }
  }
  return stepRows;
}

// pre_installation/parts_check/post_installation_check are all item-specific
// — about one part's install step — so they all live in the Installation
// band; post_installation_check doesn't get its own section just because its
// name says "post," it's still tied to a specific part's work.
// functional_check/completion_verification share the final band (a real test
// vs. closeout are different concepts, but neither is substantial enough
// alone to justify a fourth section). safety_preparation is the one
// genuinely procedure-wide, always-first category.
const CHECK_CATEGORY_BAND: Record<string, BandKey> = {
  pre_installation: 'installation',
  safety_preparation: 'safetyAndPrep',
  parts_check: 'installation',
  post_installation_check: 'installation',
  functional_check: 'completion',
  completion_verification: 'completion'
};

// safety_preparation is the sole preamble category — a blocking prerequisite
// read before the step list even begins, not a checkbox item interleaved
// with steps.
const PREAMBLE_CATEGORIES = new Set(['safety_preparation']);

// For unanchored checks, which end of their band they belong to: categories
// about starting work (stage parts, run the pre-work test) render before the
// first step row; categories about finishing work (confirm the install,
// close out) render after the last one.
const FALLBACK_BEFORE_CATEGORIES = new Set(['pre_installation', 'parts_check', 'functional_check']);

export function computeProcedureBands(
  procedure: FCOProcedure | null | undefined,
  checks: ProcedureCheck[] | null | undefined
): ComputedBand[] {
  const bucketed = bucketSections(procedure);
  const bandKeys: BandKey[] = ['safetyAndPrep', 'installation', 'completion'];

  const stepRowsByBand: Record<BandKey, ProcedureStepRow[]> = {
    safetyAndPrep: buildStepRows(bucketed.safetyAndPrep),
    installation: buildStepRows(bucketed.installation),
    completion: buildStepRows(bucketed.completion)
  };

  const allStepGroupIds = new Set<string>();
  const stepGroupIdToBand = new Map<string, BandKey>();
  for (const bandKey of bandKeys) {
    for (const row of stepRowsByBand[bandKey]) {
      if (row.stepGroupId) {
        allStepGroupIds.add(row.stepGroupId);
        stepGroupIdToBand.set(row.stepGroupId, bandKey);
      }
    }
  }

  const checksByStepGroupId = new Map<string, { before: ProcedureCheck[]; after: ProcedureCheck[] }>();
  const checksByBandFallbackBefore: Record<BandKey, ProcedureCheck[]> = { safetyAndPrep: [], installation: [], completion: [] };
  const checksByBandFallbackAfter: Record<BandKey, ProcedureCheck[]> = { safetyAndPrep: [], installation: [], completion: [] };
  const checksByBandPreamble: Record<BandKey, ProcedureCheck[]> = { safetyAndPrep: [], installation: [], completion: [] };

  for (const check of checks || []) {
    const anchorGroupId = check?.anchor?.stepGroupId;
    if (PREAMBLE_CATEGORIES.has(check?.category)) {
      // Position (before/after) doesn't apply once a check is a preamble —
      // the anchor is only used to find which band's stepGroup it's near.
      const band = (anchorGroupId && stepGroupIdToBand.get(anchorGroupId)) || CHECK_CATEGORY_BAND[check?.category] || 'safetyAndPrep';
      checksByBandPreamble[band].push(check);
    } else if (anchorGroupId && allStepGroupIds.has(anchorGroupId)) {
      const entry = checksByStepGroupId.get(anchorGroupId) || { before: [], after: [] };
      (check.anchor!.position === 'before' ? entry.before : entry.after).push(check);
      checksByStepGroupId.set(anchorGroupId, entry);
    } else {
      const band = CHECK_CATEGORY_BAND[check?.category] || 'completion';
      const bucket = FALLBACK_BEFORE_CATEGORIES.has(check?.category) ? checksByBandFallbackBefore : checksByBandFallbackAfter;
      bucket[band].push(check);
    }
  }

  return bandKeys.map(key => ({
    key,
    title: BAND_TITLES[key],
    sections: bucketed[key],
    stepRows: stepRowsByBand[key],
    preambleChecks: checksByBandPreamble[key],
    fallbackBeforeChecks: checksByBandFallbackBefore[key],
    fallbackAfterChecks: checksByBandFallbackAfter[key],
    checksByStepGroupId
  }));
}
