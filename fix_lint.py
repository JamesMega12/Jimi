import sys

with open('server.ts', 'r') as f:
    content = f.read()

content = content.replace("source = 'custom'", "source = 'configured'")
content = content.replace("const text = response.text();", "const text = response.text;")

with open('server.ts', 'w') as f:
    f.write(content)
