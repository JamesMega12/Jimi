const fs = require('fs');
let content = fs.readFileSync('src/components/DeveloperKnowledgePanel.tsx', 'utf-8');

content = content.replace(
  /<p><strong className="text-slate-900">Document Name:<\/strong> \{data\.steGuidanceStatus\.documentName\}<\/p>/,
  '<p><strong className="text-slate-900">Document Name:</strong> {data.steGuidanceStatus.documentName || "None"}</p>'
);

fs.writeFileSync('src/components/DeveloperKnowledgePanel.tsx', content);
