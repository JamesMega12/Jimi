import { detectPlaceholders, findConflictingPlaceholderCaptions } from './src/lib/placeholderDetection';

function runTests() {
  console.log("A. No placeholders");
  console.log("Conflicts:", findConflictingPlaceholderCaptions([]).length);

  console.log("\nB. One valid placeholder");
  const b = detectPlaceholders('[Insert Figure 1: Board layout]', 'Summary');
  console.log("Conflicts:", findConflictingPlaceholderCaptions(b).length);

  console.log("\nC. Same Figure 1 caption repeated");
  const sumC = detectPlaceholders('[Insert Figure 1: Board layout]', 'Summary');
  const procC = detectPlaceholders('[Insert Figure 1: Board layout]', 'Procedure');
  console.log("Conflicts:", findConflictingPlaceholderCaptions([...sumC, ...procC]).length);

  console.log("\nD. Conflicting Figure 1 captions");
  const sumD = detectPlaceholders('[Insert Figure 1: Board layout]', 'Summary');
  const procD = detectPlaceholders('[Insert Figure 1: Updated board layout]', 'Procedure');
  console.log("Conflicts:", findConflictingPlaceholderCaptions([...sumD, ...procD]).length);

  console.log("\nF. Case-only difference");
  const sumF = detectPlaceholders('[Insert Figure 1: Board Layout]', 'Summary');
  const procF = detectPlaceholders('[Insert Figure 1: board layout]', 'Procedure');
  console.log("Conflicts F:", JSON.stringify(findConflictingPlaceholderCaptions([...sumF, ...procF]), null, 2));
}

runTests();
