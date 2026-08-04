import re

content = open('src/server/routes/techComRoutes.ts').read()

old_prompt = """Current Draft State:
${JSON.stringify(techComDraft || {}, null, 2)}

Return valid JSON only. Do not include markdown.
`;"""

new_prompt = """Current Draft State:
${JSON.stringify(techComDraft || {}, null, 2)}

${TechComRewriteSchemaDescription}

Return valid JSON only. Do not include markdown.
`;"""

content = content.replace(old_prompt, new_prompt)

open('src/server/routes/techComRoutes.ts', 'w').write(content)
