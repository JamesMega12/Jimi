import { chunkExtractedText } from './src/server/chunkingService.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const chunks = await chunkExtractedText("Procedure Rules\n1. Must have safety.\n2. Must have preparation.", "test-123", "TechCom Standard QRG", "technical_standard", "1.0");
  console.log(JSON.stringify(chunks.slice(0,1), null, 2));
}

run();
