import { Document, Paragraph, TextRun, HeadingLevel, Packer, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ShadingType, VerticalAlign } from 'docx';
import { TechnicalAlertSnapshot } from '../components/technical-alert/v2/snapshot';
import { ActionItem } from '../components/technical-alert/v2/types';

// v2 DOCX exporter -- consumes ONLY the canonical TechnicalAlertSnapshot
// (never a raw draft), so it is structurally guaranteed to render exactly
// what the snapshot contains, the same snapshot the frontend's
// FinalReviewPanel renders. Follows the same docx-library patterns as the v1
// exporter (technicalAlertDocxExportService.ts, Phase A of the prior
// stabilization plan) -- this refactor is not revisiting DOCX visual
// formatting, only the content-selection architecture underneath it.

export async function generateTechnicalAlertDocxV2(snapshot: TechnicalAlertSnapshot): Promise<Buffer> {
  const sections: (Paragraph | Table)[] = [];

  sections.push(
    new Paragraph({
      text: snapshot.administrativeMetadata.title || 'UNTITLED TECHNICAL ALERT',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  sections.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: allBorders('000000', 1),
      rows: [
        new TableRow({ children: [createHeaderCell('Document Number'), createHeaderCell('Classification'), createHeaderCell('InTouch ID')] }),
        new TableRow({
          children: [
            createDataCell(snapshot.administrativeMetadata.documentNumber),
            createDataCell(snapshot.administrativeMetadata.classification),
            createDataCell(snapshot.administrativeMetadata.inTouchId),
          ],
        }),
        new TableRow({ children: [createHeaderCell('Date'), createHeaderCell('GEMS No'), createHeaderCell('Effective Timing')] }),
        new TableRow({
          children: [
            createDataCell(snapshot.administrativeMetadata.date),
            createDataCell(snapshot.administrativeMetadata.gemsNo || 'N/A'),
            createDataCell(snapshot.controlInformation.effectiveTiming),
          ],
        }),
      ],
    })
  );
  sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  sections.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: allBorders('990000', 2),
      rows: [
        new TableRow({ children: [createHeaderCell('Deadline', 'ffcccc'), createHeaderCell('Action By', 'ffcccc'), createHeaderCell('Information For', 'ffcccc')] }),
        new TableRow({
          children: [
            createDataCell(snapshot.controlInformation.deadline || 'N/A'),
            createDataCell(snapshot.controlInformation.actionBy.join(', ')),
            createDataCell(snapshot.controlInformation.informationFor.join(', ')),
          ],
        }),
      ],
    })
  );
  sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  if (snapshot.summary) {
    sections.push(heading('SUMMARY'));
    const s = snapshot.summary;
    if (s.renderedText && s.renderedText.trim()) {
      // Cohesive paragraph, produced by rewrite -- the intended default for
      // any AI-rewritten Summary. Falls back to the field-by-field render
      // below only when no rewrite has ever run (manual accept, or content
      // accepted before this capability existed).
      sections.push(new Paragraph({ text: s.renderedText, spacing: { after: 200 } }));
    } else {
      pushIfPresent(sections, 'Subject:', s.subject);
      pushIfPresent(sections, 'Affected Scope:', s.affectedScope);
      pushIfPresent(sections, 'Risk/Issue:', s.riskOrIssue);
      pushIfPresent(sections, 'Requirement:', s.centralRequirement);
      pushIfPresent(sections, 'Prohibition:', s.centralProhibition);
      pushIfPresent(sections, 'Revocation:', s.revocation);
      pushIfPresent(sections, 'Effective Timing:', s.effectiveTiming);
      pushIfPresent(sections, 'Exception Note:', s.exceptionNote);
    }
  }

  if (snapshot.reasons) {
    sections.push(heading('REASONS'));
    if (snapshot.reasons.narrative) {
      const n = snapshot.reasons.narrative;
      if (n.renderedText && n.renderedText.trim()) {
        // Cohesive paragraph, produced by rewrite -- same renderedText-first
        // pattern as Summary (2026-07-28 fix: this branch was missing here,
        // so a rewritten Reasons narrative always exported as the raw field
        // list below, never the synthesized prose).
        sections.push(new Paragraph({ text: n.renderedText, spacing: { after: 100 } }));
        pushIfPresent(sections, 'Cause Status:', n.causeStatus);
      } else {
        pushIfPresent(sections, 'Technical Basis:', n.technicalBasis);
        pushIfPresent(sections, 'Compliance Basis:', n.complianceBasis);
        pushIfPresent(sections, 'Consequence:', n.consequence);
        pushIfPresent(sections, 'Cause Status:', n.causeStatus);
      }
    }
    if (snapshot.reasons.evidenceItems && snapshot.reasons.evidenceItems.length > 0) {
      const rows = [
        new TableRow({ children: [createHeaderCell('Component'), createHeaderCell('Concern'), createHeaderCell('Evidence')] }),
        ...snapshot.reasons.evidenceItems.map(
          e => new TableRow({ children: [createDataCell(e.component), createDataCell(e.concern), createDataCell(e.evidence || '')] })
        ),
      ];
      sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
      sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    }
  }

  addActionSection(sections, 'IMMEDIATE ACTION', snapshot.immediateAction?.items);
  if (snapshot.immediateAction && snapshot.immediateAction.exceptions.length > 0) {
    sections.push(heading('EXCEPTIONS'));
    snapshot.immediateAction.exceptions.forEach((exc, i) => {
      sections.push(new Paragraph({ children: [new TextRun({ text: `Exception ${i + 1}: `, bold: true }), new TextRun({ text: exc.condition })], spacing: { after: 60 } }));
      exc.limitations.forEach(l => sections.push(new Paragraph({ text: l, bullet: { level: 0 } })));
      if (exc.requiredApprovers.length > 0) pushIfPresent(sections, 'Required Approvers:', exc.requiredApprovers.join(', '));
      pushIfPresent(sections, 'Submission System:', exc.submissionSystem);
      pushIfPresent(sections, 'Related Standard:', exc.relatedStandard);
    });
  }

  if (snapshot.followUpAction?.notApplicable) {
    sections.push(heading('FOLLOW UP ACTION'));
    sections.push(new Paragraph({ children: [new TextRun({ text: 'Not Applicable.', italics: true })] }));
  } else {
    addActionSection(sections, 'FOLLOW UP ACTION', snapshot.followUpAction?.items);
  }

  if (snapshot.controlInformation.acknowledgementRequired && snapshot.supportingContent.acknowledgement) {
    sections.push(heading('ACKNOWLEDGEMENT AND QUIZ'));
    const ack = snapshot.supportingContent.acknowledgement;
    pushIfPresent(sections, 'Application/System:', ack.applicationOrSystem);
    pushIfPresent(sections, 'Completion Deadline:', ack.completionDeadline);
    pushIfPresent(sections, 'Completion Instructions:', ack.completionInstructions);
    if (snapshot.controlInformation.quizRequired) {
      sections.push(new Paragraph({ children: [new TextRun({ text: 'Quiz completion is required.', bold: true })] }));
    }
  }

  if (snapshot.supportingContent.tables.length > 0) {
    sections.push(heading('TABLES'));
    snapshot.supportingContent.tables.forEach(t => sections.push(new Paragraph({ children: [new TextRun({ text: `[TABLE ${t.number}: ${t.caption || 'Untitled'}]`, bold: true })] })));
  }
  if (snapshot.supportingContent.figures.length > 0) {
    sections.push(heading('FIGURES'));
    snapshot.supportingContent.figures.forEach(f => sections.push(new Paragraph({ children: [new TextRun({ text: `[FIGURE ${f.number}: ${f.caption || 'Untitled'}]`, bold: true })], alignment: AlignmentType.CENTER })));
  }
  if (snapshot.supportingContent.references.length > 0) {
    sections.push(heading('REFERENCES'));
    snapshot.supportingContent.references.forEach(r => {
      let text = r.label;
      if (r.url) text += ` - ${r.url}`;
      if (r.note) text += ` (${r.note})`;
      sections.push(new Paragraph({ text, bullet: { level: 0 } }));
    });
  }

  const doc = new Document({
    creator: 'TechCom Assistant',
    title: snapshot.administrativeMetadata.title,
    description: 'Generated Technical Alert (v2)',
    sections: [{ properties: {}, children: sections }],
  });

  return await Packer.toBuffer(doc);
}

function heading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
}
function pushIfPresent(sections: (Paragraph | Table)[], label: string, value: string | undefined) {
  if (value && value.trim()) {
    sections.push(new Paragraph({ children: [new TextRun({ text: label + ' ', bold: true }), new TextRun({ text: value })], spacing: { after: 100 } }));
  }
}
function addActionSection(sections: (Paragraph | Table)[], title: string, items: ActionItem[] | undefined) {
  if (!items || items.length === 0) return;
  sections.push(heading(title));
  items.forEach(item => {
    const flags = [`(${item.obligationStrength})`, ...(item.controlType || []).map(t => `[${t.replace(/_/g, ' ')}]`)].join(' ');
    const actor = item.actor.length > 0 ? ` — ${item.actor.join(', ')}` : '';
    // Prefer the synthesized instructionText (folds target/timing/condition
    // into the sentence -- see types.ts ActionItem.instructionText) over the
    // bare requiredAction field, which never carried those facts into the
    // exported text (a confirmed defect: they were captured in data but
    // silently dropped here). Falls back to requiredAction alone for
    // manually-authored or pre-rewrite items, which never get instructionText.
    const text = item.instructionText || item.requiredAction;
    sections.push(new Paragraph({ text: `${text} ${flags}${actor}`, bullet: { level: 0 }, spacing: { after: 60 } }));
  });
}
function allBorders(color: string, size: number) {
  const border = { style: BorderStyle.SINGLE, size, color };
  return { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
}
function createHeaderCell(text: string, bgColor: string = 'e0e0e0'): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })], alignment: AlignmentType.CENTER })],
    shading: { fill: bgColor, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
  });
}
function createDataCell(text: string): TableCell {
  return new TableCell({ children: [new Paragraph({ text })], verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } });
}
