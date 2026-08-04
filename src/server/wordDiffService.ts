export interface DiffToken {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}

export interface DiffStats {
  addedWordCount: number;
  removedWordCount: number;
  unchangedWordCount: number;
  similarityRatio: number;
}

export interface DiffResult {
  available: boolean;
  originalText: string;
  rewrittenText: string;
  diffTokens: DiffToken[];
  stats: DiffStats;
}

export interface DiffTrace {
  summary: DiffResult;
  procedure: {
    available: boolean;
    sections: {
      title: string;
      originalText: string;
      rewrittenText: string;
      diffTokens: DiffToken[];
      stats: DiffStats;
    }[];
  };
  warnings: string[];
}

const INDIVISIBLE_PATTERN = /((?:PN|SWI|InTouch)\s+[\w-]+|Drawing\s+PN\s+[\w]+|(?:Figure|Table)s?\s+\d+(?:\s+and\s+\d+)?|\b\d+\s*(?:degC|psi|degrees? C|°C)\b|\bversion\s+\d+(?:\.\d+)*|\[[A-Za-z0-9\s:_-]+\])/g;

function tokenize(text: string): string[] {
  if (!text) return [];
  // First split by indivisible tokens
  const rawParts = text.split(INDIVISIBLE_PATTERN);
  const result: string[] = [];
  
  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    if (!part) continue;
    
    if (i % 2 === 1) {
      // It's an indivisible token, treat as single word
      result.push(part);
    } else {
      // It's normal text, split into words and punctuation
      const words = part.match(/\S+|\s+/g);
      if (words) {
         words.forEach(w => {
            if (w.trim() === '') {
               result.push(w);
            } else {
               const puncSplit = w.match(/\w+|[^\w\s]+/g);
               if (puncSplit) {
                 result.push(...puncSplit);
               } else {
                 result.push(w);
               }
            }
         });
      }
    }
  }
  return result;
}

// LCS algorithm for diffing
function computeDiff(original: string[], rewritten: string[]): DiffToken[] {
  const m = original.length;
  const n = rewritten.length;
  const lcs = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (original[i - 1].toLowerCase() === rewritten[j - 1].toLowerCase()) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  const diff: DiffToken[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1].toLowerCase() === rewritten[j - 1].toLowerCase()) {
      diff.unshift({ type: 'unchanged', text: rewritten[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      diff.unshift({ type: 'added', text: rewritten[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || lcs[i][j - 1] < lcs[i - 1][j])) {
      diff.unshift({ type: 'removed', text: original[i - 1] });
      i--;
    }
  }
  
  return optimizeDiff(diff);
}

function optimizeDiff(diff: DiffToken[]): DiffToken[] {
  const merged: DiffToken[] = [];
  for (const token of diff) {
    const lastToken = merged[merged.length - 1];
    
    // Ignore purely whitespace adds/removes to reduce noise, unless joining words
    if ((token.type === 'added' || token.type === 'removed') && token.text.match(/^\s+$/)) {
      if (lastToken && lastToken.type === token.type) {
         lastToken.text += token.text;
      } else {
         merged.push(token);
      }
      continue;
    }
    
    if (lastToken && lastToken.type === token.type) {
      lastToken.text += token.text;
    } else {
      merged.push(token);
    }
  }
  return merged;
}

export function generateDiffTrace(originalText: string, rewrittenText: string): DiffResult {
  const origTokens = tokenize(originalText);
  const newTokens = tokenize(rewrittenText);
  
  const diffTokens = computeDiff(origTokens, newTokens);
  
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  
  diffTokens.forEach(t => {
     const words = (t.text.match(/\b\w+\b/g) || []).length;
     if (t.type === 'added') added += words;
     else if (t.type === 'removed') removed += words;
     else if (t.type === 'unchanged') unchanged += words;
  });
  
  const total = added + removed + unchanged;
  const similarityRatio = total > 0 ? unchanged / total : 0;
  
  return {
    available: true,
    originalText,
    rewrittenText,
    diffTokens,
    stats: {
      addedWordCount: added,
      removedWordCount: removed,
      unchangedWordCount: unchanged,
      similarityRatio
    }
  };
}
