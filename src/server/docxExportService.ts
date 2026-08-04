import { Document, Paragraph, TextRun, HeadingLevel, Packer, Table, TableRow, TableCell, BorderStyle, WidthType, Header, Footer, AlignmentType, ShadingType, SimpleField } from 'docx';

function formatConsistentDate(val: string | undefined): string | undefined {
  if (!val) return val;
  // Use a simple regex to detect DD-MM-YYYY or MM-DD-YYYY or YYYY-MM-DD
  const datePattern = /^(\d{1,4})[-\/\.](\d{1,2})[-\/\.](\d{1,4})$/;
  const match = val.match(datePattern);
  if (match) {
     // Check which one is year
     let year, month, day;
     if (match[1].length === 4) { year = match[1]; month = match[2]; day = match[3]; }
     else if (match[3].length === 4) { year = match[3]; month = match[2]; day = match[1]; }
     else return val; // fallback

     const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
     const mIndex = parseInt(month, 10) - 1;
     if (mIndex >= 0 && mIndex < 12) {
         return `${day.padStart(2, '0')}-${monthNames[mIndex]}-${year}`;
     }
  }
  return val;
}

const MISSING = "[Information required from submitter]";
const BAND_FILL = "D9D9D9";   // section band shading (matches official form look)
const HEADER_FILL = "F3F4F6"; // table header shading
const BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "808080" }
};
const CELL_MARGINS = { top: 100, bottom: 100, left: 150, right: 150 };

/** Splits step text on inline [Figure N: caption] / [Table N: caption] tokens.
 * Returns paragraphs: the text (with tokens removed) followed by a red, bold
 * placeholder paragraph for each token — matching the "placeholder for now"
 * image handling in the official document. */
function stepTextToParagraphs(text: string, opts: { bullet?: boolean; bold?: boolean } = {}): Paragraph[] {
  const out: Paragraph[] = [];
  const tokenRegex = /\[\s*(?:insert\s+)?(figure|fig\.?|table)\s*(\d+)\s*[:\-–]?\s*([^\]]*)\]/gi;
  const placeholders: { kind: string; num: string; caption: string }[] = [];
  const cleaned = text.replace(tokenRegex, (_m, kind, num, caption) => {
    placeholders.push({
      kind: /table/i.test(kind) ? 'TABLE' : 'FIGURE',
      num,
      caption: (caption || '').trim()
    });
    return '';
  }).replace(/\s{2,}/g, ' ').trim();

  if (cleaned) {
    out.push(new Paragraph({
      children: [new TextRun({ text: (opts.bullet ? '• ' : '') + cleaned, bold: opts.bold })],
      spacing: { after: 60 },
      indent: opts.bullet ? { left: 200 } : undefined
    }));
  }
  for (const p of placeholders) {
    out.push(new Paragraph({
      children: [new TextRun({
        text: `[ ${p.kind} ${p.num} PLACEHOLDER${p.caption ? ` — ${p.caption}` : ''} ]`,
        bold: true,
        color: "C00000"
      })],
      spacing: { before: 60, after: 60 },
      indent: opts.bullet ? { left: 200 } : undefined
    }));
    out.push(new Paragraph({
      children: [new TextRun({
        text: p.kind === 'FIGURE' ? `Figure ${p.num}${p.caption ? ` — ${p.caption}` : ''}` : `Table ${p.num}${p.caption ? ` — ${p.caption}` : ''}`,
        italics: true,
        size: 18
      })],
      spacing: { after: 80 },
      indent: opts.bullet ? { left: 200 } : undefined
    }));
  }
  return out;
}

export async function generateDocxExport(
  fcoContext: any,
  rewrittenSummary: any,
  rewrittenProcedure: any,
  diagnostics?: any,
  developerMode: boolean = false
): Promise<Buffer> {
  const docTitle = fcoContext?.fcoDraft?.fcoMetadata?.fcoTitle || fcoContext?.title || "Field Change Order (FCO) Draft";
  const meta = fcoContext?.fcoDraft?.fcoMetadata || {};
  const assocInfo = fcoContext?.fcoDraft?.associatedInfo || {};
  const costSched = fcoContext?.fcoDraft?.costSchedule || {};
  const addInfo = fcoContext?.fcoDraft?.additionalFcoInfo || {};
  const approval = fcoContext?.fcoDraft?.approvalRoles || {};
  const tables = fcoContext?.fcoDraft?.fcoTables || {};
  const visualPlaceholders = fcoContext?.fcoDraft?.visualPlaceholders || [];
  const procedureCallouts = fcoContext?.fcoDraft?.technicalContent?.procedureCallouts || [];
  const existingReferences = fcoContext?.fcoDraft?.technicalContent?.existingReferences || '';

  const children: any[] = [];
  const isFallback = diagnostics?.engineUsed === 'local_fallback' || diagnostics?.fallbackUsed;

  // ---------- Title band ----------
  const titleCellChildren: any[] = [
    new Paragraph({
      children: [new TextRun({ text: "DRAFT FCO", bold: true, size: 24, color: "595959" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: docTitle,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: isFallback ? 100 : 0 }
    })
  ];
  if (isFallback) {
    const text = developerMode
      ? "WARNING: FALLBACK MODE ACTIVATED - Offline local fallback engine used. TechCom review is strictly required."
      : "Draft generated using local fallback. TechCom review required.";
    titleCellChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: "FF0000" })],
        spacing: { before: 100, after: 0 }
      })
    );
  }
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "F2F2F2" },
        margins: { top: 200, bottom: 200, left: 200, right: 200 },
        children: titleCellChildren
      })]
    })]
  }));
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // ---------- Developer engine summary ----------
  if (developerMode && diagnostics) {
    let engineLabel = "Unknown";
    if (diagnostics.engineUsed === 'gemini') engineLabel = "Gemini";
    else if (diagnostics.engineUsed === 'gemini_with_repair') engineLabel = "Gemini with Repair";
    else if (isFallback) engineLabel = "Local Fallback";
    children.push(new Paragraph({
      children: [
        new TextRun({ text: "Engine Used: ", bold: true }),
        new TextRun({ text: engineLabel }),
        new TextRun({ text: " | Fallback: ", bold: true }),
        new TextRun({ text: isFallback ? `Yes (${diagnostics.fallbackReason || 'N/A'})` : "No" })
      ],
      spacing: { after: 200 }
    }));
  }

  // ---------- Identification table (official FCO top block) ----------
  const labelValueRow = (label: string, val: any) => new TableRow({
    children: [
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        margins: CELL_MARGINS,
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })]
      }),
      new TableCell({
        width: { size: 75, type: WidthType.PERCENTAGE },
        margins: CELL_MARGINS,
        columnSpan: 2,
        children: [new Paragraph({ text: (val === undefined || val === null || String(val).trim() === '') ? MISSING : String(val) })]
      })
    ]
  });

  const fullRow = (paragraphs: Paragraph[]) => new TableRow({
    children: [new TableCell({
      margins: CELL_MARGINS,
      columnSpan: 3,
      children: paragraphs
    })]
  });

  const twoCellRow = (leftLabel: string, leftVal: any, rightLabel: string, rightVal: any) => new TableRow({
    children: [
      new TableCell({
        width: { size: 40, type: WidthType.PERCENTAGE },
        margins: CELL_MARGINS,
        children: [new Paragraph({
          children: [
            new TextRun({ text: `${leftLabel}  `, bold: true }),
            new TextRun({ text: (leftVal === undefined || leftVal === null || String(leftVal).trim() === '') ? MISSING : String(leftVal) })
          ]
        })]
      }),
      new TableCell({
        width: { size: 60, type: WidthType.PERCENTAGE },
        margins: CELL_MARGINS,
        columnSpan: 2,
        children: [new Paragraph({
          children: [
            new TextRun({ text: `${rightLabel}  `, bold: true }),
            new TextRun({ text: (rightVal === undefined || rightVal === null || String(rightVal).trim() === '') ? MISSING : String(rightVal) })
          ]
        })]
      })
    ]
  });

  const summaryParagraphText = typeof rewrittenSummary?.paragraph === 'string' ? rewrittenSummary.paragraph : '';
  const summaryParas: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: "Summary:", bold: true })], spacing: { after: 80 } })
  ];
  // Summary may include inline figure/table tokens too.
  stepTextToParagraphs(summaryParagraphText || MISSING).forEach(p => summaryParas.push(p));

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERS,
    rows: [
      labelValueRow("Applies to:", meta.appliesTo || fcoContext?.appliesTo),
      labelValueRow("Effective Date:", formatConsistentDate(meta.effectiveDate || fcoContext?.effectiveDate)),
      labelValueRow("Production Start:", meta.productionStart || fcoContext?.productionStart),
      fullRow(summaryParas),
      labelValueRow("Associated RFI:", assocInfo.associatedRFI),
      labelValueRow("Superseded FCOs:", assocInfo.supersededFCOs),
      labelValueRow("Associated FCOs:", assocInfo.associatedFCOs),
      labelValueRow("Associated CO/CAs:", assocInfo.associatedCOCAs),
      labelValueRow("Associated Tech Alerts:", assocInfo.associatedTechAlerts),
      twoCellRow("Q-Check / Service Level:", assocInfo.qCheckServiceLevel, "Coding Changes:", assocInfo.codingChanges),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: CELL_MARGINS,
            shading: { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL },
            children: [new Paragraph({ children: [new TextRun({ text: "Est. FCO Cost (USD) (a+c)", bold: true })] })]
          }),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: CELL_MARGINS,
            shading: { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL },
            children: [new Paragraph({ children: [new TextRun({ text: "Est. Special Equip. Cost (USD) (b)", bold: true })] })]
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            margins: CELL_MARGINS,
            shading: { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL },
            children: [new Paragraph({
              children: [
                new TextRun({ text: "Est. Time (Hours)  ", bold: true }),
                new TextRun({ text: costSched.estimatedTimeHours || MISSING })
              ]
            })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: CELL_MARGINS,
            children: [new Paragraph({ text: costSched.estimatedFcoCostUsd || MISSING })]
          }),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: CELL_MARGINS,
            children: [new Paragraph({ text: costSched.estimatedSpecialEquipmentCostUsd || MISSING })]
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            margins: CELL_MARGINS,
            children: [new Paragraph({
              children: [
                new TextRun({ text: "Due Date: ", bold: true }),
                new TextRun({ text: formatConsistentDate(costSched.dueDate) || MISSING })
              ]
            })]
          })
        ]
      }),
      twoCellRow("Priority:", meta.priority || fcoContext?.priority, "Application:", meta.application),
      fullRow([new Paragraph({
        children: [
          new TextRun({ text: "Capitalize: ", bold: true }),
          new TextRun({ text: assocInfo.capitalize || MISSING })
        ]
      })]),
      fullRow([
        new Paragraph({ children: [new TextRun({ text: "Comments by Operations:", bold: true })], spacing: { after: 80 } }),
        new Paragraph({ text: assocInfo.commentsByOperations || MISSING })
      ])
    ]
  }));
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // ---------- Parts / history tables (banded, official form style) ----------
  const bandedTable = (bandTitle: string, tableDef: any, headers: string[], fields: string[]) => {
    const colCount = headers.length;
    const rows: TableRow[] = [];

    rows.push(new TableRow({
      children: [new TableCell({
        columnSpan: colCount,
        margins: CELL_MARGINS,
        shading: { type: ShadingType.CLEAR, color: "auto", fill: BAND_FILL },
        children: [new Paragraph({ children: [new TextRun({ text: bandTitle, bold: true })] })]
      })]
    }));

    const getColWidth = (field: string) => {
      if (['quantity', 'qty', 'cost', 'reworkCost'].includes(field)) return { size: 8, type: WidthType.PERCENTAGE };
      if (['partNumber', 'partKitNumber', 'fcoNumber', 'priority'].includes(field)) return { size: 15, type: WidthType.PERCENTAGE };
      return { size: 30, type: WidthType.PERCENTAGE };
    };
    const getColAlign = (field: string) => {
      if (['quantity', 'qty', 'cost', 'reworkCost'].includes(field)) return AlignmentType.CENTER;
      return AlignmentType.LEFT;
    };

    rows.push(new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => new TableCell({
        margins: CELL_MARGINS,
        shading: { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL },
        width: getColWidth(fields[i]),
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true })],
          alignment: getColAlign(fields[i])
        })]
      }))
    }));

    const dataRows = (tableDef && tableDef.status !== 'not_applicable' && Array.isArray(tableDef.rows)) ? tableDef.rows : [];
    if (dataRows.length === 0) {
      rows.push(new TableRow({
        children: [new TableCell({
          columnSpan: colCount,
          margins: CELL_MARGINS,
          children: [new Paragraph({ children: [new TextRun({ text: "None.", italics: true, color: "808080" })] })]
        })]
      }));
    } else {
      for (const row of dataRows) {
        rows.push(new TableRow({
          children: fields.map(f => new TableCell({
            margins: CELL_MARGINS,
            width: getColWidth(f),
            children: [new Paragraph({
              text: row[f] ? String(row[f]) : '',
              alignment: getColAlign(f)
            })]
          }))
        }));
      }
    }

    children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDERS }));
    children.push(new Paragraph({ spacing: { after: 150 } }));
  };

  bandedTable("FCO History", tables.fcoHistory, ["FCO #", "Priority", "Application", "Description"], ["fcoNumber", "priority", "application", "description"]);
  bandedTable("Parts or Kits Required (a)", tables.partsOrKitsRequired, ["Qty.", "Part/Kit #", "Description", "Cost", "Comments"], ["quantity", "partKitNumber", "description", "cost", "comments"]);
  bandedTable("Special Equipment Required (b)", tables.specialEquipmentRequired, ["Qty.", "Part No.", "Description", "Cost", "Comments"], ["quantity", "partNumber", "description", "cost", "comments"]);
  bandedTable("Parts Requiring Rework (c)", tables.partsRequiringRework, ["Qty.", "Part No.", "Description", "Rework Cost", "Comments"], ["quantity", "partNumber", "description", "reworkCost", "comments"]);
  bandedTable("Parts to Scrap", tables.partsToScrap, ["Qty.", "Part No.", "Description", "Cost", "Comments"], ["quantity", "partNumber", "description", "cost", "comments"]);

  // ---------- Maintenance changes / marking ----------
  children.push(new Paragraph({ children: [new TextRun({ text: "Changes to Maintenance and Test Procedures, SWIs, or Manuals", bold: true })], spacing: { before: 200, after: 80 } }));
  children.push(new Paragraph({ text: addInfo.maintenanceProcedureChanges || "N.A.", spacing: { after: 150 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: "Marking Information", bold: true })], spacing: { before: 100, after: 80 } }));
  children.push(new Paragraph({ text: addInfo.markingInformation || "N.A.", spacing: { after: 200 } }));

  // ---------- Procedure (official step-table layout) ----------
  children.push(new Paragraph({ children: [new TextRun({ text: "Procedure:", bold: true, size: 26 })], spacing: { before: 200, after: 120 } }));

  // Map internal sections into the official three bands.
  const bands = {
    safetyAndPrep: [] as any[],
    installation: [] as any[],
    postInstallation: [] as any[]
  };
  if (rewrittenProcedure?.sections && Array.isArray(rewrittenProcedure.sections)) {
    for (const section of rewrittenProcedure.sections) {
      const tLower = (section.title || '').toLowerCase();
      if (tLower.includes('safety') || tLower.includes('preparation')) {
        bands.safetyAndPrep.push(section);
      } else if (tLower.includes('implementation') || tLower.includes('update') || tLower.includes('install') || tLower.includes('backup')) {
        bands.installation.push(section);
      } else {
        bands.postInstallation.push(section);
      }
    }
  }

  const cleanCalloutLabel = (type: string, text: string) => {
    const prefix = `${type.toUpperCase()}:`;
    let cleaned = text.trim();
    while (cleaned.toUpperCase().startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length).trim();
    }
    return `${prefix} ${cleaned}`;
  };

  let masterStepNum = 0;
  const bandTable = (bandTitle: string, bandSections: any[]) => {
    // Collect the major step rows of this band: each stepGroup is one row
    // (bold title + sub-bullets), each flat step is one row.
    type StepRow = { title?: string; texts: string[] };
    const stepRows: StepRow[] = [];
    for (const section of bandSections) {
      if (Array.isArray(section.stepGroups)) {
        for (const g of section.stepGroups) {
          if (g && Array.isArray(g.steps) && g.steps.length > 0) {
            stepRows.push({ title: g.title, texts: g.steps });
          }
        }
      }
      if (Array.isArray(section.steps)) {
        for (const st of section.steps) {
          const text = typeof st === 'string' ? st : (st?.text || '');
          if (text) stepRows.push({ texts: [text] });
        }
      }
    }
    if (stepRows.length === 0) return;

    const rows: TableRow[] = [];
    rows.push(new TableRow({
      children: [new TableCell({
        columnSpan: 2,
        margins: CELL_MARGINS,
        shading: { type: ShadingType.CLEAR, color: "auto", fill: BAND_FILL },
        children: [new Paragraph({ children: [new TextRun({ text: bandTitle, bold: true })] })]
      })]
    }));

    // Safety callouts for this band go right under the band header.
    const matchedCallouts = procedureCallouts.filter((c: any) =>
      c.section && (c.section.toLowerCase() === bandTitle.toLowerCase() || bandTitle.toLowerCase().includes(c.section.toLowerCase()))
    );
    if (matchedCallouts.length > 0) {
      const calloutParas: Paragraph[] = [];
      for (const callout of matchedCallouts) {
        if (!callout.text || !callout.text.trim()) continue;
        calloutParas.push(new Paragraph({
          children: [new TextRun({ text: cleanCalloutLabel(callout.type, callout.text), bold: true, color: callout.type === 'warning' ? "C00000" : (callout.type === 'caution' ? "BF6900" : "1F4E79") })],
          spacing: { after: 60 }
        }));
      }
      if (calloutParas.length > 0) {
        rows.push(new TableRow({
          children: [new TableCell({ columnSpan: 2, margins: CELL_MARGINS, children: calloutParas })]
        }));
      }
    }

    rows.push(new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          margins: CELL_MARGINS,
          shading: { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL },
          children: [new Paragraph({ children: [new TextRun({ text: "Step", bold: true })], alignment: AlignmentType.CENTER })]
        }),
        new TableCell({
          width: { size: 90, type: WidthType.PERCENTAGE },
          margins: CELL_MARGINS,
          shading: { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL },
          children: [new Paragraph({ children: [new TextRun({ text: "Description / Action", bold: true })] })]
        })
      ]
    }));

    for (const stepRow of stepRows) {
      masterStepNum++;
      const contentParas: Paragraph[] = [];
      if (stepRow.title) {
        stepTextToParagraphs(stepRow.title, { bold: true }).forEach(p => contentParas.push(p));
        for (const sub of stepRow.texts) {
          stepTextToParagraphs(sub, { bullet: true }).forEach(p => contentParas.push(p));
        }
      } else {
        stepTextToParagraphs(stepRow.texts[0]).forEach(p => contentParas.push(p));
      }
      if (contentParas.length === 0) continue;

      rows.push(new TableRow({
        children: [
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            margins: CELL_MARGINS,
            children: [new Paragraph({ children: [new TextRun({ text: String(masterStepNum), bold: true })], alignment: AlignmentType.CENTER })]
          }),
          new TableCell({
            width: { size: 90, type: WidthType.PERCENTAGE },
            margins: CELL_MARGINS,
            children: contentParas
          })
        ]
      }));
    }

    children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDERS }));
    children.push(new Paragraph({ spacing: { after: 150 } }));
  };

  bandTable("Safety and Preparation", bands.safetyAndPrep);
  bandTable("Installation Steps", bands.installation);
  bandTable("Post-Installation / Functional Check", bands.postInstallation);

  // ---------- References ----------
  children.push(new Paragraph({ children: [new TextRun({ text: "Reference", bold: true })], spacing: { before: 200, after: 80 } }));
  if (existingReferences && existingReferences.trim()) {
    existingReferences.split(/\r?\n/).filter((l: string) => l.trim()).forEach((line: string) => {
      children.push(new Paragraph({ text: line.trim(), spacing: { after: 60 } }));
    });
  } else {
    children.push(new Paragraph({ text: "N.A.", spacing: { after: 60 } }));
  }
  children.push(new Paragraph({ spacing: { after: 100 } }));

  // ---------- Reference figures (placeholders) ----------
  children.push(new Paragraph({ children: [new TextRun({ text: "Reference Figures", bold: true })], spacing: { before: 100, after: 80 } }));
  if (visualPlaceholders.length === 0) {
    children.push(new Paragraph({ text: "N.A.", spacing: { after: 200 } }));
  } else {
    for (const p of visualPlaceholders) {
      const cap = p.caption ? p.caption : 'caption required';
      const num = p.number ? p.number : '{number}';
      children.push(new Paragraph({
        children: [new TextRun({
          text: `[ ${p.type === 'figure' ? 'FIGURE' : 'TABLE'} ${num} PLACEHOLDER — ${cap} ]`,
          color: "C00000",
          bold: true
        })],
        spacing: { after: 60 }
      }));
      children.push(new Paragraph({
        children: [new TextRun({
          text: `${p.type === 'figure' ? 'Figure' : 'Table'} ${num} — ${cap}`,
          italics: true,
          size: 18
        })],
        spacing: { after: 120 }
      }));
    }
    children.push(new Paragraph({ spacing: { after: 100 } }));
  }

  // ---------- Approval roles ----------
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERS,
    rows: [
      new TableRow({
        children: ["Design Engineer", "InTouch Engineer", "Field Decision Maker"].map(h => new TableCell({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL },
          margins: CELL_MARGINS,
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })]
        }))
      }),
      new TableRow({
        children: [
          approval.designEngineer || MISSING,
          approval.inTouchEngineer || MISSING,
          approval.fieldDecisionMaker || MISSING
        ].map(name => new TableCell({
          margins: CELL_MARGINS,
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ text: name, alignment: AlignmentType.CENTER })]
        }))
      })
    ]
  }));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22, // 11pt * 2
          },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { bold: true, size: 32 },
          paragraph: { spacing: { after: 400 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { bold: true, allCaps: true, size: 28 },
          paragraph: { spacing: { before: 400, after: 200 } },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { bold: true, size: 24 },
          paragraph: { spacing: { before: 300, after: 150 } },
        }
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1267, bottom: 1080, left: 1440 }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [{ type: "right", position: 9360 }],
                children: [
                  new TextRun({ text: "Field Change Order", bold: true }),
                  new TextRun({ text: `\t${fcoContext?.fcoDraft?.fcoMetadata?.baseProductCode || "[Base Product Code]"} FCO ${fcoContext?.fcoDraft?.fcoMetadata?.fcoNumber || "[FCO Number]"}`, bold: true })
                ]
              }),
              new Paragraph({ text: docTitle, spacing: { after: 200 } })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [
                  { type: "center", position: 4680 },
                  { type: "right", position: 9360 }
                ],
                children: [
                  new TextRun({ text: "SLB-Private\tDMS # TBD        Revision Draft\tPage " }),
                  new SimpleField("PAGE"),
                  new TextRun({ text: " of " }),
                  new SimpleField("NUMPAGES")
                ]
              })
            ]
          })
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
