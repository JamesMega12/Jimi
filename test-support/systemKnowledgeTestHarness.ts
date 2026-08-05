// Shared setup for the test-fco-unit-system-knowledge-*.ts suite.
//
// IMPORTANT ordering constraint: knowledgeBaseService.ts reads
// JIMI_KB_DATA_DIR into a top-level `const DATA_DIR = ...` at module
// evaluation time, and ESM `import` declarations are hoisted ahead of a
// module's own top-level statements -- so a test file that does
//   process.env.JIMI_KB_DATA_DIR = '...';
//   import { getDocuments } from '../src/server/knowledgeBaseService';
// would silently bind DATA_DIR to the *default* (real, committed) path,
// because the import's module evaluation happens before the assignment
// line runs. `setupTestKnowledgeEnv` below sets the env vars first and only
// then reaches the affected modules via `await import(...)`, which -- unlike
// a static import -- is an ordinary expression evaluated exactly where it
// appears. Every test file must go through this helper rather than
// statically importing src/server/{knowledgeBaseService,retrievalService,
// embeddingService,systemKnowledge/*} at the top of the file.
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface TestManifestEntryInput {
  id: string;
  name: string;
  version: string;
  file: string;
  docType: string;
  enabled?: boolean;
  synthetic?: boolean;
  /** Written verbatim to sources/<file>. */
  content: string;
}

export interface TestKnowledgeEnv {
  tmpDir: string;
  systemKnowledgeDir: string;
  kbDataDir: string;
  systemKnowledgeService: typeof import('../src/server/systemKnowledge/systemKnowledgeService');
  retrievalService: typeof import('../src/server/retrievalService');
  knowledgeBaseService: typeof import('../src/server/knowledgeBaseService');
  embeddingService: typeof import('../src/server/embeddingService');
  groundingContextBuilder: typeof import('../src/server/groundingContextBuilder');
}

function writeManifestAndSources(systemKnowledgeDir: string, entries: TestManifestEntryInput[]): void {
  const manifest = { sources: entries.map(({ content, ...rest }) => rest) };
  fs.writeFileSync(path.join(systemKnowledgeDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  for (const entry of entries) {
    fs.writeFileSync(path.join(systemKnowledgeDir, 'sources', entry.file), entry.content, 'utf-8');
  }
}

/**
 * Creates an isolated scratch `data/systemKnowledge/` + `src/server/data/`
 * pair, points the env-var overrides at them, writes a manifest + source
 * files, and returns the service modules bound to that environment. No
 * committed repo data is read or touched. Also forces the local heuristic
 * embedding path (blank GEMINI_API_KEY) so the whole suite is offline,
 * deterministic, and free -- matching test-runner.mjs's existing "pure,
 * no server, no API key" contract for everything it globs.
 */
export async function setupTestKnowledgeEnv(entries: TestManifestEntryInput[]): Promise<TestKnowledgeEnv> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jimi-system-knowledge-test-'));
  const systemKnowledgeDir = path.join(tmpDir, 'systemKnowledge');
  const kbDataDir = path.join(tmpDir, 'kbData');
  fs.mkdirSync(path.join(systemKnowledgeDir, 'sources'), { recursive: true });
  fs.mkdirSync(path.join(systemKnowledgeDir, 'normalized'), { recursive: true });
  fs.mkdirSync(kbDataDir, { recursive: true });

  writeManifestAndSources(systemKnowledgeDir, entries);

  process.env.JIMI_SYSTEM_KNOWLEDGE_DIR = systemKnowledgeDir;
  process.env.JIMI_KB_DATA_DIR = kbDataDir;
  process.env.GEMINI_API_KEY = '';
  delete process.env.SYSTEM_KNOWLEDGE_DISABLED;

  const systemKnowledgeService = await import('../src/server/systemKnowledge/systemKnowledgeService');
  const retrievalService = await import('../src/server/retrievalService');
  const knowledgeBaseService = await import('../src/server/knowledgeBaseService');
  const embeddingService = await import('../src/server/embeddingService');
  const groundingContextBuilder = await import('../src/server/groundingContextBuilder');

  return {
    tmpDir,
    systemKnowledgeDir,
    kbDataDir,
    systemKnowledgeService,
    retrievalService,
    knowledgeBaseService,
    embeddingService,
    groundingContextBuilder,
  };
}

/** Overwrite the manifest + source files mid-test (e.g. for a Case-6 change-detection test). */
export function rewriteManifest(env: TestKnowledgeEnv, entries: TestManifestEntryInput[]): void {
  writeManifestAndSources(env.systemKnowledgeDir, entries);
}

/**
 * Writes only manifest.json, WITHOUT writing any source file content --
 * unlike rewriteManifest, which always writes `entry.content` to
 * `sources/<file>`. Use this to simulate a manifest entry whose declared
 * file is missing on disk (a typo, or a source deleted out from under the
 * app), without also inadvertently creating that file.
 */
export function rewriteManifestOnly(env: TestKnowledgeEnv, entries: Omit<TestManifestEntryInput, 'content'>[]): void {
  const manifest = { sources: entries };
  fs.writeFileSync(path.join(env.systemKnowledgeDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
}

export function makeFcoRequest(overrides: Record<string, unknown> = {}): any {
  return {
    rawSummary: '',
    rawProcedure: '',
    customDirectives: '',
    ...overrides,
  };
}

/**
 * Reads the actual committed synthetic fixture text rather than a duplicated
 * copy, so these tests exercise (and fail loudly against) the real file
 * content instead of a copy that could silently drift from it.
 */
export function loadSyntheticFixtureSource(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'data', 'systemKnowledge', 'sources', 'synthetic-ste-fixture-v1.md'),
    'utf-8',
  );
}

/** Assert helper matching the house style used by the other test-fco-unit-*.ts files. */
export function makeAsserter() {
  let passed = 0;
  let failed = 0;
  const assert = (cond: boolean, msg: string) => {
    if (cond) {
      passed++;
      console.log(`  ✓ ${msg}`);
    } else {
      failed++;
      console.error(`  ✗ ${msg}`);
    }
  };
  const finish = (label: string) => {
    console.log(`\n${passed}/${passed + failed} passed -- ${label}`);
    process.exit(failed ? 1 : 0);
  };
  return { assert, finish };
}
