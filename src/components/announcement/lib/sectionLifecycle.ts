// Pure transition functions over SectionWorkspace<TComponents, TAccepted>.
//
// Framework-free (no React) so they can be unit-tested in isolation and reused
// identically by every Announcement section workspace. This is a deliberate
// COPY of Technical Alert v2's sectionWorkspace.ts (the domain-neutral state
// engine), not an import: Phase 1 copies it into the Announcement module to
// guarantee zero risk of regressing Technical Alert while the two evolve; a
// later phase may converge them into a shared lib once the Announcement API is
// proven. The control-info staleness cause (relevant only to Technical Alert's
// ControlInformation) is omitted here -- Announcement has no such construct.

import { Finding, RevisionRef, SectionWorkspace } from "../announcementTypes";

export function createEmptySectionWorkspace<TComponents, TAccepted>(
  initialComponents: TComponents | null = null
): SectionWorkspace<TComponents, TAccepted> {
  return {
    raw: "",
    analysis: { components: initialComponents, findings: [], ranAt: null },
    suggestion: { value: null, basedOn: null, requestId: null },
    accepted: null,
    freshness: "fresh",
    currentRevision: { revision: 0 },
    inFlightRequest: null,
    loading: false,
    error: null,
  };
}

function bump(rev: RevisionRef): RevisionRef {
  return { revision: rev.revision + 1 };
}

function sameRevision(a: RevisionRef | null, b: RevisionRef | null): boolean {
  return !!a && !!b && a.revision === b.revision;
}

/** User edits raw source. Bumps revision, discards any pending suggestion (it
 * was generated against now-superseded raw text), and marks previously-accepted
 * content stale rather than clearing it. */
export function editRaw<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  raw: string
): SectionWorkspace<TComponents, TAccepted> {
  return {
    ...ws,
    raw,
    currentRevision: bump(ws.currentRevision),
    suggestion: { value: null, basedOn: null, requestId: null },
    freshness: ws.accepted ? "stale" : ws.freshness,
  };
}

/** User hand-edits the structured components. Bumps revision for the same
 * reason as editRaw. */
export function editComponents<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  components: TComponents
): SectionWorkspace<TComponents, TAccepted> {
  return {
    ...ws,
    analysis: { ...ws.analysis, components },
    currentRevision: bump(ws.currentRevision),
    suggestion: { value: null, basedOn: null, requestId: null },
    freshness: ws.accepted ? "stale" : ws.freshness,
  };
}

/** Call when an analyze/rewrite request is issued, before awaiting the
 * response, so isResponseCurrent() has something to check against. */
export function beginRequest<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  requestId: string
): SectionWorkspace<TComponents, TAccepted> {
  return {
    ...ws,
    loading: true,
    error: null,
    inFlightRequest: { requestId, revisionAtRequestTime: ws.currentRevision },
  };
}

/** Analysis response lands. Does not bump revision (it's a response TO a
 * revision, not an edit) and never touches accepted content. Caller must check
 * isResponseCurrent() first. */
export function applyAnalysisResult<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  components: TComponents,
  findings: Finding[]
): SectionWorkspace<TComponents, TAccepted> {
  return {
    ...ws,
    analysis: { components, findings, ranAt: ws.currentRevision },
    loading: false,
    inFlightRequest: null,
  };
}

/** Rewrite response lands as a pending suggestion -- never canonical until
 * accept() is called. Caller must check isResponseCurrent() first. */
export function applySuggestion<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  value: TAccepted,
  requestId: string
): SectionWorkspace<TComponents, TAccepted> {
  return {
    ...ws,
    suggestion: { value, basedOn: ws.currentRevision, requestId },
    loading: false,
    inFlightRequest: null,
  };
}

/** Call when an issued request fails. Skips clobbering state if a newer request
 * has already superseded this one, so a slow failed request can't blank out a
 * newer in-flight one. */
export function failRequest<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  requestId: string,
  error: string
): SectionWorkspace<TComponents, TAccepted> {
  if (!isResponseCurrent(ws, requestId)) return ws;
  return { ...ws, loading: false, error, inFlightRequest: null };
}

export function dismissSuggestion<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>
): SectionWorkspace<TComponents, TAccepted> {
  return { ...ws, suggestion: { value: null, basedOn: null, requestId: null } };
}

/** Promote the pending suggestion to accepted. Editing the suggestion in place
 * before calling this does not change its AI provenance. */
export function acceptSuggestion<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  now: string = new Date().toISOString()
): SectionWorkspace<TComponents, TAccepted> {
  if (ws.suggestion.value === null) return ws;
  return {
    ...ws,
    accepted: {
      value: ws.suggestion.value,
      source: "ai",
      basedOn: ws.currentRevision,
      acceptedAt: now,
    },
    suggestion: { value: null, basedOn: null, requestId: null },
    freshness: "fresh",
  };
}

/** Accept hand-filled components with no AI round-trip at all -- the fully
 * AI-free manual path. */
export function manualAccept<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  value: TAccepted,
  now: string = new Date().toISOString()
): SectionWorkspace<TComponents, TAccepted> {
  return {
    ...ws,
    accepted: { value, source: "manual", basedOn: ws.currentRevision, acceptedAt: now },
    suggestion: { value: null, basedOn: null, requestId: null },
    freshness: "fresh",
  };
}

/** Power-user path: edit already-accepted content directly, with an explicit
 * commit that re-stamps basedOn to the current revision (clears staleness). */
export function editAcceptedDirectly<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  value: TAccepted,
  now: string = new Date().toISOString()
): SectionWorkspace<TComponents, TAccepted> {
  if (!ws.accepted) return ws;
  return {
    ...ws,
    accepted: { ...ws.accepted, value, basedOn: ws.currentRevision, acceptedAt: now },
    freshness: "fresh",
  };
}

export function isStale<TComponents, TAccepted>(ws: SectionWorkspace<TComponents, TAccepted>): boolean {
  return ws.freshness === "stale";
}

/** Stale-response guard: a response is only current if its requestId matches
 * the section's latest *issued* request AND the revision hasn't advanced since
 * the request was issued. Call this before applyAnalysisResult/applySuggestion
 * and skip applying the response if it returns false. */
export function isResponseCurrent<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  requestId: string
): boolean {
  return (
    !!ws.inFlightRequest &&
    ws.inFlightRequest.requestId === requestId &&
    sameRevision(ws.currentRevision, ws.inFlightRequest.revisionAtRequestTime)
  );
}
