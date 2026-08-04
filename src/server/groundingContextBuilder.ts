export function buildGroundingPromptContext(chunks: any[]): string {
  if (!chunks || chunks.length === 0) {
    return "";
  }
  
  let contextText = "--- GROUNDING CONTEXT ---\n";
  contextText += "Use the following excerpts from authoritative source documents to guide your rewrite.\n\n";
  
  chunks.forEach((chunk, index) => {
    contextText += `[Source ${index + 1}: ${chunk.documentName || 'Unknown Document'} - ${chunk.sectionTitle || 'Unknown Section'}]\n`;
    contextText += `${chunk.text}\n\n`;
  });
  
  contextText += "--- END GROUNDING CONTEXT ---\n";
  return contextText;
}
