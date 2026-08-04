const fs = require('fs');
const file = 'src/types.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `export interface FCORequestData {`;
const replaceWith = `export type FcoRewriteScope = 'summary' | 'procedure' | 'full';

export interface FCORequestData {
  rewriteScope?: FcoRewriteScope;`;

content = content.replace(target, replaceWith);
fs.writeFileSync(file, content);
