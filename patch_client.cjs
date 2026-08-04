const fs = require('fs');
let content = fs.readFileSync('src/components/DeveloperKnowledgePanel.tsx', 'utf-8');

content = content.replace(
  /body: JSON\.stringify\(\{ content \}\)/,
  "body: JSON.stringify({ content, name: file.name })"
);

fs.writeFileSync('src/components/DeveloperKnowledgePanel.tsx', content);
