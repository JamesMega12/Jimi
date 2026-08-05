/**
 * Types for the system-owned knowledge source pipeline. Kept local to this
 * module rather than added to `src/types.ts`, where `KBDocument` / `KBChunk`
 * / `GroundingSource` are all `export type X = any` -- new code here should
 * not inherit that.
 */

export interface SystemKnowledgeManifestEntry {
  /** Stable id. Becomes the KBDocument id across re-ingests -- never randomize this. */
  id: string;
  name: string;
  version: string;
  /** Filename under data/systemKnowledge/sources/. */
  file: string;
  /** Descriptive document type, stored on the KBDocument record for display. */
  docType: string;
  enabled: boolean;
  synthetic?: boolean;
}

export interface SystemKnowledgeManifest {
  sources: SystemKnowledgeManifestEntry[];
}

export interface NormalizedDocument {
  text: string;
  extractorId: string;
  warnings: string[];
}

export type SystemKnowledgeStatus =
  | 'indexed'
  | 'failed'
  | 'disabled'
  | 'indexing'
  | 'not_ingested';

export interface SystemKnowledgeSourceStatus {
  id: string;
  name: string;
  version: string;
  docType: string;
  enabled: boolean;
  synthetic: boolean;
  /**
   * 'failed' means the MOST RECENT ingest attempt failed -- it does not mean
   * nothing is being served. `chunkCount`/`contentHash`/`embeddingBackend`/
   * `indexedAt` below always describe the last SUCCESSFULLY indexed version
   * (which retrieval keeps using), never the failed attempt -- see
   * `lastAttemptedContentHash`/`lastAttemptedAt` for what was just tried.
   */
  status: SystemKnowledgeStatus;
  chunkCount: number;
  contentHash?: string;
  extractorId?: string;
  normalizationSource?: 'auto' | 'override';
  normalizationWarnings?: string[];
  embeddingBackend?: string;
  embeddingDimensions?: number;
  ingestionConfigVersion?: string;
  indexedAt?: string;
  errorMessage?: string;
  /** Content hash of the most recent (possibly failed) ingest attempt, if different from contentHash. */
  lastAttemptedContentHash?: string;
  lastAttemptedAt?: string;
}

export interface KnowledgeProvenanceSourceSummary {
  id: string;
  name: string;
  version: string;
  contentHashShort: string;
  chunkCount: number;
}

/**
 * Attached to every retrieval result so a caller (and a log line) can tell
 * "no relevant guidance found" apart from "retrieval never ran" apart from
 * "retrieval broke" -- the three states the FCO rewrite path previously
 * collapsed into a single silent `console.warn`.
 */
export interface KnowledgeProvenance {
  status: 'ok' | 'empty' | 'disabled' | 'error';
  systemSources: KnowledgeProvenanceSourceSummary[];
  searchedChunkCount: number;
  embeddingBackend: string;
  backendMismatchCount: number;
  error?: string;
}
