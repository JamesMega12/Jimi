import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import * as pdfParse from 'pdf-parse';

/**
 * Extracts plain text from TXT, MD, PDF or DOCX files.
 */
export async function extractTextFromFile(filePath: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found on server at: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  
  if (ext === '.txt' || ext === '.md' || ext === '.json') {
    return cleanRawExtractedText(buffer.toString('utf-8'));
  } else if (ext === '.pdf') {
    try {
      const p = new pdfParse.PDFParse({ data: buffer });
      const extractedText = await p.getText();
      if (extractedText && extractedText.text) {
        return cleanRawExtractedText(extractedText.text);
      }
    } catch (err: any) {
      console.warn("pdf-parse failed:", err);
    }
    return cleanRawExtractedText(buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' '));
  } else if (ext === '.docx') {
    try {
      const zip = new AdmZip(buffer);
      const documentXml = zip.getEntry('word/document.xml');
      if (documentXml) {
        const xmlContent = documentXml.getData().toString('utf-8');
        const matches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        let text = '';
        matches.forEach(m => {
          const inner = m.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
          if (inner && inner[1]) {
            text += inner[1] + ' ';
          }
        });
        if (text.trim().length > 0) {
          return cleanRawExtractedText(text);
        }
      }
    } catch (err: any) {
      console.warn("adm-zip word/document.xml extraction failed:", err);
    }
    return cleanRawExtractedText(buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' '));
  } else {
    // Treat as simple string
    return cleanRawExtractedText(buffer.toString('utf-8'));
  }
}

function cleanRawExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}
