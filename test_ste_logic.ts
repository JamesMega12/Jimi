import fs from 'fs';

const p = './src/server/data/kb_chunks.json';
const chunks = JSON.parse(fs.readFileSync(p, 'utf8'));

const text = chunks.filter(c => c.documentName.includes('STE_QRG'))[0].text;

let currentSec = 'General Guidelines';
let currentRaw = [];
const out = [];

const processChunk = (content, sec) => {
   const cleanContent = content.trim();
   if (cleanContent) out.push({sec, len: cleanContent.split(/\s+/).length, words: cleanContent.substring(0, 50).replace(/\n/g, ' ')});
};

const getSectionFromRule = (ruleStr) => {
   const match = ruleStr.match(/Rule\s+([0-9]+)\./i);
   if (!match) return null;
   const num = parseInt(match[1]);
   switch (num) {
      case 1: return 'Words';
      case 2: return 'Noun clusters';
      case 3: return 'Verbs';
      case 4: return 'Sentences';
      case 5: return 'Procedures';
      case 6: return 'Descriptive writing';
      case 7: return 'Safety instructions';
      case 8: return 'Punctuation and word counts';
      case 9: return 'Writing practices';
      default: return `Rule Group ${num}`;
   }
};

for (const line of text.split('\n')) {
   const ltrim = line.trim().toLowerCase();
   if (ltrim.startsWith('rule ') || ltrim.startsWith('rules ')) {
      const sec = getSectionFromRule(line);
      if (sec && sec !== currentSec) {
         if (currentRaw.length > 0) {
            processChunk(currentRaw.join('\n'), currentSec);
            currentRaw = [];
         }
         currentSec = sec;
      }
   }
   currentRaw.push(line);
}
if (currentRaw.length > 0) processChunk(currentRaw.join('\n'), currentSec);

console.log("CHUNKS GENERATED:", out.length);
console.log(out);
