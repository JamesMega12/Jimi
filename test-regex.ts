import { detectPlaceholders } from './src/lib/placeholderDetection';

function runTests() {
  // C. Natural language "table to" rejected
  const resC = detectPlaceholders('Use the model selection table to identify the correct kit.', 'Procedure');
  console.log('Test C (table to):', resC);

  // D. Valid table reference still detected
  const resD = detectPlaceholders('See Table 1 before selecting the correct kit.', 'Procedure');
  console.log('Test D (Table 1):', resD);

  // E. Valid figure reference still detected
  const resE = detectPlaceholders('See Figure 2A for bracket orientation.', 'Procedure');
  console.log('Test E (Figure 2A):', resE);
  
  // F. Placeholder caption still valid
  const resF = detectPlaceholders('[Insert Figure 1: Old Access Cover Removal]', 'Procedure');
  console.log('Test F (Explicit placeholder):', resF);
}
runTests();
