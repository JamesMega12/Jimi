import sys

with open('server.ts', 'r') as f:
    lines = f.readlines()

# Find the start of the second processRewrite
idx = -1
for i, line in enumerate(lines):
    if line.startswith("async function processRewrite(req: express.Request, res: express.Response) {") and i > 1000:
        idx = i
        break

if idx != -1:
    # Delete from idx up to app.post('/api/fco/rewrite', processRewrite);
    end_idx = -1
    for i in range(idx, len(lines)):
        if "app.post('/api/fco/rewrite', processRewrite);" in lines[i]:
            end_idx = i
            break
    if end_idx != -1:
        del lines[idx:end_idx]

# Find the top level await Vite server
vite_idx = -1
for i, line in enumerate(lines):
    if "if (process.env.NODE_ENV !== 'production') {" in line:
        vite_idx = i
        break

if vite_idx != -1:
    lines.insert(vite_idx, "(async () => {\n")
    lines.append("})();\n")

with open('server.ts', 'w') as f:
    f.writelines(lines)
