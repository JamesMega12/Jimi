# TechCom Analyze Pipeline Diagnosis Report

## 1. Executive Summary
The primary root cause of the incomplete analysis cards in the UI is a **schema injection failure** in the backend. While `TechComAnalyzeSchemaDescription` exists in `src/server/techComSchemas.ts`, it is **never imported or included in the Gemini prompt** in `src/server/routes/techComRoutes.ts`. Because Gemini is only told to "Return JSON only" without a required schema, it hallucinates the JSON structure, failing to provide the nested fields (like `analysis.summary.fourPartSupport`, `analysis.reason.clarity`) that the frontend expects.

## 2. Actual Backend Analyze Response Shape
Because Gemini is not constrained by a schema, the raw text returned varies wildly. The backend attempts to normalize it with fallback objects, resulting in a shape like:
```json
{
  "documentType": "Announcement",
  "readiness": {
    "status": "Needs minor fixes",
    "summary": "The draft is usable, but the rewrite should clarify action wording and affected scope.",
    "blockingIssues": [],
    "warnings": []
  },
  "analysis": {
    "summary": {},
    "reason": {},
    "action": {},
    "metadata": { "status": "Unknown", "missingFields": [], "warnings": [] },
    "placeholders": { "status": "Unknown", "preserved": [], "dropped": [], "renamed": [], "duplicated": [], "unreferencedOfficial": [], "addedSuggestions": [], "warnings": [], "blockingIssues": [] }
  },
  "suggestedRewriteFocus": []
}
```
*Note that `summary`, `reason`, and `action` objects inside `analysis` are frequently empty or contain unexpected keys.*

## 3. Gemini Analyze Prompt / Schema Findings
- Gemini is instructed by `analyzeDraftPack.content` to analyze completeness, clarity, actionability, etc.
- Gemini is told to "Return JSON only."
- **Critical Flaw:** The required JSON schema string (`TechComAnalyzeSchemaDescription`) is not passed in the prompt. Gemini does not know that fields like `fourPartSupport`, `mandatoryActionFinding`, or `ownerDeadlineFinding` are expected.

## 4. API Client Mapping Findings
`techComApi.ts` calls `/api/techcom/analyze` and simply does:
```typescript
return response.json();
```
It performs no transformation, renaming, or normalization on the client side. The frontend receives exactly what the backend returns.

## 5. Frontend UI Mapping Findings
The `TechComAnalysisResult.tsx` UI expects deeply nested, strictly named fields:
- **Draft Readiness:** Reads `result.readiness.status` and `result.readiness.summary`.
- **Summary Check:** Expects `result.analysis.summary.fourPartSupport` (with sub-fields `whatHappenedOrChanged`, `whyItMatters`, `affectedScope`, `requiredAction`).
- **Reason Check:** Expects `result.analysis.reason.clarity`, `rootCauseCertainty`, and `duplicationWarning`.
- **Action Check:** Expects `result.analysis.action.clarity`, `mandatoryActionFinding`, and `ownerDeadlineFinding`.
- **Metadata Check:** Expects `result.analysis.metadata.missingFields`.
- **Figures & Tables:** Expects arrays like `result.analysis.placeholders.dropped` and `unreferencedOfficial`.

**Mismatches:** Since Gemini doesn't output these nested fields (e.g., `fourPartSupport`), the UI renders the card structure but leaves the values empty.

## 6. Why Draft Readiness Works but Section Cards Are Empty
Draft Readiness works perfectly because **it is explicitly calculated in Node.js** (inside `techComRoutes.ts` lines 182-203). Regardless of what Gemini outputs, the backend forces the `readiness` object to contain `status` and `summary` strings based on the count of warnings and missing fields. 
The section cards (Summary, Reason, Action) rely on Gemini's raw JSON output, which is missing the required fields because Gemini lacks the schema.

## 7. Placeholder Warning Diagnosis
Placeholder analysis is mostly correct:
- Official placeholders are extracted from `techComDraft.figures` / `tables`.
- Text placeholders are extracted from raw input sections.
- The backend compares them and correctly assigns `result.analysis.placeholders.unreferencedOfficial`.
- The backend correctly clears `dropped` (`result.analysis.placeholders.dropped = [];`) so that unreferenced placeholders aren't mislabeled as "missing".
- The UI properly renders `unreferencedOfficial.join(', ')` and `addedSuggestions.join(', ')`. 

## 8. Data Contract Gap
- **Field expected by UI:** `analysis.summary.fourPartSupport`
- **Field returned by backend:** Missing or randomly named (e.g., `summaryAnalysis`)
- **Impact:** Empty Summary card in UI.
- **Recommended fix:** Inject `TechComAnalyzeSchemaDescription` into the user prompt.

- **Field expected by UI:** `analysis.reason.clarity`, `analysis.reason.rootCauseCertainty`
- **Field returned by backend:** Missing.
- **Impact:** Reason card shows bold labels with blank text.
- **Recommended fix:** Inject schema.

- **Field expected by UI:** `analysis.action.mandatoryActionFinding`
- **Field returned by backend:** Missing.
- **Impact:** Action card shows bold labels with blank text.
- **Recommended fix:** Inject schema.

## 9. Recommended Fix Plan, No Implementation Yet
1. **Update Route Imports:** Import `TechComAnalyzeSchemaDescription` (and format/rewrite schemas) into `src/server/routes/techComRoutes.ts`.
2. **Inject Schema:** Update the `userPrompt` construction in `/api/techcom/analyze`, `/api/techcom/format`, and `/api/techcom/rewrite` to append the appropriate schema description.
   ```typescript
   const userPrompt = `Instruction Pack:
   ${analyzeDraftPack.content}
   
   Expected Output Format:
   ${TechComAnalyzeSchemaDescription}
   
   ...`
   ```
3. **Robust Backend Normalization:** Update the normalization block in `techComRoutes.ts` to ensure that `result.analysis.summary.fourPartSupport` and other nested objects are safely initialized with fallback strings if Gemini still omits them (e.g., `"Checking..."` or `"Not evaluated"`).
4. **Remove One-page Risk:** Ensure one-page risk is fully purged from the UI and schemas if it isn't already. (It appears it was removed from the UI in the last update).

## 10. Files That Need Changes Next
- `src/server/routes/techComRoutes.ts`
  - **Why:** The Gemini prompt lacks the schema descriptions.
  - **Risk Level:** Medium (affects Gemini output quality).
  - **Expected Change:** Import schema descriptions and inject them into the respective prompts for `/format`, `/analyze`, and `/rewrite`.
- `src/server/techComSchemas.ts` (Optional)
  - **Why:** Verify that the schema descriptions exactly match the UI expectations.
  - **Risk Level:** Low.
  - **Expected Change:** Minor field tweaks if needed.

## 11. Open Questions / Needs Inspection
None. The root cause is definitively a missing schema injection in the backend route.
