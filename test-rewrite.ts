import http from 'http';

const data = JSON.stringify({
  title: "Test FCO",
  rawSummary: "Fix the valve because it leaks. It reduces risk.",
  rawProcedure: "1. Turn off valve.\n2. Replace seal.\n3. Turn on valve.",
  changeType: "Repair"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/fco/rewrite',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      console.log(JSON.stringify(parsed.diagnostics, null, 2));
    } catch(e) {
      console.log(body);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
