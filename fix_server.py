import re

with open('server.ts', 'r') as f:
    content = f.read()

# Add a catch-all API route before vite middleware
catch_all = """
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

  if (process.env.NODE_ENV !== 'production') {
"""

content = content.replace("  if (process.env.NODE_ENV !== 'production') {", catch_all)

with open('server.ts', 'w') as f:
    f.write(content)
