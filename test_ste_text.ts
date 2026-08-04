import fs from 'fs';

const p = './src/server/data/kb_chunks.json';
const chunks = JSON.parse(fs.readFileSync(p, 'utf8'));

const ste = chunks.filter(c => c.documentName.includes('STE_QRG'))[0].text;
console.log("Lines starting with Rule:");
ste.split('\n').forEach(line => {
   if (line.trim().toLowerCase().startsWith('rule ')) {
      console.log(line.trim());
   }
});
