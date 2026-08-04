import { PRESETS } from './src/lib/testPresets';

async function runTests() {
  console.log("=== Testing Phase B.1 Split FCO Rewrite Routes ===\n");

  const baseUrl = 'http://127.0.0.1:3000';

  const testPayload = {
    title: "Split Route Test",
    priority: "Required",
    rawSummary: "Fix the valve. It is broken. [insert solution here]",
    rawProcedure: "1. Turn it off.\n2. [insert action here].",
    customDirectives: "Do it well."
  };

  try {
    // 1. Full Route Regression
    console.log("1. Testing Full Route (/api/fco/rewrite)...");
    const fullRes = await fetch(`${baseUrl}/api/fco/rewrite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    if (!fullRes.ok) throw new Error(`Full route failed: ${fullRes.status} ${await fullRes.text()}`);
    const fullData = await fullRes.json();
    if (!fullData.rewrittenSummary || !fullData.rewrittenProcedure) {
      throw new Error("Full route missing expected fields.");
    }
    console.log("   ✅ Full route returned both Summary and Procedure.");

    // 2. Summary Route Contract
    console.log("\n2. Testing Summary Route (/api/fco/rewrite-summary)...");
    const summaryPayload = {
      title: "Split Route Test",
      priority: "Required",
      rawSummary: "Fix the valve. It is broken. [insert solution here]",
      customDirectives: "Do it well."
    };
    const sumRes = await fetch(`${baseUrl}/api/fco/rewrite-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summaryPayload)
    });
    if (!sumRes.ok) throw new Error(`Summary route failed: ${sumRes.status} ${await sumRes.text()}`);
    const sumData = await sumRes.json();
    
    if (sumData.rewriteScope !== 'summary') throw new Error("Summary route missing correct rewriteScope");
    if (!sumData.rewrittenSummary) throw new Error("Summary route missing rewrittenSummary");
    if (sumData.rewrittenProcedure) throw new Error("Summary route leaked rewrittenProcedure");
    
    console.log("   ✅ Summary route accepted payload without rawProcedure.");
    console.log(`   ✅ Summary route returned rewriteScope: ${sumData.rewriteScope}`);
    console.log("   ✅ Summary route returned rewrittenSummary and did NOT expose dummy fields.");

    // 3. Procedure Route Contract
    console.log("\n3. Testing Procedure Route (/api/fco/rewrite-procedure)...");
    const procPayload = {
      title: "Split Route Test",
      rawProcedure: "1. Turn it off.\n2. [insert action here].",
      customDirectives: "Do it well.",
      acceptedSummary: "The valve was broken."
    };
    const procRes = await fetch(`${baseUrl}/api/fco/rewrite-procedure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(procPayload)
    });
    if (!procRes.ok) throw new Error(`Procedure route failed: ${procRes.status} ${await procRes.text()}`);
    const procData = await procRes.json();

    if (procData.rewriteScope !== 'procedure') throw new Error("Procedure route missing correct rewriteScope");
    if (!procData.rewrittenProcedure) throw new Error("Procedure route missing rewrittenProcedure");
    if (procData.rewrittenSummary) throw new Error("Procedure route leaked rewrittenSummary dummy field");

    console.log("   ✅ Procedure route accepted payload without rawSummary.");
    console.log(`   ✅ Procedure route returned rewriteScope: ${procData.rewriteScope}`);
    console.log("   ✅ Procedure route returned rewrittenProcedure and did NOT expose dummy fields.");

    // 4. Placeholder Scope Test - Summary
    console.log("\n4. Testing Placeholder Scope (Summary)...");
    const sumPlaceholderWarnings = sumData.placeholderWarnings || [];
    console.log("   Summary Placeholder Warnings:", sumPlaceholderWarnings);
    if (sumPlaceholderWarnings.some((w: string) => w.includes("action here"))) {
        throw new Error("Summary placeholder validation leaked into Procedure scope!");
    }
    console.log("   ✅ Summary route ignored Procedure placeholders.");

    // 5. Placeholder Scope Test - Procedure
    console.log("\n5. Testing Placeholder Scope (Procedure)...");
    const procPlaceholderWarnings = procData.placeholderWarnings || [];
    console.log("   Procedure Placeholder Warnings:", procPlaceholderWarnings);
    if (procPlaceholderWarnings.some((w: string) => w.includes("solution here"))) {
        throw new Error("Procedure placeholder validation leaked into Summary scope!");
    }
    console.log("   ✅ Procedure route ignored Summary placeholders.");

    console.log("\nAll Phase B.1 verification tests passed!");

  } catch (err: any) {
    console.error("\n❌ Test Failed:", err.message);
  }
}

runTests();
