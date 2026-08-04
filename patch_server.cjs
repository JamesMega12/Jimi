const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const routeCode = `
app.post('/api/fco/suggest-title', async (req, res) => {
  try {
    const { draftSummary, draftProcedure, baseProductCode, fcoNumber, affectedEquipmentModel, appliesTo, priority } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured." });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = \`
You are an expert technical writer helping to generate a concise, professional title for a Field Change Order (FCO).
Use ONLY the provided information below. Do NOT invent or hallucinate FCO numbers, product codes, model names, locations, part numbers, safety data, or technical facts.

Provided Context:
Draft Summary: \${draftSummary || "Not provided"}
Draft Procedure: \${draftProcedure || "Not provided"}
Base Product Code: \${baseProductCode || "Not provided"}
FCO Number: \${fcoNumber || "Not provided"}
Affected Equipment Model: \${affectedEquipmentModel || "Not provided"}
Applies To: \${appliesTo || "Not provided"}
Priority: \${priority || "Not provided"}

Instructions:
- Return a JSON object with exactly one key "suggestions" which is an array of 1 to 3 string options.
- The title format should ideally be: [Base Product Code] FCO [FCO Number] [Change / Equipment / Scope].
- If key identifiers like Base Product Code or FCO Number are "Not provided", simply omit them from the title. Do NOT invent them.
- If there is not enough information to form a specific title, return a conservative title such as "Draft FCO for [affected equipment or scope]".
- Keep the title concise and professional.
\`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            suggestions: {
              type: "ARRAY",
              items: { type: "STRING" }
            }
          },
          required: ["suggestions"]
        },
        temperature: 0.2
      }
    });

    const text = response.text();
    if (!text) throw new Error("Empty response from AI");
    
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch(e) {
        throw new Error("Failed to parse JSON from AI response");
    }

    res.json(parsed);

  } catch (error: any) {
    console.error("Error in /api/fco/suggest-title:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
`;

code = code.replace("app.post('/api/fco/evaluate-summary', async (req, res) => {", routeCode + "\napp.post('/api/fco/evaluate-summary', async (req, res) => {");

fs.writeFileSync('server.ts', code);
