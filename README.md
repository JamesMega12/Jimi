# FCO Drafting Assistant (TechCom MVP)

The **FCO Drafting Assistant** is a professional, full-stack prototype application designed to help technology and lifecycle management engineers rewrite raw, unstructured Field Change Order (FCO) engineering notes into operator-friendly, structured drafts ready for Technical Communications (TechCom) and FSQE safety reviews.

By targeting trained operators rather than other design engineers, the tool standardizes safety exclusions, isolates technical fact sets, restarts sequential item lists at index 1 for every procedural block, and flags missing or critical references via structural compliance checkmarks.

---

## Technical Architecture Overview

- **Frontend Hub:** Built with **React 19 / Vite 6 / TypeScript / Slate Theme**. It supports tabbed workspaces, interactive integrity checkboxes, validation audit dashboards, and export outputs (Markdown / JSON).
- **Backend Service:** Implemented in **Express 4 / Tsx / Esbuild / TypeScript**. It provides a robust proxy pipeline connecting to the Gemini 3.5 Flash Model safely, hiding keys from browser environments.
- **Safety Fallback Engine:** Features a high-integrity conservative local parsing heuristic that activates if the Gemini API experiences network errors, rate-limiting, or timeouts, preserving all proprietary metrics without hallucinations.

---

## Installation & Setup

Ensure you have **Node.js v20+** installed on your workstation.

### 1. Install Dependencies
Install the required system libraries at the root directory:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file at the root (or copy `.env.example` as a baseline) and supply your API credential:
```env
# Root directory - .env
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
```

---

## Running the Application

This repository operates on a single-socket full-stack framework where Express mounts Vite development middleware on port `3000`.

### Development Mode (with Vite HMR and Express active)
Run the development server natively:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Production Compiling and Execution
Compile the React static files and bundle the TypeScript backend using `esbuild` into a self-contained CommonJS target (`dist/server.cjs`):
```bash
npm run build
npm run start
```

---

## API Endpoints Definition

### Rewrite FCO Draft Pipeline
- **Method:** `POST`
- **Route:** `/api/fco/rewrite`
- **Headers:** `Content-Type: application/json`

#### Request Payload Schema
```json
{
  "title": "SLB-400 Valve Assembly O-ring Retrofit",
  "priority": "Required",
  "changeTypeOverride": "Physical / Hardware Change",
  "affectedEquipment": "SLB-400 High Pressure Separator Series B",
  "knownSafetyRisks": "Hydraulic pressure discharge",
  "existingReferences": "SWI-3040 Rev C, InTouch 99281",
  "customDirectives": "Emphasize fluid injection hazard.",
  "rawSummary": "Raw engineers summary text...",
  "rawProcedure": "Step 1. Perform lockout tagout..."
}
```

#### Response Body Schema
```json
{
  "rewrittenSummary": {
    "problem": "String Problem",
    "cause": "String Cause",
    "solution": "String Solution",
    "benefit": "String Benefit",
    "wordCount": 110,
    "withinWordLimit": true
  },
  "rewrittenProcedure": {
    "changeType": "Physical / Hardware Change",
    "sections": [
      {
        "title": "A. Safety",
        "steps": ["Step 1", "Step 2"],
        "notes": ["Note 1"],
        "cautions": [],
        "warnings": ["Warning 1"]
      }
    ]
  },
  "whatWasEdited": {
    "changeTypeIdentified": "Physical / Hardware Change",
    "summaryWordingEdits": [
      {
        "original": "old engineering description",
        "rewritten": "new active text"
      }
    ],
    "procedureWordingEdits": [],
    "structuralEdits": ["Applied Forced Labels formatting to Summary"],
    "preservedTechnicalInformation": ["PN-9942A"]
  },
  "techComReviewNotes": {
    "missingInformation": [],
    "safetyItemsToConfirm": ["Isolate local hydraulic pump HV-02"],
    "referencesToConfirm": [],
    "technicalItemsToConfirm": [],
    "changeTypeConfirmation": [],
    "directiveConfirmation": []
  },
  "diagnostics": {
    "engineUsed": "gemini",
    "confidenceLevel": "high",
    "fallbackReason": null,
    "summaryWordLimitPassed": true,
    "numberingRestarted": true,
    "technicalValuesPreserved": true,
    "requiresTechComReview": true
  },
  "rawMarkdown": "Markdown compilation of the draft...",
  "rawJson": {}
}
```

---

## Local Heuristic Fallback Engine

If the backend encounters failures (timeout of 12 seconds, invalid JSON responses, missing credentials, quota limits, or network timeouts), the Express route captures the exception, logs it, and executes the **Local Heuristic Fallback Engine**:

- **Summary Isolation:** Searches raw text sequentially for problems, causes, solutions, and benefits, inserting the indicator `[Information required from submitter]` if any are left blank.
- **Change Type Detection:** Employs precise keyword matching to classify the draft into physical hardware, software config, documentation, or policy.
- **Section Parsing:** Distributes matching lines dynamically amongst standard SWI heading structures (Safety, Preparation, Implementation, Verification, Completion).
- **Conservative Values Preservation:** Leverages safe, non-hallucinating regex pattern matching to ensure part numbers, software updates, and tolerances are compiled untouched. No design parameters or benefits are ever invented.
- **Status Badges:** Flags `"engineUsed": "local_heuristic"` to render an amber status banner on the user interface, warning TechCom reviewers.

---

## Constraints & Limitations

1. **MVP Scope:** Only summary and procedural rewrites are operational. Expanded templates (approver maps, parts tables, or historic revisions) are bypassed for this release.
2. **Precision Level:** The tool standardizes formatting layout. It does **not** evaluate technical design feasibility.
3. **Security Constraints:** API credentials are fully secured and reside strictly in backend process vectors.

---

## TechCom Advisory Disclaimer

> ⚠️ **IMPORTANT SAFETY ADVISORY:** All draft material compiled is designated for Technical Communications (TechCom) review only. It does not substitute or replace FSQE, InTouch Engineering, local field decision-makers, or administrative management sign-off channels.
