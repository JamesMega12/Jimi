import { SectionId } from './types';

// Pure, unit-testable detection of which neighbor sections the Summary was
// AI-grounded on have since changed -- extracted out of the React effect in
// TechnicalAlertWorkflowV2 (same rationale as computeDependentSectionsFromControlInfoChange
// in controlInfoDependency.ts).
//
// The key correctness point: a neighbor is only "something the summary was
// written from" if it had accepted content at grounding time -- i.e. its
// snapshot value is non-null. A neighbor that was UNACCEPTED at grounding time
// (null) and is accepted later is NOT a change to the summary's grounding (the
// summary never saw it), so it must not fire staleness. A grounded neighbor
// that is later removed (value -> null) DOES count, since the thing the summary
// was written from has changed.

/** Given the Summary's grounding snapshot (JSON string per neighbor id, or null
 *  if that neighbor was unaccepted at grounding time) and the current
 *  serialized neighbor values, return exactly the grounded neighbors that have
 *  since changed. */
export function computeChangedGroundedNeighbors(
  grounded: Record<string, string | null> | undefined,
  current: Record<string, string | null>
): SectionId[] {
  if (!grounded) return [];
  return (Object.keys(current) as SectionId[]).filter(k => {
    const was = grounded[k] ?? null;
    return was !== null && current[k] !== was;
  });
}
