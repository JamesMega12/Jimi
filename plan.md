PHASE UI-2A INSPECTION PLAN

### Files/Components Inspected
- \`src/components/AppWorkflow.tsx\`: Manages the wizard state (\`currentStep\`), holds \`formData\` and \`response\` (the AI output), and contains \`handleRewriteSubmit\`.
- \`src/components/Step1Context.tsx\`: Currently contains Draft inputs, FCO Identity, Advanced Metadata, FcoTablesEditor, and Extra Directives.
- \`src/components/Step2Content.tsx\`: Currently contains the "AI Review Studio" (Summary PCSB evaluation, Procedure normalization, Placeholder preview, Procedure Callouts Editor, and the Rewrite trigger).
- \`src/components/Step3Review.tsx\`: Currently contains \`RewrittenDraft\`, \`ProcedureReadinessPanel\`, \`ValidationChecklist\`, and \`ExportPanel\`.

### Current Flow Map
1. **Step 1:** User enters all Draft context, Minimum Identity, Advanced Metadata, and FCO Tables.
2. **Step 2:** User runs Summary PCSB evaluation, normalizes procedure, adds callouts, and clicks "Rewrite". This triggers \`handleRewriteSubmit\` which auto-advances to Step 3.
3. **Step 3:** Displays AI output (\`RewrittenDraft\`), Readiness suggestions, Validation, and DOCX Export.

### Proposed New Flow Map
1. **Step 1 (Draft & Rewrite Workspace):** User enters Draft inputs, Minimum Identity, and Directives. User runs AI evaluations and triggers the Rewrite. The \`RewrittenDraft\` and \`ProcedureReadinessPanel\` are displayed at the bottom of Step 1 for immediate feedback and iteration.
2. **Step 2 (Advanced Metadata & FCO Tables):** User fills out Phase B/C tables (\`FcoTablesEditor\`) and Advanced Metadata (Associated Info, Cost, Approvals, etc.).
3. **Step 3 (Final Review & Export):** User performs final validation (\`ValidationChecklist\`), reviews TechCom notes, and exports the DOCX.

### Components to Extract/Reuse
- **Advanced Metadata:** Move the `<details>` block for Associated Info, Cost Schedule, Additional Info, and Approval Roles from \`Step1Context\` into \`Step2Content\`.
- **Tables:** Move \`FcoTablesEditor\` from \`Step1Context\` to \`Step2Content\`.
- **AI Review Studio:** Extract the state machine (Evaluate Summary, Analyze Procedure) from \`Step2Content\` into a reusable component (e.g., \`AiReviewTrigger\`) to embed in Step 1.
- **Editors:** Move \`PlaceholderPreviewPanel\` and \`ProcedureCalloutsEditor\` into Step 1.
- **Results:** Import and render \`RewrittenDraft\` and \`ProcedureReadinessPanel\` in Step 1.

### Step 1 New Layout
1. DOCX Upload Modal & Minimum FCO Identity
2. Draft Summary & Draft Procedure
3. Known Safety Risks & Optional Rewrite Instructions
4. \`PlaceholderPreviewPanel\` & \`ProcedureCalloutsEditor\`
5. "AI Review Studio" actions (Analyze Summary / Procedure -> Rewrite)
6. **Conditional:** If \`response\` exists, display \`RewrittenDraft\` and \`ProcedureReadinessPanel\`.
7. "Next: Advanced Metadata" button.

### Step 2 New Layout
1. Advanced Metadata fields (Associated Info, Cost & Schedule, Additional FCO Info, Approval Roles).
2. \`FcoTablesEditor\` (FCO History, Parts, Special Equipment, etc.).
3. "Back to Draft" and "Next: Final Review" buttons.

### Step 3 Final Review/Export Layout
1. Read-only review of the \`RewrittenDraft\` (optional but recommended for context).
2. \`TechComReviewNotes\` & \`ValidationChecklist\`.
3. \`ExportPanel\`.
4. "Back to Tables" button.

### State Paths Affected
- **Navigation:** \`handleRewriteSubmit\` in \`AppWorkflow.tsx\` must be modified to **remove** \`setCurrentStep(3)\`. It should fetch the response and remain on Step 1.
- **fcoDraft canonical state:** Unchanged structurally.
- **Legacy flat-field sync:** Unchanged.

### Risks
- Moving the AI Review Studio state machine into Step 1 will make the component very large if not extracted properly. Extracting it into a new sub-component is highly recommended.
- Without auto-advancing to Step 3 on rewrite, we must ensure Step 1 has a clear "Next" button at the bottom so users know how to proceed after reviewing the AI results.

### Minimal Patch Sequence
1. **AppWorkflow.tsx:** Remove \`setCurrentStep(3)\` from \`handleRewriteSubmit\`. Ensure \`response\` is passed down to Step 1.
2. **Step1Context.tsx:** Cut Advanced Metadata and \`FcoTablesEditor\` and paste them into \`Step2Content.tsx\`.
3. **Step2Content.tsx:** Cut the AI Review Studio evaluation logic, \`PlaceholderPreviewPanel\`, and \`ProcedureCalloutsEditor\` and paste them into \`Step1Context.tsx\` (or a new component).
4. **Step1Context.tsx:** Conditionally render \`RewrittenDraft\` and \`ProcedureReadinessPanel\` using the passed-down \`response\`.
5. **Step3Review.tsx:** Adjust the layout to focus on Validation and Export, since the initial draft review now happens in Step 1.

### What Not To Touch
- Backend rewrite behavior (\`/api/fco/rewrite\`)
- Gemini prompts or instruction packs
- DOCX export logic
- Placeholder validation logic
- Readiness lifecycle
- \`fcoDraft\` schema
