import { GoogleGenAI } from '@google/genai';
import { generateLocalHeuristicEmbedding } from './knowledgeBaseService';

/**
 * Generates an embedding vector (number array) for a text.
 * Calls Gemini if available, otherwise falls back to local heuristic vector.
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    console.warn("No GEMINI_API_KEY for embedding generation, using local heuristic fallback.");
    return generateLocalHeuristicEmbedding(text);
  }

  try {
    console.log(`[Gemini Embedding] Dispatching embedContent request... payload size: ${text.length} characters`);
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const modelName = 'text-embedding-004';
    const response: any = await ai.models.embedContent({
      model: modelName,
      contents: text
    });

    if (response && response.embeddings && response.embeddings.length > 0 && response.embeddings[0].values) {
      console.log(`[Gemini Embedding] Success. Received vector of dimension ${response.embeddings[0].values.length}`);
      return response.embeddings[0].values;
    }

    console.warn("[Gemini Embedding] Unexpected response layout from Gemini embedding API. Using local heuristic fallback.");
    return generateLocalHeuristicEmbedding(text);
  } catch (err: any) {
    console.error("[Gemini Embedding] Failed to generate embedding with Gemini API:", err.message || err);
    return generateLocalHeuristicEmbedding(text);
  }
}
