import { getChunks } from './src/server/knowledgeBaseService.js';
const chunks = getChunks().filter(c => c.documentName.includes('STE_QRG'));
console.log(chunks[0].text.substring(0, 500));
