import { PRESETS } from './src/lib/testPresets';

async function runTest() {
  for (let i = 0; i < PRESETS.length; i++) {
    const preset = PRESETS[i];
    console.log(`\nTesting Preset ${i + 1}: ${preset.name}`);
    
    try {
      const response = await fetch('http://127.0.0.1:3000/api/fco/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset.data)
      });
      const data = await response.json();
      console.log(`engineUsed: ${data.diagnostics?.engineUsed}`);
      if (data.diagnostics?.engineUsed === 'local_fallback') {
        console.log("FALLBACK HIT!");
        console.log(`Reason: ${data.diagnostics?.fallbackReason}`);
      }
    } catch (e: any) {
      console.log(`Failed: ${e.message}`);
    }
  }
}

runTest();
