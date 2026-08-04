import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  getDocuments,
  deleteDocument,
  getChunks,
  getSettings,
  updateSettings,
  loadSeedData,
  clearSeedData,
  replaceDocumentChunks,
} from '../knowledgeBaseService';
import { ingestDocument } from '../documentIngestionService';
import {
  retrieveRelevantChunksForQuery,
  filterChunksBySettings,
} from '../retrievalService';
import { generateTextEmbedding } from '../embeddingService';
import { KBChunk, KBDocument } from '../../types';

/**
 * Knowledge Base ("Source Truth") admin routes.
 *
 * This router owns the `/api/kb/*` surface consumed by SourceTruthAdminPage.
 * It is intentionally thin: every route delegates to a service in
 * `src/server/` and only performs request/response shaping. This keeps the
 * router aligned with the Single Responsibility Principle and mirrors the
 * existing `docxRoutes` / `techComRoutes` modules.
 */
export const kbRoutes = express.Router();

/**
 * Decode a base64 data URL (or raw string) into a Buffer.
 */
function decodeUploadContent(content: string): Buffer {
  if (content.startsWith('data:') && content.includes(';base64,')) {
    return Buffer.from(content.split(';base64,')[1], 'base64');
  }
  return Buffer.from(content, 'utf-8');
}

/**
 * Recompute embeddings for stored chunks. Original source files are not
 * persisted after ingestion, so "reindex" refreshes the vector for each
 * retained chunk rather than re-parsing the document.
 */
async function reindexEmbeddings(documentId?: string): Promise<number> {
  const allChunks = getChunks();
  const targets = documentId
    ? allChunks.filter((c) => c.documentId === documentId)
    : allChunks;

  if (targets.length === 0) return 0;

  const byDocument = new Map<string, KBChunk[]>();
  for (const chunk of targets) {
    const updated: KBChunk = {
      ...chunk,
      embedding: await generateTextEmbedding(chunk.text),
    };
    const bucket = byDocument.get(chunk.documentId) || [];
    bucket.push(updated);
    byDocument.set(chunk.documentId, bucket);
  }

  for (const [docId, chunks] of byDocument) {
    replaceDocumentChunks(docId, chunks);
  }

  return targets.length;
}

// --- Settings ------------------------------------------------------------

kbRoutes.get('/settings', (_req, res) => {
  try {
    res.json(getSettings());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

kbRoutes.post('/settings', (req, res) => {
  try {
    const { retrievalMode } = req.body || {};
    res.json(updateSettings({ retrievalMode }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Seed data -----------------------------------------------------------

kbRoutes.post('/load-seed', (_req, res) => {
  try {
    res.json({ success: true, documents: loadSeedData() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

kbRoutes.post('/clear-seed', (_req, res) => {
  try {
    res.json({ success: true, documents: clearSeedData() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Documents -----------------------------------------------------------

kbRoutes.get('/documents', (_req, res) => {
  try {
    res.json(getDocuments());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

kbRoutes.delete('/documents/:documentId', (req, res) => {
  try {
    const result = deleteDocument(req.params.documentId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

kbRoutes.post('/documents/reindex-all', async (_req, res) => {
  try {
    const reindexedChunkCount = await reindexEmbeddings();
    res.json({ success: true, reindexedChunkCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

kbRoutes.post('/documents/:documentId/reindex', async (req, res) => {
  try {
    const { documentId } = req.params;
    const doc = getDocuments().find((d: KBDocument) => d.id === documentId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    const start = Date.now();
    const chunkCount = await reindexEmbeddings(documentId);
    return res.json({
      success: true,
      documentId,
      chunkCount,
      extractedWordCount: doc.parsedWordCount ?? 0,
      elapsedTimeMs: Date.now() - start,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Upload / ingestion --------------------------------------------------

kbRoutes.post('/upload', async (req, res) => {
  const { name, type, version, content } = req.body || {};
  if (!content) {
    return res.status(400).json({ success: false, error: 'Missing file content.' });
  }
  if (!name) {
    return res.status(400).json({ success: false, error: 'Missing document name.' });
  }

  const uploadsDir = path.join(process.cwd(), 'src', 'server', 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const safeName = String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  const tempPath = path.join(uploadsDir, `kb_${Date.now()}_${safeName}`);

  try {
    fs.writeFileSync(tempPath, decodeUploadContent(content));
    const diagnostics = await ingestDocument(
      tempPath,
      name,
      (type as KBDocument['type']) || 'GUIDELINE',
      version || '1.0.0',
    );
    return res.json({ ...diagnostics });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

// --- Retrieval testing ---------------------------------------------------

kbRoutes.post('/test-retrieval', async (req, res) => {
  try {
    const { queries } = req.body || {};
    if (!Array.isArray(queries)) {
      return res.status(400).json({ error: 'Missing queries array.' });
    }

    const settings = getSettings();
    const chunks = filterChunksBySettings(getChunks());

    const results = await Promise.all(
      queries
        .filter((q: unknown) => typeof q === 'string' && q.trim())
        .map(async (query: string) => {
          const matches = await retrieveRelevantChunksForQuery(query, chunks, 5);
          return {
            query,
            routingMode: settings.retrievalMode,
            results: matches.map(({ source, score }) => ({
              documentName: source.documentName,
              sourceType: source.isSeedData ? 'seed_data' : 'uploaded_document',
              ruleCategory: source.ruleCategory,
              sectionTitle: source.sectionTitle,
              chunkTextPreview: (source.text || '').slice(0, 240),
              finalScore: parseFloat(score.toFixed(4)),
            })),
          };
        }),
    );

    return res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
