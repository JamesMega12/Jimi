// Rich content fidelity (Phase 5): a constrained, minimal inline/block markup
// parser for Announcement's free-text content fields (Summary/Reason
// renderedText, Action item text). Framework-free (no React, no docx) so it's
// safely importable by both the client renderer (RichTextContent.tsx) and the
// server DOCX exporter's renderer (announcementRichTextDocx.ts) without either
// pulling in the other's dependency (react / docx).
//
// Fields stay plain `string` -- no type-model rewrite. Only the *rendering*
// interprets this syntax; `.trim()`/readiness/grounding checks are unaffected.
//
// Syntax (deliberately minimal -- only what real WCF Announcement reference
// documents actually use):
//   **bold**, *italic*, [link text](https://url)
//   "- " at line start -> a bullet item; an indented "- " (2+ leading spaces)
//   under a bullet -> one level of nested sub-bullet. Blank-line-separated
//   text stays a plain paragraph (extends the paragraph-splitting behavior
//   renderedText already used before this: `text.split(/\n{2,}/)`).

export interface RichSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

export interface RichListItem {
  spans: RichSpan[];
  subItems?: RichSpan[][];
}

export type RichBlock =
  | { type: "paragraph"; spans: RichSpan[] }
  | { type: "list"; items: RichListItem[] };

// Inline markup: link, then bold, then italic (checked in that order per match
// so "**bold**" is never misparsed as two adjacent italics).
const INLINE_RE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

export function parseInlineSpans(text: string): RichSpan[] {
  const spans: RichSpan[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > lastIndex) spans.push({ text: text.slice(lastIndex, m.index) });
    if (m[1] !== undefined) {
      spans.push({ text: m[1], href: m[2] });
    } else if (m[3] !== undefined) {
      spans.push({ text: m[3], bold: true });
    } else if (m[4] !== undefined) {
      spans.push({ text: m[4], italic: true });
    }
    lastIndex = INLINE_RE.lastIndex;
  }
  if (lastIndex < text.length) spans.push({ text: text.slice(lastIndex) });
  return spans.length > 0 ? spans : [{ text: "" }];
}

export function parseRichText(raw: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paraBuffer: string[] = [];
  let currentList: RichListItem[] | null = null;

  const flushParagraph = () => {
    const text = paraBuffer.join(" ").trim();
    paraBuffer = [];
    if (text) blocks.push({ type: "paragraph", spans: parseInlineSpans(text) });
  };
  const flushList = () => {
    if (currentList && currentList.length > 0) blocks.push({ type: "list", items: currentList });
    currentList = null;
  };

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const leadingSpaces = line.length - line.trimStart().length;
    const isBulletLine = /^-\s+/.test(trimmed) || trimmed === "-";

    if (isBulletLine) {
      const content = trimmed.replace(/^-\s*/, "");
      flushParagraph();
      if (leadingSpaces >= 2 && currentList && currentList.length > 0) {
        const last = currentList[currentList.length - 1];
        last.subItems = last.subItems ?? [];
        last.subItems.push(parseInlineSpans(content));
      } else {
        if (!currentList) currentList = [];
        currentList.push({ spans: parseInlineSpans(content) });
      }
      continue;
    }

    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paraBuffer.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}
