import type {
  TechnicalAlertSections,
  AdministrativeMetadata,
  ControlInformation,
  SupportingContent,
  WorkflowStage,
  Finding,
} from '../components/technical-alert/v2/types';
import { migrateTechnicalAlertDraftV1ToV2 } from './technicalAlertMigration';

// v2 persistence, under a NEW key -- the old v1 key is left untouched as a
// safety net (never deleted), per the refactor plan's "Migration and
// Compatibility" strategy. If no v2 state exists yet but a v1 draft does, it
// is migrated once on load; ambiguous mappings surface as findings the caller
// can display, never silently guessed.

const V2_KEY = 'ta_workflow_state_v2';
const V1_KEY = 'ta_workflow_state_v1';

export interface PersistedTechnicalAlertStateV2 {
  schemaVersion: 2;
  administrativeMetadata: AdministrativeMetadata;
  controlInformation: ControlInformation;
  supportingContent: SupportingContent;
  sections: TechnicalAlertSections;
  stage: WorkflowStage;
}

export interface LoadResult {
  state: PersistedTechnicalAlertStateV2 | null;
  migrationFindings: Finding[] | null; // non-null only if a migration just happened
}

export function loadOrMigrateTechnicalAlertStateV2(): LoadResult {
  if (typeof window === 'undefined') return { state: null, migrationFindings: null };

  try {
    const v2Raw = window.localStorage.getItem(V2_KEY);
    if (v2Raw) {
      const parsed = JSON.parse(v2Raw);
      if (parsed && parsed.schemaVersion === 2) {
        return { state: parsed as PersistedTechnicalAlertStateV2, migrationFindings: null };
      }
    }
  } catch {
    // corrupt v2 state -- fall through to migration/fresh-start rather than throwing
  }

  try {
    const v1Raw = window.localStorage.getItem(V1_KEY);
    if (v1Raw) {
      const parsedV1 = JSON.parse(v1Raw);
      if (parsedV1?.draft) {
        const { draft: migratedDraft, findings } = migrateTechnicalAlertDraftV1ToV2(parsedV1.draft);
        const state: PersistedTechnicalAlertStateV2 = {
          schemaVersion: 2,
          administrativeMetadata: migratedDraft.administrativeMetadata,
          controlInformation: migratedDraft.controlInformation,
          supportingContent: migratedDraft.supportingContent,
          sections: migratedDraft.sections,
          stage: 'drafting',
        };
        return { state, migrationFindings: findings };
      }
    }
  } catch {
    // corrupt v1 state -- fall through to a fresh start rather than throwing
  }

  return { state: null, migrationFindings: null };
}

export function saveTechnicalAlertStateV2(state: Omit<PersistedTechnicalAlertStateV2, 'schemaVersion'>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(V2_KEY, JSON.stringify({ schemaVersion: 2, ...state }));
  } catch {
    // storage full/unavailable -- degrade to in-memory only, same as v1's persistence
  }
}

export function clearPersistedTechnicalAlertStateV2(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(V2_KEY);
    window.localStorage.removeItem(V1_KEY); // Remove V1 key as well to prevent old draft resurrection
  } catch {
    // ignore
  }
}
