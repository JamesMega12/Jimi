import type { AnnouncementDraft, WorkflowStage, SectionWorkspace } from "../components/announcement/announcementTypes";

// Announcement draft persistence -- mirrors technicalAlertPersistenceV2.ts so a
// browser refresh no longer loses an in-progress Announcement. A SINGLE key
// holding the latest draft (overwritten each save, never appended), so it
// cannot accumulate or fill on its own; a whole draft is a few KB of text.
// Every localStorage touch is wrapped in try/catch: a full quota degrades to
// in-memory only (no crash, current session unaffected), and corrupt/old data
// on load falls through to a fresh start rather than throwing.

const KEY = "announcement_workflow_state_v1";

interface PersistedAnnouncementState {
  schemaVersion: 1;
  draft: AnnouncementDraft;
  stage: WorkflowStage;
}

// Reset transient, per-request fields so a refresh mid-request never restores a
// stuck spinner or an orphaned in-flight guard. Accepted/pending/analysis/raw
// content is preserved.
function sanitizeSection<TC, TA>(ws: SectionWorkspace<TC, TA>): SectionWorkspace<TC, TA> {
  return { ...ws, loading: false, inFlightRequest: null, error: null };
}

export function loadAnnouncementState(): { draft: AnnouncementDraft; stage: WorkflowStage } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAnnouncementState;
    if (!parsed || parsed.schemaVersion !== 1 || !parsed.draft?.sections) return null;
    const d = parsed.draft;
    d.sections = {
      summary: sanitizeSection(d.sections.summary),
      reason: sanitizeSection(d.sections.reason),
      action: sanitizeSection(d.sections.action),
    };
    return { draft: d, stage: parsed.stage ?? "drafting" };
  } catch {
    return null; // corrupt / old schema / unavailable -> fresh start
  }
}

export function saveAnnouncementState(draft: AnnouncementDraft, stage: WorkflowStage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, draft, stage } satisfies PersistedAnnouncementState));
  } catch {
    // quota exceeded / storage disabled -> degrade to in-memory only
  }
}

export function clearAnnouncementState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
