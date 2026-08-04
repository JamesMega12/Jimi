import { KBDocument, KBChunk } from '../types';
import { extractTextFromFile } from './textExtractionService';
import { chunkExtractedText, checkCorruption } from './chunkingService';
import { generateTextEmbedding } from './embeddingService';
import { saveDocument, saveChunks } from './knowledgeBaseService';

export interface IngestionDiagnostics {
  success: boolean;
  documentId: string;
  extractedWordCount: number;
  chunkCount: number;
  elapsedTimeMs: number;
  error?: string;
  corruptedChunkCount?: number;
  discardedCorruptedChunkCount?: number;
  readabilityStatus?: 'clean' | 'warning' | 'failed';
}

/**
 * Orchestrates the full ingestion flow for an uploaded source-truth document.
 */
export async function ingestDocument(
  filePath: string,
  originalName: string,
  docType: KBDocument['type'],
  version: string
): Promise<IngestionDiagnostics> {
  const startTime = Date.now();
  const documentId = 'doc-' + Math.random().toString(36).substring(2, 9);
  
  // Create metadata record
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

  // Immediate save to status "indexing"
  saveDocument(docMeta);

  try {
    // 1. Extract Text
    const extractedText = await extractTextFromFile(filePath, originalName);
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
    
    if (!extractedText.trim()) {
      throw new Error("Text extraction returned completely empty document.");
    }

    // 2. Chunk text
    const chunksWithoutEmbed = await chunkExtractedText(
      extractedText,
      documentId,
      originalName,
      docType,
      docMeta.version
    );

    if (chunksWithoutEmbed.length === 0) {
      throw new Error("Document chunker returned zero text blocks.");
    }

    // Corrupted Chunks detection
    const initialChunkCount = chunksWithoutEmbed.length;
    const cleanChunks = [];
    let corruptedChunkCount = 0;
    
    for (const chunk of chunksWithoutEmbed) {
       if (checkCorruption(chunk.text)) {
           corruptedChunkCount++;
       } else {
           cleanChunks.push(chunk);
       }
    }
    
    let readabilityStatus: 'clean' | 'warning' | 'failed' = 'clean';
    let discardedCorruptedChunkCount = 0;
    
    if (corruptedChunkCount > 0) {
       const ratio = corruptedChunkCount / initialChunkCount;
       if (ratio > 0.1) { // more than 10%
          readabilityStatus = 'failed';
          throw new Error("Document extraction failed. Parsed text appears corrupted.");
       } else {
          readabilityStatus = 'warning';
          discardedCorruptedChunkCount = corruptedChunkCount;
       }
    }

    // 3. Generate embeddings
    const chunksWithEmbed: KBChunk[] = [];
    for (const chunk of cleanChunks) {
      const embedding = await generateTextEmbedding(chunk.text);
      chunksWithEmbed.push({
        ...chunk,
        embedding
      });
    }

    // 4. Save results to disk database
    saveChunks(chunksWithEmbed);
    
    const wordCounts = chunksWithEmbed.map(c => c.wordCount || 0);
    const avgWords = wordCounts.length ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length : 0;
    const minWords = wordCounts.length ? Math.min(...wordCounts) : 0;
    const maxWords = wordCounts.length ? Math.max(...wordCounts) : 0;
    const emptyCount = wordCounts.filter(w => w === 0).length;
    const oversizedCount = wordCounts.filter(w => w > 1000).length;
    
    // Update metadata block to indexed status
    docMeta.status = 'indexed';
    docMeta.chunkCount = chunksWithEmbed.length;
    docMeta.parsedWordCount = wordCount;
    docMeta.parsedCharacterCount = extractedText.length;
    docMeta.averageChunkWordCount = avgWords;
    docMeta.minChunkWordCount = minWords;
    docMeta.maxChunkWordCount = maxWords;
    docMeta.emptyChunkCount = emptyCount;
    docMeta.oversizedChunkCount = oversizedCount;
    docMeta.corruptedChunkCount = corruptedChunkCount;
    docMeta.discardedCorruptedChunkCount = discardedCorruptedChunkCount;
    docMeta.readabilityStatus = readabilityStatus;
    docMeta.firstChunkPreview = chunksWithEmbed.length > 0 ? chunksWithEmbed[0].text.substring(0, 150) : '';
    docMeta.lastChunkPreview = chunksWithEmbed.length > 0 ? chunksWithEmbed[chunksWithEmbed.length - 1].text.substring(0, 150) : '';
    docMeta.enabledForRetrieval = true;
    
    // Chunking Audit Logic
    let recommended = 'Unknown';
    let minExpected = 0;
    let maxExpected = Infinity;
    
    if (docMeta.type === 'SLB Communications Handbook' || docMeta.name.includes('Handbook Full')) {
         recommended = '100-350';
         minExpected = 100;
         maxExpected = 350;
    } else if (docMeta.type === 'STE Guide' || docMeta.name.includes('STE_QRG')) {
         recommended = '8-12';
         minExpected = 8;
         maxExpected = 12;
    } else if (docMeta.type === 'TechCom Standard' || docMeta.name.includes('Well Construction')) {
         recommended = '25-40';
         minExpected = 25;
         maxExpected = 40;
    } else if (docMeta.type === 'SWI / Procedure Reference' || docMeta.name.includes('SWI')) {
         recommended = '5-8';
         minExpected = 5;
         maxExpected = 8;
    }

    docMeta.recommendedChunkCountRange = recommended;
    const isCorrupted = chunksWithEmbed.length === 0 || discardedCorruptedChunkCount > 0 || readabilityStatus !== 'clean';
    
    if (isCorrupted) {
         docMeta.chunkingStatus = 'corrupted';
         docMeta.underChunkedWarning = true;
         docMeta.overChunkedWarning = false;
    } else if (chunksWithEmbed.length < minExpected) {
         docMeta.chunkingStatus = 'under-chunked';
         docMeta.underChunkedWarning = true;
         docMeta.overChunkedWarning = false;
    } else if (chunksWithEmbed.length > maxExpected) {
         docMeta.chunkingStatus = 'over-chunked';
         docMeta.underChunkedWarning = false;
         docMeta.overChunkedWarning = true;
    } else {
         docMeta.chunkingStatus = 'acceptable';
         docMeta.underChunkedWarning = false;
         docMeta.overChunkedWarning = false;
    }
    
    docMeta.indexedAt = new Date().toISOString();
    
    saveDocument(docMeta);

    return {
      success: true,
      documentId,
      extractedWordCount: wordCount,
      chunkCount: chunksWithEmbed.length,
      corruptedChunkCount,
      discardedCorruptedChunkCount,
      readabilityStatus,
      elapsedTimeMs: Date.now() - startTime
    };

  } catch (err: any) {
    console.error(`Failed to ingest document ${originalName}:`, err.message || err);
    
    docMeta.status = 'failed';
    docMeta.errorMessage = err.message || String(err);
    docMeta.readabilityStatus = docMeta.readabilityStatus || 'failed';
    docMeta.enabledForRetrieval = false;
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

