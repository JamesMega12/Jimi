// Phase 8 tests: the canonical snapshot builder. Fixture-based, no LLM
// dependency. Run with: npx tsx test-technical-alert-v2-snapshot.ts
import { buildTechnicalAlertSnapshot, isSnapshotExportable } from './src/components/technical-alert/v2/snapshot';
import { createEmptySectionWorkspace } from './src/components/technical-alert/v2/sectionWorkspace';
import {
  TechnicalAlertSections,
  SummaryAccepted,
  ReasonsAccepted,
  ImmediateActionContent,
  FollowUpActionContent,
  AdministrativeMetadata,
  ControlInformation,
  SupportingContent,
  ActionItem,
} from './src/components/technical-alert/v2/types';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}

function acceptedWs<T>(value: T) {
  const ws = createEmptySectionWorkspace<T, T>();
  ws.accepted = { value, source: 'manual', basedOn: ws.currentRevision, acceptedAt: new Date().toISOString() };
  return ws;
}
function emptyWs<T>() {
  return createEmptySectionWorkspace<T, T>();
}
function actionItem(overrides: Partial<ActionItem>): ActionItem {
  return { id: crypto.randomUUID(), actor: [], requiredAction: 'do the thing', obligationStrength: 'mandatory', ...overrides };
}

const validMetadata: AdministrativeMetadata = { title: 'Test Alert', documentNumber: 'WCF TA 2026-99', inTouchId: '', date: '', gemsNo: '', classification: '' };
const validControlInfo: ControlInformation = { deadline: '2026-08-01', actionBy: ['Ops'], informationFor: [], effectiveTiming: 'Effective Immediately', acknowledgementRequired: false, quizRequired: false };
const emptySupportingContent: SupportingContent = { acknowledgement: null, figures: [], tables: [], references: [] };

function fullSections(): TechnicalAlertSections {
  return {
    summary: acceptedWs<SummaryAccepted>({ subject: 'Welding prohibited', affectedScope: 'Cement heads' }),
    reasons: acceptedWs<ReasonsAccepted>({ narrative: { technicalBasis: 'x', causeStatus: 'confirmed' } }),
    immediateAction: acceptedWs<ImmediateActionContent>({ items: [actionItem({ requiredAction: 'Stop all welding repairs' })], exceptions: [] }),
    followUpAction: acceptedWs<FollowUpActionContent>({ items: [], notApplicable: true }),
  };
}

// ===== Snapshot reads only accepted values =====
{
  const snapshot = buildTechnicalAlertSnapshot({ administrativeMetadata: validMetadata, controlInformation: validControlInfo, supportingContent: emptySupportingContent, sections: fullSections() });
  assert(snapshot.summary?.subject === 'Welding prohibited', 'snapshot: summary.subject reflects accepted content');
  assert(snapshot.immediateAction?.items.length === 1, 'snapshot: immediateAction.items reflects accepted content');
  assert(snapshot.administrativeMetadata.title === 'Test Alert', 'snapshot: administrativeMetadata passed through unchanged');
}

// ===== Snapshot never includes pending/unaccepted content =====
{
  const sections = fullSections();
  sections.summary = emptyWs<SummaryAccepted>(); // never accepted, only pending/analysis could exist here in a real workflow
  const snapshot = buildTechnicalAlertSnapshot({ administrativeMetadata: validMetadata, controlInformation: validControlInfo, supportingContent: emptySupportingContent, sections });
  assert(snapshot.summary === null, 'snapshot: an unaccepted section is null in the snapshot, never fabricated from pending/analysis state');
}

// ===== Snapshot embeds readiness, and isSnapshotExportable matches it =====
{
  const readySnapshot = buildTechnicalAlertSnapshot({ administrativeMetadata: validMetadata, controlInformation: validControlInfo, supportingContent: emptySupportingContent, sections: fullSections() });
  assert(readySnapshot.readiness.status === 'Ready', `a fully-ready fixture snapshot embeds readiness.status "Ready" (got ${readySnapshot.readiness.status})`);
  assert(isSnapshotExportable(readySnapshot), 'isSnapshotExportable: true when readiness has zero blocking issues');

  const blockedSections = fullSections();
  blockedSections.immediateAction = emptyWs<ImmediateActionContent>();
  const blockedSnapshot = buildTechnicalAlertSnapshot({ administrativeMetadata: validMetadata, controlInformation: validControlInfo, supportingContent: emptySupportingContent, sections: blockedSections });
  assert(!isSnapshotExportable(blockedSnapshot), 'isSnapshotExportable: false when readiness has blocking issues');
}

// ===== Determinism: same input produces an equivalent snapshot =====
{
  const input = { administrativeMetadata: validMetadata, controlInformation: validControlInfo, supportingContent: emptySupportingContent, sections: fullSections() };
  const a = buildTechnicalAlertSnapshot(input);
  const b = buildTechnicalAlertSnapshot(input);
  assert(JSON.stringify(a) === JSON.stringify(b), 'snapshot: building twice from the same input produces an equivalent snapshot (deterministic, no hidden state)');
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
