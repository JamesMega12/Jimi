// Aggregate runner for the pure (no server, no API key) assertion suites, wired
// to `npm test`. Globs the Announcement, Technical Alert v2, and reliability
// test files and runs each in its own process (the scripts call process.exit,
// so they must be isolated), aggregating exit codes.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const PATTERN = /^(test-announcement-.*|test-technical-alert-v2-.*|test-fco-unit-.*|test-ai-timeout)\.ts$/;
const files = readdirSync(".").filter((f) => PATTERN.test(f)).sort();

let failed = 0;
for (const f of files) {
  const r = spawnSync("npx", ["tsx", f], { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    failed++;
    console.error(`\n>>> FAILED: ${f}\n`);
  }
}

console.log(`\n${files.length - failed}/${files.length} test files passed.`);
process.exit(failed ? 1 : 0);
