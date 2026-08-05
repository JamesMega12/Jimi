import { GoogleGenAI } from '@google/genai';
import { generateLocalHeuristicEmbedding, LOCAL_EMBEDDING_DIMENSIONS } from './knowledgeBaseService';

// `text-embedding-004` (the model this file previously hardcoded) 404s as
// unavailable for embedContent on at least some API keys/projects -- verified
// against a real key during this feature's development, where `models?key=...`
// listed `gemini-embedding-001` (3072-dim) as the actually-supported
// embedContent model instead. Using the wrong dimension here would silently
// reintroduce the dimension-mismatch bug this module exists to fix, so this
// value must match whatever GEMINI_EMBEDDING_MODEL actually returns -- verify
// with a real call before changing either constant.
const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const GEMINI_EMBEDDING_DIMENSIONS = 3072;

export interface EmbeddingBackend {
  id: string;
  dimensions: number;
}

function hasUsableApiKey(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return !!apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim() !== '';
}

/**
 * Which embedding backend a chunk embedded *right now* would use. Stamped
 * onto every chunk at ingest time so retrieval can detect a query embedded
 * under one backend being scored against chunks embedded under another --
 * previously an unannounced 768-dim vs 41-dim mismatch that silently scored
 * 0 for every affected chunk (retrievalService.ts cosineSimilarity's
 * `a.length !== b.length` early return). The dimension is authoritative
 * here; retrieval compares it against each chunk's actual embedding length.
 */
export function getEmbeddingBackendId(): EmbeddingBackend {
  if (hasUsableApiKey()) {
    return { id: GEMINI_EMBEDDING_MODEL, dimensions: GEMINI_EMBEDDING_DIMENSIONS };
  }
  return { id: 'local-hashed-bow-v1', dimensions: LOCAL_EMBEDDING_DIMENSIONS };
}

/**
 * Generates an embedding vector for a text. Falls back to a local heuristic
 * vector only when no usable API key is configured at all -- that is
 * intentional graceful degradation (see `.claude/skills/run-techcom-workspace`:
 * "the app degrades gracefully without a working key"). It deliberately does
 * NOT fall back on a request error when a key *is* configured: silently
 * substituting a 256-dim local vector for what should have been a 768-dim
 * Gemini vector reproduces the exact silent dimension-mismatch bug this
 * module exists to fix. Callers that can tolerate a failed embedding call
 * (e.g. marking one document ingestion as failed rather than crashing the
 * server) should catch this themselves.
 */
/**
 * Whether an error from the embedding API is transient (worth retrying):
 * 503 UNAVAILABLE / 429 rate-limit / other 5xx. A 4xx other than 429 (e.g. a
 * malformed request or an over-long input) is NOT retried. Ingesting a large
 * document fires one call per chunk in sequence, which can trip transient
 * overload/rate-limit responses that succeed on a short backoff.
 */
function isTransientEmbeddingError(err: any): boolean {
  const msg = String(err?.message || err || '');
  if (/50\d|unavailable|overloaded|deadline|timeout|ECONNRESET|ETIMEDOUT|429|rate limit|resource has been exhausted/i.test(msg)) {
    return true;
  }
  const status = err?.status ?? err?.code;
  return status === 503 || status === 429 || status === 500 || status === 502 || status === 504;
}

const EMBEDDING_MAX_ATTEMPTS = 5;

export async function generateTextEmbedding(text: string): Promise<number[]> {
  if (!hasUsableApiKey()) {
    return generateLocalHeuristicEmbedding(text);
  }

  const apiKey = process.env.GEMINI_API_KEY as string;
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  let lastErr: any;
  for (let attempt = 1; attempt <= EMBEDDING_MAX_ATTEMPTS; attempt++) {
    try {
      const response: any = await ai.models.embedContent({
        model: GEMINI_EMBEDDING_MODEL,
        contents: text,
      });

      const values = response?.embeddings?.[0]?.values;
      if (!values || !Array.isArray(values) || values.length === 0) {
        throw new Error('Gemini embedding API returned an unexpected response shape (no embedding values).');
      }
      return values;
    } catch (err: any) {
      lastErr = err;
      // Only retry transient failures; surface everything else immediately.
      // Never fall back to a local vector here (see the doc comment above) --
      // a dimension-mismatched substitute is worse than a clean failure.
      if (attempt < EMBEDDING_MAX_ATTEMPTS && isTransientEmbeddingError(err)) {
        // Exponential backoff with jitter: ~0.5s, 1s, 2s, 4s.
        const delayMs = Math.round(500 * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5));
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
