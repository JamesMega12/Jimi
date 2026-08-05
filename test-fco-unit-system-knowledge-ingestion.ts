// Pure unit test for system-knowledge ingestion: chunks are created with a
// real heading-derived section title (not the "General Guidelines"
// catch-all every legacy PDF/DOCX upload collapses to -- see
// sourceNormalizer.ts's doc comment for why), metadata is retained, the
// document id stays stable across re-ingests, and a content hash is
// recorded. Offline, no server, no API key -- run: npx tsx test-fco-unit-system-knowledge-ingestion.ts
import {
  setupTestKnowledgeEnv,
  loadSyntheticFixtureSource,
  makeAsserter,
} from './test-support/systemKnowledgeTestHarness';

const { assert, finish } = makeAsserter();

async function main() {
  const env = await setupTestKnowledgeEnv([
    {
      id: 'system-ste-handbook',
      name: 'Synthetic STE Test Guide',
      version: 'synthetic-1.0.0',
      file: 'synthetic-ste-fixture-v1.md',
      docType: 'STE Handbook',
      enabled: true,
      synthetic: true,
      content: loadSyntheticFixtureSource(),
    },
  ]);

  console.log('\nFirst sync (fresh ingest):');
  const results = await env.systemKnowledgeService.syncSystemKnowledge();
  assert(results.length === 1, 'sync returns one result for one manifest entry');
  const result = results[0];
  assert(result.status === 'indexed', `status is indexed (got ${result.status}: ${result.errorMessage || ''})`);
  assert(result.chunkCount > 0, `chunkCount is > 0 (got ${result.chunkCount})`);
  assert(!!result.contentHash && result.contentHash.length === 64, 'contentHash is a sha256 hex digest');
  assert(result.synthetic === true, 'synthetic flag is true for this fixture');

  const chunks = env.knowledgeBaseService.getChunks().filter((c: any) => c.documentId === 'system-ste-handbook');
  assert(chunks.length === result.chunkCount, 'stored chunk count matches reported chunkCount');

  const unitsChunk = chunks.find((c: any) => /degrees celsius/i.test(c.text));
  assert(!!unitsChunk, 'a chunk containing the temperature rule exists');
  assert(
    !!unitsChunk && unitsChunk.sectionTitle !== 'General Guidelines',
    `temperature-rule chunk has a real section title, not the catch-all (got "${unitsChunk?.sectionTitle}")`,
  );
  assert(
    !!unitsChunk && /units/i.test(unitsChunk.sectionTitle || ''),
    `temperature-rule chunk's section title reflects its actual heading (got "${unitsChunk?.sectionTitle}")`,
  );

  const canaryChunk = chunks.find((c: any) => c.text.includes('approx-QX7'));
  assert(!!canaryChunk, 'a chunk containing the canary token exists');

  chunks.forEach((c: any) => {
    assert(c.documentId === 'system-ste-handbook', `chunk ${c.id} carries its documentId`);
    assert(c.sourceType === 'system_knowledge', `chunk ${c.id} is tagged sourceType=system_knowledge`);
    assert(Array.isArray(c.embedding) && c.embedding.length > 0, `chunk ${c.id} has a non-empty embedding`);
  });

  const docs = env.knowledgeBaseService.getDocumentsRaw();
  const doc = docs.find((d: any) => d.id === 'system-ste-handbook');
  assert(!!doc, 'KBDocument record exists for the system source');
  assert(doc?.status === 'indexed', `KBDocument raw status is indexed (got "${doc?.status}")`);

  console.log('\nSecond sync (no changes -- must be idempotent and keep the same id/hash):');
  const secondResults = await env.systemKnowledgeService.syncSystemKnowledge();
  assert(secondResults[0].id === result.id, 'document id is stable across re-ingests');
  assert(secondResults[0].contentHash === result.contentHash, 'content hash is stable when the source is unchanged');

  finish('system-knowledge ingestion');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
