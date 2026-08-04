import { FCOPartInvolved, FCOProcedure } from '../types';

// Shared "what can a check apply to" option-builders, used by both
// ProcedureChecksEditor (post-accept, ids exist via stampProcedureIdentity)
// and ProcedureReadinessPanel (pre-accept, only names/titles exist yet).

export interface AnchorIdOption {
  stepGroupId: string;
  label: string;
}

export function collectAnchorIdOptions(procedure: FCOProcedure | null | undefined): AnchorIdOption[] {
  const options: AnchorIdOption[] = [];
  for (const section of procedure?.sections || []) {
    for (const g of section.stepGroups || []) {
      if (g?.id) options.push({ stepGroupId: g.id, label: `${section.title} — ${g.title}` });
    }
  }
  return options;
}

export function collectPartIdOptions(declaredParts: FCOPartInvolved[], procedure: FCOProcedure | null | undefined) {
  const byId = new Map<string, string>();
  for (const p of declaredParts) if (p.id) byId.set(p.id, p.name || p.identifier || p.id);
  for (const p of procedure?.partsInvolved || []) if (p.id && !byId.has(p.id)) byId.set(p.id, p.name || p.identifier || p.id);
  return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
}

export interface AnchorTitleOption {
  stepGroupTitle: string;
  label: string;
}

// Pre-accept equivalent: generatedProcedure has no stepGroup ids yet, so
// options are keyed by title (exact, case-insensitive match resolved later
// in mergeAcceptedChecks against the stamped procedure).
export function collectAnchorTitleOptions(procedure: FCOProcedure | null | undefined): AnchorTitleOption[] {
  const options: AnchorTitleOption[] = [];
  const seen = new Set<string>();
  for (const section of procedure?.sections || []) {
    for (const g of section.stepGroups || []) {
      if (g?.title && !seen.has(g.title.toLowerCase())) {
        seen.add(g.title.toLowerCase());
        options.push({ stepGroupTitle: g.title, label: `${section.title} — ${g.title}` });
      }
    }
  }
  return options;
}

export function collectPartNameOptions(declaredParts: FCOPartInvolved[], procedure: FCOProcedure | null | undefined): string[] {
  const names = new Set<string>();
  for (const p of declaredParts) if (p.name) names.add(p.name);
  for (const p of procedure?.partsInvolved || []) if (p?.name) names.add(p.name);
  return Array.from(names);
}
