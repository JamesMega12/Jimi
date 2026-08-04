import sys

with open('server.ts', 'r') as f:
    content = f.read()

import re

# Replace the return object block in summary
content = re.sub(r'return res\.json\({\s*rewriteScope: "summary",\s*rewrittenSummary: finalized\.rewrittenSummary,.*?(?:diagnostics: finalized\.diagnostics)?\s*}\);', 'return res.json(finalized);', content, flags=re.DOTALL)

# Replace the return object block in procedure 
content = re.sub(r'return res\.json\({\s*rewriteScope: "procedure",\s*rewrittenProcedure: finalized\.rewrittenProcedure,.*?(?:diagnostics: finalized\.diagnostics)?\s*}\);', 'return res.json(finalized);', content, flags=re.DOTALL)

with open('server.ts', 'w') as f:
    f.write(content)
