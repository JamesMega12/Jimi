// Pure unit test: the local heuristic fallback must emit diagnostics that mark
// the output as NON-AI, so the client (Phase 2 badge) and DOCX banner can flag
// it. Guards against a regression of the bug where the split rewrite routes
// returned a fallback draft with no diagnostics at all (invisible fallback).
//
// Run directly: npx tsx test-fco-unit-fallback-diagnostics.ts

import { runLocalHeuristic } from './src/server/fallbackEngine';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
  else { console.log(`  ✓ ${msg}`); }
}

const reqData: any = {
  title: 'SLB-400 O-ring upgrade',
  rawSummary: 'The O-ring fails and leaks. Replace with a Viton O-ring to improve reliability.',
  rawProcedure: 'Remove the old O-ring. Install the Viton O-ring. Verify no leaks.',
  changeType: '',
  rewriteScope: 'summary',
  fcoDraft: { technicalContent: {} },
};

const out: any = runLocalHeuristic(reqData, 'Gemini call failed');

assert(!!out.diagnostics, 'fallback response includes a diagnostics object');
assert(out.diagnostics?.engineUsed === 'local_fallback', "engineUsed is 'local_fallback'");
assert(out.diagnostics?.fallbackUsed === true, 'fallbackUsed is true');
assert(
  typeof out.diagnostics?.fallbackReason === 'string' && out.diagnostics.fallbackReason.length > 0,
  'fallbackReason is populated (surfaced to the user)'
);
assert(!!out.rewrittenSummary, 'fallback still returns a rewrittenSummary payload');

console.log(`\nfco fallback diagnostics: ${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
process.exit(failures ? 1 : 0);
