// Phase A assertions: provider-call timeout + pipeline error responder.
// Run: npx tsx test-ai-timeout.ts   (pure, real timers, no server/key)

import { withTimeout, ProviderTimeoutError, sendPipelineError, AI_TIMEOUT_MS } from "./src/server/aiCall";

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}
const delay = <T>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const reject = (ms: number, e: any) => new Promise((_, r) => setTimeout(() => r(e), ms));

(async () => {
  console.log("\nwithTimeout:");
  assert((await withTimeout(delay(10, "ok"), 100)) === "ok", "resolves when the promise beats the timeout");

  let timedOut = false, aborted = false;
  try {
    await withTimeout(delay(100, "late"), 15, () => { aborted = true; });
  } catch (e) {
    timedOut = e instanceof ProviderTimeoutError;
  }
  assert(timedOut, "rejects with ProviderTimeoutError when the timeout wins");
  assert(aborted, "fires onTimeout (abort) on timeout");

  // A late rejection after the timeout must not crash the process (unhandledRejection).
  let sawUnhandled = false;
  const onUnhandled = () => { sawUnhandled = true; };
  process.on("unhandledRejection", onUnhandled);
  try { await withTimeout(reject(20, new Error("late boom")) as Promise<string>, 5); } catch { /* expected timeout */ }
  await delay(60, null); // let the loser reject
  process.off("unhandledRejection", onUnhandled);
  assert(!sawUnhandled, "a post-timeout rejection does not surface as unhandledRejection");

  console.log("\nProviderTimeoutError:");
  const err = new ProviderTimeoutError(AI_TIMEOUT_MS);
  assert(err.name === "ProviderTimeoutError" && (err as any).code === "provider_timeout", "carries name + code");
  assert(/timed out/i.test(err.message), "human-readable message");

  console.log("\nsendPipelineError (status mapping + no body leak):");
  function mockRes() {
    return { _s: 0 as number, _j: null as any, status(n: number) { this._s = n; return this; }, json(o: any) { this._j = o; } };
  }
  const r1 = mockRes();
  sendPipelineError(r1 as any, new ProviderTimeoutError(), "Announcement");
  assert(r1._s === 504 && r1._j.code === "provider_timeout", "timeout => 504 with code");
  const r2 = mockRes();
  sendPipelineError(r2 as any, new Error("Unexpected token < in JSON"), "Technical Alert");
  assert(r2._s === 502 && r2._j.error === "Unexpected token < in JSON" && r2._j.code === undefined, "other error => 502, message passed, no code");

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
