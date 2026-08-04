const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/server/data/kb_documents.json');
let docs = JSON.parse(fs.readFileSync(file, 'utf-8'));
docs.push({
    "id": "doc-1",
    "name": "STE_QRG_6861590_AC-Sep-2022 Online_6861590_01.pdf",
    "type": "STE_LANGUAGE_GUIDE",
    "status": "indexed_clean"
});
docs.push({
    "id": "doc-2",
    "name": "STE_QRG_6861590_AC-Sep-2022 Online_6861590_01.pdf",
    "type": "STE_LANGUAGE_GUIDE",
    "status": "indexed_clean"
});
fs.writeFileSync(file, JSON.stringify(docs, null, 2));
