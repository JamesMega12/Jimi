import { detectPlaceholders } from './src/lib/placeholderDetection';

function runTests() {
  const resF = detectPlaceholders('[Insert Figure 1: ]', 'Procedure');
  console.log('Test missing caption:', resF);
}
runTests();
