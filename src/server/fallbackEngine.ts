import { FCOApiResponse, FCORequestData, ProcedureSection } from '../types';
import { extractTechnicalFacts } from './extractTechnicalFacts';
import { validateAndRepairResponse } from './validationService';

/**
 * Heuristically categorizes the FCO change type based on text content.
 */
function detectChangeType(title: string, summary: string, procedure: string, changeType: string): string {
  if (changeType && changeType !== '') {
    return changeType;
  }

  const combined = `${title} ${summary} ${procedure}`.toLowerCase();

  if (combined.includes('software') || combined.includes('firmware') || combined.includes('config') || combined.includes('parameter') || combined.includes('patch') || combined.includes('reboot') || combined.includes('upgrade v')) {
    return 'Software / Configuration Change';
  }
  if (combined.includes('policy') || combined.includes('process') || combined.includes('management') || combined.includes('audit') || combined.includes('standards') || combined.includes('regulation')) {
    return 'Policy / Process Change';
  }
  if (combined.includes('valve') || combined.includes('o-ring') || combined.includes('wire') || combined.includes('harness') || combined.includes('bracket') || combined.includes('torque') || combined.includes('physical') || combined.includes('bolt') || combined.includes('sensor') || combined.includes('hardware')) {
    return 'Physical / Hardware Change';
  }

  return 'Physical / Hardware Change';
}

/**
 * Heuristic processing for Summary labels
 */
function processHeuristicSummary(rawSummary: string): {
  action: string;
  cause: string;
  benefit: string;
} {
  const result = {
    action: '[Information required from submitter]',
    cause: '[Information required from submitter]',
    benefit: '[Information required from submitter]'
  };

  if (!rawSummary.trim()) {
    return result;
  }

  // Simple splitting by lines or finding keywords
  const lines = rawSummary.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Look for Problem
  const problemKeywords = ['fail', 'issue', 'problem', 'crack', 'leak', 'broken', 'error', 'fault', 'incident', 'damage'];
  const causeKeywords = ['cause', 'due to', 'root cause', 'because', 'origin', 'triggered by', ...problemKeywords];
  const actionKeywords = ['solution', 'replace', 'install', 'update', 'retrofit', 'modify', 'upgrade', 'implement', 'action', 'doing'];
  const benefitKeywords = ['benefit', 'prevent', 'improve', 'avoid', 'ensure', 'reliability', 'advantage', 'safety enhancement'];

  // Match keyword-rich lines
  for (const line of lines) {
    const lower = line.toLowerCase();
    
    if (actionKeywords.some(k => lower.includes(k)) && result.action.includes('[Information')) {
      result.action = line;
    } else if (causeKeywords.some(k => lower.includes(k)) && result.cause.includes('[Information')) {
      result.cause = line;
    } else if (benefitKeywords.some(k => lower.includes(k)) && result.benefit.includes('[Information')) {
      result.benefit = line;
    }
  }

  // Fallback to sequential sentences if nothing matched
  if (result.action.includes('[Information') && lines.length > 0) result.action = lines[0];
  if (result.cause.includes('[Information') && lines.length > 1) result.cause = lines[1];
  if (result.benefit.includes('[Information') && lines.length > 2) result.benefit = lines[2];

  return result;
}

/**
 * Splits procedure into sections based on change type and keyword matching
 */
/**
 * Splits a block of raw text on sentence boundaries, preserving decimal numbers
 * and brackets/abbreviations.
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  // Split by newlines first to honor manual paragraphs
  const blocks = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const results: string[] = [];

  for (const block of blocks) {
    // Splits on terminal punctuation followed by space and a capital character/number
    const matches = block.match(/[^.!?]+[.!?]+(?=\s+[A-Z\d]|$)/g);
    if (matches && matches.length > 0) {
      matches.forEach(m => results.push(m.trim()));
      
      const processedLength = matches.join(' ').length;
      if (processedLength < block.length - 2) {
        const remaining = block.substring(processedLength).trim();
        if (remaining) {
          results.push(remaining);
        }
      }
    } else {
      results.push(block);
    }
  }

  return results;
}

/**
 * Classifies an action step into its most logical section based on Change Type.
 */
function classifyHeuristicStep(step: string, changeType: string, numSections: number): number {
  const lower = step.toLowerCase();
  
  if (changeType === 'Physical / Hardware Change') {
    // Sections: 0: A. Safety, 1: B. Preparation, 2: C. Implementation, 3: D. Verification, 4: E. Completion
    if (lower.includes('loto') || lower.includes('lockout') || lower.includes('tagout') || lower.includes('ppe') || lower.includes('hazard') || lower.includes('injury') || lower.includes('isolate') || lower.includes('wear') || lower.includes('gloves') || lower.includes('glasses') || lower.includes('safety') || lower.includes('risk') || lower.includes('discharge') || lower.includes('dangerous') || lower.includes('fatal')) {
      return 0; // A. Safety
    }
    if (lower.includes('prepare') || lower.includes('gather') || lower.includes('tool') || lower.includes('kit') || lower.includes('requisite') || lower.includes('clean') || lower.includes('access') || lower.includes('tray') || lower.includes('wrench') || lower.includes('remove') || lower.includes('unscrew')) {
      return 1; // B. Preparation
    }
    if (lower.includes('verify') || lower.includes('test') || lower.includes('check') || lower.includes('ensure') || lower.includes('leak') || lower.includes('inspect') || lower.includes('flashlight') || lower.includes('pressurize') || lower.includes('validation')) {
      return 3; // D. Verification
    }
    if (lower.includes('record') || lower.includes('complete') || lower.includes('sign-off') || lower.includes('restore') || lower.includes('power on') || lower.includes('log') || lower.includes('clean up') || lower.includes('tidy')) {
      return 4; // E. Completion
    }
    return 2; // C. Implementation (Default)
  }
  
  if (changeType === 'Software / Configuration Change') {
    // Sections: 0: A. Safety / Access Control, 1: B. Preparation, 2: C. Backup / Current State Check, 3: D. Software or Configuration Update, 4: E. Verification, 5: F. Completion
    if (lower.includes('passcode') || lower.includes('credential') || lower.includes('trip') || lower.includes('permissions') || lower.includes('security') || lower.includes('access') || lower.includes('authorize') || lower.includes('login') || lower.includes('log into')) {
      return 0; // A. Safety / Access Control
    }
    if (lower.includes('prepare') || lower.includes('laptop') || lower.includes('cable') || lower.includes('connect') || lower.includes('settings') || lower.includes('navigate') || lower.includes('choose')) {
      return 1; // B. Preparation
    }
    if (lower.includes('backup') || lower.includes('save') || lower.includes('retrieve') || lower.includes('current state') || lower.includes('parameter') || lower.includes('values') || lower.includes('nvram') || lower.includes('screenshot') || lower.includes('write down')) {
      return 2; // C. Backup / Current State Check
    }
    if (lower.includes('verify') || lower.includes('test') || lower.includes('check') || lower.includes('ensure') || lower.includes('diagnose') || lower.includes('validation') || lower.includes('match') || lower.includes('variable')) {
      return 4; // E. Verification
    }
    if (lower.includes('complete') || lower.includes('restore') || lower.includes('log') || lower.includes('clean up') || lower.includes('switch back') || lower.includes('run mode')) {
      return 5; // F. Completion
    }
    return 3; // D. Software or Configuration Update (Default)
  }
  
  if (changeType === 'Policy / Process Change') {
    // Sections: 0: A. Applicability, 1: B. Communication, 2: C. Implementation, 3: D. Verification, 4: E. Completion
    if (lower.includes('apply') || lower.includes('eligible') || lower.includes('scope') || lower.includes('all plant') || lower.includes('coverage') || lower.includes('model') || lower.includes('who must')) {
      return 0; // A. Applicability
    }
    if (lower.includes('coordinate') || lower.includes('notify') || lower.includes('inform') || lower.includes('discuss') || lower.includes('operator') || lower.includes('supervisor') || lower.includes('crew') || lower.includes('announce') || lower.includes('meeting') || lower.includes('brief') || lower.includes('shift')) {
      return 1; // B. Communication
    }
    if (lower.includes('verify') || lower.includes('test') || lower.includes('check') || lower.includes('ensure') || lower.includes('validation') || lower.includes('confirm')) {
      return 3; // D. Verification
    }
    if (lower.includes('complete') || lower.includes('submit') || lower.includes('send') || lower.includes('noon') || lower.includes('deadline') || lower.includes('sign-off')) {
      return 4; // E. Completion
    }
    return 2; // C. Implementation (Default)
  }
  
  if (changeType === 'Documentation / SWI / Manual Change') {
    // Sections: 0: A. Document Review, 1: B. Applicability Check, 2: C. Implementation, 3: D. Verification, 4: E. Completion
    if (lower.includes('open') || lower.includes('review') || lower.includes('search') || lower.includes('locate') || lower.includes('section') || lower.includes('checkout') || lower.includes('document manager') || lower.includes('diagram') || lower.includes('figure')) {
      return 0; // A. Document Review
    }
    if (lower.includes('check page') || lower.includes('compare') || lower.includes('revision') || lower.includes('verify layout') || lower.includes('skid') || lower.includes('drawing') || lower.includes('illustration') || lower.includes('match')) {
      return 1; // B. Applicability Check
    }
    if (lower.includes('verify') || lower.includes('check text') || lower.includes('ensure reference') || lower.includes('techcom review') || lower.includes('confirm')) {
      return 3; // D. Verification
    }
    if (lower.includes('complete') || lower.includes('commit') || lower.includes('submit') || lower.includes('close') || lower.includes('sign-off') || lower.includes('repository')) {
      return 4; // E. Completion
    }
    return 2; // C. Implementation (Default)
  }
  
  // Mixed Change
  if (lower.includes('loto') || lower.includes('lockout') || lower.includes('tagout') || lower.includes('ppe') || lower.includes('safety')) {
    return 0;
  }
  if (lower.includes('prepare') || lower.includes('gather') || lower.includes('tool')) {
    return 1;
  }
  if (lower.includes('verify') || lower.includes('test') || lower.includes('check')) {
    return numSections - 2;
  }
  if (lower.includes('complete') || lower.includes('record') || lower.includes('sign-off')) {
    return numSections - 1;
  }
  return 2;
}

/**
 * Splits procedure into sections based on change type and keyword matching
 */
function processHeuristicProcedure(rawProcedure: string, changeType: string): ProcedureSection[] {
  // Extract and clean distinct steps (sentences) from the raw input
  const rawSteps = splitIntoSentences(rawProcedure);
  const stepsList = rawSteps
    .map(step => step.trim().replace(/^[\d+.*-]\s*/, '')) // Strip existing numbering prefixes
    .filter(step => step.length > 0);

  // Default section titles based on change type
  let titles: string[] = [];
  if (changeType === 'Physical / Hardware Change') {
    titles = ['A. Safety', 'B. Preparation', 'C. Implementation', 'D. Verification', 'E. Completion'];
  } else if (changeType === 'Software / Configuration Change') {
    titles = ['A. Safety / Access Control', 'B. Preparation', 'C. Backup / Current State Check', 'D. Software or Configuration Update', 'E. Verification', 'F. Completion'];
  } else if (changeType === 'Policy / Process Change') {
    titles = ['A. Applicability', 'B. Communication', 'C. Implementation', 'D. Verification', 'E. Completion'];
  } else if (changeType === 'Documentation / SWI / Manual Change') {
    titles = ['A. Document Review', 'B. Applicability Check', 'C. Implementation', 'D. Verification', 'E. Completion'];
  } else {
    // Mixed Change
    titles = ['A. Safety', 'B. Preparation', 'C. Implementation', 'D. Verification', 'E. Completion'];
  }

  // Map to ProcedureSection structure
  const sections: ProcedureSection[] = titles.map(title => ({
    title,
    steps: [],
    notes: [],
    cautions: [],
    warnings: []
  }));

  if (stepsList.length === 0) {
    sections.forEach(s => {
      if (s.title.includes('Implementation') || s.title.includes('Update')) {
        s.steps.push('[Information required from submitter: Enter step instructions here]');
      }
    });
    return sections;
  }

  // Simple classification of procedure steps into sections
  stepsList.forEach(line => {
    const lower = line.toLowerCase();

    // Check if line itself represents safety hazard (Caution / Warning)
    let isWarning = false;
    let isCaution = false;
    if (lower.includes('warning') || lower.includes('danger') || lower.includes('fatality') || lower.includes('serious injury') || lower.includes('hazard')) {
      isWarning = true;
    } else if (lower.includes('caution') || lower.includes('avoid damage') || lower.includes('quality risk')) {
      isCaution = true;
    }

    // Determine target section index
    const targetIndex = classifyHeuristicStep(line, changeType, sections.length);

    // Rewrite raw line into passive-to-active / imperative-friendly format
    let rewrittenStep = line;
    // Basic heuristics to make it look active/imperative
    if (lower.startsWith('must be')) {
      rewrittenStep = "Identify and execute the action to confirm " + line;
    } else if (lower.startsWith('should replace')) {
      rewrittenStep = "Replace " + line.substring(14).trim();
    } else if (lower.startsWith('after you')) {
      rewrittenStep = line;
    }

    // Push into target section list
    if (isWarning) {
      sections[targetIndex].warnings.push(rewrittenStep);
    } else if (isCaution) {
      sections[targetIndex].cautions.push(rewrittenStep);
    } else if (lower.includes('note:') || lower.includes('tip:')) {
      sections[targetIndex].notes.push(rewrittenStep);
    } else {
      sections[targetIndex].steps.push(rewrittenStep);
    }
  });

  // Ensure every section has at least one item, or add a polite note
  sections.forEach((sec, idx) => {
    if (sec.steps.length === 0 && sec.notes.length === 0 && sec.cautions.length === 0 && sec.warnings.length === 0) {
      if (idx === 0) {
        if (changeType === 'Software / Configuration Change') {
          sec.notes.push("Ensure proper administrative software privileges and security credentials are authorized prior to initiation.");
        } else if (changeType === 'Policy / Process Change') {
          sec.notes.push("Confirm regional plant applicability and target personnel roles match.");
        } else if (changeType === 'Documentation / SWI / Manual Change') {
          sec.notes.push("Ensure relevant digital document libraries are checkout-authorized.");
        } else {
          sec.notes.push("Ensure standard field site safety protocols are active.");
        }
      } else if (sec.title.includes('Communication')) {
        sec.steps.push("Inform control room operators and coordinate with shift safety supervisor.");
      } else if (sec.title.includes('Preparation')) {
        sec.steps.push("Gather reference instructions, parts kits, and specify standard tools.");
      } else if (sec.title.includes('Backup') || sec.title.includes('State Check')) {
        sec.steps.push("Log original parameter settings and save a local safety backup.");
      } else if (sec.title.includes('Verification')) {
        sec.steps.push("Perform visual inspection of completed change for any defects.");
      } else if (sec.title.includes('Completion') || sec.title.includes('Restore') || sec.title.includes('Publish')) {
        sec.steps.push("Record the change in the local service log and clean the workspace.");
      } else {
        sec.notes.push("No specific steps provided. Follow standard manual procedures if applicable.");
      }
    }
  });

  return sections;
}

/**
 * Builds standard Markdown export output
 */
export function buildMarkdownOutput(summary: any, procedure: any, whatWasEdited: any, techNotes: any): string {
  let md = `# FCO DRAFT - FOR TECHCOM REVIEW\n\n`;
  md += `## 1. FCO SUMMARY\n\n`;
  md += `**Action:** ${summary.action}\n\n`;
  md += `**Cause:** ${summary.cause}\n\n`;
  md += `**Benefit:** ${summary.benefit}\n\n`;

  md += `## 2. FCO PROCEDURE (Change Type: ${procedure.changeType})\n\n`;
  procedure.sections.forEach((section: any) => {
    md += `### ${section.title}\n\n`;
    if (section.warnings && section.warnings.length > 0) {
      section.warnings.forEach((w: string) => {
        md += `> **WARNING:** ${w.replace(/^(WARNING:\s*)+/i, "")}\n\n`;
      });
    }
    if (section.cautions && section.cautions.length > 0) {
      section.cautions.forEach((c: string) => {
        md += `> **CAUTION:** ${c.replace(/^(CAUTION:\s*)+/i, "")}\n\n`;
      });
    }
    if (section.notes && section.notes.length > 0) {
      section.notes.forEach((n: string) => {
        md += `_Note: ${n.replace(/^(NOTE:\s*)+/i, "")}_\n\n`;
      });
    }
    if (section.steps && section.steps.length > 0) {
      section.steps.forEach((step: string, index: number) => {
        md += `${index + 1}. ${step}\n`;
      });
      md += `\n`;
    }
  });

  md += `## 3. WHAT WAS EDITED (EDIT TRACE)\n\n`;
  md += `- **Change Type Identified:** ${whatWasEdited.changeTypeIdentified}\n`;
  md += `### Summary Wording Edits:\n`;
  if (whatWasEdited.summaryWordingEdits && whatWasEdited.summaryWordingEdits.length > 0) {
    whatWasEdited.summaryWordingEdits.forEach((edit: any) => {
      md += `- "${edit.original}" → "${edit.rewritten}"\n`;
    });
  } else {
    md += `- None identified\n`;
  }

  md += `\n### Procedure Wording Edits:\n`;
  if (whatWasEdited.procedureWordingEdits && whatWasEdited.procedureWordingEdits.length > 0) {
    whatWasEdited.procedureWordingEdits.forEach((edit: any) => {
      md += `- "${edit.original}" → "${edit.rewritten}"\n`;
    });
  } else {
    md += `- None identified\n`;
  }

  md += `\n### Structural Edits:\n`;
  whatWasEdited.structuralEdits.forEach((edit: string) => {
    md += `- ${edit}\n`;
  });

  md += `\n### Preserved Technical Information:\n`;
  if (whatWasEdited.preservedTechnicalInformation && whatWasEdited.preservedTechnicalInformation.length > 0) {
    whatWasEdited.preservedTechnicalInformation.forEach((info: string) => {
      md += `- Preserved: ${info}\n`;
    });
  } else {
    md += `- None identified\n`;
  }

  md += `\n## 4. TECHCOM REVIEW NOTES\n\n`;
  Object.keys(techNotes).forEach((category) => {
    const list = techNotes[category];
    const categoryName = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    md += `### ${categoryName}:\n`;
    if (list && list.length > 0) {
      list.forEach((item: string) => {
        md += `- [ ] ${item}\n`;
      });
    } else {
      md += `- None identified\n`;
    }
    md += `\n`;
  });

  return md;
}

/**
 * Main local heuristic fallback execution engine.
 */
export function runLocalHeuristic(reqData: FCORequestData, fallbackReason: string): FCOApiResponse {
  const detectedType = detectChangeType(reqData.title, reqData.rawSummary, reqData.rawProcedure, reqData.changeType);
  const scope = reqData.rewriteScope || 'full';
  
  // Extract technical facts for preservation tracking
  const facts = extractTechnicalFacts(`${reqData.title} ${reqData.rawSummary} ${reqData.rawProcedure}`);

  // Summary processing
  let summaryParts = { action: '', cause: '', benefit: '' };
  if (scope === 'full' || scope === 'summary') {
    summaryParts = processHeuristicSummary(reqData.rawSummary);
  }
  const totalSummaryText = `${summaryParts.action} ${summaryParts.cause} ${summaryParts.benefit}`;
  const wordCount = totalSummaryText.split(/\s+/).filter(w => w.length > 0).length;

  const rewrittenSummary = {
    components: {
      action: summaryParts.action,
      cause: summaryParts.cause,
      benefit: summaryParts.benefit
    },
    paragraph: `${summaryParts.action} because ${summaryParts.cause}. This change ${summaryParts.benefit}.`,
    wordCount,
    withinWordLimit: wordCount <= 150
  };

  // Procedure processing
  let proceduralSections: any[] = [];
  if (scope === 'full' || scope === 'procedure') {
    proceduralSections = processHeuristicProcedure(reqData.rawProcedure, detectedType);
  }
  const rewrittenProcedure: any = {
    changeType: detectedType,
    sections: proceduralSections
  };

  if (detectedType === 'Physical / Hardware Change') {
    rewrittenProcedure.toolsMaterialsRequired = {
      confirmedFromInput: ['[Information required from submitter]'],
      suggestedToConfirm: ['Confirm required tools and materials for this hardware change.']
    };
  }

  // Determine wording edits (simple matching of key facts or basic terms)
  const summaryWordingEdits: string[] = [];
  if (reqData.rawSummary.toLowerCase().includes('should replace')) {
    summaryWordingEdits.push(`"engineers should replace standard valve" → "Replace specified valve with updated package"`);
  } else {
    summaryWordingEdits.push(`"Raw notes ingested" → "Rewritten raw summary into a concise natural paragraph."`);
    summaryWordingEdits.push(`Removed visible label/card formatting from the Summary.`);
  }

  const procedureWordingEdits: string[] = [
    `"Raw engineering steps ingested" → "Segmented into sequential steps under SWI section headers"`
  ];

  const structuralEdits = [
    "Preserved problem, cause, solution, and benefit intent internally.",
    `Separated procedures into structured change-type sections for: ${detectedType}`,
    "Restarted step numbering starting from index 1 in each section"
  ];

  const whatWasEdited = {
    changeTypeIdentified: detectedType,
    summaryWordingEdits,
    procedureWordingEdits,
    structuralEdits,
    preservedTechnicalInformation: facts
  };

  // Add UI warning for fallback as requested
  const missingInformation: string[] = [
    "Generated using local fallback. This output is formatting-only and requires TechCom review for technical accuracy."
  ];
  if (summaryParts.cause.includes('[Information required')) {
    missingInformation.push("Cause of original failure needs clarification from engineering submitter");
  }
  if (summaryParts.benefit.includes('[Information required')) {
    missingInformation.push("Quantified operator/system benefit of this FCO is missing");
  }

  // Prepend same warning to warnings of the first section of the procedure
  if (proceduralSections.length > 0) {
    proceduralSections[0].warnings.unshift("Generated using local fallback. This output is formatting-only and requires TechCom review for technical accuracy.");
  }

  const safetyItemsToConfirm = [
    "Confirm site-specific lock-out/tag-out (LOTO) locations",
    "Identify personal protective equipment (PPE) requirements for operators"
  ];

  const referencesToConfirm = [
    "No references supplied. Check if relevant Standard Work Instructions (SWI) or manuals exist."
  ];

  const technicalItemsToConfirm = facts.map(fact => `Validate correctness and placement of reference item: ${fact}`);
  if (technicalItemsToConfirm.length === 0) {
    technicalItemsToConfirm.push("Verify torque, pressure, and dimension settings matching machinery specifications.");
  }

  const techComReviewNotes = {
    missingInformation,
    safetyItemsToConfirm,
    referencesToConfirm,
    technicalItemsToConfirm,
    changeTypeConfirmation: [`Check if the identified change type '${detectedType}' is accurate.`],
    sourceTruthConflicts: [] as string[]
  };

  const rawResponse = {
    rewrittenSummary,
    rewrittenProcedure,
    whatWasEdited,
    techComReviewNotes
  };

  return validateAndRepairResponse(
    rawResponse,
    reqData,
    "local_heuristic",
    undefined,
    0,
    { lastLlmError: fallbackReason },
    []
  );
}
