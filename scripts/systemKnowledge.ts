// CLI for the system-owned knowledge source, independent of the running
// dev server -- lets `npm run knowledge:*` ingest/inspect the approved
// handbook (or its synthetic stand-in) without going through the UI.
// Run via `npx tsx scripts/systemKnowledge.ts <command>` or the npm scripts
// `knowledge:sync` / `knowledge:status` / `knowledge:convert`.
import dotenv from 'dotenv';
import path from 'path';
import {
  syncSystemKnowledge,
  getSystemKnowledgeStatus,
  previewSystemKnowledgeSource,
} from '../src/server/systemKnowledge/systemKnowledgeService';
import { loadManifest } from '../src/server/systemKnowledge/manifest';
import { SystemKnowledgeSourceStatus } from '../src/server/systemKnowledge/types';

// Same env-loading convention as server.ts: real .env first, then fall back
// to .env.example (which has blank values) so scripts behave the same way
// with or without a key -- sync/status work either way; only the Gemini
// embedding call inside `sync` needs a real key to use it instead of the
// local heuristic fallback.
dotenv.config({ override: true });
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY' || process.env.GEMINI_API_KEY.trim() === '') {
  dotenv.config({ path: path.join(process.cwd(), '.env.example'), override: true });
}

function printStatusTable(results: SystemKnowledgeSourceStatus[]) {
  if (results.length === 0) {
    console.log('(no system-knowledge sources declared in data/systemKnowledge/manifest.json)');
    return;
  }
  for (const r of results) {
    console.log(`- ${r.id} [${r.status}] v${r.version} chunks=${r.chunkCount}${r.synthetic ? ' (SYNTHETIC)' : ''}`);
    if (r.contentHash) {
      console.log(`    hash=${r.contentHash.slice(0, 12)} backend=${r.embeddingBackend || '-'} indexedAt=${r.indexedAt || '-'}`);
    }
    if (r.normalizationWarnings && r.normalizationWarnings.length > 0) {
      console.log(`    warnings: ${r.normalizationWarnings.join(', ')}`);
    }
    if (r.errorMessage) {
      console.log(`    ERROR: ${r.errorMessage}`);
    }
  }
}

async function runSync(args: string[]) {
  const force = args.includes('--force');
  const results = await syncSystemKnowledge({ force });
  printStatusTable(results);
  if (results.some((r) => r.status === 'failed')) process.exitCode = 1;
}

async function runStatus() {
  printStatusTable(getSystemKnowledgeStatus());
}

async function runConvert(args: string[]) {
  const manifest = loadManifest();
  const targetId = args.find((a) => !a.startsWith('--'));
  const entries = targetId ? manifest.sources.filter((e) => e.id === targetId) : manifest.sources;

  if (entries.length === 0) {
    console.error(targetId ? `No manifest source with id "${targetId}".` : 'No sources declared in manifest.json.');
    process.exitCode = 1;
    return;
  }

  for (const entry of entries) {
    console.log(`\nConverting "${entry.id}" (${entry.file})...`);
    try {
      const preview = await previewSystemKnowledgeSource(entry.id);
      console.log(`  extractor: ${preview.extractorId} (source: ${preview.normalizationSource})`);
      console.log(`  estimated chunks: ${preview.estimatedChunkCount}`);
      console.log(`  sections detected: ${preview.sectionTitles.length ? preview.sectionTitles.join(', ') : '(none)'}`);
      if (preview.warnings.length > 0) {
        console.log(`  WARNINGS: ${preview.warnings.join(', ')}`);
      }
      console.log('  -> normalized text written to data/systemKnowledge/normalized/ -- read it, and if extraction');
      console.log('     mangled a column or table, copy it to a matching .override.md and hand-correct.');
    } catch (err: any) {
      console.error(`  FAILED: ${err.message || err}`);
      process.exitCode = 1;
    }
  }
}

async function main() {
  const [, , command, ...args] = process.argv;
  switch (command) {
    case 'sync':
      await runSync(args);
      break;
    case 'status':
      await runStatus();
      break;
    case 'convert':
      await runConvert(args);
      break;
    default:
      console.log(
        'Usage:\n' +
          '  npx tsx scripts/systemKnowledge.ts sync [--force]\n' +
          '  npx tsx scripts/systemKnowledge.ts status\n' +
          '  npx tsx scripts/systemKnowledge.ts convert [sourceId]',
      );
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
