const fs = require('fs');
const lines = fs.readFileSync('src/components/SourceTruthAdminPage.tsx', 'utf-8').split('\n');
const fixed = lines.slice(0, 704).join('\n');
fs.writeFileSync('src/components/SourceTruthAdminPage.tsx', fixed);
console.log('Fixed file');
