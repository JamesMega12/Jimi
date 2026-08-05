import { KBChunk, GroundingSource, FCORequestData } from '../types';
import { getChunks, getDocumentsRaw, getSettings } from './knowledgeBaseService';
import { generateTextEmbedding, getEmbeddingBackendId } from './embeddingService';
import { logEvent } from './logger';
import { KnowledgeProvenance, KnowledgeProvenanceSourceSummary } from './systemKnowledge/types';

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function detectQueryCategories(query: string): string[] {
  const categories = new Set<string>();
  const lower = query.toLowerCase();

  if (lower.includes('degc') || lower.includes('temperature') || lower.includes('unit')) categories.add('units');
  if (lower.includes('abbreviation') || lower.includes('acronym') || lower.includes('loto')) categories.add('abbreviation');
  if (lower.includes('active voice') || lower.includes('sentence structure') || lower.includes('style') || lower.includes('language') || lower.includes('concise')) categories.add('style');
  if (lower.includes('terminology')) categories.add('terminology');
  if (lower.includes('spelling')) categories.add('spelling');
  if (lower.includes('branding')) categories.add('branding');
  if (lower.includes('legal')) categories.add('legal');
  if (lower.includes('figure') || lower.includes('table') || lower.includes('caption')) categories.add('table'); // Add fallback mapping for tables

  return Array.from(categories);
}

function calculateHybridScore(chunk: KBChunk, queryText: string, queryEmbed: number[], detectedCategories: string[]): number {
  const semanticScore = chunk.embedding ? cosineSimilarity(queryEmbed, chunk.embedding) : 0;

  const chunkTextLower = chunk.text.toLowerCase();
  const queryWords = queryText.toLowerCase().split(/\s+/).filter(Boolean);

  let keywordMatches = 0;
  queryWords.forEach(kw => {
     if (chunk.keywords && chunk.keywords.some(k => k.toLowerCase() === kw)) {
        keywordMatches += 2;
     } else if (chunkTextLower.includes(kw)) {
        keywordMatches += 1;
     }
  });
  const keywordScore = Math.min(keywordMatches / (queryWords.length || 1), 1.0);

  let categoryMatch = 0;
  if (chunk.ruleCategory && detectedCategories.includes(chunk.ruleCategory)) {
    categoryMatch = 1;
  }

  let finalScore = (semanticScore * 0.5) + (keywordScore * 0.3) + (categoryMatch * 0.2);

  if (chunk.priorityScore && chunk.priorityScore > 1) {
    // scale up by 1.1x per point above 1
    finalScore = finalScore * (1 + (chunk.priorityScore - 1) * 0.1);
  }

  return finalScore;
}

export async function retrieveRelevantChunksForQuery(queryText: string, chunks: KBChunk[], limit = 3): Promise<{ source: GroundingSource, score: number, matchedCategories: string[] }[]> {
   const detectedCategories = detectQueryCategories(queryText);
   const queryEmbed = await generateTextEmbedding(queryText);

   const scored = chunks.map(chunk => {
       const score = calculateHybridScore(chunk, queryText, queryEmbed, detectedCategories);
       return {
          source: {
            chunkId: chunk.id,
            documentId: chunk.documentId,
            documentName: chunk.documentName,
            documentType: chunk.documentType,
            standardType: chunk.standardType,
            ruleCategory: chunk.ruleCategory,
            relevanceScore: parseFloat(score.toFixed(4)),
            isSeedData: chunk.isSeedData || chunk.sourceType === 'seed_data',
            isSystemKnowledge: chunk.sourceType === 'system_knowledge',
            sectionTitle: chunk.sectionTitle,
            text: chunk.text,
            structuredRules: chunk.structuredRules
          },
          score,
          matchedCategories: detectedCategories
       };
   });

   scored.sort((a, b) => b.score - a.score);
   return scored.slice(0, limit);
}

/**
 * Selects which chunk tiers are eligible for retrieval, per `kb_settings.json`'s
 * `retrievalMode`. System-owned knowledge (the approved handbook, or its
 * synthetic stand-in) is always eligible regardless of mode -- it is not a
 * demo convenience like the seed chunks, and unlike user uploads it isn't
 * something a mode toggle should be able to hide. Legacy uploaded/seed
 * behavior is unchanged.
 */
export function filterChunksBySettings(chunks: KBChunk[]): KBChunk[] {
  const settings = getSettings();
  const systemChunks = chunks.filter(c => c.sourceType === 'system_knowledge');
  const uploadedChunks = chunks.filter(c => c.sourceType !== 'system_knowledge' && !c.isSeedData && c.sourceType !== 'seed_data');
  const seedChunks = chunks.filter(c => c.sourceType !== 'system_knowledge' && (c.isSeedData || c.sourceType === 'seed_data'));

  let selected: KBChunk[];
  if (settings.retrievalMode === 'uploaded_only') {
    selected = uploadedChunks;
  } else if (settings.retrievalMode === 'demo_allowed') {
    selected = uploadedChunks.length === 0 ? seedChunks : uploadedChunks;
  } else if (settings.retrievalMode === 'mixed_debug') {
    selected = [...uploadedChunks, ...seedChunks];
  } else {
    selected = uploadedChunks;
  }
  return [...systemChunks, ...selected];
}

function summarizeSystemSources(): KnowledgeProvenanceSourceSummary[] {
  // Filter on chunkCount, not status === 'indexed': a source whose most
  // recent re-ingest attempt failed keeps status: 'failed' for visibility,
  // but systemKnowledgeService.ts deliberately does not clear its
  // previously-indexed chunks or chunkCount on a failed attempt -- those old
  // chunks are still what gets searched. Filtering on status here would make
  // provenance under-report a source that is, in fact, still being retrieved.
  return getDocumentsRaw()
    .filter((d: any) => d.sourceType === 'system_knowledge' && (d.chunkCount || 0) > 0)
    .map((d: any) => ({
      id: d.id,
      name: d.name,
      version: d.version,
      contentHashShort: (d.contentHash || '').slice(0, 12),
      chunkCount: d.chunkCount || 0,
    }));
}

export async function retrieveRelevantChunks(
  request: FCORequestData,
  limit = 8
): Promise<{ sources: GroundingSource[], matchedCategories: string[], topChunkCategories: string[], provenance: KnowledgeProvenance }> {
  const backend = getEmbeddingBackendId();
  const systemSources = summarizeSystemSources();

  // Retrieval-time kill switch: does NOT touch the persisted index, so it is
  // a safe, reversible test mechanism (flip an env var, no re-ingestion).
  // See docs/SYSTEM_KNOWLEDGE.md Case 3.
  if (process.env.SYSTEM_KNOWLEDGE_DISABLED === 'true') {
    logEvent('info', 'knowledge_retrieval', { status: 'disabled' });
    return {
      sources: [],
      matchedCategories: [],
      topChunkCategories: [],
      provenance: {
        status: 'disabled',
        systemSources: [],
        searchedChunkCount: 0,
        embeddingBackend: backend.id,
        backendMismatchCount: 0,
      },
    };
  }

  try {
    const allChunks = getChunks();
    const chunks = filterChunksBySettings(allChunks);

    const backendMismatchCount = chunks.filter(
      (c) => c.embedding && c.embedding.length > 0 && c.embedding.length !== backend.dimensions,
    ).length;

    if (chunks.length === 0) {
      logEvent('info', 'knowledge_retrieval', { status: 'empty', embeddingBackend: backend.id });
      return {
        sources: [],
        matchedCategories: [],
        topChunkCategories: [],
        provenance: {
          status: 'empty',
          systemSources,
          searchedChunkCount: 0,
          embeddingBackend: backend.id,
          backendMismatchCount: 0,
        },
      };
    }

    const queries = [
       "FCO Summary Problem Cause Solution Benefit concise field-friendly wording",
       "procedure active voice operator-friendly numbered steps simplified technical English",
       "WARNING CAUTION Note safety instruction technical procedure wording"
    ];

    let dyn = [];
    const fullInputLower = (request.rawSummary + ' ' + request.rawProcedure + ' ' + request.customDirectives).toLowerCase();

    if (fullInputLower.includes('°c') || fullInputLower.includes('celsius')) dyn.push("temperature degC unit symbols Celsius");
    if (fullInputLower.includes('loto')) dyn.push("abbreviation first use LOTO Lockout Tagout");
    if (fullInputLower.includes('psi') || fullInputLower.includes('kpa') || fullInputLower.includes('mpa')) dyn.push("pressure unit symbols psi kPa MPa");
    if (fullInputLower.includes('fig ') || fullInputLower.includes('figure') || fullInputLower.includes('table')) dyn.push("figure caption table title formatting Fig Figure Table");

    if (dyn.length > 0) queries.push(dyn.join(' '));

    let allResults: { source: GroundingSource, score: number }[] = [];
    let allMatchedCategories = new Set<string>();

    for (const q of queries) {
        const res = await retrieveRelevantChunksForQuery(q, chunks, 3);
        logEvent('debug', 'knowledge_query', { query: q, resultCount: res.length, topScore: res[0]?.score });
        allResults.push(...res);
        const queryCats = detectQueryCategories(q);
        queryCats.forEach(c => allMatchedCategories.add(c));
    }

    const uniqueMap = new Map<string, { source: GroundingSource, score: number }>();
    allResults.forEach(r => {
        const existing = uniqueMap.get(r.source.chunkId);
        if (!existing || existing.score < r.score) {
            uniqueMap.set(r.source.chunkId, r);
        }
    });

    const finalSorted = Array.from(uniqueMap.values()).sort((a, b) => b.score - a.score);
    const sliced = finalSorted.slice(0, limit).map(r => r.source);

    const categoryCounts: Record<string, number> = {};
    sliced.forEach(s => {
      if (s.ruleCategory) {
         categoryCounts[s.ruleCategory] = (categoryCounts[s.ruleCategory] || 0) + 1;
      }
    });
    const topChunkCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(e => e[0]);

    logEvent('info', 'knowledge_retrieval', {
      status: 'ok',
      searchedChunkCount: chunks.length,
      retrievedChunkCount: sliced.length,
      chunkIds: sliced.map((s: any) => s.chunkId),
      scores: sliced.map((s: any) => s.relevanceScore),
      embeddingBackend: backend.id,
      backendMismatchCount,
      systemSourceIds: systemSources.map((s) => s.id),
    });

    return {
      sources: sliced,
      matchedCategories: Array.from(allMatchedCategories),
      topChunkCategories,
      provenance: {
        status: 'ok',
        systemSources,
        searchedChunkCount: chunks.length,
        embeddingBackend: backend.id,
        backendMismatchCount,
      },
    };
  } catch (err: any) {
    const message = err?.message || String(err);
    logEvent('error', 'knowledge_retrieval', { status: 'error', message });
    return {
      sources: [],
      matchedCategories: [],
      topChunkCategories: [],
      provenance: {
        status: 'error',
        systemSources,
        searchedChunkCount: 0,
        embeddingBackend: backend.id,
        backendMismatchCount: 0,
        error: message,
      },
    };
  }
}
