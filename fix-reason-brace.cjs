const fs = require('fs');
let code = fs.readFileSync('src/components/technical-alert/v2/ReasonsWorkspace.tsx', 'utf8');
// remove the last }
let lastBrace = code.lastIndexOf('}');
if (lastBrace !== -1) {
  code = code.substring(0, lastBrace) + code.substring(lastBrace + 1);
  fs.writeFileSync('src/components/technical-alert/v2/ReasonsWorkspace.tsx', code);
}
