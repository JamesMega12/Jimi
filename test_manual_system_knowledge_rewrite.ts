// Manual, live-model integration check for the system-knowledge source --
// NOT part of `npm test` / test-runner.mjs (its glob only picks up
// test-fco-unit-*.ts / test-announcement-*.ts / test-technical-alert-v2-*.ts /
// test-ai-timeout.ts; this file's underscore-prefixed name is deliberately
// outside that pattern). Requires:
//   1. A running dev server (`npm run dev`) with a real GEMINI_API_KEY set.
//   2. The synthetic system-knowledge fixture already synced (it is, by
//      default, via the server's own bootstrap -- `npm run knowledge:status`
//      to confirm).
//
// Run: npx tsx test_manual_system_knowledge_rewrite.ts
//
// Why this exists (see docs/SYSTEM_KNOWLEDGE.md): the automated suite proves
// retrieval, chunk identity, source metadata, and context assembly
// deterministically, without a live model. It cannot prove that a live
// rewrite actually *used* what was retrieved -- the model might independently
// know "degC" is a valid abbreviation. This script prints the model's raw
// output NEXT TO the retrieval provenance for the same request, so a human
// can judge whether the output plausibly came from the retrieved guidance
// (especially the canary case, where "approx-QX7" cannot come from anywhere
// but this synthetic source) rather than trusting output text alone.
const BASE_URL = process.env.JIMI_BASE_URL || 'http://localhost:3000';

interface Case {
  label: string;
  rawSummary: string;
  expectSubstring?: string;
}

const CASES: Case[] = [
  {
    label: 'Case 1: temperature style rule',
    rawSummary: 'Heat the component to 50 degrees Celsius before installation.',
    expectSubstring: 'degC',
  },
  {
    label: 'Case 2: canary rule (strongest proof of retrieval)',
    rawSummary: 'The reading was approximately stable throughout the test; record the approximate value.',
    expectSubstring: 'approx-QX7',
  },
  {
    label: 'Case 4: non-applicable content',
    rawSummary: 'Replace the mounting bracket and torque the four retaining bolts to spec.',
  },
];

async function runCase(c: Case) {
  console.log(`\n=== ${c.label} ===`);
  console.log(`Input: "${c.rawSummary}"`);

  const res = await fetch(`${BASE_URL}/api/fco/rewrite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawSummary: c.rawSummary,
      rawProcedure: 'Step 1. Perform the described action. Step 2. Confirm completion.',
      customDirectives: '',
      title: 'Manual system-knowledge check',
      priority: 'Required',
    }),
  });

  if (!res.ok) {
    console.error(`FAILED: HTTP ${res.status}`);
    return;
  }

  const data: any = await res.json();
  const grounding = data.grounding || {};
  const rewrittenText = JSON.stringify(data.rewrittenSummary || {});

  console.log('--- Retrieval provenance (independent of model output) ---');
  console.log('  retrievalStatus:      ', grounding.retrievalStatus);
  console.log('  usedSystemKnowledge:  ', grounding.usedSystemKnowledge);
  console.log('  systemKnowledge.status:', grounding.systemKnowledge?.status);
  console.log('  systemKnowledge.sources:', JSON.stringify(grounding.systemKnowledge?.sources));
  console.log('  retrievedSources:      ', JSON.stringify((grounding.retrievedSources || []).map((s: any) => ({ doc: s.documentName, section: s.sectionTitle, score: s.relevanceScore, system: s.isSystemKnowledge }))));
  console.log('  retrievalWarnings:     ', JSON.stringify(grounding.retrievalWarnings));

  console.log('--- Model output ---');
  console.log(' ', rewrittenText.slice(0, 500));

  if (c.expectSubstring) {
    const foundInOutput = rewrittenText.includes(c.expectSubstring);
    const foundInRetrieval = (grounding.retrievedSources || []).some((s: any) => s.sectionTitle && grounding.systemKnowledge?.status === 'ok');
    console.log(`--- Judgement ---`);
    console.log(`  Output contains "${c.expectSubstring}": ${foundInOutput}`);
    console.log(`  Retrieval independently found relevant system-knowledge chunks: ${foundInRetrieval}`);
    if (foundInOutput && !foundInRetrieval) {
      console.log('  ⚠ Output matched but retrieval did NOT run/find anything -- this would NOT be retrieval evidence (could be base-model knowledge, or coincidence for the canary case).');
    } else if (foundInOutput && foundInRetrieval) {
      console.log('  ✓ Output matches AND retrieval independently surfaced the relevant chunk -- consistent with retrieval-grounded output.');
    } else {
      console.log('  Output did not contain the expected token this run -- inspect the model output above.');
    }
  } else {
    const leaked = rewrittenText.includes('degC') || rewrittenText.includes('approx-QX7');
    console.log(`--- Judgement ---`);
    console.log(`  Unrelated output leaked a synthetic-fixture token: ${leaked} (expected: false)`);
  }
}

async function main() {
  console.log(`Target: ${BASE_URL}`);
  for (const c of CASES) {
    await runCase(c);
  }
  console.log('\nDone. This script does not assert/exit non-zero -- read the judgement lines above.');
}

main().catch((err) => {
  console.error('FATAL (is the dev server running with npm run dev?):', err);
  process.exit(1);
});
