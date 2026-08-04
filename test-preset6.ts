import http from 'http';
import { PRESETS } from './src/lib/testPresets';

async function runTest() {
  const preset = PRESETS[5]; // Preset 6
  console.log(`\nTesting Preset 6: ${preset.name}`);
  
  await new Promise((resolve) => {
    const data = JSON.stringify(preset.data);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/fco/rewrite',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          console.log(`engineUsed: ${parsed.diagnostics?.engineUsed}`);
          if (parsed.diagnostics?.engineUsed === 'local_fallback') {
            console.log("FALLBACK HIT!");
            console.log(`Reason: ${parsed.diagnostics?.fallbackReason}`);
          } else {
            console.log("SUCCESS. No fallback.");
          }
        } catch(e) {
          console.log("Failed to parse", body);
        }
        resolve(true);
      });
    });
    req.on('error', e => {
      console.log(`Error: ${e.message}`);
      resolve(false);
    });
    req.write(data);
    req.end();
  });
}
runTest();
