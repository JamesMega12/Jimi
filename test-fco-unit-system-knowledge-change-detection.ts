// Pure unit test for Proof Case 6 (changed-source re-ingestion):
//   - Syncing an unchanged source is a no-op: status/hash/indexedAt/chunk
//     ids are untouched, and nothing is re-embedded.
//   - Mutating the source content changes the recorded hash, triggers
//     re-ingestion automatically (no --force needed), replaces the chunk
//     set atomically so stale chunks from the old version cannot linger,
//     and advances indexedAt.
// Offline, no server, no API key -- run: npx tsx test-fco-unit-system-knowledge-change-detection.ts
import {
  setupTestKnowledgeEnv,
  rewriteManifest,
  rewriteManifestOnly,
  loadSyntheticFixtureSource,
  makeAsserter,
} from './test-support/systemKnowledgeTestHarness';

const { assert, finish } = makeAsserter();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const originalContent = loadSyntheticFixtureSource();
  const baseEntry = {
    id: 'system-ste-handbook',
    name: 'Synthetic STE Test Guide',
    version: 'synthetic-1.0.0',
    file: 'synthetic-ste-fixture-v1.md',
    docType: 'STE Handbook',
    enabled: true,
    synthetic: true,
  };

  const env = await setupTestKnowledgeEnv([{ ...baseEntry, content: originalContent }]);

  console.log('\nInitial ingest:');
  const first = (await env.systemKnowledgeService.syncSystemKnowledge())[0];
  assert(first.status === 'indexed', `initial ingest succeeded (got ${first.status}: ${first.errorMessage || ''})`);

  await wait(5); // guarantee a distinct indexedAt timestamp for the mutated-source run below

  console.log('\nRe-sync with no changes (must skip, not reprocess):');
  const unchanged = (await env.systemKnowledgeService.syncSystemKnowledge())[0];
  assert(unchanged.status === 'indexed', 'status stays indexed on a no-op sync');
  assert(unchanged.contentHash === first.contentHash, 'content hash is unchanged');
  assert(unchanged.indexedAt === first.indexedAt, 'indexedAt is untouched -- proves nothing was reprocessed');
  assert(unchanged.chunkCount === first.chunkCount, 'chunk count is unchanged');

  await wait(5);

  console.log('\nMutate source content + bump version, re-sync (no --force):');
  const mutatedContent = originalContent.replace('approx-QX7', 'approx-QX7-v2').replace('synthetic-1.0.0', 'synthetic-1.1.0');
  rewriteManifest(env, [{ ...baseEntry, version: 'synthetic-1.1.0', content: mutatedContent }]);

  const second = (await env.systemKnowledgeService.syncSystemKnowledge())[0];
  assert(second.status === 'indexed', `mutated source re-ingested (got ${second.status}: ${second.errorMessage || ''})`);
  assert(second.contentHash !== first.contentHash, 'content hash changed after mutation');
  assert(second.indexedAt !== first.indexedAt, 'indexedAt advanced -- proves the change was detected and reprocessed');
  assert(second.version === 'synthetic-1.1.0', 'active version reflects the manifest bump');

  const secondChunks = env.knowledgeBaseService.getChunks().filter((c: any) => c.documentId === 'system-ste-handbook');
  assert(
    !secondChunks.some((c: any) => c.text.includes('approx-QX7') && !c.text.includes('approx-QX7-v2')),
    'the OLD canary text is gone -- stale chunks from the previous version did not linger',
  );
  assert(
    secondChunks.some((c: any) => c.text.includes('approx-QX7-v2')),
    'the NEW canary text is present',
  );

  console.log('\nRe-sync again with no further changes (must skip the mutated version too):');
  const stillUnchanged = (await env.systemKnowledgeService.syncSystemKnowledge())[0];
  assert(stillUnchanged.indexedAt === second.indexedAt, 'a second no-op sync after the mutation also skips reprocessing');

  console.log('\nA failed re-ingest attempt must not erase what is still being served:');
  // Point the manifest at a file that does not exist -- a deterministic,
  // offline way to force resolveSourceText() to throw (no live embedding
  // call needed), simulating e.g. a manifest typo or a source file deleted
  // out from under the app. rewriteManifestOnly (unlike rewriteManifest)
  // does NOT write any source file content, so the referenced file
  // genuinely does not exist on disk.
  rewriteManifestOnly(env, [{ ...baseEntry, version: 'synthetic-1.1.0', file: 'this-file-does-not-exist.md' }]);
  const broken = (await env.systemKnowledgeService.syncSystemKnowledge())[0];
  assert(broken.status === 'failed', `sync reports failure (got ${broken.status})`);
  assert(!!broken.errorMessage, 'failure carries an error message');
  assert(broken.chunkCount === second.chunkCount, `chunkCount still reflects the last GOOD ingest, not zeroed out (got ${broken.chunkCount}, expected ${second.chunkCount})`);
  assert(broken.contentHash === second.contentHash, 'contentHash still reflects the last GOOD ingest');
  assert(broken.indexedAt === second.indexedAt, 'indexedAt still reflects the last GOOD ingest -- nothing was silently replaced');
  assert(!!broken.lastAttemptedAt, 'a separate lastAttemptedAt records that a (failed) attempt happened');

  const chunksAfterFailure = env.knowledgeBaseService.getChunks().filter((c: any) => c.documentId === 'system-ste-handbook');
  assert(chunksAfterFailure.length === second.chunkCount, 'the previously-indexed chunks are still physically present after a failed re-ingest');
  assert(
    chunksAfterFailure.some((c: any) => c.text.includes('approx-QX7-v2')),
    'those chunks are still retrievable content from the last good version, not orphaned garbage',
  );

  console.log('\nFixing the manifest recovers to indexed:');
  rewriteManifest(env, [{ ...baseEntry, version: 'synthetic-1.1.0', content: mutatedContent }]);
  const recovered = (await env.systemKnowledgeService.syncSystemKnowledge())[0];
  assert(recovered.status === 'indexed', `sync recovers once the source is fixed (got ${recovered.status})`);

  finish('system-knowledge changed-source re-ingestion (Case 6)');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
