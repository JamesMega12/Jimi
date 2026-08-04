# Multi-Workflow Architecture

This application acts as a multi-workflow platform, currently supporting two independent drafting workflows:

1. **FCO Draft Assistant**
2. **TechCom Announcement App**

## Architecture Guidelines

- **Coexistence**: Both workflows coexist cleanly in the same codebase. FCO functionality is preserved entirely.
- **App Shell**: The `AppShell` component serves as the main entry point, providing a landing page for selecting the active workflow.
- **State Isolation**: 
  - FCO workflow state is managed within `AppWorkflow` and its children.
  - TechCom workflow state is managed within `TechComWorkflow` (using `TechComDraft` types) and its children.
  - State does not leak between workflows. Switching workflows unmounts the active workflow and mounts the selected one.
- **Route Isolation**:
  - FCO features (validation, FCO rewrite, FCO docx export) use routes prefixed implicitly or explicitly for FCO (e.g., `/api/fco/*` or `/api/*` defined before TechCom routes).
  - TechCom features use isolated routes prefixed with `/api/techcom/*`.
  - The workflows do not call each other's backend endpoints.
- **Export Determinism**:
  - Both workflows implement deterministic DOCX export.
  - No LLM (Gemini) calls are made during the export phase of either workflow.
- **Document Types**: 
  - TechCom specifically supports `Announcement` and `Technical Alert` only. It explicitly avoids the FCO-specific `Needs Human Decision` type.

## Folder Organization

- `src/components/` - Home of FCO specific and general components.
- `src/components/techcom/` - Home of TechCom specific components.
- `src/server/routes/techComRoutes.ts` - TechCom specific Express routes.
- `src/server/techComDocxExportService.ts` - TechCom specific DOCX export logic.
