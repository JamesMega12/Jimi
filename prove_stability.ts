import fs from 'fs';
import path from 'path';

async function testBackend() {
  console.log("=== BACKEND STABILITY TEST ===");
  
  // 1. Check Server Health / API
  try {
    const health = await fetch('http://localhost:3000/api/fco/test/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    console.log("1. /api/fco/test/summary (Basic Route):", health.status, await health.json());
  } catch (err: any) {
    console.log("1. /api/fco/test/summary FAILED:", err.message);
  }

  // 2. Check suggest-title
  try {
    const title = await fetch('http://localhost:3000/api/fco/suggest-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftSummary: "Fixing a broken pump.", baseProductCode: "PMP" })
    });
    console.log("2. /api/fco/suggest-title:", title.status, await title.json());
  } catch (err: any) {
    console.log("2. /api/fco/suggest-title FAILED:", err.message);
  }

  // 3. Test rewrite-summary route
  try {
    const summary = await fetch('http://localhost:3000/api/fco/rewrite-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: "Test FCO",
        priority: "High",
        rawSummary: "The pump is broken. We need to fix it by replacing the seal. This will prevent leaks.",
      })
    });
    const sumResult = await summary.json();
    console.log("3. /api/fco/rewrite-summary:", summary.status);
    console.log("   Rewrite Scope:", sumResult.rewriteScope);
    if (sumResult.rewrittenSummary) {
       console.log("   Parsed correctly:", !!sumResult.rewrittenSummary);
    } else {
       console.log("   FAILED TO PARSE RESPONSE:", sumResult);
    }
  } catch (err: any) {
    console.log("3. /api/fco/rewrite-summary ERROR:", err.message);
  }

  // 4. Test rewrite-procedure route
  try {
    const procedure = await fetch('http://localhost:3000/api/fco/rewrite-procedure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: "Test FCO",
        rawProcedure: "1. Turn off pump. 2. Remove seal. 3. Put new seal. 4. Turn on.",
      })
    });
    const procResult = await procedure.json();
    console.log("4. /api/fco/rewrite-procedure:", procedure.status);
    console.log("   Rewrite Scope:", procResult.rewriteScope);
    if (procResult.rewrittenProcedure) {
       console.log("   Parsed correctly:", !!procResult.rewrittenProcedure);
    } else {
       console.log("   FAILED TO PARSE RESPONSE:", procResult);
    }
  } catch (err: any) {
    console.log("4. /api/fco/rewrite-procedure ERROR:", err.message);
  }
}

testBackend();
