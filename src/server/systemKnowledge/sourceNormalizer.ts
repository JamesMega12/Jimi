import fs from 'fs';
import path from 'path';
import * as pdfParse from 'pdf-parse';
import { parseDocx } from '../docx/docxParserService';
import { NormalizedDocument } from './types';

/**
 * Normalizes a system-knowledge source file into Markdown-shaped text: `##`
 * headings and blank-line-separated paragraphs. This exists because
 * `chunkExtractedText` (chunkingService.ts) already knows how to chunk on
 * exactly that shape -- it just never receives it from the legacy
 * `textExtractionService.ts` path, which strips every blank line. Rather
 * than touch the legacy extractor (used by the existing user-upload path)
 * or the chunker, this module is a new boundary in front of both: whatever
 * the source format, it produces the shape the chunker was designed for.
 *
 * Deliberately best-effort for PDF: heading/paragraph/header-footer
 * detection here are heuristics, not a layout engine. `warnings` surfaces
 * what the heuristics could not confidently resolve (no headings found, a
 * lot of repeated boilerplate stripped, suspiciously low paragraph count)
 * so a human can inspect the generated `.normalized.md` and, if needed,
 * hand-correct it into a `.override.md` that takes precedence -- see
 * `manifest.ts` / `systemKnowledgeService.ts`.
 */

// "1. Introduction", "2.3 Units and Symbols", "Chapter 4", "APPENDIX A"
const NUMBERED_HEADING = /^(?:[0-9]+(?:\.[0-9]+)*\.?)\s+[A-Z]/;
const NAMED_HEADING = /^(chapter|section|appendix)\s+[0-9ivxlc]+/i;
const PAGE_NUMBER_LIKE = /^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i;

function isHeadingLike(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (NUMBERED_HEADING.test(t)) return true;
  if (NAMED_HEADING.test(t)) return true;
  // Short, all-caps line with at least one letter reads as a heading/title,
  // not a sentence (real prose in these documents is not written in caps).
  if (t.length >= 4 && t.length <= 70 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/[a-z]/.test(t)) {
    return true;
  }
  return false;
}

function isPageNumberLike(line: string): boolean {
  return PAGE_NUMBER_LIKE.test(line.trim());
}

/**
 * Merge PDF text-stream lines back into paragraphs. `pdf-parse` emits one
 * line per visual text line, not per paragraph, so a naive "one line = one
 * chunk" reading is far too fragmented. Heuristic: keep appending lines to
 * the current paragraph unless the previous line ends a sentence AND the
 * next line starts a new one AND the accumulated paragraph is already
 * reasonably long (avoids splitting short label/value lines mid-thought).
 */
function groupIntoParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let current = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current) {
        paragraphs.push(current);
        current = '';
      }
      continue;
    }
    if (!current) {
      current = line;
      continue;
    }
    const endsSentence = /[.:?!]["')\]]?$/.test(current);
    const startsNewSentence = /^[A-Z0-9"'(]/.test(line);
    if (endsSentence && startsNewSentence && current.length > 60) {
      paragraphs.push(current);
      current = line;
    } else {
      current = `${current} ${line}`;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

async function normalizePdf(buffer: Buffer, warnings: string[]): Promise<NormalizedDocument> {
  const parser = new (pdfParse as any).PDFParse({ data: buffer });
  const result = await parser.getText();
  const pages: { num: number; text: string }[] =
    result?.pages && result.pages.length > 0 ? result.pages : [{ num: 1, text: result?.text || '' }];

  const perPageLines: string[][] = pages.map((p) => (p.text || '').split(/\r?\n/));

  // A line repeating on a large fraction of pages is a running header or
  // footer (title bar, confidentiality notice, doc number), not content.
  const pageCount = perPageLines.length;
  const lineCounts = new Map<string, number>();
  if (pageCount >= 3) {
    for (const lines of perPageLines) {
      const seenOnThisPage = new Set<string>();
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.length > 100) continue;
        if (seenOnThisPage.has(line)) continue;
        seenOnThisPage.add(line);
        lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
      }
    }
  }
  const repeatThreshold = Math.max(3, Math.ceil(pageCount * 0.4));
  const repeatedLines = new Set<string>();
  for (const [line, count] of lineCounts) {
    if (count >= repeatThreshold) repeatedLines.add(line);
  }

  let strippedRepeatedCount = 0;
  let strippedPageNumberCount = 0;
  let headingCount = 0;
  const outParts: string[] = [];

  for (const rawLines of perPageLines) {
    const kept: string[] = [];
    for (const raw of rawLines) {
      const line = raw.trim();
      if (!line) {
        kept.push('');
        continue;
      }
      if (repeatedLines.has(line)) {
        strippedRepeatedCount++;
        continue;
      }
      if (isPageNumberLike(line)) {
        strippedPageNumberCount++;
        continue;
      }
      if (isHeadingLike(line)) {
        headingCount++;
        if (kept.length && kept[kept.length - 1] !== '') kept.push('');
        kept.push(`## ${line}`);
        kept.push('');
      } else {
        kept.push(line);
      }
    }
    const paragraphs = groupIntoParagraphs(kept.filter((l, i) => !(l === '' && kept[i - 1] === '')));
    if (paragraphs.length) {
      outParts.push(paragraphs.join('\n\n'));
    }
  }

  const text = outParts.join('\n\n');
  const totalParagraphCount = outParts.reduce((sum, page) => sum + page.split('\n\n').length, 0);

  if (headingCount === 0) warnings.push('no_headings_detected');
  if (strippedRepeatedCount > 0) warnings.push(`repeated_lines_stripped:${strippedRepeatedCount}`);
  if (pageCount > 0 && totalParagraphCount / pageCount < 0.5) warnings.push('low_paragraph_density');

  return { text, extractorId: 'pdf-heuristic-v1', warnings };
}

function renderTableMarkdown(block: any): string {
  const rows: any[] = block.rows || [];
  if (rows.length === 0) return (block.text || '').trim();
  const lines: string[] = [];
  rows.forEach((row: any, idx: number) => {
    const cells = (row.cells || []).map((c: any) =>
      String(c.text || '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim(),
    );
    lines.push(`| ${cells.join(' | ')} |`);
    if (idx === 0) {
      lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
    }
  });
  return lines.join('\n');
}

function normalizeDocx(buffer: Buffer, fileName: string, warnings: string[]): NormalizedDocument {
  const parsed: any = parseDocx(buffer, fileName, 'system-knowledge-normalize');
  const blocks: any[] = parsed?.blocks || [];

  let headingCount = 0;
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block) continue;
    if (block.type === 'table') {
      const rendered = renderTableMarkdown(block);
      if (rendered) parts.push(rendered);
      continue;
    }
    const text = (block.text || '').trim();
    if (!text) continue;
    if (block.type === 'heading') {
      headingCount++;
      parts.push(`## ${text}`);
    } else {
      parts.push(text);
    }
  }

  if (blocks.length === 0) warnings.push('extraction_produced_no_blocks');
  if (headingCount === 0) warnings.push('no_headings_detected');

  return { text: parts.join('\n\n'), extractorId: 'docx-structured-v1', warnings };
}

/**
 * Normalize a system-knowledge source file at `filePath` into Markdown-shaped
 * text ready for `chunkExtractedText`. Throws on unreadable/unsupported
 * files -- callers (systemKnowledgeService) are expected to record that as
 * an ingestion failure, not to guess at partial content.
 */
export async function normalizeSource(filePath: string, originalName: string): Promise<NormalizedDocument> {
  const ext = path.extname(originalName).toLowerCase();
  const warnings: string[] = [];

  if (!fs.existsSync(filePath)) {
    throw new Error(`Source file not found at: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);

  if (ext === '.md' || ext === '.txt') {
    const text = buffer.toString('utf-8');
    if (!/^#{1,6}\s+/m.test(text)) warnings.push('no_headings_detected');
    return { text, extractorId: 'markdown-passthrough-v1', warnings };
  }

  if (ext === '.pdf') {
    return normalizePdf(buffer, warnings);
  }

  if (ext === '.docx') {
    return normalizeDocx(buffer, originalName, warnings);
  }

  throw new Error(`Unsupported system-knowledge source file type: "${ext}". Supported: .md, .txt, .pdf, .docx`);
}
