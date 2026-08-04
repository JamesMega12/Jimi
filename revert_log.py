import re

with open('server.ts', 'r') as f:
    content = f.read()

content = content.replace('      console.error("[analyze-summary] Gemini API Error:", apiErr);\n      fs.appendFileSync("app_debug.log", "[analyze-summary] Gemini API Error: " + (apiErr.stack || apiErr) + "\\n");', '      console.error("[analyze-summary] Gemini API Error:", apiErr);')

with open('server.ts', 'w') as f:
    f.write(content)
