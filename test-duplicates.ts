import { consolidatePlaceholders, detectPlaceholders } from './src/lib/placeholderDetection';

function runTests() {
  const p1 = detectPlaceholders('[Insert Figure 1: Caption]', 'Procedure');
  const p2 = detectPlaceholders('[Insert Figure 1: Caption]', 'Procedure');
  
  const all = consolidatePlaceholders(p1, p2);
  console.log('Duplicate test:', all);
}
runTests();
