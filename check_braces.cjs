const fs = require('fs');
const code = fs.readFileSync('src/components/technical-alert/v2/ReasonsWorkspace.tsx', 'utf8');
let open = 0;
for (let i = 0; i < code.length; i++) {
  if (code[i] === '{') open++;
  if (code[i] === '}') open--;
}
console.log('Braces diff:', open);
