const fs = require('fs');
const file = 'src/server/validationService.ts';
let content = fs.readFileSync(file, 'utf8');

const target1 = `  // 2. Summary Grammar and Word Limit Validation`;
const replace1 = `  // 2. Summary Grammar and Word Limit Validation
  let summaryWordLimitPassed = true;
  if (scope === 'full' || scope === 'summary') {`;

const target2 = `  if (totalSummaryWords > 150) {
    errors.push(\`Summary total word count of \${totalSummaryWords} exceeds the strict limit of 150 words.\`);
  }`;
const replace2 = `  if (totalSummaryWords > 150) {
    errors.push(\`Summary total word count of \${totalSummaryWords} exceeds the strict limit of 150 words.\`);
  }
  }`; // close the if scope == 'full' || 'summary' block

const target3 = `  // 3. Section and Change Type Alignment Checklist`;
const replace3 = `  // 3. Section and Change Type Alignment Checklist
  if (scope === 'full' || scope === 'procedure') {`;

const target4 = `  if (rawHasPressure) {
    if (safetySections.length === 0) {
      errors.push("Input describes high-pressure operations, but Safety / Access section is missing.");
    } else {
      // Must isolate pressure source
      if (!/isolate|shut off|stop|disconnect|loto|lockout|block/i.test(safetyCombinedText)) {
        errors.push("Pressure source isolation step (LOTO/Shut-off) is missing from the Safety section.");`;

const target4End = `      }
    }
  }`; // Wait, there's more. We need to check where to close this `scope === 'full' || 'procedure'` block.
