# FCO Draft Assistant - System Architecture & Pipeline Overview

## 1. Executive Summary
The **Field Change Order (FCO) Draft Assistant** is a purpose-built, AI-augmented web application designed to streamline the creation, review, and standardization of engineering FCO documents. 

From a system architecture perspective, it operates as a **React/TypeScript Single Page Application (SPA)** backed by a **Node.js/Express API**. The application leverages the Google Gemini API to analyze, rewrite, and validate procedural and summary text against strict technical writing guidelines, while strictly maintaining deterministic boundaries around state management and document export.

## 2. Tech Stack
*   **Frontend**: React 18, TypeScript, Tailwind CSS, Vite.
*   **Backend**: Node.js, Express.
*   **AI/LLM**: Google GenAI SDK (Gemini API).
*   **Document Generation**: `docx` library (Server-side deterministic assembly).
*   **State Management**: React component state (lifting state up via `AppWorkflow.tsx`), using `fcoDraft` as the canonical source of truth.

## 3. The End-to-End Pipeline

The application processes data through a strictly phased, three-step pipeline. The fundamental engineering philosophy here is **"AI Proposes, Human Disposes."**

### Phase 1: Ingestion, Drafting & AI Rewrite (`Step1Context.tsx`)
1.  **Data Ingestion**: Users input draft content manually or via DOCX upload/extraction. The raw inputs (Summary, Procedure, Safety Risks, FCO Title) are bound to the React state.
2.  **AI Invocation (`AiReviewStudio.tsx`)**: When the user requests a rewrite, the frontend packages the current context and dispatches it to the `/api/fco/rewrite` endpoint.
3.  **LLM Processing**: The backend applies targeted instruction packs and system prompts to the Gemini model. The LLM evaluates technical terminology, formatting rules, and safety callouts.
4.  **Human-in-the-Loop Validation**: The AI returns structured JSON. The UI renders an interactive diff/preview. Crucially, the AI's output does *not* automatically overwrite the user's canonical state until explicitly accepted.

### Phase 2: Metadata & Tabular Enrichment (`Step2Content.tsx`)
Once the core unstructured text is drafted, the pipeline moves to structured metadata.
1.  **Advanced Metadata**: Associated tech alerts, Q-Check levels, capital costs, and engineering roles.
2.  **FCO Tables (`FcoTablesEditor.tsx`)**: Users fill out relational data such as Required Parts, Tools, and Parts to Scrap. 
3.  **State Consolidation**: All data is merged into the deeply nested `fcoDraft` object. No AI processing occurs in this phase, ensuring structured data integrity.

### Phase 3: Assembly, Validation & Export (`Step3Review.tsx`)
The final phase handles readiness resolution, validation checks, and deterministic export.
1.  **Readiness Resolution (`ProcedureReadinessPanel.tsx`)**: Pending AI suggestions (e.g., "Add safety warning before step 4") must be accepted, edited, or dismissed.
2.  **Placeholder Validation**: The app runs a regex-based AST-lite check (`placeholderDetection.ts`) to ensure that visual placeholders (e.g., `[Insert Figure 1]`) in the original draft were not hallucinated or dropped by the LLM.
3.  **Deterministic Export (`docxExportService.ts`)**: 
    *   Triggered via `/api/fco/export-docx`.
    *   **Architecture Rule**: *No AI calls are permitted during export.* 
    *   The backend takes the finalized `fcoDraft` JSON payload and procedurally maps it to OpenXML elements using the `docx` package, returning a binary Buffer to the client.

## 4. Key Architectural Patterns & Constraints

### A. The "Canonical State" Pattern
The application avoids distributed state fragmentation by centralizing the source of truth in `AppWorkflow.tsx` under the `formData.fcoDraft` schema. All child components (Step 1, Step 2, Step 3) receive `formData` and a `setFormData` dispatcher. This ensures that the export payload exactly matches what is rendered on screen.

### B. Strict AI Boundaries
To prevent non-deterministic regressions, the architecture strictly segregates AI logic from core application logic:
*   **No Auto-Commits**: AI endpoints return suggestions (diffs, readiness warnings, rewritten text) which live in temporary component state until the user clicks "Accept".
*   **Deterministic Export**: The DOCX generator operates purely on finalized JSON. It has no awareness of Gemini, RAG, or embeddings.
*   **Instruction Packs as Configuration**: Writing rules and style guides are injected as context to the LLM, but they do not control the application's runtime validation schemas or UI logic.

### C. Placeholder Integrity Check
Since LLMs are prone to modifying non-standard markdown or dropping bracketed tokens, the system implements a dedicated RegExp extraction layer (`lib/placeholderDetection.ts`). It cross-references placeholders identified in the *input* text against the placeholders present in the *output* text, firing critical UI warnings if the LLM broke referential integrity.

## 5. Backend Route Topology
*   `POST /api/fco/rewrite`: Main LLM workhorse. Takes raw text, returns structured procedural rewrites.
*   `POST /api/fco/suggest-title`: Lightweight LLM call to generate a title based on context.
*   `POST /api/fco/evaluate-summary`: specialized grading endpoint for problem/cause/solution/benefit analysis.
*   `POST /api/fco/export-docx`: Translates the JSON AST into an OpenXML DOCX buffer.
*   `GET/POST /api/kb/*`: Knowledge base and RAG endpoints (handles seed data and source-of-truth grounding, distinct from the core export pipeline).

## 6. Future Extensibility (SOLID Application)
The current UI components (Steps 1, 2, 3) are designed as compositional wrappers. By adhering to the Single Responsibility Principle:
1.  `AiReviewStudio` encapsulates all AI interactions.
2.  `ExportPanel` encapsulates download logic.
3.  `Step3Review` composes these elements without needing to understand *how* they work, ensuring the pipeline can be easily modified or extended without breaking state synchronization.
