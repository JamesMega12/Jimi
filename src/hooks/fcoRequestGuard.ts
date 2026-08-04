// Framework-free stale-response guard for the FCO drafting pipeline.
//
// One guard instance is held per async "section" (Summary rewrite/analyze,
// Procedure rewrite, Procedure readiness) inside useFcoDraftingState via useRef.
// It exists because the FCO source inputs stay editable while a rewrite is in
// flight: a late/superseded response must never be applied on top of state the
// user has since changed. This mirrors the revision + requestId semantics of the
// sibling workflows' src/components/announcement/lib/sectionLifecycle.ts, kept as
// a deliberately small copy (no React, so it is unit-testable in isolation).
//
// Contract for callers (see useFcoDraftingState):
//   const { id, signal } = begin(guard);        // before fetch; pass signal to fetch
//   ... await fetch(..., { signal }) ...
//   if (!isCurrent(guard, id)) return;          // AFTER each await, before any setState
//   ...apply response...
//   settle(guard, id);                          // request is done (success or handled error)
// On an invalidating edit / reset, call bump(guard): it advances the revision and
// aborts the in-flight request so its response is dropped by isCurrent().

export interface InFlightRequest {
  id: string;
  /** The guard's revision at the moment this request was issued. */
  rev: number;
}

export interface RequestGuard {
  /** Monotonic counter bumped whenever the section's inputs change / are reset. */
  revision: number;
  /** The request currently owning this section, or null when idle. */
  inFlight: InFlightRequest | null;
  /** AbortController for the in-flight request, so bump()/begin() can cancel it. */
  controller: AbortController | null;
}

export function createGuard(): RequestGuard {
  return { revision: 0, inFlight: null, controller: null };
}

let counter = 0;
function uid(): string {
  counter += 1;
  return `req-${Date.now()}-${counter}`;
}

export interface BeginResult {
  id: string;
  /** Passed to fetch(); undefined only in environments without AbortController. */
  signal: AbortSignal | undefined;
}

/**
 * Mark a new request as in flight for this section. Aborts any request that was
 * already in flight (defensive — the UI normally disables the trigger while
 * loading, but a new begin() must still supersede a prior one cleanly).
 */
export function begin(guard: RequestGuard): BeginResult {
  if (guard.controller) {
    guard.controller.abort();
  }
  const id = uid();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  guard.inFlight = { id, rev: guard.revision };
  guard.controller = controller;
  return { id, signal: controller ? controller.signal : undefined };
}

/**
 * Advance the revision and cancel any in-flight request. Call this whenever the
 * section's source of truth changes (raw edit, dependency change, reset) so that
 * a response already on the wire can no longer be applied.
 */
export function bump(guard: RequestGuard): void {
  guard.revision += 1;
  guard.inFlight = null;
  if (guard.controller) {
    guard.controller.abort();
    guard.controller = null;
  }
}

/**
 * True only if `id` is still the section's in-flight request AND the revision has
 * not advanced since it was issued. Check after every await, before any setState.
 */
export function isCurrent(guard: RequestGuard, id: string): boolean {
  return (
    !!guard.inFlight &&
    guard.inFlight.id === id &&
    guard.inFlight.rev === guard.revision
  );
}

/** Whether a request is genuinely in flight for this section right now. */
export function isInFlight(guard: RequestGuard): boolean {
  return guard.inFlight !== null;
}

/**
 * Clear the in-flight marker once a request has settled (applied or errored),
 * but only if it is still the current one — a superseded request must not clear
 * the marker of the request that replaced it.
 */
export function settle(guard: RequestGuard, id: string): void {
  if (guard.inFlight && guard.inFlight.id === id) {
    guard.inFlight = null;
    guard.controller = null;
  }
}

/**
 * Loading-state ownership check for a handler's `finally`: clear the shared
 * loading flag only if this request still owns the section (idle after settle,
 * or nothing newer has begun). Prevents a finishing request from clearing the
 * spinner of a newer in-flight one.
 */
export function ownsLoading(guard: RequestGuard, id: string): boolean {
  return guard.inFlight === null || guard.inFlight.id === id;
}
