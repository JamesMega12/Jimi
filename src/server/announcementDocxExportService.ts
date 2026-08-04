import { Document, Paragraph, TextRun, HeadingLevel, Packer, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ShadingType, VerticalAlign } from "docx";
import { AnnouncementSnapshot } from "../components/announcement/announcementTypes";
import { actionItemLine } from "../components/announcement/announcementActionRender";

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
      // back to the field list only when no rewrite ran (manual accept).
      s.renderedText.split(/\n{2,}/).forEach((para) => {
        const t = para.trim();
        if (t) sections.push(new Paragraph({ text: t, spacing: { after: 200 } }));
      });
    } else {
      pushIfPresent(sections, "", s.centralMessage);
      pushIfPresent(sections, "Affected Scope:", s.affectedScope);
      pushIfPresent(sections, "Impact:", s.impact);
      pushIfPresent(sections, "Implementation Timing:", s.implementationTiming);
    }
  }

  if (snapshot.reason) {
    sections.push(heading("REASON"));
    const r = snapshot.reason;
    if (r.renderedText && r.renderedText.trim()) {
      r.renderedText.split(/\n{2,}/).forEach((para) => {
        const t = para.trim();
        if (t) sections.push(new Paragraph({ text: t, spacing: { after: 200 } }));
      });
    } else {
      pushIfPresent(sections, "", r.rationale);
      pushIfPresent(sections, "Triggering Observation:", r.triggeringObservation);
    }
    // Certainty tag is printed only when a cause is actually asserted, so a
    // rationale/objectives-style Reason never shows a spurious "Cause Status".
    if (r.causeStatus) pushIfPresent(sections, "Cause Status:", r.causeStatus);
  }

  if (snapshot.action) {
    sections.push(heading("ACTION"));
    const a = snapshot.action;
    if (a.lead && a.lead.trim()) sections.push(new Paragraph({ text: a.lead.trim(), spacing: { after: 120 } }));
    a.items.forEach((item) => {
      sections.push(new Paragraph({ text: actionItemLine(item), bullet: { level: 0 }, spacing: { after: 60 } }));
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
