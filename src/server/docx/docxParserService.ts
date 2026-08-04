import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { v4 as uuidv4 } from 'uuid';
import { DocxBlock, DocxFigure, DocxAnalysisResponse, DocxTableMetadata } from '../../types';

export function parseDocx(buffer: Buffer, fileName: string, documentId: string): DocxAnalysisResponse {
  const blocks: DocxBlock[] = [];
  try {
    const zip = new AdmZip(buffer);
    const documentXmlEntry = zip.getEntry('word/document.xml');
    
    if (!documentXmlEntry) {
      throw new Error('Not a valid DOCX file (missing word/document.xml)');
    }
    
    const xmlData = documentXmlEntry.getData().toString('utf8');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      preserveOrder: true,
      textNodeName: "#text"
    });
    const parsedXml = parser.parse(xmlData);
    
    // Find w:body
    let body: any = null;
    const findBody = (arr: any) => {
      for (const item of arr) {
        if (item['w:document']) return findBody(item['w:document']);
        if (item['w:body']) return item['w:body'];
      }
    };
    body = findBody(parsedXml);

    if (!body) {
       throw new Error("Could not find body in document.xml");
    }

    let blockIndex = 0;
    
    function extractText(obj: any): string {
       if (typeof obj === 'string') return obj;
       if (Array.isArray(obj)) return obj.map(extractText).join('');
       if (typeof obj === 'object') {
          let text = '';
          for (const key in obj) {
             if (key === 'w:instrText') {
                continue; // Ignore field codes
             }
             if (key === '#text') {
                text += obj[key];
             } else if (key !== ':@') {
                text += extractText(obj[key]);
             }
          }
          return text;
       }
       return '';
    }

    function extractTextFromRun(run: any): string {
       return extractText(run);
    }
    
    function extractMultiRefs(text: string, keyword: string) {
       const refs = new Set<string>();
       const validIdRegex = /[A-Za-z0-9-]*\d[A-Za-z0-9-]*|[A-Z]/;
       const regex = new RegExp(`(?:${keyword}s?|${keyword.substring(0,3)}\\.?)\\s+([a-zA-Z0-9-]+(?:\\s*(?:,|and|&)\\s*[a-zA-Z0-9-]+)*)`, 'gi');
       
       let match;
       while ((match = regex.exec(text)) !== null) {
           const numbersStr = match[1];
           const numbers = numbersStr.split(/[,\s]+(?:and|&)*[\s]+/i).map(s => s.trim()).filter(Boolean);
           numbers.forEach(n => {
               if (n.match(/^(?:[A-Za-z0-9-]*\d[A-Za-z0-9-]*|[A-Z])$/i)) {
                   refs.add(`${keyword} ${n}`);
               }
           });
       }
       return Array.from(refs);
    }
    
    function checkContainsImage(node: any): boolean {
       if (Array.isArray(node)) return node.some(checkContainsImage);
       if (typeof node === 'object') {
          for (const key in node) {
             if (key === 'w:drawing' || key === 'v:imagedata' || key === 'a:blip') return true;
             if (key !== ':@' && checkContainsImage(node[key])) return true;
          }
       }
       return false;
    }

    function processParagraph(p: any, type: DocxBlock['type'] = 'paragraph', styleName: string | null = null, tableCellPath: string | null = null) {
      const text = extractText(p).trim();
      const containsImage = checkContainsImage(p);
      
      let finalType = type;
      if (text.toLowerCase().startsWith('figure ') || text.toLowerCase().startsWith('fig.')) {
        finalType = 'caption';
      } else if (styleName && styleName.toLowerCase().includes('heading')) {
        finalType = 'heading';
      }
      
      const figureRefs = extractMultiRefs(text, 'Figure');

      const tableRefs = extractMultiRefs(text, 'Table');
      const tableRefRegex2 = /(?:(?:the\s+)?[Tt]able\s+below)/ig;
      const tableRefsMatches2 = text.match(tableRefRegex2);
      if (tableRefsMatches2) {
         tableRefsMatches2.forEach(m => tableRefs.push(m.trim()));
      }

      let captionFigureNumber: string | null = null;
      if (finalType === 'caption') {
         const match = text.match(/^(?:[Ff]igure|[Ff]ig\.)\s*(\d+|\w+)/);
         if (match) captionFigureNumber = match[0];
      }
      
      const blockId = `block-${uuidv4()}`;
      blocks.push({
        blockId,
        blockIndex: blockIndex++,
        type: containsImage && text.length < 5 ? 'image' : finalType,
        text,
        containsImage,
        imageRefs: containsImage ? [`img-${blockIndex}`] : [],
        figureRefs,
        tableRefs,
        captionFigureNumber,
        styleName,
        tableCellPath,
        preserve: true
      });
    }

    function processTableNode(tbl: any) {
      const rows = [];
      let flattenedText = '';
      let containsImage = false;
      const figureRefs = new Set<string>();
      const tableRefs = new Set<string>();
      let ri = 0;
      
      for (const tItem of tbl) {
         if (tItem['w:tr']) {
            const rowCells = [];
            let ci = 0;
            // Iterate over children of w:tr
            for (const rItem of Array.isArray(tItem['w:tr']) ? tItem['w:tr'] : [tItem['w:tr']]) {
                if (rItem['w:tc']) {
                   const cellText = extractText(rItem['w:tc']).trim();
                   flattenedText += cellText + '\n';
                   if (checkContainsImage(rItem['w:tc'])) {
                       containsImage = true;
                   }
                   const matches = extractMultiRefs(cellText, 'Figure');
                   matches.forEach(m => figureRefs.add(m));

                   const tableMatches = extractMultiRefs(cellText, 'Table');
                   tableMatches.forEach(m => tableRefs.add(m));
                   
                   const cellTableRefRegex = /(?:(?:the\s+)?[Tt]able\s+below)/ig;
                   const tableMatches2 = cellText.match(cellTableRefRegex);
                   if (tableMatches2) tableMatches2.forEach(m => tableRefs.add(m.trim()));

                   // Simple label detection
                   const detectedLabels = [];
                   if (cellText.match(/summary\s*:/i) || cellText.match(/^summary\s*$/i)) detectedLabels.push('Summary');
                   
                   rowCells.push({
                      cellIndex: ci,
                      text: cellText,
                      containsLabel: detectedLabels.length > 0,
                      detectedLabels
                   });
                   ci++;
                }
            }
            rows.push({
               rowIndex: ri,
               cells: rowCells
            });
            ri++;
         }
      }

      const blockId = `block-${uuidv4()}`;
      blocks.push({
        blockId,
        blockIndex: blockIndex++,
        type: 'table',
        text: flattenedText.trim(),
        containsImage,
        imageRefs: containsImage ? [`img-${blockIndex}`] : [],
        figureRefs: Array.from(figureRefs),
        tableRefs: Array.from(tableRefs),
        captionFigureNumber: null,
        styleName: null,
        tableCellPath: null,
        preserve: true,
        rows,
        flattenedText: flattenedText.trim()
      });
    }

    function processElement(el: any) {
       for (const key in el) {
          if (key === 'w:p') {
             processParagraph(el[key], 'paragraph', null, null);
          } else if (key === 'w:tbl') {
             processTableNode(el[key]);
          } else {
             // Continue searching down if it's an array or object
             if (Array.isArray(el[key])) {
                 el[key].forEach((child: any) => processElement({[key]: child}));
             }
          }
       }
    }

    for (const item of body) {
       processElement(item);
    }
    
    // Now detect Summary and Procedure boundaries
    return detectSectionsAndFigures(blocks, documentId, fileName);

  } catch (e: any) {
    console.error('DOCX parse error', e);
    return {
       documentId,
       fileName,
       status: 'failed',
       detectedSummary: { text: '', blockIds: [], confidence: 0, warnings: [] },
       detectedProcedure: { text: '', blockIds: [], confidence: 0, warnings: [] },
       figures: [],
       procedureTables: [],
       documentBlocks: blocks,
       summaryConfidence: 0,
       procedureConfidence: 0,
       overallExtractionConfidence: 0,
       requiresUserConfirmation: true,
       warnings: ['Parsing failed: ' + e.message]
    };
  }
}

function detectSectionsAndFigures(blocks: DocxBlock[], documentId: string, fileName: string): DocxAnalysisResponse {
  let inSummary = false;
  let inProcedure = false;
  let summaryTextRaw = '';
  let procedureBlocks: DocxBlock[] = [];
  let summaryBlocks: DocxBlock[] = [];
  let sConfidence = 0;
  let pConfidence = 0;

  let appliesTo: string | undefined = undefined;
  let effectiveDate: string | undefined = undefined;
  let productionStart: string | undefined = undefined;

  let summaryDetectionMethod = 'manual';
  let summaryStartBlockId = '';
  let summaryStopLabel = '';
  let summaryStopBlockId = '';
  let summaryWarnings: string[] = [];
  let procedureWarnings: string[] = [];

  const stopLabels = [
    'associated rfi', 'superseded fco', 'associated fco', 'associated co/cas', 'associated co/ca',
    'associated tech alert', 'q-check', 'service level', 'coding changes',
    'est. fco cost', 'est. special equip. cost', 'est. time', 'due date',
    'priority', 'application', 'capitalize', 'comments by operations',
    'fco history', 'parts or kits required', 'special equipment required',
    'parts requiring rework', 'parts to scrap',
    'changes to maintenance and test procedures', 'marking information', 'procedure',
    'reference figures', 'acknowledgement'
  ];

  const isStopLabel = (text: string) => {
     const clean = text.toLowerCase().trim().replace(/:$/, '');
     return stopLabels.some(l => clean === l || clean.startsWith(l)) || (clean.length > 0 && stopLabels.includes(clean));
  };

  const processTextLineForSummary = (line: string, blockId: string) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      if (!inSummary && !inProcedure) {
          const lower = cleanLine.toLowerCase();
          const match = lower.match(/^summary\s*:?\s*(.*)/);
          if (match) {
             inSummary = true;
             sConfidence = 0.9;
             summaryStartBlockId = blockId;
             const remaining = cleanLine.substring(lower.indexOf('summary') + 7).replace(/^:/, '').trim();
             if (remaining) {
                 summaryTextRaw += remaining + '\n';
             }
          }
      } else if (inSummary) {
          if (isStopLabel(cleanLine)) {
             inSummary = false;
             summaryStopLabel = cleanLine;
             summaryStopBlockId = blockId;
          } else {
             summaryTextRaw += cleanLine + '\n';
          }
      }
  };

  for (let i = 0; i < blocks.length; i++) {
     const b = blocks[i];

     // Handle Procedure Sections separately as blocks since they hold images
     const bTextLower = b.text.toLowerCase().trim();
     if (!inProcedure && (bTextLower === 'procedure' || bTextLower.startsWith('procedure:'))) {
         inProcedure = true;
         inSummary = false;
         pConfidence = 0.9;
         if (bTextLower === 'procedure' || bTextLower === 'procedure:') continue;
     }

     if (inProcedure) {
         if (isStopLabel(bTextLower) && !bTextLower.includes('procedure')) {
             inProcedure = false;
         } else {
             procedureBlocks.push(b);
         }
         continue; // Procedure takes over
     }

     // Use table-cell logic for Summary
     if (b.type === 'table' && b.rows) {
         if (inSummary) summaryBlocks.push(b);
         
         let startSummaryHere = !inSummary;
         for (const row of b.rows) {
             for (let c = 0; c < row.cells.length; c++) {
                 const cell = row.cells[c];
                 const cellLower = cell.text.toLowerCase().trim();
                 
                 // Look for Applies To
                 if (cellLower === 'applies to:' || cellLower === 'applies to') {
                     if (c + 1 < row.cells.length) appliesTo = row.cells[c + 1].text.trim();
                 }
                 // Effective Date
                 if (cellLower === 'effective date:' || cellLower === 'effective date') {
                     if (c + 1 < row.cells.length) effectiveDate = row.cells[c + 1].text.trim();
                 }
                 // Production Start
                 if (cellLower === 'production start:' || cellLower === 'production start') {
                     if (c + 1 < row.cells.length) productionStart = row.cells[c + 1].text.trim();
                 }

                 const lines = cell.text.split('\n');
                 for (const line of lines) {
                     processTextLineForSummary(line, b.blockId);
                 }
             }
         }
         if (startSummaryHere && inSummary) {
             summaryDetectionMethod = 'table-field';
         }
     } else {
         if (inSummary) summaryBlocks.push(b);
         
         const lines = b.text.split('\n');
         let startSummaryHere = !inSummary;
         for (const line of lines) {
             processTextLineForSummary(line, b.blockId);
         }
         if (startSummaryHere && inSummary && summaryDetectionMethod === 'manual') {
             summaryDetectionMethod = 'paragraph-heading';
         }
     }
  }

  summaryTextRaw = summaryTextRaw.trim();

  // Validate Summary
  let summaryFailed = false;
  const lowerSummary = summaryTextRaw.toLowerCase();
  ['associated co/ca', 'associated tech alert', 'q-check', 'coding changes', 'est. fco cost', 'due date', 'priority', 'application'].forEach(l => {
      if (lowerSummary.includes(l)) {
          summaryFailed = true;
          sConfidence = 0;
          summaryWarnings.push(`Summary extraction unexpectedly included field: ${l}`);
      }
  });

  if (!summaryTextRaw) {
     sConfidence = 0;
     summaryWarnings.push('Could not confidently detect Summary section.');
  } else if (summaryFailed) {
     sConfidence = 0;
     summaryWarnings.push('Summary extraction failed logic constraints.');
     summaryTextRaw = '';
  }

  if (procedureBlocks.length === 0) {
     pConfidence = 0;
     procedureWarnings.push('Could not confidently detect Procedure section.');
  }

  // Detect Figures
  const figuresMap = new Map<string, DocxFigure>();
  const figuresList: DocxFigure[] = [];
  let uncaptionedImageBlocks: string[] = [];
  let anonymousFigureCount = 1;

  const extractCaption = (text: string) => {
      const match = text.trim().match(/^(?:(?:[Ff]igure|[Ff]ig\.)\s*([A-Za-z0-9-]*\d[A-Za-z0-9-]*|[A-Z]))([\s:.\-]+(.+))?/i);
      if (match) {
          return {
              figureNumber: `Figure ${match[1]}`, // Standardize
              captionText: match[3] ? match[3].trim() : null
          };
      }
      return null;
  };

  // Detect Tables
  const tablesMap = new Map<string, DocxTableMetadata>();
  const tablesList: DocxTableMetadata[] = [];
  let anonymousTableCount = 1;

  const extractTableInfo = (text: string) => {
      // Table 1: Title, Table 2.Title etc.
      const match = text.trim().match(/^[Tt]able\s*(\w+)([\s:.\-]+(.+))?/i);
      if (match) {
          return {
              tableNumber: `Table ${match[1]}`,
              titleText: match[3] ? match[3].trim() : null
          };
      }
      return null;
  };

  procedureBlocks.forEach((b, idx) => {
     let isImageBlock = b.containsImage;
     
     let capInfo = null;
     if (b.type === 'caption' || b.captionFigureNumber) {
         capInfo = extractCaption(b.text);
     } else if (b.type === 'table' && b.rows) {
         for (const row of b.rows) {
             for (const cell of row.cells) {
                 const cellCapInfo = extractCaption(cell.text);
                 if (cellCapInfo) {
                     capInfo = cellCapInfo;
                     break;
                 }
             }
             if (capInfo) break;
         }
     } else {
         const possible = extractCaption(b.text);
         if (possible) capInfo = possible;
     }

     if (isImageBlock) {
         uncaptionedImageBlocks.push(b.blockId);
     }

     if (capInfo && capInfo.figureNumber) {
         const num = capInfo.figureNumber;
         const capText = capInfo.captionText;

         let f = figuresMap.get(num);
         if (!f) {
             f = {
                 figureId: `fig-${num.replace(/\s+/g, '-')}`,
                 figureNumber: num,
                 caption: capText,
                 placeholder: capText ? `[Insert ${num}: ${capText}]` : `[Insert ${num}: caption required]`,
                 imageBlockIds: [],
                 captionBlockId: b.blockId,
                 referencedByBlockIds: [],
                 linkConfidence: uncaptionedImageBlocks.length > 0 ? 0.9 : 0.6,
                 warnings: []
             };
             figuresMap.set(num, f);
             figuresList.push(f);
         } else {
             if (!f.caption && capText) {
                 f.caption = capText;
                 f.placeholder = `[Insert ${num}: ${capText}]`;
             }
             f.captionBlockId = b.blockId;
             if (uncaptionedImageBlocks.length > 0) f.linkConfidence = 0.9;
         }

         f.imageBlockIds.push(...uncaptionedImageBlocks);
         uncaptionedImageBlocks = [];
     }

     if (b.figureRefs && b.figureRefs.length > 0) {
        b.figureRefs.forEach(ref => {
           const match = ref.match(/^(?:[Ff]igure|[Ff]ig\.)\s*(\d+|\w+)/i);
           if (match) {
              const num = `Figure ${match[1]}`;
              if (!figuresMap.has(num)) {
                  const f: DocxFigure = {
                     figureId: `fig-${num.replace(/\s+/g, '-')}`,
                     figureNumber: num,
                     caption: null,
                     placeholder: `[Insert ${num}: caption required]`,
                     imageBlockIds: [],
                     captionBlockId: null,
                     referencedByBlockIds: [b.blockId],
                     linkConfidence: 0.5,
                     warnings: [`${num} is referenced in the procedure, but no matching caption was detected.`]
                  };
                  figuresMap.set(num, f);
                  figuresList.push(f);
              } else {
                  const f = figuresMap.get(num)!;
                  if (!f.referencedByBlockIds.includes(b.blockId)) f.referencedByBlockIds.push(b.blockId);
              }
           }
        });
     }

     // Handle Tables
     if (b.type === 'table') {
         let tableInfo = null;
         let pidx = idx - 1;
         while (pidx >= 0 && !procedureBlocks[pidx].text) pidx--;
         
         if (pidx >= 0) {
            tableInfo = extractTableInfo(procedureBlocks[pidx].text);
         }

         const tId = tableInfo?.tableNumber ? `table-${tableInfo.tableNumber.replace(/\s+/g, '-')}` : `anon-table-${anonymousTableCount++}`;
         const finalNum = tableInfo?.tableNumber || null;
         const finalTitle = tableInfo?.titleText || null;
         const finalPlaceholder = tableInfo && finalNum && finalTitle ? `[Insert ${finalNum}: ${finalTitle}]` : (finalNum ? `[Insert ${finalNum}: table title required]` : `[Insert procedure table: table title required]`);

         const tMeta: DocxTableMetadata = {
             tableId: tId,
             tableNumber: finalNum,
             title: finalTitle,
             placeholder: finalPlaceholder,
             tableBlockIds: [b.blockId],
             referencedByBlockIds: [],
             linkConfidence: tableInfo ? 0.9 : 0.4,
             warnings: tableInfo && finalNum && finalTitle ? [] : ["A procedure table was detected, but no table title or purpose was found."]
         };
         
         if (finalNum) {
             if (tablesMap.has(finalNum)) {
                 const existing = tablesMap.get(finalNum)!;
                 if (!existing.title && finalTitle) {
                     existing.title = finalTitle;
                     existing.placeholder = finalPlaceholder;
                 }
                 existing.tableBlockIds.push(b.blockId);
             } else {
                 tablesMap.set(finalNum, tMeta);
                 tablesList.push(tMeta);
             }
         } else {
             tablesList.push(tMeta);
         }
     }

     if (b.tableRefs && b.tableRefs.length > 0) {
        b.tableRefs.forEach(ref => {
           let numMatch = ref.match(/^[Tt]able\s*(\d+|\w+)/i);
           if (numMatch) {
              const num = `Table ${numMatch[1]}`;
              if (!tablesMap.has(num)) {
                  const t: DocxTableMetadata = {
                     tableId: `table-${num.replace(/\s+/g, '-')}`,
                     tableNumber: num,
                     title: null,
                     placeholder: `[Insert ${num}: table title required]`,
                     tableBlockIds: [],
                     referencedByBlockIds: [b.blockId],
                     linkConfidence: 0.5,
                     warnings: [`${num} is referenced in the procedure, but no matching table was detected.`]
                  };
                  tablesMap.set(num, t);
                  tablesList.push(t);
              } else {
                  const t = tablesMap.get(num)!;
                  if (!t.referencedByBlockIds.includes(b.blockId)) t.referencedByBlockIds.push(b.blockId);
              }
           } else if (ref.toLowerCase().includes('table below')) {
               // generic reference, handled generally
           }
        });
     }
  });

  uncaptionedImageBlocks.forEach((blockId) => {
      const anonId = `anon-fig-${anonymousFigureCount++}`;
      const f: DocxFigure = {
          figureId: anonId,
          figureNumber: null,
          caption: null,
          placeholder: `[Insert figure: figure number and caption required]`,
          imageBlockIds: [blockId],
          captionBlockId: null,
          referencedByBlockIds: [],
          linkConfidence: 0.1,
          warnings: ["An image was detected without a figure number or caption. Confirm the correct figure caption."]
      };
      figuresList.push(f);
  });

  figuresList.forEach(f => {
     if (f.referencedByBlockIds.length === 0 && f.captionBlockId && f.figureNumber) {
        f.warnings.push(`${f.figureNumber} caption was detected, but no procedure step reference was found.`);
        f.linkConfidence = Math.min(f.linkConfidence, 0.6);
     }
     if (f.figureNumber && f.imageBlockIds.length > 0) {
        f.warnings.push(`Re-import or verify ${f.figureNumber} in the final Word document.`);
     }
  });

  tablesList.forEach(t => {
     if (t.referencedByBlockIds.length === 0 && t.tableNumber && t.tableBlockIds.length > 0) {
        t.warnings.push(`A procedure table was detected, but no procedure step reference was found.`);
        t.linkConfidence = Math.min(t.linkConfidence, 0.6);
     }
     if (t.tableBlockIds.length > 0) {
         t.warnings.push(`Reinsert or verify the procedure table in the final Word document.`);
     }
  });

  let overall = (sConfidence + pConfidence) / 2;
  const requiresUserConfirmation = overall < 0.85;

  const procedureText = procedureBlocks.map(b => {
     let txt = b.text;
     // Replace image blocks with placeholders if they are part of a figure
     if (b.type === 'table') {
         const t = tablesList.find(tbl => tbl.tableBlockIds.includes(b.blockId));
         if (t) {
             if (t.tableNumber) {
                 txt = t.title ? `[${t.tableNumber} detected: ${t.title}]` : `[${t.tableNumber} detected: table title required]`;
             } else {
                 txt = `[Table detected: table title required]`;
             }
         } else {
             txt = `[Table detected: table title required]`;
         }
     } else if (b.containsImage && b.type === 'image') {
         const f = figuresList.find(fig => fig.imageBlockIds.includes(b.blockId));
         if (f) {
             if (f.figureNumber) {
                 txt = f.caption ? `[${f.figureNumber} detected: ${f.caption}]` : `[${f.figureNumber} detected: caption required]`;
             } else {
                 txt = `[figure detected: figure number and caption required]`;
             }
         } else {
             txt = `[figure detected: figure number and caption required]`;
         }
     }
     return txt;
  }).filter(Boolean).join('\n\n');

  return {
    documentId,
    fileName,
    status: requiresUserConfirmation ? 'needs_confirmation' : 'parsed',
    detectedSummary: {
      text: summaryTextRaw,
      blockIds: summaryBlocks.map(b => b.blockId),
      confidence: sConfidence,
      warnings: summaryWarnings,
      diagnostics: summaryDetectionMethod === 'table-field' ? {
         summaryDetectionMethod,
         summaryStartBlockId,
         summaryStopLabel,
         summaryStopBlockId
      } : undefined
    },
    detectedProcedure: {
      text: procedureText,
      blockIds: procedureBlocks.map(b => b.blockId),
      confidence: pConfidence,
      warnings: procedureWarnings
    },
    detectedMetadata: {
      appliesTo,
      effectiveDate,
      productionStart
    },
    figures: figuresList,
    procedureTables: tablesList,
    documentBlocks: blocks,
    summaryConfidence: sConfidence,
    procedureConfidence: pConfidence,
    overallExtractionConfidence: overall,
    requiresUserConfirmation,
    warnings: [...summaryWarnings, ...procedureWarnings],
    docxExtractionDiagnostics: {
      discardedInvalidFigureReferences: [],
      discardedTechnicalArtifacts: [],
      discardedGenericTerms: [],
      validFigureReferences: figuresList.map(f => f.figureNumber).filter(Boolean) as string[],
      validTableReferences: tablesList.map(t => t.tableNumber).filter(Boolean) as string[],
      procedureContentTables: tablesList.filter(t => t.tableNumber).map(t => t.tableNumber as string),
      ignoredTables: [],
      technicalFactsFromVisibleTextOnly: true
    }
  };
}
