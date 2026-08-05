// Pure unit test for Proof Case 3 (retrieval-disabled control):
// SYSTEM_KNOWLEDGE_DISABLED=true must produce an observable "disabled"
// state, an empty result set, and no claim of grounding -- and must NOT
// touch the persisted index (a safe, reversible test mechanism, not a
// destructive one). If the model happened to already know "degC" or
// produced the canary token independently, that would NOT be retrieval
// evidence; this test only asserts the retrieval-layer contract, which is
// what makes that distinction possible for a caller.
// Offline, no server, no API key -- run: npx tsx test-fco-unit-system-knowledge-disabled.ts
import {
  setupTestKnowledgeEnv,
  loadSyntheticFixtureSource,
  makeFcoRequest,
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
  await env.systemKnowledgeService.syncSystemKnowledge();

  const statusBefore = env.systemKnowledgeService.getSystemKnowledgeStatus();
  assert(statusBefore[0].status === 'indexed', 'source is indexed before the kill switch is flipped');
  const chunkCountBefore = statusBefore[0].chunkCount;

  console.log('\nSYSTEM_KNOWLEDGE_DISABLED=true:');
  process.env.SYSTEM_KNOWLEDGE_DISABLED = 'true';
  try {
    const disabledResult = await env.retrievalService.retrieveRelevantChunks(
      makeFcoRequest({ rawSummary: 'Heat the component to 50 degrees Celsius.' }),
      5,
    );
    assert(disabledResult.provenance.status === 'disabled', `provenance status is "disabled" (got "${disabledResult.provenance.status}")`);
    assert(disabledResult.sources.length === 0, 'no chunks are returned while disabled');
    assert(disabledResult.provenance.systemSources.length === 0, 'no system sources are reported as searched while disabled');

    const context = env.groundingContextBuilder.buildGroundingPromptContext(disabledResult.sources);
    assert(context === '', 'assembled grounding context is empty while disabled -- nothing to claim STE support from');
    assert(!context.includes('degC'), 'disabled context does not leak the temperature rule');
    assert(!context.includes('approx-QX7'), 'disabled context does not leak the canary token');
  } finally {
    delete process.env.SYSTEM_KNOWLEDGE_DISABLED;
  }

  console.log('\nRe-enabled (kill switch is retrieval-time only, must not have mutated the index):');
  const reenabledResult = await env.retrievalService.retrieveRelevantChunks(
    makeFcoRequest({ rawSummary: 'Heat the component to 50 degrees Celsius.' }),
    5,
  );
  assert(reenabledResult.provenance.status === 'ok', 'provenance returns to "ok" once re-enabled');
  assert(
    reenabledResult.sources.some((s: any) => /degc/i.test(s.text)),
    'the same rule is retrievable again immediately -- no re-ingestion was needed',
  );

  const statusAfter = env.systemKnowledgeService.getSystemKnowledgeStatus();
  assert(statusAfter[0].chunkCount === chunkCountBefore, 'chunk count is unchanged -- disabling did not mutate the persisted index');
  assert(statusAfter[0].contentHash === statusBefore[0].contentHash, 'content hash is unchanged -- disabling did not trigger re-ingestion');

  finish('system-knowledge retrieval-disabled control (Case 3)');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
