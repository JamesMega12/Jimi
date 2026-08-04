# FCO Draft Assistant - UX/UI and User Flow Reference

This document serves as a blueprint for the user flow, UI/UX paradigms, and human-AI interaction patterns used in the FCO Draft Assistant. It is designed to be used as a reference prompt for replicating this architecture and workflow in other applications.

## Core UX Philosophy: "AI Proposes, Human Disposes"
The fundamental principle of this application is that **the AI never silently overwrites canonical user data.** 
1. **User inputs raw data.**
2. **AI generates suggestions, rewrites, and analyses.**
3. **UI presents a side-by-side or inline review (Diffs, Warnings, Suggestions).**
4. **User explicitly accepts, edits, or rejects the AI's output.**
5. **Only upon acceptance does the data merge into the canonical state for export.**

---

## The 3-Step Guided Workflow

The application uses a linear, wizard-like progression (`Step 1 -> Step 2 -> Step 3`), managed by a central `AppWorkflow.tsx` component that holds the canonical state (`formData.fcoDraft`).

### Step 1: Draft & Rewrite Workspace
**Goal**: Capture the raw engineering intent and use AI to standardize the language.

1. **User Input Phase**:
   - Users can manually type or upload a DOCX file to populate the `Raw Summary` and `Raw Procedure` text areas.
   - Users fill out core identity fields: *Priority, Affected Equipment, Applies To, Known Safety Risks*.
   - **Unique UI Feature**: *Optional Rewrite Instructions*. A specific input where the user can direct the AI (e.g., "Emphasize the risk of O-ring pinching").

2. **AI Interaction (The `AiReviewStudio`)**:
   - The user clicks "Rewrite Draft". The UI enters a loading state (spinner, disabled inputs) while the backend Gemini API processes the text against strict technical writing rules.
   - **Title Suggestion**: A dedicated button allows users to generate an FCO Title based on their raw draft. It opens a dropdown of 3 AI-generated titles. The user clicks one to apply it to the input field.

3. **Review Phase (Inline)**:
   - Instead of navigating away, the `AiReviewStudio` renders the AI's output directly below the inputs.
   - The user is presented with the rewritten text and can compare it to their original intent. 
   - The AI output is held in a "staging" state until the user proceeds.

### Step 2: Advanced Details & FCO Tables
**Goal**: Collect structured, deterministic metadata that the AI should *not* touch.

1. **Structured Forms**:
   - Standard React controlled inputs (dropdowns, text fields) for *Q-Check Service Level, Coding Changes, Estimated Costs, Due Dates, and Approval Roles*.
   - **UX Pattern**: Clean, grid-based card layouts using Tailwind CSS (e.g., `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`).

2. **Dynamic Tables (`FcoTablesEditor`)**:
   - Complex arrays of data (e.g., *Parts Required, Special Equipment, Parts to Scrap*).
   - **UX Pattern**: Users can add rows, delete rows, and edit cells inline. 
   - **AI Boundary**: There is strictly zero AI involvement in Step 2. This enforces trust that the AI won't hallucinate part numbers or financial costs.

### Step 3: Final Review & Export
**Goal**: Final human sign-off, safety validation, and document generation.

1. **Draft Integrity Warnings (Crucial UX)**:
   - **The Problem**: AI sometimes drops visual placeholders like `[Insert Figure 1]` when rewriting procedures.
   - **The UX Solution**: A deterministic Regex function compares the user's Step 1 input against the AI's Step 1 output. If a placeholder is missing or mutated, a high-visibility warning banner (`bg-rose-50 border-rose-250 text-rose-900`) is injected at the top of Step 3. The user is forced to acknowledge this discrepancy.

2. **Procedure Readiness Panel**:
   - The AI doesn't just rewrite text; it generates "Suggestions" (e.g., "Step 4 lacks a safety caution").
   - **UX Pattern**: These suggestions appear as a checklist in Step 3. The user must click **Accept**, **Edit**, or **Dismiss** for each item. Accepted items are dynamically merged into the final procedure object in real-time.

3. **Final Preview (`RewrittenDraft`)**:
   - A read-only, beautifully formatted view of the final FCO document, exactly as it will appear in the export.
   - Includes styled tabs (e.g., *Rewritten Draft, Edit Trace, Validation Checklist*).

4. **Deterministic Export (`ExportPanel`)**:
   - The user clicks "Export DOCX".
   - **AI Boundary**: The export function sends the canonical React state to the backend. The backend uses the `docx` library to map the JSON to a Word document. *No AI generation happens during export*, ensuring 100% fidelity between what the user approved on screen and the downloaded file.

---

## UI/UX Design System Guidelines for Replication

If replicating this application, adhere to the following UI/UX patterns:

1. **State Management**:
   - Lift state to a top-level orchestrator. Pass down `formData` and `setFormData` to all steps.
   - Keep "Raw Draft" fields structurally separate from "AI Rewritten" fields in the state object.

2. **Visual Hierarchy & Styling (Tailwind CSS)**:
   - **Cards**: Wrap distinct sections in `<div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">`.
   - **Typography**: Use clear, sans-serif fonts. Use `text-xs font-bold uppercase tracking-wider text-slate-500` for section sub-labels to create a technical, professional feel.
   - **Feedback Colors**: 
     - *Success/Ready*: Emerald/Green (`bg-emerald-50 text-emerald-700`).
     - *Warning/AI Suggestion*: Amber/Yellow (`bg-amber-50 text-amber-800`).
     - *Critical/Missing Data*: Rose/Red (`bg-rose-50 text-rose-700`).

3. **Icons & Affordances**:
   - Use icons heavily (e.g., `lucide-react`) to break up text-heavy technical data.
   - Use `Sparkles` to denote AI actions, `AlertTriangle` for warnings, and `CheckCircle2` for accepted states.

4. **Progressive Disclosure**:
   - Don't overwhelm the user. Hide the AI output (Step 1) and Final Review (Step 3) until the requisite actions have been taken. Use accordions (e.g., `<details>`) for optional advanced metadata.
