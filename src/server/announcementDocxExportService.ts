import { Document, Paragraph, TextRun, HeadingLevel, Packer, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ShadingType, VerticalAlign } from "docx";
import { AnnouncementSnapshot } from "../components/announcement/announcementTypes";
import { ACTION_KIND_LABELS, actionItemMeta } from "../components/announcement/announcementActionRender";
import { parseRichText, RichBlock } from "../components/announcement/richTextMarkup";
import { renderRichBlocksToDocxParagraphs, renderRichTextToDocxParagraphs, spansToRuns } from "./announcementRichTextDocx";
import { ANNOUNCEMENT_FIGURES_ENABLED } from "../components/announcement/announcementFeatureFlags";

// Announcement DOCX exporter -- consumes ONLY the canonical AnnouncementSnapshot
// (never a raw draft), the SAME snapshot the frontend review renders, so what
// you see is structurally guaranteed to be what you export (plan §17). Phase 1
// renders document-control metadata + the Summary section; Reason/Action are
// added when those sections land.

export async function generateAnnouncementDocx(snapshot: AnnouncementSnapshot): Promise<Buffer> {
  const sections: (Paragraph | Table)[] = [];

  sections.push(
    new Paragraph({
      text: snapshot.metadata.title || "UNTITLED ANNOUNCEMENT",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  sections.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: allBorders("000000", 1),
      rows: [
        new TableRow({ children: [headerCell("Announcement No."), headerCell("InTouch ID"), headerCell("Date")] }),
        new TableRow({
          children: [
            dataCell(snapshot.metadata.announcementNumber),
            dataCell(snapshot.metadata.inTouchId),
            dataCell(snapshot.metadata.date),
          ],
        }),
        new TableRow({ children: [headerCell("GEMS No"), headerCell("Classification"), headerCell("")] }),
        new TableRow({
          children: [
            dataCell(snapshot.metadata.gemsNo || "N/A"),
            dataCell(snapshot.metadata.classification || "SLB-Private"),
            dataCell(""),
          ],
        }),
      ],
    })
  );
  sections.push(new Paragraph({ text: "", spacing: { after: 200 } }));

  if (snapshot.summary) {
    sections.push(heading("SUMMARY"));
    const s = snapshot.summary;
    if (s.renderedText && s.renderedText.trim()) {
      // Cohesive paragraph produced by rewrite -- the intended default. Falls
      // back to the field list only when no rewrite ran (manual accept). Rich
      // markup (bold/italic/links/nested bullets) renders as real Word
      // formatting, not literal **/[]() characters.
      sections.push(...renderRichTextToDocxParagraphs(s.renderedText));
    } else {
      pushRichIfPresent(sections, "", s.centralMessage);
      pushRichIfPresent(sections, "Affected Scope:", s.affectedScope);
      pushRichIfPresent(sections, "Impact:", s.impact);
      pushRichIfPresent(sections, "Implementation Timing:", s.implementationTiming);
    }
  }

  if (snapshot.reason) {
    sections.push(heading("REASON"));
    const r = snapshot.reason;
    if (r.renderedText && r.renderedText.trim()) {
      sections.push(...renderRichTextToDocxParagraphs(r.renderedText));
    } else {
      pushRichIfPresent(sections, "", r.rationale);
      pushRichIfPresent(sections, "Triggering Observation:", r.triggeringObservation);
    }
    // Certainty tag is printed only when a cause is actually asserted, so a
    // rationale/objectives-style Reason never shows a spurious "Cause Status".
    // Plain -- an enum value, never markup.
    if (r.causeStatus) pushIfPresent(sections, "Cause Status:", r.causeStatus);
  }

  if (snapshot.action) {
    sections.push(heading("ACTION"));
    const a = snapshot.action;
    if (a.lead && a.lead.trim()) sections.push(...renderRichTextToDocxParagraphs(a.lead.trim()));
    a.items.forEach((item) => {
      // The kind label stays a plain bold prefix (never itself markup); the
      // item's own text is rich-parsed so bold/italic/links/nested "- "
      // sub-bullets (e.g. a "Mandatory X:" item with its own sub-steps)
      // render as real Word formatting and structure, not literal characters.
      const label = new TextRun({ text: `${ACTION_KIND_LABELS[item.kind]}: `, bold: true });
      const meta = actionItemMeta(item);
      const blocks = parseRichText(item.text);
      const first = blocks.length > 0 ? blocks[0] : null;
      const isFirstParagraph = first !== null && first.type === "paragraph";

      if (isFirstParagraph) {
        const spans = (first as Extract<RichBlock, { type: "paragraph" }>).spans;
        const metaRun = meta ? [new TextRun({ text: meta, color: "666666" })] : [];
        sections.push(
          new Paragraph({ children: [label, ...spansToRuns(spans), ...metaRun], bullet: { level: 0 }, spacing: { after: 60 } })
        );
        if (blocks.length > 1) sections.push(...renderRichBlocksToDocxParagraphs(blocks.slice(1), 1));
      } else {
        sections.push(new Paragraph({ children: [label], bullet: { level: 0 }, spacing: { after: 60 } }));
        if (blocks.length > 0) sections.push(...renderRichBlocksToDocxParagraphs(blocks, 1));
        if (meta.trim()) {
          sections.push(new Paragraph({ children: [new TextRun({ text: meta.trim(), color: "666666" })], spacing: { after: 60 } }));
        }
      }
    });
  }

  // Numbered caption placeholders, not embedded images -- mirrors Technical
  // Alert v2's technicalAlertDocxExportServiceV2.ts. The author pastes the
  // real image in after export.
  if (ANNOUNCEMENT_FIGURES_ENABLED && snapshot.supportingContent.figures.length > 0) {
    sections.push(heading("FIGURES"));
    snapshot.supportingContent.figures.forEach((f) => {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: `[FIGURE ${f.number}: ${f.caption || "Untitled"}]`, bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        })
      );
    });
  }

  const doc = new Document({
    creator: "TechCom Assistant",
    title: snapshot.metadata.title,
    description: "Generated Announcement",
    sections: [{ properties: {}, children: sections }],
  });

  return await Packer.toBuffer(doc);
}

function heading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
}

function pushIfPresent(sections: (Paragraph | Table)[], label: string, value: string | undefined) {
  if (value && value.trim()) {
    const children = label
      ? [new TextRun({ text: label + " ", bold: true }), new TextRun({ text: value })]
      : [new TextRun({ text: value })];
    sections.push(new Paragraph({ children, spacing: { after: 100 } }));
  }
}

/** Same as pushIfPresent, but the value is rich-parsed so manually-typed
 * bold/italic/link markup renders as real Word formatting. */
function pushRichIfPresent(sections: (Paragraph | Table)[], label: string, value: string | undefined) {
  if (!value || !value.trim()) return;
  const blocks = parseRichText(value);
  if (label && blocks.length > 0 && blocks[0].type === "paragraph") {
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: label + " ", bold: true }), ...spansToRuns(blocks[0].spans)],
        spacing: { after: 100 },
      })
    );
    sections.push(...renderRichBlocksToDocxParagraphs(blocks.slice(1)));
  } else {
    if (label) sections.push(new Paragraph({ children: [new TextRun({ text: label, bold: true })], spacing: { after: 60 } }));
    sections.push(...renderRichBlocksToDocxParagraphs(blocks));
  }
}

function allBorders(color: string, size: number) {
  const border = { style: BorderStyle.SINGLE, size, color };
  return { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
}

function headerCell(text: string, bgColor: string = "e0e0e0"): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })], alignment: AlignmentType.CENTER })],
    shading: { fill: bgColor, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
  });
}

function dataCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ text: text || "" })],
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
  });
}
