export interface DetectedPlaceholder {
  type: 'Figure' | 'Table';
  number: string;
  caption: string;
  source: 'Summary' | 'Procedure';
  warning?: string;
}

export function detectPlaceholders(text: string, source: 'Summary' | 'Procedure'): DetectedPlaceholder[] {
  const detected: DetectedPlaceholder[] = [];
  
  // Explicit placeholders: [Insert Figure 1: Caption]
  const explicitRegex = /\[Insert\s+(Figure|Table)\s+([a-zA-Z0-9.\-]+)\s*:?\s*(.*?)\]/gi;
  
  // References: see Figure 1, Table 1, etc.
  const referenceRegex = /\b(?:see|refer to|in)\s+(Figure|Table|Fig\.?|Tab\.?)\s+(\d+[a-zA-Z0-9.\-]*)\b/gi;
  // Also just "Figure X" without "see"
  const plainRefRegex = /\b(Figure|Table|Fig\.?|Tab\.?)\s+(\d+[a-zA-Z0-9.\-]*)\b/gi;

  const explicitMatches = [...text.matchAll(explicitRegex)];
  const plainRefs = [...text.matchAll(plainRefRegex)];

  // Process explicit placeholders
  for (const match of explicitMatches) {
    const typeRaw = match[1].toLowerCase();
    const type = typeRaw.startsWith('fig') ? 'Figure' : 'Table';
    const number = match[2];
    const caption = match[3].trim();
    
    let warning: string | undefined;
    if (!caption) {
      warning = `${type} ${number} is missing a caption.`;
    } else if (caption.toLowerCase().includes('ignore all') || caption.toLowerCase().includes('prompt')) {
      warning = `${type} ${number} caption may contain instruction-like text. Review before export.`;
    }

    detected.push({
      type,
      number,
      caption,
      source,
      warning
    });
  }

  // Process references that don't have explicit placeholders in the same text
  // (We'll check across both in the component, but we can do a preliminary check here)
  for (const match of plainRefs) {
    const typeRaw = match[1].toLowerCase();
    const type = typeRaw.startsWith('fig') ? 'Figure' : 'Table';
    const number = match[2];
    
    // Check if we already found an explicit placeholder for this
    const hasExplicit = detected.some(d => d.type === type && d.number === number);
    if (!hasExplicit) {
      // It's a reference without an inline placeholder
      detected.push({
        type,
        number,
        caption: '',
        source,
        warning: `${type} ${number} is referenced, but no ${type} ${number} placeholder was found.`
      });
    }
  }

  return detected;
}

export interface ConflictingPlaceholder {
  type: string;
  number: string;
  captions: { caption: string; source: string }[];
}

export function findConflictingPlaceholderCaptions(placeholders: DetectedPlaceholder[]): ConflictingPlaceholder[] {
  const groups: Record<string, DetectedPlaceholder[]> = {};
  for (const p of placeholders) {
    if (p.warning?.includes('is referenced')) continue; // Skip plain references
    const key = `${p.type.toLowerCase()}:${p.number}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  const conflicts: ConflictingPlaceholder[] = [];
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    const uniqueCaptions = new Map<string, DetectedPlaceholder>();
    for (const p of group) {
      const normalizedCaption = (p.caption || '').trim().toLowerCase();
      if (!uniqueCaptions.has(normalizedCaption)) {
        uniqueCaptions.set(normalizedCaption, p);
      }
    }
    
    if (uniqueCaptions.size > 1) {
      conflicts.push({
        type: group[0].type,
        number: group[0].number,
        captions: Array.from(uniqueCaptions.values()).map(p => ({
          caption: (p.caption || '').trim(),
          source: p.source || 'Unknown'
        }))
      });
    }
  }

  return conflicts;
}

export function consolidatePlaceholders(summaryDetected: DetectedPlaceholder[], procedureDetected: DetectedPlaceholder[]) {
  const all = [...summaryDetected, ...procedureDetected];
  const consolidated: DetectedPlaceholder[] = [];
  
  const explicitCounts: Record<string, number> = {};

  for (const item of all) {
    const key = `${item.type}-${item.number}`;
    
    if (!item.warning?.includes('is referenced')) {
       // It's an explicit placeholder
       explicitCounts[key] = (explicitCounts[key] || 0) + 1;
       if (explicitCounts[key] > 1) {
         item.warning = `Duplicate ${item.type} ${item.number} placeholders detected.`;
       }
       consolidated.push(item);
    }
  }

  // Add references that still don't have explicit placeholders
  for (const item of all) {
    if (item.warning?.includes('is referenced')) {
      const key = `${item.type}-${item.number}`;
      if (!explicitCounts[key]) {
        // We only add it once
        if (!consolidated.some(c => c.warning?.includes('is referenced') && c.type === item.type && c.number === item.number)) {
            consolidated.push(item);
        }
      }
    }
  }

  return consolidated;
}
