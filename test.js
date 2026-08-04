const express = require('express');
const app = express();
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'test' });
});
app.listen(3001, () => console.log('started'));
