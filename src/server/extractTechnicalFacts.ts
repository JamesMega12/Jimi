/**
 * Extracts key technical facts from raw text to ensure they are preserved in the AI output.
 */
export function extractTechnicalFacts(text: string): string[] {
  if (!text) return [];

  const facts = new Set<string>();

  // Helper to add trimmed non-empty matches
  const addMatch = (match: string) => {
    const trimmed = match.trim();
    if (trimmed && trimmed.length > 2) {
      facts.add(trimmed);
    }
  };

  // 1. Part numbers & Kit numbers
  // Forms like PN 123456, P/N A123-BC, Kit #9982, PN:98765
  const partRegex = /(?:PN|P\/N|Part|Kit)\s*#?\s*:?\s*([A-Za-z0-9-]{4,20})/gi;
  let match;
  while ((match = partRegex.exec(text)) !== null) {
    addMatch(match[0]); // Preserve full context like "PN 12345"
  }

  // 2. InTouch IDs and SWI references
  // Forms like InTouch 1234567, IT-1234567, SWI-4020, SWI 3040
  const refRegex = /\b(?:InTouch|IT|SWI)-?[0-9]{3,8}\b/gi;
  const refMatches = text.match(refRegex);
  if (refMatches) {
    refMatches.forEach(addMatch);
  }

  const refSpaceRegex = /\b(?:InTouch|IT|SWI)\s+[0-9]{3,8}\b/gi;
  const refSpaceMatches = text.match(refSpaceRegex);
  if (refSpaceMatches) {
    refSpaceMatches.forEach(addMatch);
  }

  // 3. Drawing and Figure references
  // Forms like Drawing 12345, Fig 1, Figure 4a
  // Ensure it only matches if there's a digit in the token after the generic word, or it's a single letter
  const figRegex = /\b(?:Drawing|Drg|Fig|Figure)s?\.?\s*#?[\s-_]*(?:\d[a-z0-9-]*)\b|\b(?:Drawing|Drg|Fig|Figure)s?\.?\s*#?[\s-_]+[a-z]\b|\b(?:Drg|Fig)\.?[a-z]\b/gi;
  const figMatches = text.match(figRegex);
  if (figMatches) {
    figMatches.forEach(addMatch);
  }

  // 4. Pressure values
  // Forms like 3000 psi, 150 psi, 20 bar, 5 MPa
  const pressureRegex = /\b\d+(?:\.\d+)?\s*(?:psi|bar|MPa|kPa)\b/gi;
  const pressureMatches = text.match(pressureRegex);
  if (pressureMatches) {
    pressureMatches.forEach(addMatch);
  }

  // 5. Torque values
  // Forms like 45 ft-lbs, 50 Nm, 10 N·m
  const torqueRegex = /\b\d+(?:\.\d+)?\s*(?:Nm|N·m|ft-lbs|in-lbs)\b/gi;
  const torqueMatches = text.match(torqueRegex);
  if (torqueMatches) {
    torqueMatches.forEach(addMatch);
  }

  // 6. Temperature values
  // Forms like 150 C, 300 F, 20°C, 350°F
  const tempRegex = /\b\d+(?:\.\d+)?\s*(?:°C|°F|C|F)\b/gi;
  const tempMatches = text.match(tempRegex);
  if (tempMatches) {
    tempMatches.forEach(item => {
      // Avoid standalone letters like "C" or "F" when not a temperature
      if (item.match(/\d/)) addMatch(item);
    });
  }

  // 7. Dimensions and Tolerances
  // Forms like 5 mm, 12 inch, 1/4 in, 3 m, 0.5 cm
  const dimRegex = /\b\d+(?:\.\d+)?\s*(?:mm|cm|inch|inch?|m)\b/gi;
  const dimMatches = text.match(dimRegex);
  if (dimMatches) {
    dimMatches.forEach(item => {
      // Exclude fake XML layout artifacts (e.g. 51434991105535120mm) by checking digit length
      const numPart = item.match(/\d+/);
      if (numPart && numPart[0].length <= 8) {
        addMatch(item);
      }
    });
  }

  // Fraction dimensions like 1/4" or 1/2 in or 0.125"
  const fractionRegex = /\b\d+\/\d+(?:\s*(?:in|inch|mm|"))?/gi;
  const fractionMatches = text.match(fractionRegex);
  if (fractionMatches) {
    fractionMatches.forEach(addMatch);
  }

  // 8. Software versions
  // Forms like v3.5, version 1.2.3, ver 5
  const swRegex = /\bv\d+(?:\.\d+)+\b/gi;
  const swMatches = text.match(swRegex);
  if (swMatches) {
    swMatches.forEach(addMatch);
  }

  const swVerRegex = /version\s+\d+(?:\.\d+)+\b/gi;
  const swVerMatches = text.match(swVerRegex);
  if (swVerMatches) {
    swVerMatches.forEach(addMatch);
  }

  // 9. Specific model numbers (e.g., SLB-200, R3000, 3100-XP)
  const modelRegex = /\b[A-Za-z]{2,5}-\d{3,5}[A-Za-z]*\b/g;
  const modelMatches = text.match(modelRegex);
  if (modelMatches) {
    modelMatches.forEach(addMatch);
  }

  // 10. Lubricants / Materials / Brands commonly cited with key letters
  const matBrandsRegex = /\b(?:Molykote|Mobil[a-zA-Z0-9]*|Loctite|Dow Corning|Castrol|Shell)\b/gi;
  const matBrandsMatches = text.match(matBrandsRegex);
  if (matBrandsMatches) {
    matBrandsMatches.forEach(addMatch);
  }

  // Filter out generic terms that might have been accidentally caught
  const genericTerms = new Set([
    'figure', 'figures', 'fig', 'figs',
    'table', 'tables', 'reference', 'references',
    'procedure', 'summary', 'section', 'page',
    'image', 'caption', 'relevant', 'below', 'above', 'note', 'step',
    'drawing', 'drawings', 'drg', 'drgs'
  ]);
  
  const finalFacts = Array.from(facts).filter(fact => !genericTerms.has(fact.toLowerCase()));

  return finalFacts;
}

/**
 * Checks which extracted technical facts are missing in the rewritten output.
 */
export function checkPreservedFacts(originalText: string, compiledOutput: string): {
  allPreserved: boolean;
  missingFacts: string[];
} {
  const originalFacts = extractTechnicalFacts(originalText);
  if (originalFacts.length === 0) {
    return { allPreserved: true, missingFacts: [] };
  }

  const missingFacts: string[] = [];
  const normalizedOutput = compiledOutput.toLowerCase();

  originalFacts.forEach(fact => {
    // Escape special characters for string check or just use standard includes on normalized form
    const factLower = fact.toLowerCase();
    // Sometimes the output might parse "PN 12345" as "P/N 12345" or just "12345". To prevent false positives, we also check if the inner numeric part is present.
    const numericPart = fact.match(/\d+/);
    
    let isPresent = normalizedOutput.includes(factLower);
    
    // Fallback check if the main text has the numeric part and some context
    if (!isPresent && numericPart) {
      isPresent = normalizedOutput.includes(numericPart[0]);
    }

    if (!isPresent) {
      missingFacts.push(fact);
    }
  });

  return {
    allPreserved: missingFacts.length === 0,
    missingFacts
  };
}
