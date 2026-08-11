import { Paragraph, TextRun, ExternalHyperlink } from "docx";
import { RichBlock, RichSpan, parseRichText } from "../components/announcement/richTextMarkup";

// Server-only DOCX rendering for the rich content markup (Phase 5). Kept
// separate from richTextMarkup.ts (which stays framework-free) so importing
// this file's `docx` dependency never reaches the client bundle -- the client
// only needs the parser + a React renderer (RichTextContent.tsx), never docx
// itself.

export function spansToRuns(spans: RichSpan[]): (TextRun | ExternalHyperlink)[] {
  return spans.map((s) => {
    if (s.href) {
      return new ExternalHyperlink({
        link: s.href,
        children: [new TextRun({ text: s.text, bold: s.bold, italics: s.italic })],
      });
    }
    return new TextRun({ text: s.text, bold: s.bold, italics: s.italic });
  });
}

/**
 * @param baseLevel bullet-list nesting level for this blocks' own top-level
 * list items (sub-items of those items render at baseLevel+1). Lets a caller
 * embed rich blocks underneath something else's own bullet (see
 * announcementDocxExportService.ts's Action item rendering).
 */
export function renderRichBlocksToDocxParagraphs(blocks: RichBlock[], baseLevel = 0): Paragraph[] {
  const out: Paragraph[] = [];
  for (const block of blocks) {
    if (block.type === "paragraph") {
      out.push(new Paragraph({ children: spansToRuns(block.spans), spacing: { after: 200 } }));
    } else {
      for (const item of block.items) {
        out.push(new Paragraph({ children: spansToRuns(item.spans), bullet: { level: baseLevel }, spacing: { after: 60 } }));
        for (const sub of item.subItems ?? []) {
          out.push(new Paragraph({ children: spansToRuns(sub), bullet: { level: baseLevel + 1 }, spacing: { after: 60 } }));
        }
      }
    }
  }
  return out;
}

/** Convenience: parse a raw markup string straight to DOCX paragraphs. */
export function renderRichTextToDocxParagraphs(text: string, baseLevel = 0): Paragraph[] {
  return renderRichBlocksToDocxParagraphs(parseRichText(text), baseLevel);
}
