import { ControlInformation, ControlInfoField, SectionId, CONTROL_INFO_DEPENDENTS } from './types';

/** Pure function: given the previous and next ControlInformation, returns
 * exactly the set of sections that should be marked staleDueToControlChange
 * -- extracted out of the React component so it's unit-testable without a
 * component-test harness. */
export function computeDependentSectionsFromControlInfoChange(
  prev: ControlInformation,
  next: ControlInformation
): Set<SectionId> {
  const changedFields = (Object.keys(next) as (keyof ControlInformation)[]).filter(
    k => JSON.stringify(next[k]) !== JSON.stringify(prev[k])
  );
  const dependentSections = new Set<SectionId>();
  changedFields.forEach(field => {
    if (field in CONTROL_INFO_DEPENDENTS) {
      CONTROL_INFO_DEPENDENTS[field as ControlInfoField].forEach(id => dependentSections.add(id));
    }
  });
  return dependentSections;
}

/** Same change-detection as above, but keyed by section: returns, for each
 * dependent section, exactly which changed Control-Info field(s) drove it stale
 * -- so the UI can name them ("the deadline changed") instead of a generic
 * message. A section appears only if at least one field it depends on changed. */
export function computeControlChangeImpact(
  prev: ControlInformation,
  next: ControlInformation
): Map<SectionId, ControlInfoField[]> {
  const changedFields = (Object.keys(next) as (keyof ControlInformation)[]).filter(
    k => JSON.stringify(next[k]) !== JSON.stringify(prev[k])
  );
  const impact = new Map<SectionId, ControlInfoField[]>();
  changedFields.forEach(field => {
    if (!(field in CONTROL_INFO_DEPENDENTS)) return;
    const cf = field as ControlInfoField;
    CONTROL_INFO_DEPENDENTS[cf].forEach(id => {
      const existing = impact.get(id) ?? [];
      if (!existing.includes(cf)) existing.push(cf);
      impact.set(id, existing);
    });
  });
  return impact;
}
