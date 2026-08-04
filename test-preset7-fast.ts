import http from 'http';
import { PRESETS } from './src/lib/testPresets';

async function runTest() {
  const preset = PRESETS[6];
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
  });
  req.on('error', () => {});
  req.write(data);
  req.end();
  console.log("Sent request");
}
runTest();
