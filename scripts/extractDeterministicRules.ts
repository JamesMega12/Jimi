/**
 * Offline build/review tool for the deterministic writing-convention rule set
 * (data/deterministicRules/rules.json).
 *
 * This does NOT run at request time and does NOT write rules.json directly:
 * it surfaces *candidate* rules from the handbook PDF so a human can triage
 * the high-confidence, unambiguous ones into rules.json by hand — the same
 * review discipline systemKnowledge uses for its .override.md files. The
 * handbook's ~63-page unit table flattens to wrapped, column-interleaved text
 * under pdf-parse's getText() (no column coordinates), so fully reconstructing
 * every row automatically is unreliable; targeting the explicit, pattern-bound
 * rules ("Do not use X for Y", "Incorrect: ... / Correct: ...") is both
 * tractable and safe.
 *
 * Usage:
 *   npx tsx scripts/extractDeterministicRules.ts units  [pdfPath]
 *   npx tsx scripts/extractDeterministicRules.ts prose  [pdfPath]
 *   npx tsx scripts/extractDeterministicRules.ts help
 *
 * pdfPath defaults to $SLB_HANDBOOK_PDF if set. The PDF is read in place and
 * never copied, relocated, or committed by this script.
 */
import fs from 'fs';
import * as pdfParse from 'pdf-parse';

async function loadPages(pdfPath: string): Promise<string[]> {
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    console.error('Pass a path as the last arg or set $SLB_HANDBOOK_PDF.');
    process.exit(1);
  }
  const buf = fs.readFileSync(pdfPath);
  const p = new (pdfParse as any).PDFParse({ data: buf });
  const r = await p.getText();
  return r.pages.map((pg: any) => pg.text as string);
}

/** "Do not use X for Y" -> candidate disallowed-form rule. */
function extractDoNotUse(pages: string[]): any[] {
  const out: any[] = [];
  const re = /Do not use\s+(.{1,40}?)\s+for\s+([a-z][a-z \-/]{2,40})/gi;
  pages.forEach((text, idx) => {
    const flat = text.replace(/\n/g, ' ');
    let m: RegExpExecArray | null;
    while ((m = re.exec(flat)) !== null) {
      out.push({ page: idx + 1, disallowed: m[1].trim(), thing: m[2].trim(), raw: m[0].trim() });
    }
  });
  return out;
}

/** "Incorrect: ... / Correct: ..." prose pairs. */
function extractIncorrectCorrect(pages: string[]): any[] {
  const out: any[] = [];
  pages.forEach((text, idx) => {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const inc = lines[i].match(/^Incorrect:\s*(.+)$/i);
      if (inc) {
        // The matching "Correct:" is usually the next non-empty line, but may
        // wrap; look ahead a few lines.
        let corr = '';
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const c = lines[j].match(/^Correct:\s*(.+)$/i);
          if (c) { corr = c[1].trim(); break; }
        }
        out.push({ page: idx + 1, incorrect: inc[1].trim(), correct: corr });
      }
    }
  });
  return out;
}

async function main() {
  const cmd = process.argv[2] || 'help';
  const pdfPath = process.argv[4] || process.argv[3] || process.env.SLB_HANDBOOK_PDF || '';

  if (cmd === 'help' || !cmd) {
    console.log(`extractDeterministicRules — candidate extractor for human review\n`);
    console.log(`  units  [pdfPath]   list "Do not use X for Y" candidate rules`);
    console.log(`  prose  [pdfPath]   list Incorrect:/Correct: candidate pairs`);
    console.log(`\nCandidates are printed for triage; curate rules.json by hand.`);
    return;
  }

  const pages = await loadPages(pdfPath);

  if (cmd === 'units') {
    const cands = extractDoNotUse(pages);
    console.log(JSON.stringify({ command: 'units', count: cands.length, candidates: cands }, null, 2));
  } else if (cmd === 'prose') {
    const cands = extractIncorrectCorrect(pages);
    console.log(JSON.stringify({ command: 'prose', count: cands.length, candidates: cands }, null, 2));
  } else {
    console.error(`Unknown command: ${cmd}. Try "help".`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
