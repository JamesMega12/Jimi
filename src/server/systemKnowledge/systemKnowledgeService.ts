import fs from 'fs';
import { KBChunk } from '../../types';
import {
  loadManifest,
  resolveSourcePath,
  normalizedPathsFor,
  ensureNormalizedDir,
  hashBuffer,
  hashText,
} from './manifest';
import { normalizeSource } from './sourceNormalizer';
import { NormalizedDocument, SystemKnowledgeManifestEntry, SystemKnowledgeSourceStatus } from './types';
import { chunkExtractedText, checkCorruption } from '../chunkingService';
import { generateTextEmbedding, getEmbeddingBackendId } from '../embeddingService';
import { getDocumentsRaw, saveDocument, deleteDocument, replaceDocumentChunks } from '../knowledgeBaseService';
import { logEvent } from '../logger';

/**
 * Bump this when chunking/normalization rules change in a way that should
 * force every system-knowledge source to re-ingest even though the source
 * file itself is unchanged (part of the ingestion fingerprint alongside the
 * source content hash and the active embedding backend).
 */
export const INGESTION_CONFIG_VERSION = 'system-knowledge-v1';

/**
 * Deliberately NOT `entry.docType`. `chunkExtractedText` (chunkingService.ts)
 * routes to a live-LLM structured-extraction path for docType `'STE Guide'`
 * / `'technical_standard'` / `'TechCom Standard'` (and for filenames
 * containing `SWI`, `Well Construction`, `STE_QRG`, `techcom`) -- fine for
 * an interactive upload, wrong for system-knowledge ingestion, which must
 * stay deterministic and run without a network call so it can be tested
 * offline and re-synced on every restart without cost or nondeterminism.
 * Passing this fixed, unmatchable string routes every system-knowledge
 * source through the default heading + paragraph chunker instead -- the one
 * `sourceNormalizer.ts` is designed to feed.
 */
const CHUNKER_DOC_TYPE = 'System Knowledge Source';

const FINGERPRINT_COMMENT = /^<!-- system-knowledge-source-hash: ([a-f0-9]+) -->\n?/;

function stripFingerprintComment(text: string): string {
  return text.replace(FINGERPRINT_COMMENT, '');
}

function extractFingerprintComment(text: string): string | null {
  const match = text.match(FINGERPRINT_COMMENT);
  return match ? match[1] : null;
}

interface ResolvedSource {
  doc: NormalizedDocument;
  normalizationSource: 'auto' | 'override';
}

/**
 * Resolve the text to ingest for one manifest entry, in precedence order:
 * a hand-corrected `<base>.override.md` always wins; otherwise a cached
 * `<base>.normalized.md` is reused if its recorded source hash still
 * matches the source file; otherwise the source is normalized fresh and the
 * result cached (with the source hash embedded as a leading HTML comment,
 * so the cache is self-describing -- no separate metadata file to drift).
 */
async function resolveSourceText(entry: SystemKnowledgeManifestEntry): Promise<ResolvedSource> {
  const sourcePath = resolveSourcePath(entry);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Declared source file missing on disk: ${sourcePath}`);
  }
  const sourceHash = hashBuffer(fs.readFileSync(sourcePath));
  const { normalized: normalizedPath, override: overridePath } = normalizedPathsFor(entry);
  ensureNormalizedDir();

  if (fs.existsSync(overridePath)) {
    const text = stripFingerprintComment(fs.readFileSync(overridePath, 'utf-8'));
    return { doc: { text, extractorId: 'hand-override', warnings: [] }, normalizationSource: 'override' };
  }

  if (fs.existsSync(normalizedPath)) {
    const raw = fs.readFileSync(normalizedPath, 'utf-8');
    if (extractFingerprintComment(raw) === sourceHash) {
      return {
        doc: { text: stripFingerprintComment(raw), extractorId: 'cached', warnings: [] },
        normalizationSource: 'auto',
      };
    }
  }

  const normalized = await normalizeSource(sourcePath, entry.file);
  fs.writeFileSync(normalizedPath, `<!-- system-knowledge-source-hash: ${sourceHash} -->\n${normalized.text}`, 'utf-8');
  return { doc: normalized, normalizationSource: 'auto' };
}

function buildDocRecord(
  entry: SystemKnowledgeManifestEntry,
  existing: any,
  overrides: Record<string, unknown>,
): any {
  return {
    // Spread `existing` FIRST so any field this function doesn't explicitly
    // set below (contentHash, embeddingBackend, embeddingDimensions,
    // indexedAt, normalizationSource, extractorId, normalizationWarnings,
    // ingestionFingerprint, ...) survives from the last successful ingest by
    // default, instead of silently disappearing from the record. This
    // matters most for the 'failed' path: a re-ingest attempt that throws
    // must not erase what the last GOOD ingest recorded, since those old
    // chunks are still what retrieval serves.
    ...existing,
    id: entry.id,
    name: entry.name,
    type: entry.docType,
    version: entry.version,
    uploadedAt: existing?.uploadedAt || new Date().toISOString(),
    sourceType: 'system_knowledge',
    isSeedData: false,
    synthetic: !!entry.synthetic,
    ingestionConfigVersion: INGESTION_CONFIG_VERSION,
    chunkCount: existing?.chunkCount || 0,
    status: 'indexing',
    ...overrides,
  };
}

function toStatus(doc: any): SystemKnowledgeSourceStatus {
  return {
    id: doc.id,
    name: doc.name,
    version: doc.version,
    docType: doc.type,
    enabled: doc.status !== 'disabled',
    synthetic: !!doc.synthetic,
    status: doc.status,
    chunkCount: doc.chunkCount || 0,
    contentHash: doc.contentHash,
    extractorId: doc.extractorId,
    normalizationSource: doc.normalizationSource,
    normalizationWarnings: doc.normalizationWarnings,
    embeddingBackend: doc.embeddingBackend,
    embeddingDimensions: doc.embeddingDimensions,
    ingestionConfigVersion: doc.ingestionConfigVersion,
    indexedAt: doc.indexedAt,
    errorMessage: doc.errorMessage,
    lastAttemptedContentHash: doc.lastAttemptedContentHash,
    lastAttemptedAt: doc.lastAttemptedAt,
  };
}

function toStatusFromEntry(
  entry: SystemKnowledgeManifestEntry,
  status: SystemKnowledgeSourceStatus['status'],
): SystemKnowledgeSourceStatus {
  return {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    docType: entry.docType,
    enabled: entry.enabled,
    synthetic: !!entry.synthetic,
    status,
    chunkCount: 0,
  };
}

/**
 * Ingest (or skip, or fail) one manifest entry. Idempotent: computes a
 * fingerprint from the normalized content hash + INGESTION_CONFIG_VERSION +
 * the active embedding backend id, and skips re-chunking/re-embedding
 * entirely when an already-`indexed` record matches it (Case 6's "unchanged
 * sources are not unnecessarily reprocessed"; Case 5's "nothing is
 * re-embedded on restart" -- the bootstrap call in server.ts hits this path
 * on every start).
 */
export async function ingestSystemKnowledgeSource(
  entry: SystemKnowledgeManifestEntry,
  opts: { force?: boolean } = {},
): Promise<SystemKnowledgeSourceStatus> {
  const existing = getDocumentsRaw().find((d: any) => d.id === entry.id);

  if (!entry.enabled) {
    replaceDocumentChunks(entry.id, []);
    const doc = buildDocRecord(entry, existing, { status: 'disabled', chunkCount: 0 });
    saveDocument(doc);
    logEvent('info', 'system_knowledge_sync', { sourceId: entry.id, status: 'disabled' });
    return toStatus(doc);
  }

  let resolved: ResolvedSource;
  try {
    resolved = await resolveSourceText(entry);
  } catch (err: any) {
    const errorMessage = err.message || String(err);
    // Same "don't erase the last good state" reasoning as the later catch
    // block below: this can fail (e.g. a manifest typo pointing at a
    // nonexistent file) while a previously-indexed version is still being
    // served, so chunkCount/contentHash/etc. are deliberately left as they
    // were on `existing` (via buildDocRecord's `...existing` spread).
    const doc = buildDocRecord(entry, existing, { status: 'failed', errorMessage, lastAttemptedAt: new Date().toISOString() });
    saveDocument(doc);
    logEvent('error', 'system_knowledge_sync', {
      sourceId: entry.id,
      status: 'failed',
      message: errorMessage,
      previousChunkCount: existing?.chunkCount || 0,
    });
    return toStatus(doc);
  }

  const { doc: normalized, normalizationSource } = resolved;
  const backend = getEmbeddingBackendId();
  const contentHash = hashText(normalized.text);
  const fingerprint = `${contentHash}:${INGESTION_CONFIG_VERSION}:${backend.id}`;

  if (!opts.force && existing && existing.status === 'indexed' && existing.ingestionFingerprint === fingerprint) {
    logEvent('info', 'system_knowledge_sync', { sourceId: entry.id, status: 'skipped', chunkCount: existing.chunkCount });
    return toStatus(existing);
  }

  saveDocument(buildDocRecord(entry, existing, { status: 'indexing' }));

  try {
    if (!normalized.text.trim()) {
      throw new Error('Normalization produced empty text -- nothing to ingest.');
    }

    const rawChunks = await chunkExtractedText(normalized.text, entry.id, entry.name, CHUNKER_DOC_TYPE, entry.version);
    if (rawChunks.length === 0) {
      throw new Error('Chunker produced zero chunks from normalized text.');
    }

    const corruptCount = rawChunks.filter((c) => checkCorruption(c.text)).length;
    if (corruptCount > 0) {
      throw new Error(
        `${corruptCount} of ${rawChunks.length} chunks failed the corruption check -- normalized text looks unreadable (binary/XML artifacts).`,
      );
    }

    const embeddedChunks: KBChunk[] = [];
    for (const chunk of rawChunks) {
      const embedding = await generateTextEmbedding(chunk.text);
      embeddedChunks.push({
        ...chunk,
        sourceType: 'system_knowledge',
        isSeedData: false,
        // Modest authority boost: this is the system-owned, approved
        // writing reference, not a user upload or demo seed.
        priorityScore: 2,
        sectionPriority: 'high',
        embedding,
        embeddingBackend: backend.id,
        embeddingDimensions: embedding.length,
      });
    }

    replaceDocumentChunks(entry.id, embeddedChunks);

    const finalDoc = buildDocRecord(entry, existing, {
      status: 'indexed',
      chunkCount: embeddedChunks.length,
      contentHash,
      ingestionFingerprint: fingerprint,
      normalizationSource,
      extractorId: normalized.extractorId,
      normalizationWarnings: normalized.warnings,
      embeddingBackend: backend.id,
      embeddingDimensions: backend.dimensions,
      errorMessage: undefined,
      lastAttemptedContentHash: undefined,
      lastAttemptedAt: undefined,
      indexedAt: new Date().toISOString(),
    });
    saveDocument(finalDoc);
    logEvent('info', 'system_knowledge_sync', {
      sourceId: entry.id,
      status: 'indexed',
      chunkCount: embeddedChunks.length,
      warnings: normalized.warnings,
    });
    return toStatus(finalDoc);
  } catch (err: any) {
    const errorMessage = err.message || String(err);
    // Deliberately do NOT overwrite chunkCount/contentHash/embeddingBackend/
    // indexedAt here: those describe the last successfully indexed version,
    // which is still what retrieval serves (ingestSystemKnowledgeSource never
    // calls replaceDocumentChunks in this branch, so the old chunks are
    // untouched). Only `status`/`errorMessage` change, plus a separate
    // "what did we just try" record -- conflating the two previously made a
    // failed re-ingest attempt look like it had zeroed out a working source.
    const failedDoc = buildDocRecord(entry, existing, {
      status: 'failed',
      errorMessage,
      lastAttemptedContentHash: contentHash,
      lastAttemptedAt: new Date().toISOString(),
    });
    saveDocument(failedDoc);
    logEvent('error', 'system_knowledge_sync', {
      sourceId: entry.id,
      status: 'failed',
      message: errorMessage,
      previousChunkCount: existing?.chunkCount || 0,
    });
    return toStatus(failedDoc);
  }
}

/**
 * Sync every enabled manifest entry, then prune KB records for any
 * system-knowledge document id that used to be in the manifest and no
 * longer is (e.g. the synthetic fixture removed the day the real handbook
 * lands -- see docs/SYSTEM_KNOWLEDGE.md).
 */
export async function syncSystemKnowledge(opts: { force?: boolean } = {}): Promise<SystemKnowledgeSourceStatus[]> {
  const manifest = loadManifest();
  const results: SystemKnowledgeSourceStatus[] = [];
  for (const entry of manifest.sources) {
    results.push(await ingestSystemKnowledgeSource(entry, opts));
  }

  const manifestIds = new Set(manifest.sources.map((e) => e.id));
  const staleDocs = getDocumentsRaw().filter((d: any) => d.sourceType === 'system_knowledge' && !manifestIds.has(d.id));
  for (const doc of staleDocs) {
    deleteDocument(doc.id);
    logEvent('info', 'system_knowledge_sync', { sourceId: doc.id, status: 'removed_from_manifest' });
  }

  return results;
}

/** Read-only status for every declared source, without ingesting anything. */
export function getSystemKnowledgeStatus(): SystemKnowledgeSourceStatus[] {
  const manifest = loadManifest();
  const docs = getDocumentsRaw();
  return manifest.sources.map((entry) => {
    if (!entry.enabled) return toStatusFromEntry(entry, 'disabled');
    const doc = docs.find((d: any) => d.id === entry.id);
    return doc ? toStatus(doc) : toStatusFromEntry(entry, 'not_ingested');
  });
}

export interface SystemKnowledgePreview {
  sourceId: string;
  extractorId: string;
  normalizationSource: 'auto' | 'override';
  warnings: string[];
  sectionTitles: string[];
  estimatedChunkCount: number;
}

/**
 * Normalize + chunk a source WITHOUT embedding or saving it -- the
 * inspector for "did the extractor make sense of this document's columns
 * and tables" before committing to a full (embedding-costing) sync. Safe to
 * call repeatedly; touches nothing but the normalized-text cache.
 */
export async function previewSystemKnowledgeSource(sourceId: string): Promise<SystemKnowledgePreview> {
  const manifest = loadManifest();
  const entry = manifest.sources.find((e) => e.id === sourceId);
  if (!entry) throw new Error(`Unknown system-knowledge source id: ${sourceId}`);

  const { doc: normalized, normalizationSource } = await resolveSourceText(entry);
  const chunks = await chunkExtractedText(normalized.text, entry.id, entry.name, CHUNKER_DOC_TYPE, entry.version);
  const sectionTitles = Array.from(new Set(chunks.map((c) => c.sectionTitle).filter(Boolean))) as string[];

  return {
    sourceId: entry.id,
    extractorId: normalized.extractorId,
    normalizationSource,
    warnings: normalized.warnings,
    sectionTitles,
    estimatedChunkCount: chunks.length,
  };
}
