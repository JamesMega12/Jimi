# PHASE UI-1A.1 STEP 2 REFRAMING PLAN

**Files Inspected:**
- `src/components/Step2Content.tsx`
- `src/components/Step1Context.tsx`

**Current Step 2 Structure:**
Step 2 currently serves as a dual-purpose screen:
1. **Raw Content Entry**: `renderManualMode` provides textareas for `rawSummary` and `rawProcedure`. `renderDocxMode` provides similar editable textareas for `docSummary` and `docProcedure`.
2. **AI Analysis Pipeline**: After confirming the raw text, it flows sequentially into Paste Normalizer (if manual), Change Type Detection, Summary PCSB Evaluation, and Procedure Rewrite Analysis.

**Duplicated Areas Caused by UI-1A:**
Because Step 1 now houses the Draft Summary and Draft Procedure textareas (syncing to `rawSummary` and `rawProcedure`), `renderManualMode` in Step 2 currently renders redundant, identical textareas. The user enters their draft in Step 1, clicks "Next", and is immediately presented with the exact same input fields in Step 2.

**Proposed AI Review Studio Layout:**
Step 2 will be reframed as an "AI Review Studio" rather than a data-entry form.
1. **Header Rebranding**: Rename "Step 2: Manual Summary and Procedure" to "Step 2: AI Review Studio".
2. **Read-Only Draft Preview (Manual Mode)**: Replace the duplicate textareas in `renderManualMode` with clean, read-only preview cards (e.g., `<div className="bg-slate-50 p-4 rounded-xl text-sm font-mono whitespace-pre-wrap">`) displaying the draft content passed from Step 1.
3. **DOCX Review Preservation**: Keep `renderDocxMode` textareas editable but clearly label them as "Review Extracted Content" since OCR/parsing often requires manual correction before analysis.
4. **Studio Flow**: The rest of the screen will retain the AI analysis pipeline (Normalizer modal, Change Type, PCSB Evaluation, Procedure Rewrite). The "Format Document Structure" or "Detect Change Type" buttons remain as the primary calls to action to advance the review pipeline.

**What Should Stay Editable:**
- DOCX extracted text (`docSummary`, `docProcedure`) prior to confirmation.
- Change Type dropdown.
- PCSB (Problem, Cause, Solution, Benefit) rewritten suggestions.
- Procedure Rewrite results (AI-suggested steps).
- `ProcedureCalloutsEditor` and `PlaceholderPreviewPanel`.

**What Should Become Review/Preview:**
- `rawSummary` and `rawProcedure` in manual mode should become read-only preview cards. They act as the "source material" for the AI Review Studio.

**Canonical State Risks:**
- **State Overwrites**: The AI analysis functions (e.g., `handleApplyNormalizer`, `runProcedureAnalysis`) currently update `formData.rawSummary` and `formData.rawProcedure`. If we remove the textareas in manual mode, we must ensure we don't accidentally break the data binding. By rendering read-only divs tied directly to `formData.rawSummary` and `formData.rawProcedure`, we preserve the exact state paths.
- **DOCX Sync**: `handleDocxConfirm` currently copies `docSummary` to `rawSummary` and `fcoDraft.technicalContent`. This must remain untouched.

**Minimal Patch Sequence:**
1. Update heading to "Step 2: AI Review Studio".
2. In `renderManualMode`, delete `<textarea id="rawSummaryInput"...>` and `<textarea id="rawProcedureInput"...>`.
3. Replace them with read-only view elements.
4. Ensure `PlaceholderPreviewPanel` and `ProcedureCalloutsEditor` are still rendered.
5. Retain all existing state hooks, detection logic, normalizer logic, and evaluation components without modification.

**What Not To Touch:**
- Backend rewrite behavior or routes.
- Gemini prompts.
- Instruction packs.
- DOCX export.
- Readiness lifecycle.
- Placeholder validation logic (`detectPlaceholders`).
- `fcoDraft` schema structure and Step 2 canonical sync.
