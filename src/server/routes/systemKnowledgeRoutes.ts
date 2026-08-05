import express from 'express';
import {
  syncSystemKnowledge,
  getSystemKnowledgeStatus,
  previewSystemKnowledgeSource,
} from '../systemKnowledge/systemKnowledgeService';
import { getChunks } from '../knowledgeBaseService';
import { filterChunksBySettings, retrieveRelevantChunksForQuery } from '../retrievalService';

/**
 * System-owned knowledge admin/diagnostics surface, mounted at
 * `/api/knowledge/system`. Mirrors the "thin router, logic lives in a
 * service" convention documented at the top of `kbRoutes.ts`.
 *
 * Gating duplicates (rather than imports) server.ts's `isDevKnowledgeEndpointEnabled`
 * check: importing the guard function directly from server.ts would create a
 * server.ts <-> this-router circular import (server.ts mounts this router,
 * and Express reads middleware function references at route-registration
 * time, not per-request -- a circular import could hand it `undefined`
 * depending on module evaluation order). The five-line duplication is
 * cheaper than that fragility.
 */
function isDevKnowledgeEndpointEnabled(): boolean {
  const isDemoModeEnabled = process.env.ENABLE_KNOWLEDGE_DEMO_MODE === 'true';
  const isDevFlagEnabled = process.env.ENABLE_DEVELOPER_KNOWLEDGE_ENDPOINT === 'true';
  const isLocalDev = process.env.NODE_ENV !== 'production';
  return isDemoModeEnabled || isDevFlagEnabled || isLocalDev;
}

const devKnowledgeGuard = (req: any, res: any, next: any) => {
  if (!isDevKnowledgeEndpointEnabled()) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Developer Knowledge Endpoint is disabled in this environment.',
    });
  }
  next();
};

export const systemKnowledgeRoutes = express.Router();
systemKnowledgeRoutes.use(devKnowledgeGuard);

// GET /api/knowledge/system/status -- manifest + ingestion state per source
// (chunk count, content hash, warnings, last indexed time) without ingesting
// anything.
systemKnowledgeRoutes.get('/status', (_req, res) => {
  try {
    res.json({ sources: getSystemKnowledgeStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/knowledge/system/sync { force?: boolean } -- ingest every
// enabled manifest entry (skips anything unchanged unless force is set).
systemKnowledgeRoutes.post('/sync', async (req, res) => {
  try {
    const force = !!(req.body && req.body.force);
    const sources = await syncSystemKnowledge({ force });
    res.json({ success: true, sources });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/knowledge/system/extract-preview { sourceId } -- normalize +
// chunk a declared source WITHOUT embedding or indexing it. This is the
// column/table failure inspector: it surfaces normalization warnings and
// the detected section titles so a bad multi-column or table extraction is
// visible before it reaches the index, not after a bad retrieval.
systemKnowledgeRoutes.post('/extract-preview', async (req, res) => {
  try {
    const { sourceId } = req.body || {};
    if (!sourceId) return res.status(400).json({ error: 'Missing sourceId.' });
    const preview = await previewSystemKnowledgeSource(sourceId);
    res.json(preview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/knowledge/system/retrieval-probe { query } -- run the same
// hybrid retrieval a real rewrite request would use, against the currently
// indexed knowledge base, and return chunk ids/scores/section titles. Spot
// checking, not a production endpoint.
systemKnowledgeRoutes.post('/retrieval-probe', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Missing query string.' });
    const chunks = filterChunksBySettings(getChunks());
    const matches = await retrieveRelevantChunksForQuery(query, chunks, 5);
    res.json({
      query,
      results: matches.map(({ source, score }: any) => ({
        chunkId: source.chunkId,
        documentId: source.documentId,
        documentName: source.documentName,
        isSystemKnowledge: source.isSystemKnowledge,
        sectionTitle: source.sectionTitle,
        ruleCategory: source.ruleCategory,
        score: parseFloat(score.toFixed(4)),
        textPreview: (source.text || '').slice(0, 240),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
