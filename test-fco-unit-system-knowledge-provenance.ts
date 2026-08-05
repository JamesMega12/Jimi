// Pure unit test for retrieval provenance/observability: 'ok', 'empty',
// 'disabled', and 'error' must be distinguishable from each other (this is
// what makes "no relevant guidance found" different from "retrieval never
// ran" different from "retrieval broke" -- previously collapsed into one
// bare console.warn with no trace back to the request). Also asserts the
// structured log line for a real retrieval carries chunk ids/scores but
// never chunk body text, per logger.ts's stated privacy contract.
//
// Uses a SINGLE setupTestKnowledgeEnv() call for the whole file and drives
// state changes (empty -> ok) via rewriteManifest + syncSystemKnowledge,
// not a second setupTestKnowledgeEnv() call: knowledgeBaseService.ts binds
// its data directory once, on first import, and Node's ESM module cache
// means a second `await import(...)` of the same module inside one process
// returns the already-initialized instance -- it would silently keep
// pointing at the FIRST environment's scratch directory, not a new one.
// Offline, no server, no API key -- run: npx tsx test-fco-unit-system-knowledge-provenance.ts
import {
  setupTestKnowledgeEnv,
  rewriteManifest,
  loadSyntheticFixtureSource,
  makeFcoRequest,
  makeAsserter,
} from './test-support/systemKnowledgeTestHarness';

const { assert, finish } = makeAsserter();

async function withCapturedConsole<T>(fn: () => Promise<T>): Promise<{ result: T; logLines: string[] }> {
  const logLines: string[] = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...args: any[]) => logLines.push(args.map(String).join(' '));
  console.warn = (...args: any[]) => logLines.push(args.map(String).join(' '));
  console.error = (...args: any[]) => logLines.push(args.map(String).join(' '));
  try {
    const result = await fn();
    return { result, logLines };
  } finally {
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
  }
}

async function main() {
  console.log("\n'empty' -- no sources declared at all:");
  const env = await setupTestKnowledgeEnv([]);
  const emptyResult = await env.retrievalService.retrieveRelevantChunks(
    makeFcoRequest({ rawSummary: 'Heat the component to 50 degrees Celsius.' }),
    5,
  );
  assert(emptyResult.provenance.status === 'empty', `provenance status is "empty" with no knowledge sources (got "${emptyResult.provenance.status}")`);
  assert(emptyResult.sources.length === 0, 'no sources returned when empty');

  console.log("\n'ok' -- normal indexed retrieval, and log payload must not leak chunk text:");
  rewriteManifest(env, [
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

  const { result: okResult, logLines } = await withCapturedConsole(() =>
    env.retrievalService.retrieveRelevantChunks(makeFcoRequest({ rawSummary: 'Heat the component to 50 degrees Celsius.' }), 5),
  );
  assert(okResult.provenance.status === 'ok', `provenance status is "ok" for a normal retrieval (got "${okResult.provenance.status}")`);
  assert(okResult.provenance.systemSources.length === 1, 'provenance names the searched system source');
  assert(okResult.provenance.systemSources[0].id === 'system-ste-handbook', 'provenance names it by its stable id');
  assert(okResult.provenance.embeddingBackend === 'local-hashed-bow-v1', 'provenance reports the embedding backend actually used');
  assert(okResult.provenance.backendMismatchCount === 0, 'no embedding-backend mismatch for a freshly ingested source');

  const combinedLog = logLines.join('\n');
  assert(combinedLog.includes('knowledge_retrieval'), 'a structured knowledge_retrieval log event was emitted');
  assert(!combinedLog.includes('approx-QX7'), 'log output does not leak the canary chunk body text');
  assert(!combinedLog.includes('degrees Celsius'), 'log output does not leak chunk body text');

  console.log("\n'disabled' -- retrieval-time kill switch:");
  process.env.SYSTEM_KNOWLEDGE_DISABLED = 'true';
  const disabledResult = await env.retrievalService.retrieveRelevantChunks(makeFcoRequest({ rawSummary: 'x' }), 5);
  delete process.env.SYSTEM_KNOWLEDGE_DISABLED;
  assert(disabledResult.provenance.status === 'disabled', `provenance status is "disabled" (got "${disabledResult.provenance.status}")`);

  console.log("\n'error' -- a fault inside the retrieval path must not look like an empty result:");
  // Fault injection: retrieveRelevantChunks reads request.rawSummary /
  // .rawProcedure / .customDirectives inside its try block; a null request
  // throws a plain TypeError there before any network/embedding call is
  // attempted, deterministically and offline. This models "something in the
  // retrieval path broke" without depending on a live/flaky external call.
  const errorResult = await env.retrievalService.retrieveRelevantChunks(null as any, 5);
  assert(errorResult.provenance.status === 'error', `provenance status is "error", not "empty" (got "${errorResult.provenance.status}")`);
  assert(!!errorResult.provenance.error, 'provenance carries an error message');
  assert(errorResult.sources.length === 0, 'no sources are returned on error');

  assert(
    new Set([emptyResult.provenance.status, okResult.provenance.status, disabledResult.provenance.status, errorResult.provenance.status]).size === 4,
    'all four provenance states (empty/ok/disabled/error) are mutually distinguishable',
  );

  finish('system-knowledge retrieval provenance');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
