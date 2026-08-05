import fs from 'fs';
import path from 'path';
import { KBDocument, KBChunk } from '../types';

// JIMI_KB_DATA_DIR lets tests (and, in principle, an alternate deployment
// target) point the whole-file JSON store at a scratch directory instead of
// the real committed one under src/server/data/.
const DATA_DIR = process.env.JIMI_KB_DATA_DIR
  ? path.resolve(process.env.JIMI_KB_DATA_DIR)
  : path.join(process.cwd(), 'src', 'server', 'data');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'kb_documents.json');
const CHUNKS_FILE = path.join(DATA_DIR, 'kb_chunks.json');

// Ensure data directory and files exist
const SETTINGS_FILE = path.join(DATA_DIR, 'kb_settings.json');

export interface KBSettings {
  retrievalMode: 'uploaded_only' | 'demo_allowed' | 'mixed_debug';
}

function initStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DOCUMENTS_FILE)) {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(CHUNKS_FILE)) {
    fs.writeFileSync(CHUNKS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ retrievalMode: 'demo_allowed' }, null, 2), 'utf-8');
  }
}

export function getSettings(): KBSettings {
  initStorage();
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(raw) as KBSettings;
  } catch (err) {
    return { retrievalMode: 'demo_allowed' };
  }
}

export function updateSettings(settings: Partial<KBSettings>): KBSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

/**
 * Documents exactly as stored, with no field remapping. `getDocuments()`
 * below rewrites `status` into a *different* enum for the legacy
 * SourceTruthAdminPage UI ('indexed_clean' | 'indexed_warning' | 'failed' |
 * 'processing', derived from chunk/corruption counts) -- fine for that UI,
 * wrong for anything that wrote its own `status` value and needs to read it
 * back unchanged (systemKnowledgeService.ts's 'indexed' | 'failed' |
 * 'disabled' | 'indexing', and retrievalService.ts's provenance summary).
 * Comparing `doc.status === 'indexed'` against a `getDocuments()` result is
 * a silent bug -- that field has already been overwritten to 'indexed_clean'
 * by the time you see it. Use this instead for any raw-status read.
 */
export function getDocumentsRaw(): KBDocument[] {
  initStorage();
  try {
    const raw = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
    return raw.trim() ? (JSON.parse(raw) as KBDocument[]) : [];
  } catch (err) {
    console.error('Error reading documents database:', err);
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
}

export function getDocuments(): KBDocument[] {
  initStorage();
  try {
    const raw = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
    const docs = raw.trim() ? JSON.parse(raw) as KBDocument[] : [];

    // Map existing fields to expected new unified format for frontend
    return docs.map(doc => {
      let derivedStatus: 'indexed_clean' | 'indexed_warning' | 'failed' | 'processing' = 'indexed_clean';
      
      const chunkCount = doc.chunkCount || 0;
      const corruptChunkCount = doc.corruptedChunkCount || doc.corruptChunkCount || 0;
      const emptyChunkCount = doc.emptyChunkCount || 0;
      const isProcessing = doc.status === 'indexing' || doc.status === 'processing';
      
      if (isProcessing) {
        derivedStatus = 'processing';
      } else if (chunkCount === 0 || corruptChunkCount > 5 || doc.status === 'failed') { // failed or heavily corrupted
        derivedStatus = 'failed';
      } else if (corruptChunkCount > 0 || emptyChunkCount > 0 || doc.underChunkedWarning || doc.overChunkedWarning || doc.chunkingStatus === 'under-chunked' || doc.chunkingStatus === 'over-chunked' || doc.readabilityStatus === 'warning') {
        derivedStatus = 'indexed_warning';
      } else {
        derivedStatus = 'indexed_clean';
      }

      return {
        ...doc,
        status: derivedStatus,
        avgChunkWords: doc.averageChunkWordCount || doc.avgChunkWords || 0,
        maxChunkWords: doc.maxChunkWordCount || doc.maxChunkWords || 0,
        emptyChunkCount: emptyChunkCount,
        corruptChunkCount: corruptChunkCount,
        sourceType: doc.sourceType || (doc.isSeedData ? 'seed_data' : 'uploaded_document')
      };
    });
  } catch (err) {
    console.error('Error reading documents database:', err);
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
}
const SEED_DOCUMENTS: KBDocument[] = [
  {
    id: 'seal-fco-template',
    name: 'FCO Template Standard Guide',
    type: 'FCO Template',
    version: '1.0.0',
    uploadedAt: new Date().toISOString(),
    status: 'indexed',
    chunkCount: 2,
    isSeedData: true
  },
  {
    id: 'seal-slb-comm',
    name: 'SLB Communications Handbook',
    type: 'Communications Handbook',
    version: '3.2.1',
    uploadedAt: new Date().toISOString(),
    status: 'indexed',
    chunkCount: 3,
    isSeedData: true
  },
  {
    id: 'seal-ste-guide',
    name: 'Simplified Technical English (STE) Guide',
    type: 'STE Guide',
    version: 'ASD-STE100',
    uploadedAt: new Date().toISOString(),
    status: 'indexed',
    chunkCount: 3,
    isSeedData: true
  },
  {
    id: 'seal-techcom-std',
    name: 'TechCom Safety and Writing Standards',
    type: 'TechCom Standard',
    version: '10.4.0',
    uploadedAt: new Date().toISOString(),
    status: 'indexed',
    chunkCount: 2,
    isSeedData: true
  }
];

const SEED_CHUNKS: KBChunk[] = [
  // FCO Template chunks
  {
    id: 'chunk-template-1',
    documentId: 'seal-fco-template',
    documentName: 'FCO Template Standard Guide',
    documentType: 'FCO Template',
    ruleCategory: 'template',
    sectionTitle: 'FCO Summary Section Requirements',
    chunkIndex: 0,
    text: 'Each Field Change Order (FCO) draft must begin with a structured FCO Summary. The FCO Summary is subject to a strict 150-word total count limitation and must enforce the four standardized labels: problem, cause, solution, and benefit. No long-form storytelling or 设计 details are allowed inside the Summary. All text under these labels must directly address operator outcomes.',
    version: '1.0.0',
    uploadedAt: new Date().toISOString()
  },
  {
    id: 'chunk-template-2',
    documentId: 'seal-fco-template',
    documentName: 'FCO Template Standard Guide',
    documentType: 'FCO Template',
    ruleCategory: 'template',
    sectionTitle: 'FCO Procedure Section Requirements',
    chunkIndex: 1,
    text: 'A structured FCO Procedure must follow the FCO Summary. The procedure must be cataloged into distinct chronological subheadings according to the chosen FCO change type. Hardware changes require exactly five sections and a Tools/Materials Block. Software changes require exactly six sections. Process changes require exactly five sections. Single bullet-lists or merged lists are strictly disallowed.',
    version: '1.0.0',
    uploadedAt: new Date().toISOString()
  },
  // SLB Communications Handbook chunks
  {
    id: 'chunk-comm-1',
    documentId: 'seal-slb-comm',
    documentName: 'SLB Communications Handbook',
    documentType: 'SLB Communications Handbook',
    ruleCategory: 'language',
    sectionTitle: 'American English and Abbreviations',
    chunkIndex: 0,
    text: 'All engineering documentation and field-facing communications must be written in standard American English. Any abbreviations, technical initials, or product codes must be fully defined upon their first mention. For example: always write "Lockout/Tagout (LOTO)" or "High Pressure (HP)" or "Standard Work Instruction (SWI)" before utilizing the short-hand labels.',
    version: '3.2.1',
    uploadedAt: new Date().toISOString()
  },
  {
    id: 'chunk-comm-2',
    documentId: 'seal-slb-comm',
    documentName: 'SLB Communications Handbook',
    documentType: 'SLB Communications Handbook',
    ruleCategory: 'language',
    sectionTitle: 'Active Voice in Technical Drafts',
    chunkIndex: 1,
    text: 'Always write in the active voice when describing procedures, adjustments, inspections, or completions. Passive statements such as "the bolt should be tightened" or "it is recommended that the key is turned" are confusing to operators. Replace them with direct active commands: "Tighten the bolt" or "Turn the key". Active voice increases comprehension speed and reduces errors.',
    version: '3.2.1',
    uploadedAt: new Date().toISOString()
  },
  {
    id: 'chunk-comm-3',
    documentId: 'seal-slb-comm',
    documentName: 'SLB Communications Handbook',
    documentType: 'SLB Communications Handbook',
    ruleCategory: 'terminology',
    sectionTitle: 'Consistent Technical Names',
    chunkIndex: 2,
    text: 'Maintain strict consistency across names of machine sub-assemblies, tool sizes, parts, or interfaces. Never use colloquial terms like "the red hose" or "that metal flap". Instead, reference the official technical names exactly: "HP hydraulic bypass hose" or "isolation access panel". Conflicting or ambiguous terminology inside standard guidelines leads to severe execution failures.',
    version: '3.2.1',
    uploadedAt: new Date().toISOString()
  },
  // STE Guide chunks
  {
    id: 'chunk-ste-1',
    documentId: 'seal-ste-guide',
    documentName: 'Simplified Technical English (STE) Guide',
    documentType: 'STE / Language Guide',
    ruleCategory: 'language',
    sectionTitle: 'Short and Clear Sentences',
    chunkIndex: 0,
    text: 'Limit sentence length to 15-20 words for procedural steps and 20-25 words for descriptive paragraphs. Convey only one main idea per sentence. Avoid compound phrases joined by excessive conjunctions. Keeping sentences short increases readability scores and ensures international teams can execute the procedure without translation errors.',
    version: 'ASD-STE100',
    uploadedAt: new Date().toISOString()
  },
  {
    id: 'chunk-ste-2',
    documentId: 'seal-ste-guide',
    documentName: 'Simplified Technical English (STE) Guide',
    documentType: 'STE / Language Guide',
    ruleCategory: 'language',
    sectionTitle: 'Imperative Verbs in Steps',
    chunkIndex: 1,
    text: 'Start every instruction step with a strong imperative verb. Imperative commands tell the operator exactly what motion to perform. Approved imperative verbs include: Isolate, Verify, Clean, Check, Remove, Connect, Loosen, Tighten, Record, and Submit. Avoid conditional auxiliary verbs like "should", "could", "may", or "ought to".',
    version: 'ASD-STE100',
    uploadedAt: new Date().toISOString()
  },
  {
    id: 'chunk-ste-3',
    documentId: 'seal-ste-guide',
    documentName: 'Simplified Technical English (STE) Guide',
    documentType: 'STE / Language Guide',
    ruleCategory: 'language',
    sectionTitle: 'Avoiding Ambiguous Wording',
    chunkIndex: 2,
    text: 'Never use loose, qualitative qualitative modifiers such as "as required", "if necessary", "where applicable", "suitable", "properly", "efficiently", or "proper". If a step depends on conditional factors, state the exact trigger and action: "If pressure exceeds 50 psi, open the release valve." Ambient qualitative instructions are unauditable and cause safety hazards.',
    version: 'ASD-STE100',
    uploadedAt: new Date().toISOString()
  },
  // TechCom Standards chunks
  {
    id: 'chunk-techcom-1',
    documentId: 'seal-techcom-std',
    documentName: 'TechCom Safety and Writing Standards',
    documentType: 'TechCom Standard',
    ruleCategory: 'safety',
    sectionTitle: 'Warning, Caution, and Note Definitions',
    chunkIndex: 0,
    text: 'TechCom guidelines define strict thresholds for safety tags. Utilize NOTE for optional, helpful, and non-safety operational details. Use CAUTION to warn against equipment damage, quality degradation, or moderate risks. Use WARNING exclusively for hazards involving severe injury, safety violations, or fatalities. Place the caution or warning block before the affected steps, not after.',
    version: '10.4.0',
    uploadedAt: new Date().toISOString()
  },
  {
    id: 'chunk-techcom-2',
    documentId: 'seal-techcom-std',
    documentName: 'TechCom Safety and Writing Standards',
    documentType: 'TechCom Standard',
    ruleCategory: 'formatting',
    sectionTitle: 'Unit Formatting and Spacing Rules',
    chunkIndex: 1,
    text: 'Format numbers and physical units consistently. Always place a single space between the number and its unit: e.g., "120 ft-lbs" or "20 psi" or "24 mm" or "15 minutes". Do not chain or merge them like "120ft-lbs" or "24mm". Numbers from one to nine must be spelled out as words: "four bolts", "nine panels", unless they are physical measurements or technical values.',
    version: '10.4.0',
    uploadedAt: new Date().toISOString()
  }
];

export function loadSeedData(): KBDocument[] {
  initStorage();
  const docs = getDocuments();
  const chunks = getChunks();
  
  // Filter out existing seed data if any
  const filteredDocs = docs.filter(d => !d.isSeedData);
  const filteredChunks = chunks.filter(c => !c.documentId.startsWith('seal-'));

  const newDocs = [...filteredDocs, ...SEED_DOCUMENTS];
  
  const newSeededChunks = SEED_CHUNKS.map(chunk => ({
    ...chunk,
    embedding: generateLocalHeuristicEmbedding(chunk.text)
  }));
  
  const newChunks = [...filteredChunks, ...newSeededChunks];
  
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(newDocs, null, 2), 'utf-8');
  fs.writeFileSync(CHUNKS_FILE, JSON.stringify(newChunks, null, 2), 'utf-8');
  
  return newDocs;
}

export function clearSeedData(): KBDocument[] {
  initStorage();
  const docs = getDocuments();
  const chunks = getChunks();
  
  const filteredDocs = docs.filter(d => !d.isSeedData);
  const filteredChunks = chunks.filter(c => !c.documentId.startsWith('seal-'));
  
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(filteredDocs, null, 2), 'utf-8');
  fs.writeFileSync(CHUNKS_FILE, JSON.stringify(filteredChunks, null, 2), 'utf-8');
  
  return filteredDocs;
}

export function saveDocument(doc: KBDocument): void {
  initStorage();
  let docs: KBDocument[] = [];
  try {
    const raw = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
    docs = raw.trim() ? JSON.parse(raw) : [];
  } catch(e) {}
  const index = docs.findIndex(d => d.id === doc.id);
  if (index !== -1) {
    docs[index] = doc;
  } else {
    docs.push(doc);
  }
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(docs, null, 2), 'utf-8');
}

export function deleteDocument(id: string): { deletedDocumentId: string, deletedChunkCount: number } {
  initStorage();
  let docs: KBDocument[] = [];
  try {
    const raw = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
    docs = raw.trim() ? JSON.parse(raw) : [];
  } catch(e) {}
  const filteredDocs = docs.filter(d => d.id !== id);
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(filteredDocs, null, 2), 'utf-8');

  // Also remove corresponding chunks
  let deletedChunkCount = 0;
  try {
    const raw = fs.readFileSync(CHUNKS_FILE, 'utf-8');
    const allChunks = JSON.parse(raw) as KBChunk[];
    const filteredChunks = allChunks.filter(c => c.documentId !== id);
    deletedChunkCount = allChunks.length - filteredChunks.length;
    fs.writeFileSync(CHUNKS_FILE, JSON.stringify(filteredChunks, null, 2), 'utf-8');
  } catch (err) {
    console.warn("Could not prune chunks during delete:", err);
  }
  
  return { deletedDocumentId: id, deletedChunkCount };
}

export function getChunks(): KBChunk[] {
  initStorage();
  try {
    const raw = fs.readFileSync(CHUNKS_FILE, 'utf-8');
    const chunks = raw.trim() ? JSON.parse(raw) as KBChunk[] : [];
    const docs = getDocuments();
    return chunks.map(c => {
       const doc = docs.find(d => d.id === c.documentId);
       return {
          ...c,
          isSeedData: doc?.isSeedData || c.documentId.startsWith('seal-') || false
       };
    });
  } catch (err) {
    console.error('Error reading chunks database:', err);
    // Reset the corrupted chunks file
    fs.writeFileSync(CHUNKS_FILE, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
}

export function replaceDocumentChunks(documentId: string, newChunks: KBChunk[]): void {
  initStorage();
  const existingChunks = getChunks();
  const filteredExisting = existingChunks.filter(c => c.documentId !== documentId);
  const merged = [...filteredExisting, ...newChunks];
  fs.writeFileSync(CHUNKS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

export function saveChunks(newChunks: KBChunk[]): void {
  initStorage();
  const existingChunks = getChunks();
  
  // Exclude any chunks from the same document ID to prevent dual-indexing duplicates
  const docIdsToExclude = Array.from(new Set(newChunks.map(c => c.documentId)));
  const filteredExisting = existingChunks.filter(c => !docIdsToExclude.includes(c.documentId));
  
  const merged = [...filteredExisting, ...newChunks];
  fs.writeFileSync(CHUNKS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * Local fallback embedding dimension. Fixed and exported so every caller
 * that needs to know the shape of a local-heuristic vector (retrieval's
 * dimension-mismatch check, embeddingService's backend descriptor) agrees
 * with what this function actually produces.
 */
export const LOCAL_EMBEDDING_DIMENSIONS = 256;

/**
 * Deterministic hashed bag-of-words embedding. Used when a Gemini API key is
 * unavailable (or, previously, silently on any embedding error -- that
 * silent-on-error behavior has been removed from embeddingService.ts;
 * this function is now reached only for the "no key configured" case,
 * which is intentional graceful degradation, not a bug).
 *
 * This replaces an earlier version keyed to a hardcoded 41-word vocabulary:
 * any chunk whose text didn't contain one of those 41 words produced an
 * all-zero vector, and cosine similarity against an all-zero vector is
 * always 0 -- silently unretrievable. Hashing every token into a fixed-size
 * bucket removes the vocabulary ceiling entirely: every word, including a
 * synthetic canary token like "approx-QX7" or a real technical term with no
 * synonym on this project's radar, contributes to the vector.
 */
export function generateLocalHeuristicEmbedding(
  text: string,
  dimensions: number = LOCAL_EMBEDDING_DIMENSIONS,
): number[] {
  const tokens = text.toLowerCase().match(/[a-z0-9]{2,}/g) || [];
  const freqs = new Array(dimensions).fill(0);

  tokens.forEach((token) => {
    // FNV-1a: cheap, deterministic, no external dependency, good enough
    // bucket-distribution for a bag-of-words fallback (not a real embedding
    // model -- see the module doc comment in embeddingService.ts).
    let hash = 0x811c9dc5;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const bucket = Math.abs(hash) % dimensions;
    freqs[bucket]++;
  });

  const mag = Math.sqrt(freqs.reduce((sum, val) => sum + val * val, 0));
  if (mag === 0) {
    return freqs;
  }
  return freqs.map((f) => f / mag);
}
