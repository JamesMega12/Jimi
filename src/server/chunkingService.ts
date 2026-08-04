import { KBChunk } from '../types';
import { GoogleGenAI, Type, Schema } from '@google/genai';

function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();
  const lower = text.toLowerCase();
  
  // Exact rule keywords
  if (lower.includes('degc') || lower.includes('°c') || lower.includes('celsius')) keywords.add('degC');
  if (lower.includes('degf') || lower.includes('°f') || lower.includes('fahrenheit')) keywords.add('degF');
  if (lower.includes('degr') || lower.includes('°r') || lower.includes('rankine')) keywords.add('degR');
  
  if (lower.includes('abbreviation') || lower.includes('acronym')) keywords.add('abbreviation');
  if (lower.includes('active voice') || lower.includes('passive voice')) keywords.add('active voice');
  if (lower.includes('warning')) keywords.add('WARNING');
  if (lower.includes('caution')) keywords.add('CAUTION');
  if (lower.includes('note')) keywords.add('Note');
  if (lower.includes('fig.') || lower.includes('figure')) keywords.add('Figure');
  if (lower.includes('table')) keywords.add('Table');
  if (lower.includes('unit symbol') || lower.includes('unit name')) keywords.add('Unit Symbol');
  if (lower.includes('problem')) keywords.add('Problem');
  if (lower.includes('cause')) keywords.add('Cause');
  if (lower.includes('solution')) keywords.add('Solution');
  if (lower.includes('benefit')) keywords.add('Benefit');
  if (lower.includes('capitalization')) keywords.add('capitalization');
  if (lower.includes('spelling')) keywords.add('spelling');
  
  return Array.from(keywords);
}

function determineContentTypeAndCategory(text: string, title?: string, docType?: string, docName?: string): { ruleCategory: KBChunk['ruleCategory'], contentType: Exclude<KBChunk['contentType'], undefined> } {
  const lowerTitle = (title || '').toLowerCase();
  const lowerText = text.toLowerCase();
  const lower = lowerText + ' ' + lowerTitle;
  
  if (docType === 'SLB Communications Handbook' || (docName && docName.includes('SLB'))) {
    if (lowerTitle.includes('chapter 1') || lowerTitle.includes('chapter 2') || lowerTitle.includes('branding') || lowerText.includes('chapter 1') || lowerText.includes('chapter 2')) return { ruleCategory: 'branding', contentType: 'rule-example' };
    if (lowerTitle.includes('chapter 4') || lowerTitle.includes('legal') || lowerText.includes('chapter 4')) return { ruleCategory: 'legal', contentType: 'rule-example' };
    if (lowerTitle.includes('chapter 5') || lowerTitle.includes('style') || lowerText.includes('chapter 5')) return { ruleCategory: 'style', contentType: 'rule-example' };
    if (lowerTitle.includes('chapter 6') || lowerTitle.includes('spelling') || lowerText.includes('chapter 6')) return { ruleCategory: 'spelling', contentType: 'rule-example' };
    if (lowerTitle.includes('chapter 7') || lowerTitle.includes('terminology') || lowerText.includes('chapter 7')) return { ruleCategory: 'terminology', contentType: 'glossary-list' };
    if (lowerTitle.includes('abbreviation') || lowerTitle.includes('acronym') || lowerText.includes('abbreviation')) return { ruleCategory: 'abbreviation', contentType: 'rule-example' };
    if (lowerTitle.includes('unit') || lowerTitle.includes('symbols') || lowerText.includes('unit symbol')) return { ruleCategory: 'units', contentType: 'table-rule' };
  }

  if (lower.includes('unit symbol') || lower.includes('degc')) return { ruleCategory: 'units', contentType: 'table-rule' };
  if (lower.includes('temperature') || lower.includes('celsius') || lower.includes('fahrenheit')) return { ruleCategory: 'temperature', contentType: 'table-rule' };
  if (lower.includes('abbreviation') || lower.includes('acronym')) return { ruleCategory: 'abbreviation', contentType: 'rule-example' };
  if (lower.includes('capitalization')) return { ruleCategory: 'capitalization', contentType: 'rule-example' };
  if (lower.includes('punctuation')) return { ruleCategory: 'punctuation', contentType: 'rule-example' };
  if (lower.includes('caption') || lower.includes('figure')) return { ruleCategory: 'caption', contentType: 'rule-example' };
  if (lower.includes('table title') || lower.includes('tables')) return { ruleCategory: 'table', contentType: 'rule-example' };
  if (lower.includes('problem') && lower.includes('benefit') && lower.includes('cause')) return { ruleCategory: 'template', contentType: 'template-rule' };
  if (lower.includes('warning') || lower.includes('caution')) return { ruleCategory: 'safety', contentType: 'rule-example' };
  if (lower.includes('summary') && lower.includes('limit')) return { ruleCategory: 'summary', contentType: 'template-rule' };
  if (lower.includes('procedure') && lower.includes('step')) return { ruleCategory: 'procedure', contentType: 'template-rule' };
  if (lower.includes('terminology') || lower.includes('glossary')) return { ruleCategory: 'terminology', contentType: 'glossary-list' };
  if (lower.includes('voice') || lower.includes('grammar') || lower.includes('sentence')) return { ruleCategory: 'language', contentType: 'narrative-guidance' };
  
  return { ruleCategory: 'language', contentType: 'narrative-guidance' };
}

export function checkCorruption(text: string): boolean {
  if (!text) return false;
  
  // High symbol/gibberish ratio, non-printable
  let gibberishCount = 0;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Non-printable, non-whitespace
    if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) gibberishCount++;
    if (charCode === 65533) gibberishCount++; // replacement character
  }
  if (gibberishCount / text.length > 0.05) return true;

  // Artifacts
  if (text.includes('[Content_Types].xml')) return true;
  if (/<\/?w:[a-zA-Z0-9]+[^>]*>/.test(text)) return true; // Word XML
  if (text.includes('PK\u0003\u0004')) return true; // ZIP header
  if (/%PDF-\d\.\d/.test(text)) return true; // PDF header
  if (/\/Type\s*\/[a-zA-Z]+/.test(text)) return true; // PDF objects
  if (/stream[\s\S]*endstream/.test(text)) return true; // PDF stream
  if (/(?:\/[a-zA-Z0-9]+ \d+ \d+ R)/.test(text)) return true; // PDF ref
  if (text.includes('xmlns:w="http://schemas.openxmlformats.org')) return true;

  return false;
}

function wordCount(str: string): number {
  return str.split(/\s+/).filter(Boolean).length;
}

export async function chunkExtractedText(
  text: string,
  docId: string,
  docName: string,
  docType: string,
  version: string
): Promise<Omit<KBChunk, 'embedding'>[]> {
  let chunks: Omit<KBChunk, 'embedding'>[] = [];
  let chunkIndex = 0;
  const uploadDate = new Date().toISOString();

  function processChunk(content: string, title: string) {
       const cleanContent = content.trim();
       if (!cleanContent) return;
       const wc = wordCount(cleanContent);
       if (wc < 5) return; // avoid empty noise chunks
       
       const meta = determineContentTypeAndCategory(cleanContent, title, docType, docName);
       const kw = extractKeywords(cleanContent);
       
       let sectionPriority: 'high' | 'medium' | 'low' = 'medium';
       let priorityScore = 1;

       if (docType === 'SLB Communications Handbook' || docName.includes('SLB')) {
         sectionPriority = 'high';
         priorityScore = 3;
       }
       
       chunks.push({
          id: `${docId}-chunk-${chunkIndex++}`,
          documentId: docId,
          documentName: docName,
          documentType: docType,
          version: version,
          sourceType: 'uploaded_document',
          isSeedData: false,
          sectionPriority,
          priorityScore,
          sectionTitle: title,
          ruleCategory: meta.ruleCategory,
          contentType: meta.contentType,
          chunkIndex: chunkIndex - 1,
          text: cleanContent,
          wordCount: wc,
          charCount: cleanContent.length,
          keywords: kw,
          containsExactRules: kw.length > 0,
          uploadedAt: uploadDate
       });
  }

  // ==== DOC-SPECIFIC ROUTING ====
  if (docType === 'STE Guide' || docName.includes('STE_QRG')) {
      console.log("Processing STE Guide with LLM structured extraction...");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are a style rule extractor. Convert this STE Quick Reference Guide into structured rules grouped by category.
      Create exactly one chunk for each of the following categories if found in the text: Words, Noun clusters, Verbs, Sentences, Procedures, Descriptive writing, Safety instructions, Punctuation, Writing practices.
      Target 8-12 chunks total.
      For each category, extract the specific rules. Ensure you do not merge sections.
      
      STE Document Text:
      """
      ${text.slice(0, 30000)} // truncate to prevent token issues, though standard is fine
      """`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  rules: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        ruleText: { type: Type.STRING },
                        instruction: { type: Type.STRING },
                        badExample: { type: Type.STRING },
                        goodExample: { type: Type.STRING },
                        isProcedureCritical: { type: Type.BOOLEAN },
                        isSafetyCritical: { type: Type.BOOLEAN }
                      },
                      required: ["ruleText", "instruction", "badExample", "goodExample"]
                    }
                  }
                },
                required: ["category", "rules"]
              }
            }
          }
        });

        const parsedCategories = JSON.parse(response.text || "[]");
        
        parsedCategories.forEach((cat: any) => {
          cat.rules.forEach((r: any) => r.category = cat.category);
          const ruleTexts = cat.rules.map((r: any) => `Rule: ${r.ruleText}\nInstruction: ${r.instruction}\nBad: ${r.badExample}\nGood: ${r.goodExample}`).join("\n\n");
          
          let keywords = ["imperative", "active voice", "short sentence"];
          if (cat.category.toLowerCase().includes("verb")) keywords.push("verbs", "action");
          if (cat.category.toLowerCase().includes("sentence")) keywords.push("grammar", "sentence");
          if (cat.category.toLowerCase().includes("procedure")) keywords.push("procedure", "step");
          if (cat.category.toLowerCase().includes("safety")) keywords.push("safety", "warning");

          chunks.push({
            id: `${docId}-chunk-${chunkIndex++}`,
            documentId: docId,
            documentName: docName,
            documentType: docType,
            version: version,
            sourceType: 'uploaded_document',
            isSeedData: false,
            sectionPriority: 'high',
            priorityScore: 3,
            sectionTitle: cat.category,
            ruleCategory: 'style',
            contentType: 'rule-example',
            chunkIndex: chunkIndex - 1,
            text: ruleTexts,
            structuredRules: cat.rules,
            wordCount: wordCount(ruleTexts),
            charCount: ruleTexts.length,
            keywords: keywords,
            containsExactRules: true,
            uploadedAt: uploadDate
          });
        });
        console.log("FINAL STE chunks via LLM:", chunks.length);
        return chunks;
      } catch (e) {
        console.error("STE LLM Extraction failed, falling back to heuristic", e);
      }
      
      // Fallback
      processChunk(text.slice(0, 3000), 'General Guidelines');
      return chunks;
  }

  if (docType === 'technical_standard' || docType === 'TechCom Standard' || docName.toLowerCase().includes('techcom')) {
      console.log("Processing TechCom Standard with LLM structured extraction...");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are a Technical Communications standards specialist extracting rules from this TechCom standard document.
      Transform this document into rules for procedure structure authority and validation.
      DO NOT treat this as just text. Isolate the structure, task organization, sequencing, clarity, and completeness requirements.
      Create 25-40 logical chunks by section (e.g., Procedure writing guidelines, Document structure rules, Communication clarity standards, etc.).
      
      Document Text:
      """
      ${text.slice(0, 50000)}
      """`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sectionTitle: { type: Type.STRING },
                  category: { type: Type.STRING, description: "procedure_structure, writing_guidelines, or validation" },
                  isProcedureCritical: { type: Type.BOOLEAN },
                  rules: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        ruleText: { type: Type.STRING },
                        instruction: { type: Type.STRING }
                      },
                      required: ["ruleText", "instruction"]
                    }
                  }
                },
                required: ["sectionTitle", "category", "isProcedureCritical", "rules"]
              }
            }
          }
        });

        const parsedCategories = JSON.parse(response.text || "[]");
        
        parsedCategories.forEach((cat: any) => {
          const ruleTexts = cat.rules.map((r: any) => `Rule: ${r.ruleText}\nInstruction: ${r.instruction}`).join("\n\n");
          
          let keywords = ["procedure", "steps", "task", "sequence"];
          if (cat.category.includes("structure")) keywords.push("structure", "organization");
          if (cat.category.includes("validat")) keywords.push("validation", "check");

          chunks.push({
            id: `${docId}-chunk-${chunkIndex++}`,
            documentId: docId,
            documentName: docName,
            documentType: "technical_standard", // override to match prompt req
            standardType: "TechCom",
            version: version,
            sourceType: 'uploaded_document',
            isSeedData: false,
            sectionPriority: 'high',
            priorityScore: 5, // very high so it acts as an authority
            sectionTitle: cat.sectionTitle,
            ruleCategory: cat.category,
            contentType: 'rule-example',
            chunkIndex: chunkIndex - 1,
            text: ruleTexts,
            structuredRules: cat.rules.map((r: any) => ({ ...r, category: cat.category, isProcedureCritical: cat.isProcedureCritical })),
            wordCount: wordCount(ruleTexts),
            charCount: ruleTexts.length,
            keywords: keywords,
            containsExactRules: true,
            uploadedAt: uploadDate
          });
        });
        console.log("FINAL TechCom chunks via LLM:", chunks.length);
        return chunks;
      } catch (e) {
        console.error("TechCom LLM Extraction failed, falling back to heuristic", e);
      }
  }

  if (docType === 'SWI / Procedure Reference' || docName.includes('SWI') || docName.includes('Well Construction')) {
      const isHeader = (l: string) => {
         const trim = l.trim();
         return (/^[0-9]+\.[\s]+[A-Z]/.test(trim) || /^[0-9]+\.[0-9]+[\s]+[A-Z]/.test(trim) || /^Glossary$/.test(trim) || /^List of Acronyms$/.test(trim) || /^Table of Contents$/.test(trim)) && trim.length < 80;
      };
      const limit = docName.includes('SWI') ? 100 : (docType === 'TechCom Standard' || docName.includes('Well Construction')) ? 200 : 150;
      let currentSec = 'General';
      let currentRaw: string[] = [];
      let currentWords = 0;
      for (const line of text.split('\n')) {
         const lwords = wordCount(line);
         const overflow = docName.includes('SWI') ? 10 : 50;
         if (isHeader(line) || (currentWords + lwords > limit && (line.trim() === '' || currentWords + lwords > limit + overflow))) {
              if (currentRaw.length > 0) {
                 processChunk(currentRaw.join('\n'), currentSec);
                 currentRaw = [];
                 currentWords = 0;
              }
              if (isHeader(line)) currentSec = line.trim();
         }
         currentRaw.push(line);
         currentWords += lwords;
      }
      if (currentRaw.length > 0) processChunk(currentRaw.join('\n'), currentSec);
      
      if (chunks.length === 0) processChunk(text, 'General');
      return chunks;
  }

  // Default heuristic (SLB Handbook, etc)
  const lines = text.split('\n');
  const sections: { title: string; text: string }[] = [];
  
  let currentSectionTitle = 'General Guidelines';
  let currentSectionRaw: string[] = [];
  
  for (const line of lines) {
    if (line.match(/^(?:==+|--+|###?|##?|#)\s+(.*)/)) {
      if (currentSectionRaw.length > 0) {
        sections.push({ title: currentSectionTitle, text: currentSectionRaw.join('\n') });
        currentSectionRaw = [];
      }
      currentSectionTitle = line.replace(/^(?:==+|--+|###?|##?|#)\s+/, '').trim();
    } else {
      currentSectionRaw.push(line);
    }
  }
  
  if (currentSectionRaw.length > 0) {
    sections.push({ title: currentSectionTitle, text: currentSectionRaw.join('\n') });
  }

  sections.forEach(section => {
    const isUnitTable = section.title.toLowerCase().includes('unit symbols') || section.text.toLowerCase().includes('unit symbol') && section.text.toLowerCase().includes('unit name');
    
    if (isUnitTable) {
       const tableLines = section.text.split('\n').filter(l => l.trim().length > 0);
       let currentChunkLines: string[] = [];
       const headerIndex = tableLines.findIndex(l => l.toLowerCase().includes('unit symbol'));
       const header = headerIndex >= 0 ? tableLines[headerIndex] : 'Unit Symbol | Unit Name | Comment';
       
       for (let i = headerIndex >= 0 ? headerIndex + 1 : 0; i < tableLines.length; i++) {
           currentChunkLines.push(tableLines[i]);
           if (currentChunkLines.length >= 30 || i === tableLines.length - 1) {
               const chunkContent = `Document: ${docName}\nSection: ${section.title}\nTable columns: ${header}\n\n` + currentChunkLines.join('\n');
               processChunk(chunkContent, section.title);
               currentChunkLines = [];
           }
       }
    } else {
         const paragraphs = section.text.split(/\n\s*\n+/);
         let currentText = '';
         const maxWords = 400;
         
         for (const p of paragraphs) {
             const pClean = p.trim();
             if (!pClean) continue;
             
             if (wordCount(pClean) > maxWords) {
                 const pLines = pClean.split('\n');
                 for (const l of pLines) {
                     const lClean = l.trim();
                     if (!lClean) continue;
                     
                     if (wordCount(currentText) + wordCount(lClean) > maxWords) {
                         if (currentText) {
                             processChunk(currentText, section.title);
                             currentText = '';
                         }
                         if (wordCount(lClean) > maxWords) {
                             const words = lClean.split(/\s+/);
                             let tempW = [];
                             for (const w of words) {
                                 tempW.push(w);
                                 if (tempW.length >= maxWords) {
                                     processChunk(tempW.join(' '), section.title);
                                     tempW = [];
                                 }
                             }
                             currentText = tempW.join(' ');
                         } else {
                             currentText = lClean;
                         }
                     } else {
                         currentText = currentText ? currentText + '\n' + lClean : lClean;
                     }
                 }
             } else {
                 const nextText = currentText ? currentText + '\n\n' + pClean : pClean;
                 if (wordCount(nextText) > maxWords) {
                     if (currentText) {
                         processChunk(currentText, section.title);
                     }
                     currentText = pClean;
                 } else {
                     currentText = nextText;
                 }
             }
         }
         
         if (currentText.trim()) {
             processChunk(currentText.trim(), section.title);
         }
     }
  });

  if (chunks.length === 0) {
      processChunk(text.slice(0, 3000), 'General Guidelines');
  }

  return chunks;
}
