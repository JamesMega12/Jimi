// Pure transition functions over SectionWorkspace<TComponents, TAccepted>.
//
// These are intentionally framework-free (no React) so they can be unit-tested
// in isolation and reused identically by all four section workspaces. See
// plans/role-you-are-working-delightful-cupcake.md "Human-Control and
// Acceptance Model" / "Freshness and Dependency Model" for the behavior spec
// each function below implements.

import { Finding, RevisionRef, SectionWorkspace } from './types';

export function createEmptySectionWorkspace<TComponents, TAccepted>(
  initialComponents: TComponents | null = null
): SectionWorkspace<TComponents, TAccepted> {
  return {
    raw: '',
    analysis: { components: initialComponents, findings: [], ranAt: null },
    suggestion: { value: null, basedOn: null, requestId: null },
    accepted: null,
    freshness: 'fresh',
    staleDueToControlChange: false,
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

/** User edits raw source. Bumps revision, discards any pending suggestion (it was
 * generated against now-superseded raw text), and marks previously-accepted
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
    freshness: ws.accepted ? 'stale' : ws.freshness,
  };
}

/** User hand-edits the structured components (whether AI-extracted or manually
 * filled). Bumps revision for the same reason as editRaw. */
export function editComponents<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  components: TComponents
): SectionWorkspace<TComponents, TAccepted> {
  return {
    ...ws,
    analysis: { ...ws.analysis, components },
    currentRevision: bump(ws.currentRevision),
    suggestion: { value: null, basedOn: null, requestId: null },
    freshness: ws.accepted ? 'stale' : ws.freshness,
  };
}

/** Call when an analyze/rewrite request is issued, before awaiting the
 * response, so isResponseCurrent() has something to check the eventual
 * response against. */
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

/** Server analysis response lands. Does not bump revision (it's a response TO a
 * revision, not an edit) and never touches accepted content. Caller must check
 * isResponseCurrent() first and skip calling this if the response is stale. */
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

/** Server rewrite response lands as a pending suggestion -- never canonical
 * until accept() is called. Caller must check isResponseCurrent() first. */
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

/** Call when an issued request fails or errors. Skips clobbering state if a
 * newer request has already superseded this one (same guard as the success
 * path), so a slow failed request can't blank out a newer in-flight one. */
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
      source: 'ai',
      basedOn: ws.currentRevision,
      acceptedAt: now,
    },
    suggestion: { value: null, basedOn: null, requestId: null },
    freshness: 'fresh',
    staleDueToControlChange: false,
  };
}

/** Accept hand-filled components with no AI round-trip at all -- the
 * fully-AI-free manual path the refactor plan requires end-to-end. */
export function manualAccept<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>,
  value: TAccepted,
  now: string = new Date().toISOString()
): SectionWorkspace<TComponents, TAccepted> {
  return {
    ...ws,
    accepted: { value, source: 'manual', basedOn: ws.currentRevision, acceptedAt: now },
    suggestion: { value: null, basedOn: null, requestId: null },
    freshness: 'fresh',
    staleDueToControlChange: false,
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
    freshness: 'fresh',
    staleDueToControlChange: false,
  };
}

/** A tracked control-info field (deadline/actionBy/effectiveTiming) changed
 * elsewhere in the draft. Marks accepted content stale for a distinct reason
 * from a raw/component edit, so the UI can explain "why" differently. */
export function markStaleDueToControlChange<TComponents, TAccepted>(
  ws: SectionWorkspace<TComponents, TAccepted>
): SectionWorkspace<TComponents, TAccepted> {
  if (!ws.accepted) return ws;
  return { ...ws, staleDueToControlChange: true };
}

export function isStale<TComponents, TAccepted>(ws: SectionWorkspace<TComponents, TAccepted>): boolean {
  return ws.freshness === 'stale' || ws.staleDueToControlChange;
}

/** Stale-response guard: a response is only current if its requestId matches
 * the section's latest *issued* request (tracked via beginRequest/
 * inFlightRequest, not the landed suggestion) AND the revision hasn't advanced
 * since the request was issued -- closes the gap where a raw/component edit
 * after a request was sent could let a since-superseded response land as if
 * fresh. Call this before applyAnalysisResult/applySuggestion and skip
 * applying the response if it returns false. */
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
