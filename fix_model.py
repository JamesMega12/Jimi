with open('server.ts', 'r') as f:
    content = f.read()

content = content.replace('gemini-3.5-flash', 'gemini-2.5-flash')
content = content.replace('gemini-pro', 'gemini-2.5-pro')

with open('server.ts', 'w') as f:
    f.write(content)
