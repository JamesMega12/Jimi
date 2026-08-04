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
