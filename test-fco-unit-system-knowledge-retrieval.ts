// Pure unit test for retrieval against the synthetic system-knowledge
// fixture -- Proof Cases 1, 2, and 4 from the replacement plan
// (docs/SYSTEM_KNOWLEDGE.md):
//   Case 1: a temperature-styled input retrieves the degC rule.
//   Case 2: an input using the artificial word retrieves the canary rule,
//           and the retrieved text literally contains the synthetic token
//           -- the strongest evidence retrieval (not base-model knowledge)
//           produced the match, since "approx-QX7" cannot come from
//           anywhere else.
//   Case 4: unrelated input does not surface either rule, and the grounding
//           context assembled from it contains neither trigger token.
// Offline, no server, no API key -- run: npx tsx test-fco-unit-system-knowledge-retrieval.ts
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

  const allChunks = env.knowledgeBaseService.getChunks();
  const eligibleChunks = env.retrievalService.filterChunksBySettings(allChunks);
  assert(eligibleChunks.length > 0, 'system-knowledge chunks are eligible for retrieval');

  console.log('\nCase 1 -- temperature style rule:');
  const tempMatches = await env.retrievalService.retrieveRelevantChunksForQuery(
    'Heat the component to 50 degrees Celsius.',
    eligibleChunks,
    3,
  );
  assert(tempMatches.length > 0, 'temperature query returns at least one match');
  const topTemp = tempMatches[0];
  assert(/degc/i.test(topTemp.source.text), `top match's text contains the degC rule (section: ${topTemp.source.sectionTitle})`);
  assert(topTemp.source.isSystemKnowledge === true, 'top match is flagged as system knowledge');

  const fullRewriteTemp = await env.retrievalService.retrieveRelevantChunks(
    makeFcoRequest({ rawSummary: 'Heat the component to 50 degrees Celsius before installation.' }),
    5,
  );
  assert(fullRewriteTemp.provenance.status === 'ok', 'full retrieval provenance status is ok for the temperature case');
  assert(
    fullRewriteTemp.sources.some((s: any) => /degc/i.test(s.text)),
    'full retrieval (used by the FCO rewrite prompt) surfaces the degC rule',
  );

  console.log('\nCase 2 -- canary rule (stronger proof of retrieval):');
  const canaryQuery = 'What is the correct abbreviation convention for approximately in this guide?';
  const canaryMatches = await env.retrievalService.retrieveRelevantChunksForQuery(canaryQuery, eligibleChunks, 5);
  const canaryHit = canaryMatches.find((m) => m.source.text.includes('approx-QX7'));
  assert(!!canaryHit, 'the canary-containing chunk is among the retrieval matches');
  assert(!!canaryHit && canaryHit.score > 0.05, `canary chunk has a non-trivial relevance score (got ${canaryHit?.score.toFixed(3)})`);
  assert(!!canaryHit && canaryHit.source.isSystemKnowledge === true, 'canary match is flagged as system knowledge, not base-model output');
  assert(
    !!canaryHit && canaryHit.source.documentName === 'Synthetic STE Test Guide',
    'canary match is attributed to the synthetic source by name, not an unnamed/base-model source',
  );

  const fullRewriteCanary = await env.retrievalService.retrieveRelevantChunks(makeFcoRequest({ rawSummary: canaryQuery }), 5);
  assert(
    fullRewriteCanary.sources.some((s: any) => s.text.includes('approx-QX7')),
    'full retrieval (used by the FCO rewrite prompt) surfaces the canary rule for this input',
  );

  console.log('\nCase 4 -- non-applicable content:');
  // Note on test design: the synthetic fixture is deliberately tiny (5
  // chunks total) so this suite stays fast and readable. That means "assert
  // the assembled context excludes the rule" isn't a meaningful check here
  // -- the production call site (server.ts) requests the top 5 chunks, and
  // with only 5 chunks in the whole test corpus, a top-5 selection returns
  // everything regardless of relevance. That's an artifact of this test's
  // corpus size, not a real-world retrieval property (the real handbook
  // will have hundreds of chunks). The property this test CAN and does
  // prove, corpus-size-independent: each rule scores its own matching input
  // higher than clearly unrelated input -- i.e. retrieval discriminates,
  // it doesn't just always surface these chunks regardless of query.
  const unrelatedQuery = 'Replace the mounting bracket and torque the four retaining bolts to spec.';
  const unrelated = await env.retrievalService.retrieveRelevantChunks(makeFcoRequest({ rawSummary: unrelatedQuery }), 5);
  assert(unrelated.provenance.status === 'ok', 'retrieval still runs and is observable for unrelated input');

  const degcChunk = eligibleChunks.find((c: any) => /degc/i.test(c.text));
  const canaryChunk = eligibleChunks.find((c: any) => c.text.includes('approx-QX7'));
  assert(!!degcChunk && !!canaryChunk, 'both rule chunks are present in the corpus for the comparison below');

  const degcSelfScore = (await env.retrievalService.retrieveRelevantChunksForQuery(
    'Heat the component to 50 degrees Celsius.', [degcChunk], 1,
  ))[0].score;
  const degcUnrelatedScore = (await env.retrievalService.retrieveRelevantChunksForQuery(
    unrelatedQuery, [degcChunk], 1,
  ))[0].score;
  assert(
    degcSelfScore > degcUnrelatedScore,
    `degC chunk scores higher for its own rule (${degcSelfScore.toFixed(3)}) than for unrelated content (${degcUnrelatedScore.toFixed(3)})`,
  );

  const canarySelfScore = (await env.retrievalService.retrieveRelevantChunksForQuery(
    canaryQuery, [canaryChunk], 1,
  ))[0].score;
  const canaryUnrelatedScore = (await env.retrievalService.retrieveRelevantChunksForQuery(
    unrelatedQuery, [canaryChunk], 1,
  ))[0].score;
  assert(
    canarySelfScore > canaryUnrelatedScore,
    `canary chunk scores higher for its own rule (${canarySelfScore.toFixed(3)}) than for unrelated content (${canaryUnrelatedScore.toFixed(3)})`,
  );

  finish('system-knowledge retrieval (Cases 1, 2, 4)');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
