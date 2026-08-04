const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(
  /const steDoc = docs\.find\(\(d: any\) => d\.name && d\.name\.includes\('STE_QRG_6861590'\)\);/,
  "const steDoc = docs.find((d: any) => d.type === 'STE_LANGUAGE_GUIDE');"
);

content = content.replace(
  /documentName: 'STE_QRG_6861590_AC-Sep-2022 Online_6861590_01\.pdf',/,
  "documentName: steDoc ? steDoc.name : null,"
);

content = content.replace(
  /const existing = docs\.filter\(\(d: any\) => d\.name && d\.name\.includes\('STE_QRG_6861590'\)\);\s*for \(const d of existing\) deleteDocument\(d\.id\);\s*const name = 'STE_QRG_6861590_AC-Sep-2022 Online_6861590_01\.pdf';/,
  "const existing = docs.filter((d: any) => d.type === 'STE_LANGUAGE_GUIDE');\n    for (const d of existing) deleteDocument(d.id);\n    \n    const name = req.body.name || 'STE_QRG_6861590_AC-Sep-2022 Online_6861590_01.pdf';"
);

content = content.replace(
  /const existing = docs\.filter\(\(d: any\) => d\.name && d\.name\.includes\('STE_QRG_6861590'\)\);/,
  "const existing = docs.filter((d: any) => d.type === 'STE_LANGUAGE_GUIDE');"
);

content = content.replace(
  /const existing = docs\.find\(\(d: any\) => d\.name && d\.name\.includes\('STE_QRG_6861590'\)\);/,
  "const existing = docs.find((d: any) => d.type === 'STE_LANGUAGE_GUIDE');"
);

fs.writeFileSync('server.ts', content);
