# FCO & TechCom Drafting Platform: Developer & Pipeline Guide

Welcome to the **FCO & TechCom Drafting Platform** developer documentation. This guide is designed to help engineers who are completely new to the codebase understand the core architecture, data pipelines, step-by-step workflows, and folder organization so that they can quickly start developing and maintaining features.

---

## 1. High-Level Executive Summary

The application is an enterprise-grade drafting workspace for technology and safety engineers. Its primary purpose is to take **raw, unstructured engineering notes** and convert them into **operator-focused, highly structured technical documents** that comply with strict technical writing standards.

The workspace supports two independent workflows:
1. **FCO Draft Assistant**: Used for drafting, validating, and structuring Field Change Orders (FCOs).
2. **TechCom Announcement App**: Used for creating Technical Announcements and Technical Alerts targeting field operators.

Both applications adhere to the **"AI Proposes, Human Disposes"** philosophy: AI suggestively rewrites and structures text, but the human reviewer maintains final authority and can selectively accept or edit drafts before exporting to standard OpenXML DOCX formats.

```
                  ┌──────────────────────────────────────────────┐
                  │                 Landing Page                 │
                  │                 (AppShell.tsx)               │
                  └──────────────┬────────────────┬──────────────┘
                                 │                │
            ┌────────────────────┘                └────────────────────┐
            ▼                                                          ▼
┌───────────────────────────────┐                          ┌───────────────────────────────┐
│     FCO Drafting Workflow     │                          │   TechCom Drafting Workflow   │
│      (AppWorkflow.tsx)        │                          │     (TechComWorkflow.tsx)     │
└───────────────────────────────┘                          └───────────────────────────────┘
```

---

## 2. Tech Stack

* **Frontend**: React 18/19, TypeScript, Tailwind CSS, Vite 6, Lucide Icons.
* **Backend**: Node.js, Express, `tsx` (for direct TypeScript execution in dev), `esbuild` (for compiling the backend into `dist/server.cjs` for production).
* **AI/LLM Engine**: Google GenAI SDK (`@google/genai` calling Gemini 3.5 Flash) with structured JSON schemas.
* **Local Safety Fallback Engine**: A robust regex-based parser that handles offline mode, rate limits, or credentials failure without hallucinating technical metrics.
* **Document Compilation**: Server-side deterministic OpenXML generation using the `docx` library.

---

## 3. Data Models & State Architecture

### Component Composition & Canonical State
Both workflows maintain a single, deeply nested object as the **canonical source of truth** in their root components. This state is passed down to children steps alongside dispatcher functions. This avoids state synchronization bugs, ensures the UI matches the export, and enforces modularity.

* **FCO Workspace Entry Point**: `src/components/AppWorkflow.tsx` (manages `formData` conforming to `FcoDraft`).
* **TechCom Workspace Entry Point**: `src/components/techcom/TechComWorkflow.tsx` (manages `draft` conforming to `TechComDraft`).

### Core Interface: `FcoDraft` (Simplified)
```typescript
export interface FcoDraft {
  fcoMetadata: {
    baseProductCode: string;
    fcoNumber: string;
    fcoTitle: string;
    priority: 'Urgent' | 'Required' | 'Preferred' | '';
    appliesTo: string;
    // ...
  };
  associatedInfo: {
    associatedTechAlerts: string;
    qCheckServiceLevel: string;
    // ...
  };
  technicalContent: {
    draftSummary: string;
    draftProcedure: string;
    knownSafetyRisks: string;
    existingReferences: string;
    optionalRewriteInstructions: string;
    procedureCallouts?: ProcedureCallout[];
    procedureReadinessSuggestions?: ProcedureReadinessSuggestion[];
  };
  fcoTables?: {
    partsOrKitsRequired: { status: 'active' | 'not_applicable'; rows: any[] };
    specialEquipmentRequired: { status: 'active' | 'not_applicable'; rows: any[] };
    partsRequiringRework: { status: 'active' | 'not_applicable'; rows: any[] };
    partsToScrap: { status: 'active' | 'not_applicable'; rows: any[] };
  };
  visualPlaceholders?: Array<{ id: string; type: 'figure' | 'table'; ... }>;
}
```

### Core Interface: `TechComDraft` (Simplified)
```typescript
export interface TechComDraft {
  documentType: "Announcement" | "Technical Alert";
  metadata: {
    classification: string;
    documentNumber: string;
    inTouchId: string;
    date: string;
    gemsNo: string;
    title: string;
  };
  controlInfo: {
    deadline: string;
    actionBy: string[];
    informationFor: string[];
    acknowledgementRequired: boolean;
    quizRequired: boolean;
  };
  rawSections: {
    summaryInput: string;
    reasonInput: string;
    actionInput: string;
  };
  summary: {
    whatHappenedOrChanged: string;
    whyItMatters: string;
    affectedScope: string;
    requiredAction: string;
  };
  reasonOrBackground: string;
  actions: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    prohibited: string[];
    exemptionRequired: string;
    operatorInstructions: string[];
    acknowledgementInstructions: string[];
  };
  figures: TechComFigurePlaceholder[];
  tables: TechComTablePlaceholder[];
  references: TechComReferenceItem[];
}
```

---

## 4. End-to-End Workflows & Pipelines

### A. FCO Drafting Assistant Workflow

```
   ┌───────────────────────────────────────────────────────────────┐
   │ Step 1: Ingestion, Analysis & AI Suggestion                   │
   │ (Manual draft input OR docx upload → AI processing & diffs)   │
   └──────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
   ┌───────────────────────────────────────────────────────────────┐
   │ Step 2: Structured Enrichment                                 │
   │ (Enter Advanced Metadata, Equipment Models, and Part Tables)  │
   └──────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
   ┌───────────────────────────────────────────────────────────────┐
   │ Step 3: Assembly, Validation & DOCX Export                    │
   │ (Placeholder Integrity checks, Readiness warnings, Download)  │
   └───────────────────────────────────────────────────────────────┘
```

#### Step 1: Ingestion & AI Rewrite (`Step1Context.tsx` & `AiReviewStudio.tsx`)
* **Manual Input / File Extraction**: Supports copy-pasting or uploading an existing raw engineering document. It parses the document layout, segments headings, and loads it into UI state.
* **AI Processing**: Compiles the draft and forwards it to the `/api/fco/rewrite` endpoint. The model restructures headings, enforces operator-friendly rules (active voice, safety alerts separated from actions, no double step instructions), and returns structured paragraphs.
* **Diff Interface**: Renders an interactive word-level and line-level side-by-side diff comparison so the engineer can inspect exact phrasing revisions before applying.

#### Step 2: Advanced Metadata & Tables (`Step2Content.tsx` & `FcoTablesEditor.tsx`)
* **Metadata & Coding**: Collects compliance metrics like Q-Check service levels, estimated hours, and capital categorization.
* **Structured Data Tables**: Edits relational information like Part Kits Required, Special Equipment, and Parts to Scrap with interactive CRUD rows.

#### Step 3: Review, Validate & Export (`Step3Review.tsx`)
* **Readiness Audit**: The validation engine runs automatic compliance audits: checking whether word limits are respected, sequential numbering restarts correctly at index 1 for each subsection, and required references are kept.
* **Placeholder Integrity**: Compares bracketed image tokens (e.g., `[Figure 1]`, `[Table 2]`) between input and output text via regex matching to prevent the AI from dropping figures or inventing new ones.
* **Deterministic DOCX compilation**: Sends finalized draft state to `/api/fco/export-docx`, which renders the structured OpenXML binary package directly via code. No AI dependencies are triggered during export.

---

### B. TechCom Announcement App Workflow

```
┌────────────────────────────────┐       ┌────────────────────────────────┐
│  Step 1: Ingest & Select Type  │ ───►  │ Step 2: Metadata & Analysis    │
│  (Manual Inputs, Doc Type)     │       │ (Control Info, Placeholders)   │
└────────────────────────────────┘       └──────────────┬─────────────────┘
                                                        │
┌────────────────────────────────┐       ┌──────────────▼─────────────────┐
│  Step 4: Preview & DOCX Export │ ◄───  │ Step 3: Review AI Rewrite      │
│  (Final styling, unresolved Pl)│       │ (Interactive Section Diffs)    │
└────────────────────────────────┘       └────────────────────────────────┘
```

#### Step 1: Document Setup (`TechComStepDraftEditor.tsx`)
* **Select Class**: Announcement vs. Technical Alert.
* **Raw Section Capture**: Captures draft text across three separate fields: **Summary**, **Reason / Background**, and **Required Action**.

#### Step 2: Metadata & Structuring (`TechComStepDraftEditor.tsx` / `TechComAnalysisResult.tsx`)
* **Control Metadata**: Identifies mandatory metrics like Deadlines, Action-by roles, Acknowledgement/Quiz needs, and GEMS tracking numbers.
* **Structure Validation**: Back-end analyzes draft clarity and assesses **One-Page Document Risk** (calculating length risk to avoid field announcements overflowing one sheet of paper).
* **Integrity Analysis**: Validates figure/table placeholder preservation.

#### Step 3: Review AI Rewrite (`TechComStepRewriteFinalize.tsx`)
* **Selective Verification**: The AI processes raw text into formalized, operator-oriented instructions.
* **Interactive Acceptance Panels**: Suggestions are displayed as separate, high-contrast, card-level sections (Summary, Reason, Actions).
* **"Accept" with Acknowledgment State**: Reviewers can click **Accept** on individual cards. Clicking Accept persists the rewritten text directly into the canonical draft and displays an elegant, green **Accepted** indicator.
* **Change of Mind Safety**: The user is *not* immediately pushed out of Step 3 upon accepting a block. They can inspect all accepted metrics, change their mind, and edit text before manually clicking **Continue to Preview & Export** once fully satisfied.

#### Step 4: Preview & Export (`TechComStepPreviewExport.tsx`)
* **Visual WYSIWYG Sheet**: Formats text matching authentic company publication guidelines.
* **Dynamic Warnings**: Highlights missing details, open alerts, or unresolved/pending placeholders (e.g. `Figure 1: TODO`).
* **DOCX compilation**: Downloads a polished, standardized Word file compiled via `techComDocxExportService.ts`.

---

## 5. Directory Mapping & Code Structure

```
├── .env.example                       # Reference environment configuration
├── ARCHITECTURE.md                    # Core system architectural specs
├── server.ts                          # Express Server Entry Point (Vite middleware, API mounting)
├── vite.config.ts                     # Vite plugin setup, build target configurations
├── src/
│   ├── App.tsx                        # Main switch managing route routes and global views
│   ├── AppShell.tsx                  # Global portal container enabling workflow selection
│   ├── index.css                      # Global stylesheet (Imports Tailwind CSS and Google Fonts)
│   ├── types.ts                       # Standard TypeScript Interfaces for FCO and TechCom Schemas
│   ├── lib/
│   │   ├── diff.ts                    # Word diff engine compiling added/removed/unchanged tokens
│   │   ├── placeholderDetection.ts    # Regex AST utilities tracking figures and tables
│   │   └── techComPlaceholderIntegrity.ts # Integrity checker mapping figures and tables for TechCom
│   ├── components/
│   │   ├── AppWorkflow.tsx            # Root component managing state/routing for the FCO pipeline
│   │   ├── AiReviewStudio.tsx         # Diffs visualization and AI interface for FCO Summary & Procedure
│   │   ├── FcoTablesEditor.tsx        # Structured CRUD grids for Parts, Kits, Special Equipment
│   │   ├── Step1Context.tsx           # Step 1 view container (Uploads, Raw Draft capture, suggest titles)
│   │   ├── Step2Content.tsx           # Step 2 view container (Advanced Metadata, Relational Grids)
│   │   ├── Step3Review.tsx            # Step 3 view container (Validation checklists, Export buttons)
│   │   └── techcom/                   # TECHCOM WORKFLOW SPECIFIC FRONTEND
│   │       ├── TechComWorkflow.tsx    # State hub and stepper router for TechCom
│   │       ├── TechComWorkflowStepper.tsx # Visual horizontal wizard bar (Steps 1 to 4)
│   │       ├── TechComStepDraftEditor.tsx # Capture raw sections and basic metadata
│   │       ├── TechComAnalysisResult.tsx # Panel showing readiness audits, missing fields, and One-Page Risks
│   │       ├── TechComStepRewriteFinalize.tsx # Interactive Accept Diffs panels with green confirmation alerts
│   │       └── TechComStepPreviewExport.tsx # Rich WYSIWYG letterhead preview & DOCX exporter
│   └── server/                        # BACKEND SERVICE CODE
│       ├── fallbackEngine.ts          # Regular Expression and keyword-matching local parsing fallback
│       ├── fcoSystemPrompt.ts         # Safety rules, restart-numbering directives for FCO LLM
│       ├── techComSystemPrompt.ts     # TechCom language, Announcement vs Technical Alert directives
│       ├── techComSchemas.ts          # Strict JSON return descriptions for Gemini Schema validation
│       ├── techComInstructionPacks.ts # Segmented prompts for Formatting, Analysis, and Rewriting modes
│       ├── techComDocxExportService.ts # Procedural compilation mapping TechCom to OpenXML layouts
│       ├── docxExportService.ts       # Procedural compilation mapping FCO JSON to OpenXML tables
│       └── routes/
│           ├── docxRoutes.ts          # Ingestion extraction and DOCX export routes
│           └── techComRoutes.ts       # TechCom endpoint pipeline (Format, Analyze, Rewrite, DOCX)
```

---

## 6. Behind the Scenes: The Backend API Routing

### FCO Routes Summary (`src/server/routes/docxRoutes.ts`)
* `POST /api/fco/rewrite`: Main LLM proxy calling Gemini to structure Summaries and clean up Procedures.
* `POST /api/fco/suggest-title`: Quickly scans raw texts and recommends a relevant FCO title.
* `POST /api/fco/evaluate-summary`: Gradual parsing to ensure problem/cause/solution/benefit are separated.
* `POST /api/fco/export-docx`: Translates the deep `fcoDraft` structure into structured tables and bullets.

### TechCom Routes Summary (`src/server/routes/techComRoutes.ts`)
* `POST /api/techcom/format`: Arranges unstructured pastes into classified metadata and sections.
* `POST /api/techcom/analyze`: Grades draft completeness, extracts figures/tables, and compiles warnings.
* `POST /api/techcom/rewrite`: Invokes Gemini to rewrite specific sections (Summary, Reason, Actions, or All). Matches the prompt directly to the strict JSON descriptor in `techComSchemas.ts` for guaranteed structural parsing.
* `POST /api/techcom/export-docx`: Packages metadata, control info, summary cards, and tables into a clean publication template.

---

## 7. Developer Onboarding & Development Workflow

### Step 1: Install Dependencies
Ensure you are using **Node.js v20+** and run:
```bash
npm install
```

### Step 2: Configure Keys
Create a local `.env` file at the root of the project:
```env
GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
```
*(Never commit `.env` files to git repositories).*

### Step 3: Run the Development Server
```bash
npm run dev
```
This runs the Express API and Vite development middleware concurrently on [http://localhost:3000](http://localhost:3000).

### Step 4: Verification (Linting & Compiling)
Always run the local validation tools to catch syntax or type mismatches before making a pull request:
```bash
# Verify TypeScript compile safety and type definitions
npm run lint

# Compile and bundle static files and backend server
npm run build
```

---

## 8. Common Architectural Rules for Developers

1. **State Isolation**: When creating components, do not pollute global state unless necessary. Lift state to `AppWorkflow.tsx` (for FCO) or `TechComWorkflow.tsx` (for TechCom) only if that state must be shared across steps or exported.
2. **Never Call Gemini on Export**: Word document compilation must always operate on finalized local JSON data. Adding asynchronous LLM network calls during DOCX export introduces non-deterministic lag and increases timeout rates.
3. **No Direct Secret Exposure**: Never write any React components calling the Gemini endpoint directly or using `import.meta.env.VITE_GEMINI_API_KEY`. All Gemini operations are proxied through server-side routing endpoints to shield secrets.
4. **Fallback Integrity**: Any edits to system prompt instructions should be matched with corresponding unit testing or local regex fallbacks (`fallbackEngine.ts`) to ensure offline/failover operations do not crash.
