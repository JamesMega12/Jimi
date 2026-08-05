import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SystemKnowledgeManifest, SystemKnowledgeManifestEntry } from './types';

/**
 * Path layout for the system-knowledge declaration, mirroring the existing
 * `data/instructionPacks/` convention (a committed registry + per-item
 * files, rather than the ad-hoc `src/server/data/` JSON blobs used by the
 * legacy user-upload KB path). `JIMI_SYSTEM_KNOWLEDGE_DIR` lets tests point
 * at a scratch directory instead of the real one.
 */
function rootDir(): string {
  return process.env.JIMI_SYSTEM_KNOWLEDGE_DIR
    ? path.resolve(process.env.JIMI_SYSTEM_KNOWLEDGE_DIR)
    : path.join(process.cwd(), 'data', 'systemKnowledge');
}

export function manifestFile(): string {
  return path.join(rootDir(), 'manifest.json');
}

export function sourcesDir(): string {
  return path.join(rootDir(), 'sources');
}

export function normalizedDir(): string {
  return path.join(rootDir(), 'normalized');
}

export function loadManifest(): SystemKnowledgeManifest {
  const file = manifestFile();
  if (!fs.existsSync(file)) return { sources: [] };
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err: any) {
    throw new Error(`Failed to parse system-knowledge manifest at ${file}: ${err.message || err}`);
  }
  const sources = Array.isArray(parsed?.sources) ? parsed.sources : [];
  for (const entry of sources) {
    if (!entry.id || !entry.file || !entry.name || !entry.version) {
      throw new Error(
        `Invalid system-knowledge manifest entry (needs id, name, version, file): ${JSON.stringify(entry)}`,
      );
    }
  }
  return { sources };
}

export function resolveSourcePath(entry: SystemKnowledgeManifestEntry): string {
  return path.join(sourcesDir(), entry.file);
}

export function normalizedPathsFor(entry: SystemKnowledgeManifestEntry): { normalized: string; override: string } {
  const base = path.parse(entry.file).name;
  return {
    normalized: path.join(normalizedDir(), `${base}.normalized.md`),
    override: path.join(normalizedDir(), `${base}.override.md`),
  };
}

export function ensureNormalizedDir(): void {
  const dir = normalizedDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function hashText(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}
