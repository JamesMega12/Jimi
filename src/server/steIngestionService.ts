import { KBDocument, KBChunk } from '../types';
import { extractTextFromFile } from './textExtractionService';
import { chunkExtractedText, checkCorruption } from './chunkingService';
import { saveDocument, saveChunks, getDocuments, getChunks, replaceDocumentChunks } from './knowledgeBaseService';

export interface IngestionDiagnostics {
  success: boolean;
  documentId: string;
  extractedWordCount: number;
  chunkCount: number;
  elapsedTimeMs: number;
  error?: string;
}

export async function ingestSteDocument(
  filePath: string,
  originalName: string,
  docType: KBDocument['type'],
  version: string
): Promise<IngestionDiagnostics> {
  const startTime = Date.now();
  const documentId = 'doc-' + Math.random().toString(36).substring(2, 9);
  
  const docMeta: KBDocument = {
    id: documentId,
    name: originalName,
    type: docType,
    version: version || '1.0.0',
    uploadedAt: new Date().toISOString(),
    status: 'indexing',
    chunkCount: 0,
    isSeedData: false
  };

  saveDocument(docMeta);

  try {
    const extractedText = await extractTextFromFile(filePath, originalName);
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
    if (!extractedText.trim()) throw new Error("Text extraction returned completely empty document.");

    const chunksWithoutEmbed = await chunkExtractedText(
      extractedText,
      documentId,
      originalName,
      docType,
      docMeta.version
    );

    if (chunksWithoutEmbed.length === 0) throw new Error("Document chunker returned zero text blocks.");

    const chunksWithEmptyEmbed = chunksWithoutEmbed.map(c => ({ ...c, embedding: [] }));
    
    saveChunks(chunksWithEmptyEmbed as KBChunk[]);
    
    docMeta.status = 'indexed';
    docMeta.chunkCount = chunksWithEmptyEmbed.length;
    docMeta.indexedAt = new Date().toISOString();
    docMeta.enabledForRetrieval = true;
    saveDocument(docMeta);

    return {
      success: true,
      documentId,
      extractedWordCount: wordCount,
      chunkCount: chunksWithEmptyEmbed.length,
      elapsedTimeMs: Date.now() - startTime
    };
  } catch (err: any) {
    console.error(`Failed to ingest STE document:`, err);
    docMeta.status = 'failed';
    docMeta.errorMessage = err.message || String(err);
    saveDocument(docMeta);
    return {
      success: false,
      documentId,
      extractedWordCount: 0,
      chunkCount: 0,
      elapsedTimeMs: Date.now() - startTime,
      error: err.message || String(err)
    };
  }
}

export async function reindexSteDocument(id: string): Promise<void> {
    const docs = getDocuments();
    const doc = docs.find(d => d.id === id);
    if (!doc) throw new Error('Document not found.');

    doc.status = 'indexing';
    saveDocument(doc);
    
    try {
        const sourcePath = require('path').join(process.cwd(), 'src', 'server', 'data', 'uploads', 'ste_source.pdf');
        if (!require('fs').existsSync(sourcePath)) throw new Error('Source file not found.');
        
        const extractedText = await extractTextFromFile(sourcePath, doc.name);
        if (!extractedText.trim()) throw new Error("Text extraction returned completely empty document.");
        
        const chunksWithoutEmbed = await chunkExtractedText(extractedText, id, doc.name, doc.type as string, doc.version);
        const chunksWithEmptyEmbed = chunksWithoutEmbed.map(c => ({ ...c, embedding: [] }));
        
        replaceDocumentChunks(id, chunksWithEmptyEmbed as KBChunk[]);
        
        doc.status = 'indexed';
        doc.chunkCount = chunksWithEmptyEmbed.length;
        doc.indexedAt = new Date().toISOString();
        doc.errorMessage = undefined;
        saveDocument(doc);
    } catch (err: any) {
        doc.status = 'failed';
        doc.errorMessage = err.message || String(err);
        saveDocument(doc);
        throw err;
    }
}