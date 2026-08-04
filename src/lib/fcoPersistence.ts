import type { FCORequestData } from "../types";

// FCO draft persistence -- mirrors announcementPersistence.ts /
// technicalAlertPersistenceV2.ts so a browser refresh no longer loses an
// in-progress FCO draft. A SINGLE key holds the latest draft (overwritten each
// save, never appended), so it cannot accumulate; a whole draft is a few KB of
// text. Every localStorage touch is wrapped in try/catch: a full quota degrades
// to in-memory only (no crash), and corrupt/old data on load falls through to a
// fresh start rather than throwing.
//
// Only canonical, non-transient state is persisted: the whole `formData`
// (canonical fcoDraft + accepted content + the legacy flat mirror) plus the
// current step. Pending AI output, loading flags, request guards, and errors
// live in useFcoDraftingState (React state / refs), NOT in formData, so they are
// never persisted -- a refresh restores the accepted/raw draft with no stuck
// spinner or orphaned in-flight request. The key is FCO-specific, so it never
// collides with the Announcement / Technical Alert workflow state.

const KEY = "fco_workflow_state_v1";

interface PersistedFcoState {
  schemaVersion: 1;
  formData: FCORequestData;
  currentStep: number;
}

export function loadFcoState(): { formData: FCORequestData; currentStep: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedFcoState;
    // Reject anything without the current schema or a recognizable draft shape,
    // so an old/incompatible payload can never partially restore.
    if (!parsed || parsed.schemaVersion !== 1 || !parsed.formData?.fcoDraft) return null;
    const step =
      typeof parsed.currentStep === "number" && parsed.currentStep >= 1 && parsed.currentStep <= 4
        ? parsed.currentStep
        : 1;
    // Additive backfill, not a schema bump: drafts saved before checks/part-ids
    // existed have declaredParts with no id. Backfilling here (rather than
    // rejecting on schemaVersion mismatch) means an in-flight draft is never
    // discarded for a purely additive change -- legacy parts just can't be
    // targeted by a check's targetPartIds until backfilled.
    const declaredParts = parsed.formData.fcoDraft?.technicalContent?.declaredParts;
    if (Array.isArray(declaredParts) && declaredParts.some((p: any) => !p?.id)) {
      parsed.formData.fcoDraft.technicalContent.declaredParts = declaredParts.map((p: any) =>
        p?.id ? p : { ...p, id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) }
      );
    }
    return { formData: parsed.formData, currentStep: step };
  } catch {
    return null; // corrupt / old schema / unavailable -> fresh start
  }
}

export function saveFcoState(formData: FCORequestData, currentStep: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: 1, formData, currentStep } satisfies PersistedFcoState)
    );
  } catch {
    // quota exceeded / storage disabled -> degrade to in-memory only
  }
}

export function clearFcoState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
