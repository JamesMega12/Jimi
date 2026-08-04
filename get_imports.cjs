const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

// I need to see where processRewrite ends to append.
// processRewrite is around line 1240.
const matches = content.match(/async function processRewrite[^}]+\n}/gm);
if (matches) {
    console.log("processRewrite matched length", matches[0].length);
}
