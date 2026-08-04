const fs = require('fs');
let code = fs.readFileSync('src/components/AiReviewStudio.tsx', 'utf8');

// Remove "Back" button at the bottom
code = code.replace(/<button\s+onClick=\{onBack\}[\s\S]*?<\/button>/, '');
// Remove "Edit FCO Context" button at the top
code = code.replace(/<button onClick=\{onBack\} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline px-3 py-1 bg-white border border-slate-200 rounded shadow-sm">\s*Edit FCO Context\s*<\/button>/, '');

fs.writeFileSync('src/components/AiReviewStudio.tsx', code);
