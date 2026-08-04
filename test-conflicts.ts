import { detectPlaceholders, findConflictingPlaceholderCaptions } from './src/lib/placeholderDetection';

function runTests() {
  console.log("A. Conflicting Figure captions");
  const sumA = detectPlaceholders('[Insert Figure 1: Old access cover issues]', 'Summary');
  const procA = detectPlaceholders('[Insert Figure 1: Old Access Cover Removal]', 'Procedure');
  console.log("Conflicts A:", JSON.stringify(findConflictingPlaceholderCaptions([...sumA, ...procA]), null, 2));

  console.log("\nB. Same Figure caption repeated");
  const sumB = detectPlaceholders('[Insert Figure 1: Old Access Cover Removal]', 'Summary');
  const procB = detectPlaceholders('[Insert Figure 1: Old Access Cover Removal]', 'Procedure');
  console.log("Conflicts B:", JSON.stringify(findConflictingPlaceholderCaptions([...sumB, ...procB]), null, 2));

  console.log("\nC. Figure and Table same number");
  const figsC = detectPlaceholders('[Insert Figure 1: Board layout]', 'Summary');
  const tabsC = detectPlaceholders('[Insert Table 1: Parts list]', 'Procedure');
  console.log("Conflicts C:", JSON.stringify(findConflictingPlaceholderCaptions([...figsC, ...tabsC]), null, 2));

  console.log("\nD. Plain reference and placeholder");
  const procD = detectPlaceholders('See Figure 1.\n\n[Insert Figure 1: Board layout]', 'Procedure');
  console.log("Conflicts D:", JSON.stringify(findConflictingPlaceholderCaptions(procD), null, 2));

  console.log("\nE. Plain reference only");
  const procE = detectPlaceholders('See Figure 1.', 'Procedure');
  console.log("Conflicts E:", JSON.stringify(findConflictingPlaceholderCaptions(procE), null, 2));

  console.log("\nF. Whitespace-only caption difference");
  const sumF = detectPlaceholders('[Insert Figure 1: Board layout]', 'Summary');
  const procF = detectPlaceholders('[Insert Figure 1:   Board layout   ]', 'Procedure');
  console.log("Conflicts F:", JSON.stringify(findConflictingPlaceholderCaptions([...sumF, ...procF]), null, 2));

  console.log("\nG. Real caption wording difference");
  const sumG = detectPlaceholders('[Insert Figure 1: Board layout]', 'Summary');
  const procG = detectPlaceholders('[Insert Figure 1: Updated board layout]', 'Procedure');
  console.log("Conflicts G:", JSON.stringify(findConflictingPlaceholderCaptions([...sumG, ...procG]), null, 2));

  console.log("\nH. Table conflicting captions");
  const sumH = detectPlaceholders('[Insert Table 2: Parts list]', 'Summary');
  const procH = detectPlaceholders('[Insert Table 2: Kit selection table]', 'Procedure');
  console.log("Conflicts H:", JSON.stringify(findConflictingPlaceholderCaptions([...sumH, ...procH]), null, 2));
}

runTests();
