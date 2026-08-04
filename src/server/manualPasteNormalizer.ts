export interface NormalizedPasteResult {
  sourceType: 'clean_manual_text' | 'pasted_fco_document' | 'rough_notes' | 'mixed_document_content';
  detectedSummary: string;
  detectedProcedure: string[];
  detectedFigures: string[];
  removedContent: string[];
  warnings: string[];
  extractedComponents?: {
    problem: string;
    cause: string;
    solution: string;
    benefit: string;
    missingComponents: string[];
  };
}

function classifyInputSource(text: string) {
  const pasteKeywords = [
    "Purpose/Scope", "Background/Description", "Description of Non-Conformance",
    "Impact/Risk", "Corrective Action", "Pre-requisites", "Implementation", "Figure 1",
    "Fig. 1", "Reference Figures", "Design Engineer", "InTouch Engineer",
    "Field Decision Maker", "SLB-Private", "DMS #", "Revision", "Page X of Y"
  ];
  
  let matches = 0;
  for (const kw of pasteKeywords) {
    if (text.toLowerCase().includes(kw.toLowerCase())) matches++;
  }

  if (matches >= 3) return 'pasted_fco_document';
  if (matches > 0) return 'mixed_document_content';
  
  if (text.length < 100 && !text.includes('.')) return 'rough_notes';
  
  return 'clean_manual_text';
}

function cleanSectionLabels(text: string): string {
    let clean = text;
    const labelsToRemove = [
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Purpose\/Scope:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Background(?:\/Description(?: of Non-Conformance)?)?:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Description of Non-Conformance:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Impact\/Risk:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Corrective Action:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Problem:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Cause:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Solution:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Benefit:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Pre-requisites:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Prerequisites:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Safety:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Preparation:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Implementation:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Installation:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Verification:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Test:?/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-)?\s*Completion:?/img,
    ];
    
    for (const regex of labelsToRemove) {
        clean = clean.replace(regex, "");
    }
    
    // Remove standalone markers at the start of a sentence or line
    clean = clean.replace(/^\s*(?:o|[A-Za-z0-9]+\.|-)\s+(?=[A-Za-z0-9])/img, "");
    
    return clean.replace(/\n{3,}/g, "\n\n").trim();
}

function processFigures(text: string) {
    const figures: string[] = [];
    const figureCaptionRegex = /^(?:o\s+|-?\s*)?((?:Figure|Fig\.?)\s*\d+[\s:].*)$/img;
    
    const cleanedText = text.replace(figureCaptionRegex, (match, p1) => {
        figures.push(p1.trim());
        return `[Insert ${p1.trim()}]`;
    });
    
    return { cleanedText, figures };
}

function processProcedureSteps(text: string): { steps: string[], removed: string[] } {
    const rawLines = text.split('\n').map(l => l.trim());
    const validSteps: string[] = [];
    const removed: string[] = [];

    // Valid action verbs mapping
    const actionVerbs = [
        "ensure", "wear", "implement", "confirm", "review", "perform", 
        "remove", "retain", "disconnect", "loosen", "detach", "undo", 
        "use", "retrieve", "reassemble", "install", "replace", "test", 
        "verify", "record", "clean", "restore", "submit", "refer", 
        "check", "connect", "tighten", "inspect", "heat", "hold",
        "turn", "isolate", "lock", "tag", "make"
    ];
    
    const romanNumeralRegex = /^[MDCLXVI]+\.\s+/i;
    let pendingFragment = "";

    for (let line of rawLines) {
        line = line.replace(/^\s*(?:o|-)\s+/, ""); // remove basic bullets if missed
        
        if (!line) continue;
        if (line === "." || line === "-" || line.length < 5) {
            removed.push(line);
            continue;
        }

        // Detect Roman numerals and strip them
        if (romanNumeralRegex.test(line)) {
            line = line.replace(romanNumeralRegex, "").trim();
        }

        const isPlaceholder = line.startsWith("[Insert Figure");
        const lowerLine = line.toLowerCase();
        
        let startsWithVerb = false;
        const firstWord = lowerLine.split(/\s+/)[0]?.replace(/[^a-z]/g, "");
        if (firstWord && actionVerbs.includes(firstWord)) {
            startsWithVerb = true;
        }

        // If line does not start with verb and is not a placeholder, check if it's a fragment
        if (!startsWithVerb && !isPlaceholder) {
            // Fragment detection: starts with lowercase, or starts with weird word
            if (/^[a-z]/.test(line)) {
                if (validSteps.length > 0) {
                    const lastStep = validSteps.pop()!;
                    validSteps.push(lastStep + " " + line);
                    continue;
                }
            }
        }
        
        // Filter out signature blocks / document control junk if detected
        if (lowerLine.includes("page ") && lowerLine.includes(" of ")) {
            removed.push(line);
            continue;
        }
        
        validSteps.push(line);
    }
    
    return { steps: validSteps, removed };
}

export function normalizeManualPaste(rawSummary: string, rawProcedure: string): NormalizedPasteResult {
    const combinedInput = `${rawSummary}\n\n${rawProcedure}`;
    const sourceType = classifyInputSource(combinedInput);

    if (sourceType === 'clean_manual_text' || sourceType === 'rough_notes') {
        return {
            sourceType,
            detectedSummary: rawSummary,
            detectedProcedure: rawProcedure.split('\n').filter(Boolean),
            detectedFigures: [],
            removedContent: [],
            warnings: []
        };
    }

    // Step 1: Extract figures from both
    const { cleanedText: noFigsSummary, figures: sumFigs } = processFigures(rawSummary);
    const { cleanedText: noFigsProc, figures: procFigs } = processFigures(rawProcedure);
    
    // Step 2: Remove labels
    const cleanedSummary = cleanSectionLabels(noFigsSummary);
    const cleanedRawProc = cleanSectionLabels(noFigsProc);
    
    // Step 3: Extract valid procedure steps
    const { steps: procSteps, removed } = processProcedureSteps(cleanedRawProc);
    
    const warnings: string[] = [];
    if (combinedInput.match(/(?:pressure|depressuriz|flare nut|couplings|connection)/i)) {
        warnings.push("Confirm whether depressurization or stored pressure release is required before loosening flare nut couplings or connections.");
    }
    
    const hasPlaceholders = /\[Insert (Figure|Table|Fig\.?)\s*\d+.*?\]/i.test(combinedInput);
    if (combinedInput.includes("Figure") && sumFigs.length === 0 && procFigs.length === 0 && !hasPlaceholders) {
        warnings.push("Figure references detected but no captions found. Confirm visual instructions are complete.");
    }
    
    return {
        sourceType,
        detectedSummary: cleanedSummary,
        detectedProcedure: procSteps,
        detectedFigures: [...sumFigs, ...procFigs],
        removedContent: removed,
        warnings
    };
}
