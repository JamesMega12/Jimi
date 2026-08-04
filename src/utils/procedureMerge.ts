import { FCOProcedure, FCOPartInvolved, ProcedureReadinessSuggestion, ProcedureCheck } from '../types';

function mintId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15);
}

// Stamps stable ids onto an AI-generated procedure's parts and stepGroups at
// accept time — the only point in the pipeline where this procedure snapshot
// becomes canonical. Parts are matched to the human-authored declaredParts
// list by name (case-insensitive) so a declared part's id carries through;
// unmatched AI-detected parts and all stepGroups (which have no pre-existing
// identity anywhere in the app — see EditableProcedureView's index-keying)
// get freshly minted ids. Safe to call repeatedly: existing ids are preserved.
export function stampProcedureIdentity(
  procedure: FCOProcedure,
  declaredParts: FCOPartInvolved[] = []
): FCOProcedure {
  const cloned: FCOProcedure = JSON.parse(JSON.stringify(procedure));

  const partIdByName = new Map<string, string>();
  for (const dp of declaredParts) {
    if (dp.name) partIdByName.set(dp.name.trim().toLowerCase(), dp.id);
  }

  if (cloned.partsInvolved) {
    cloned.partsInvolved = cloned.partsInvolved.map((part: any) => {
      const matchedId = part.name ? partIdByName.get(String(part.name).trim().toLowerCase()) : undefined;
      return { ...part, id: part.id || matchedId || mintId() };
    });
  }

  for (const section of cloned.sections || []) {
    if (section.stepGroups) {
      section.stepGroups = section.stepGroups.map((group: any) => ({
        ...group,
        id: group.id || mintId()
      }));
    }
  }

  return cloned;
}


// A category retired from the readiness taxonomy (its content is redundant
// with the existing additionalFcoInfo.maintenanceProcedureChanges field).
// Suggestions carrying it may still exist in old persisted drafts —
// mergeAcceptedChecks skips them defensively rather than producing a check
// for a category the app no longer recognizes.
const RETIRED_CATEGORY = 'documentation_impact';

// Builds/updates the canonical ProcedureCheck[] from accepted/edited readiness
// suggestions, preserving category/reason/id/source end to end — unlike the
// retired buildDisplayProcedure, which flattened suggestion text into
// anonymous procedure steps and discarded that metadata. Call this with the
// same stampedProcedure produced by stampProcedureIdentity() in the same
// accept, so an AI-suggested part/anchor can be validated against real ids.
export function mergeAcceptedChecks(
  existingChecks: ProcedureCheck[] | null | undefined,
  suggestions: ProcedureReadinessSuggestion[] | null | undefined,
  stampedProcedure: FCOProcedure
): ProcedureCheck[] {
  const merged: ProcedureCheck[] = existingChecks ? [...existingChecks] : [];
  if (!suggestions || suggestions.length === 0) return merged;

  // Suggestions carry a proposed target by name/title, never by id — ids are
  // only stamped onto THIS procedure snapshot right before this call runs, so
  // resolution has to happen here, against the real, current ids. A name/title
  // with no match (stale, from a since-edited procedure, or genuinely global)
  // simply resolves to nothing — same safe degradation as before.
  const partIdByName = new Map<string, string>();
  for (const p of stampedProcedure.partsInvolved || []) {
    if (p.name) partIdByName.set(p.name.trim().toLowerCase(), p.id);
  }
  const stepGroupIdByTitle = new Map<string, string>();
  for (const section of stampedProcedure.sections || []) {
    for (const g of section.stepGroups || []) {
      if (g.title) stepGroupIdByTitle.set(g.title.trim().toLowerCase(), g.id);
    }
  }

  const validSuggestions = suggestions.filter(s => {
    const isAcceptedOrEdited = s.status === 'accepted' || s.status === 'edited';
    const text = s.editedText !== undefined ? s.editedText : s.suggestedText;
    const isRetired = (s.category as string) === RETIRED_CATEGORY;
    return isAcceptedOrEdited && !isRetired && text && text.trim().length > 0;
  });

  for (const suggestion of validSuggestions) {
    const text = suggestion.editedText !== undefined ? suggestion.editedText : suggestion.suggestedText;

    const partNames = suggestion.confirmedPartNames ?? suggestion.suggestedPartNames ?? [];
    const targetPartIds = partNames
      .map(name => partIdByName.get(name.trim().toLowerCase()))
      .filter((id): id is string => !!id);

    const stepGroupTitle = suggestion.confirmedStepGroupTitle ?? suggestion.suggestedStepGroupTitle;
    const anchorPosition = suggestion.confirmedAnchorPosition ?? suggestion.suggestedAnchorPosition;
    const stepGroupId = stepGroupTitle ? stepGroupIdByTitle.get(stepGroupTitle.trim().toLowerCase()) : undefined;
    const anchor = stepGroupId && anchorPosition ? { stepGroupId, position: anchorPosition } : undefined;

    const check: ProcedureCheck = {
      id: suggestion.id,
      category: suggestion.category,
      text,
      targetPartIds,
      anchor,
      source: 'ai_suggestion',
      status: suggestion.status,
      reason: suggestion.reason,
      createdAt: suggestion.createdAt
    };

    const existingIdx = merged.findIndex(c => c.id === check.id);
    if (existingIdx >= 0) merged[existingIdx] = check;
    else merged.push(check);
  }

  return merged;
}
