# PHASE UI-1 INSPECTION AND IMPLEMENTATION PLAN

## Files/Components Found
- `src/components/Step1Context.tsx`: The main component containing the wizard form for Step 1.
- `src/components/AppWorkflow.tsx`: Handles overall step navigation and state, which will not need changes directly for this UI reorganization.
- `src/types.ts`: Defines `FCORequestData` and `FCODraft` schema, including all necessary metadata and technical content fields.

## Current Step 1 Structure
Currently, Step 1 is built as a dense, traditional metadata-first form. It is organized into 5 sections:
1. Header / Identification (FCO metadata inputs)
2. Core FCO Context (Draft Summary, Draft Procedure, Safety Risks)
3. Associated Information (RFIs, superseding info, etc.)
4. Cost and Schedule
5. Additional FCO Information

## Proposed New Step 1 Layout
The new Step 1 will invert the hierarchy, emphasizing a "Start Draft" experience rather than data entry.
1. **Hero Section (Start Draft):**
   - **Draft Summary Input** (prominent large text area)
   - **Draft Procedure Input** (prominent large text area)
2. **AI Capability Cards:**
   - Small cards/banners under or beside the drafting area highlighting features like "AI will auto-format your procedure," "AI will suggest warning callouts," etc., to immediately surface system capabilities.
3. **Minimum FCO Identity Fields:**
   - A collapsed or compact section displaying only the required identity fields: Base Product Code, FCO Number, FCO Title, Priority, Affected Equipment / Model, and Applies To.
4. **Title Suggestion Action:**
   - A button next to the "FCO Title" input that triggers an AI title suggestion based on the entered Summary and Procedure.
   - We will remove Sections 3, 4, and 5 from Step 1, or hide them behind an "Advanced Metadata" toggle, to keep the focus on drafting (if not explicitly required to keep, we'll hide them or remove them if they belong to a later step. However, the prompt says "minimum FCO identity fields" so we will likely just show those and keep the others collapsed/hidden).

## State Paths Affected
- **Draft Summary:** `formData.fcoDraft.technicalContent.draftSummary`
- **Draft Procedure:** `formData.fcoDraft.technicalContent.draftProcedure`
- **Base Product Code:** `formData.fcoDraft.fcoMetadata.baseProductCode`
- **FCO Number:** `formData.fcoDraft.fcoMetadata.fcoNumber`
- **FCO Title:** `formData.fcoDraft.fcoMetadata.fcoTitle` (and legacy `formData.title`)
- **Priority:** `formData.fcoDraft.fcoMetadata.priority` (and legacy `formData.priority`)
- **Affected Equipment:** `formData.fcoDraft.fcoMetadata.affectedEquipmentModel` (and legacy `formData.affectedEquipment`)
- **Applies To:** `formData.fcoDraft.fcoMetadata.appliesTo` (and legacy `formData.appliesTo`)

## Title Suggestion Data Flow
1. User clicks "Suggest FCO Title" button.
2. Component sends a request to a new or existing backend route (e.g., `/api/suggest-title`) containing the current `draftSummary`, `draftProcedure`, and any filled metadata.
3. The server uses Gemini to generate a concise, professional title.
4. The suggested title is returned to the frontend and displayed in a temporary state (e.g., a modal, a tooltip, or an inline preview beneath the title field).
5. The user can review the suggestion and click "Accept" (which updates `formData.fcoDraft.fcoMetadata.fcoTitle`) or dismiss it. The canonical state is not updated until explicit acceptance.

## Risks
- **Schema & State Sync:** Accidentally breaking the top-level legacy state sync (e.g. `formData.title`, `formData.priority`) when reorganizing inputs.
- **Validation:** Removing or hiding fields that might be required by existing validation rules in `AppWorkflow.tsx` or Step 1 validation.
- **Lost Data:** Hiding sections (Cost/Schedule, Associated Info) might prevent users from entering them if they aren't moved to another step or made accessible via an "Advanced" accordion.

## Minimal Patch Sequence
1. **Reorganize Layout in `Step1Context.tsx`:** Move Draft Summary and Draft Procedure to the very top.
2. **Add AI Capability Cards:** Insert simple UI components (using Lucide icons) to explain the AI benefits.
3. **Refine Metadata Fields:** Create a dedicated "Minimum FCO Identity Fields" section containing only the 6 specified fields. Move all other existing metadata fields into a collapsed `<details>` or "Advanced Metadata" accordion to preserve state without cluttering.
4. **Implement "Suggest Title" UI:** Add the button, the loading state, and the inline preview for the title suggestion flow (we will mock the API call or implement the API endpoint in a later step if needed, or implement it now if required).

## What Not to Touch
- Do not change backend rewrite behavior or `fco-rewrite` prompts.
- Do not modify DOCX export services or template logic.
- Do not touch instruction packs or Readiness Lifecycle.
- Do not remove the placeholder validation logic.
- Do not alter `fcoDraft` schema structure.
- Do not touch Phase D1b export logic.
