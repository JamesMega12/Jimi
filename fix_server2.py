with open('server.ts', 'r') as f:
    content = f.read()

# Add a global error handler before app.listen
error_handler = """
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]', err);
  if (req.path.startsWith('/api')) {
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  } else {
    next(err);
  }
});

app.listen(PORT, '0.0.0.0', () => {
"""

content = content.replace("app.listen(PORT, '0.0.0.0', () => {", error_handler)

with open('server.ts', 'w') as f:
    f.write(content)
