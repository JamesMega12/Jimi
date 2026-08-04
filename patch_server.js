const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(/indexed: steDoc \? steDoc.status === 'indexed' : false,/, `indexed: steDoc ? (steDoc.status === 'indexed' || steDoc.status === 'indexed_clean' || steDoc.status === 'indexed_warning') : false,`);
fs.writeFileSync('server.ts', content);
