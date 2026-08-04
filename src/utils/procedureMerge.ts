import { FCOProcedure, ProcedureReadinessSuggestion } from '../types';

export function matchSection(sectionTitle: string, targetSection: string): boolean {
  const sTitle = sectionTitle.toLowerCase().trim();
  const tSec = targetSection.toLowerCase().trim();
  
  if (sTitle === tSec) return true;
  if (sTitle.includes(tSec) || tSec.includes(sTitle)) return true;
  
  const isSafetyPrep = (title: string) => title.includes('safety') || title.includes('preparation') || title.includes('prep');
  const isInstallation = (title: string) => title.includes('install') || title.includes('implement') || title.includes('update');
  const isPostInstallation = (title: string) => title.includes('post') || title.includes('verif') || title.includes('check') || title.includes('complet');
  
  if (isSafetyPrep(sTitle) && isSafetyPrep(tSec)) return true;
  if (isInstallation(sTitle) && isInstallation(tSec)) return true;
  if (isPostInstallation(sTitle) && isPostInstallation(tSec)) return true;
  
  return false;
}

export function buildDisplayProcedure(
  rewrittenProcedure: FCOProcedure | null | undefined,
  suggestions: ProcedureReadinessSuggestion[] | null | undefined
): FCOProcedure {
  if (!rewrittenProcedure) {
    return {
      changeType: '',
      sections: []
    };
  }

  // Deep clone to ensure original rewrittenProcedure is never mutated
  const cloned: FCOProcedure = JSON.parse(JSON.stringify(rewrittenProcedure));

  if (!suggestions || suggestions.length === 0) {
    return cloned;
  }

  // Filter only accepted or edited suggestions with non-blank text
  const validSuggestions = suggestions.filter(s => {
    const isAcceptedOrEdited = s.status === 'accepted' || s.status === 'edited';
    const text = s.editedText !== undefined ? s.editedText : s.suggestedText;
    return isAcceptedOrEdited && text && text.trim().length > 0;
  });

  for (const suggestion of validSuggestions) {
    const textToAppend = suggestion.editedText !== undefined ? suggestion.editedText : suggestion.suggestedText;
    
    // Find matching section
    let matchedSection = cloned.sections.find(sec => matchSection(sec.title || '', suggestion.targetSection));
    
    if (matchedSection) {
      if (!matchedSection.steps) {
        matchedSection.steps = [];
      }
      matchedSection.steps.push(textToAppend);
    } else {
      // If no matching section exists in current list, let's find the first one or default
      // In normal operation, one of the three default sections will match.
      // But if none does, let's append to the last section or create a section
      if (cloned.sections.length > 0) {
        const lastSection = cloned.sections[cloned.sections.length - 1];
        if (!lastSection.steps) lastSection.steps = [];
        lastSection.steps.push(textToAppend);
      } else {
        cloned.sections.push({
          title: suggestion.targetSection,
          steps: [textToAppend],
          notes: [],
          cautions: [],
          warnings: []
        });
      }
    }
  }

  return cloned;
}
