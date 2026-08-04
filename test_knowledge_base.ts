import fs from 'fs';

async function testKnowledgeBase() {
  console.log("=== KNOWLEDGE BASE STABILITY TEST ===");
  try {
    const drafts = await fetch('http://localhost:3000/api/fco/instruction-packs/drafts');
    console.log("drafts status:", drafts.status);
    const draftsJson = await drafts.json();
    console.log("drafts json:", draftsJson.length !== undefined ? `Array of ${draftsJson.length}` : draftsJson);
  } catch (err: any) {
    console.log("drafts FAILED:", err.message);
  }

  try {
    const active = await fetch('http://localhost:3000/api/fco/instruction-packs/active-registry');
    console.log("active registry status:", active.status);
    const activeJson = await active.json();
    console.log("active registry json:", activeJson.summary?.source);
  } catch (err: any) {
    console.log("active registry FAILED:", err.message);
  }
}

testKnowledgeBase();
