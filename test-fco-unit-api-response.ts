// Pure unit test for parseJsonResponse — the Content-Type guard all FCO fetches
// now use (Phase 2). Proves that an HTML/redirect response (e.g. a misconfigured
// proxy or SPA fallback serving index.html) surfaces a clear error instead of an
// opaque JSON.parse crash, and that JSON errors are unwrapped to their message.
//
// Run: npx tsx test-fco-unit-api-response.ts

import { parseJsonResponse } from './src/utils/apiResponse';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

// Minimal Response-like stub (parseJsonResponse only uses ok, headers.get, json, text).
function mockResponse(opts: { ok: boolean; status?: number; contentType: string; json?: any; text?: string }): any {
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? opts.contentType : null) },
    json: async () => opts.json,
    text: async () => opts.text ?? '',
  };
}

async function expectThrows(fn: () => Promise<any>, match: RegExp, msg: string) {
  try {
    await fn();
    assert(false, `${msg} (expected throw, got success)`);
  } catch (e: any) {
    assert(match.test(e?.message || ''), `${msg} — "${e?.message}"`);
  }
}

(async () => {
  console.log('\nHappy path:');
  const okData = await parseJsonResponse(mockResponse({ ok: true, contentType: 'application/json; charset=utf-8', json: { rewrittenSummary: { paragraph: 'x' } } }));
  assert(okData?.rewrittenSummary?.paragraph === 'x', 'ok + application/json returns parsed body');

  console.log('\nHTML returned to a JSON client (the leak the guard catches):');
  await expectThrows(
    () => parseJsonResponse(mockResponse({ ok: true, contentType: 'text/html', text: '<!doctype html><title>App</title>' })),
    /Expected JSON but received text\/html/i,
    'ok + text/html throws a clear "expected JSON" error (not a parse crash)'
  );

  console.log('\nError responses:');
  await expectThrows(
    () => parseJsonResponse(mockResponse({ ok: false, status: 400, contentType: 'application/json', json: { error: 'raw FCO Summary is required.' } })),
    /raw FCO Summary is required\./,
    'non-ok + JSON error unwraps the backend {error} message'
  );
  await expectThrows(
    () => parseJsonResponse(mockResponse({ ok: false, status: 502, contentType: 'text/html', text: '<html>Bad Gateway</html>' })),
    /status 502/,
    'non-ok + HTML throws with status + preview (no parse crash)'
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
