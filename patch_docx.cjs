const fs = require('fs');
let code = fs.readFileSync('src/server/docxExportService.ts', 'utf8');

const oldFuncRegex = /const generateDocxTable = \(title: string, tableDef: any, headers: string\[\], fields: string\[\]\) => \{[\s\S]*?sections\.push\(new Paragraph\(\{ spacing: \{ after: 200 \} \}\)\); \/\/ Spacer\n  \};\n/m;

const newFunc = `  const generateDocxTable = (title: string, tableDef: any, headers: string[], fields: string[]) => {
    if (!tableDef || tableDef.status === 'not_applicable') return;
    
    sections.push(new Paragraph({ 
      text: title, 
      heading: HeadingLevel.HEADING_2, 
      spacing: { before: 300, after: 150 } 
    }));

    if (!tableDef.rows || tableDef.rows.length === 0) {
      sections.push(new Paragraph({ text: "No entries.", spacing: { after: 200 } }));
      return;
    }

    const tableRows = [];
    
    // Determine column widths and alignments based on field names
    const getColWidth = (field: string) => {
      if (['quantity', 'qty', 'cost', 'reworkCost'].includes(field)) return { size: 10, type: WidthType.PERCENTAGE };
      if (['partNumber', 'partKitNumber', 'fcoNumber', 'priority'].includes(field)) return { size: 15, type: WidthType.PERCENTAGE };
      if (['description', 'comments', 'application'].includes(field)) return { size: 30, type: WidthType.PERCENTAGE }; // Use remaining space
      return { size: 20, type: WidthType.PERCENTAGE };
    };

    const getColAlign = (field: string) => {
      if (['quantity', 'qty', 'cost', 'reworkCost'].includes(field)) return AlignmentType.CENTER;
      return AlignmentType.LEFT;
    };
    
    // Header Row
    tableRows.push(new TableRow({
      tableHeader: true, // prevent row breaking across pages? Actually not fully supported this way, but tableHeader means repeat on break
      children: headers.map((h, i) => new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text: h, bold: true, color: "000000" })], 
          alignment: getColAlign(fields[i]) 
        })],
        margins: { top: 150, bottom: 150, left: 150, right: 150 },
        shading: { fill: "F3F4F6" }, // light gray
        width: getColWidth(fields[i])
      }))
    }));

    // Data Rows
    for (const row of tableDef.rows) {
      tableRows.push(new TableRow({
        children: fields.map(f => new TableCell({
          children: [new Paragraph({ 
            text: row[f] ? String(row[f]) : '',
            alignment: getColAlign(f)
          })],
          margins: { top: 150, bottom: 150, left: 150, right: 150 },
          width: getColWidth(f)
        }))
      }));
    }

    sections.push(new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" }
      }
    }));
    sections.push(new Paragraph({ spacing: { after: 200 } })); // Spacer
  };
`;

code = code.replace(oldFuncRegex, newFunc);
fs.writeFileSync('src/server/docxExportService.ts', code);
