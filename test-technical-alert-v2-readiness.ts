// Phase 7 tests: the full deterministic readiness gate. One fixture per
// blocking rule, plus warning-only cases and the structural
// pending-can't-satisfy-readiness guarantee. Run with:
// npx tsx test-technical-alert-v2-readiness.ts
import { computeTechnicalAlertReadinessV2, ReadinessInput } from './src/components/technical-alert/v2/readiness';
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

function acceptedWs<T>(value: T, opts?: { stale?: boolean; staleDueToControlChange?: boolean }) {
  const ws = createEmptySectionWorkspace<T, T>();
  ws.accepted = { value, source: 'manual', basedOn: ws.currentRevision, acceptedAt: new Date().toISOString() };
  if (opts?.stale) ws.freshness = 'stale';
  if (opts?.staleDueToControlChange) ws.staleDueToControlChange = true;
  return ws;
}
function emptyWs<T>() {
  return createEmptySectionWorkspace<T, T>();
}
function actionItem(overrides: Partial<ActionItem>): ActionItem {
  return { id: crypto.randomUUID(), actor: [], requiredAction: 'do the thing', obligationStrength: 'mandatory', ...overrides };
}

const validMetadata: AdministrativeMetadata = { title: 'Test Alert', documentNumber: '', inTouchId: '', date: '', gemsNo: '', classification: '' };
const validControlInfo: ControlInformation = { deadline: '2026-08-01', actionBy: ['Ops'], informationFor: [], effectiveTiming: 'Effective Immediately', acknowledgementRequired: false, quizRequired: false };
const emptySupportingContent: SupportingContent = { acknowledgement: null, figures: [], tables: [], references: [] };

function fullyReadySections(): TechnicalAlertSections {
  return {
    summary: acceptedWs<SummaryAccepted>({ subject: 's', affectedScope: 'a' }),
    reasons: acceptedWs<ReasonsAccepted>({ narrative: { technicalBasis: 'x', causeStatus: 'confirmed' } }),
    immediateAction: acceptedWs<ImmediateActionContent>({ items: [actionItem({ requiredAction: 'Stop work' })], exceptions: [] }),
    followUpAction: acceptedWs<FollowUpActionContent>({ items: [], notApplicable: true }),
  };
}

function baseInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    administrativeMetadata: validMetadata,
    controlInformation: validControlInfo,
    supportingContent: emptySupportingContent,
    sections: fullyReadySections(),
    ...overrides,
  };
}

// ===== Fully-ready baseline is actually Ready =====
{
  const r = computeTechnicalAlertReadinessV2(baseInput());
  assert(r.status === 'Ready' && r.blockingIssues.length === 0, `baseline fully-ready fixture is Ready (got ${r.status}: ${r.blockingIssues.join('; ')})`);
}

// ===== Blocking: missing title =====
{
  const r = computeTechnicalAlertReadinessV2(baseInput({ administrativeMetadata: { ...validMetadata, title: '' } }));
  assert(r.status === 'Blocked' && r.blockingIssues.some(b => b.includes('Title')), 'blocking: missing title');
}

// ===== Blocking: summary not accepted =====
{
  const sections = fullyReadySections();
  sections.summary = emptyWs<SummaryAccepted>();
  const r = computeTechnicalAlertReadinessV2(baseInput({ sections }));
  assert(r.status === 'Blocked' && r.blockingIssues.some(b => b.includes('Summary')), 'blocking: summary not accepted');
}

// ===== Blocking: immediateAction empty (and can never be N/A) =====
{
  const sections = fullyReadySections();
  sections.immediateAction = acceptedWs<ImmediateActionContent>({ items: [], exceptions: [] });
  const r = computeTechnicalAlertReadinessV2(baseInput({ sections }));
  assert(r.status === 'Blocked' && r.blockingIssues.some(b => b.includes('Immediate Action')), 'blocking: immediateAction with zero items (no N/A escape hatch)');
}

// ===== Blocking: stale accepted content (either cause) =====
{
  const sections = fullyReadySections();
  sections.reasons = acceptedWs<ReasonsAccepted>({ narrative: { technicalBasis: 'x', causeStatus: 'confirmed' } }, { stale: true });
  const r = computeTechnicalAlertReadinessV2(baseInput({ sections }));
  assert(r.status === 'Blocked' && r.blockingIssues.some(b => b.toLowerCase().includes('stale')), 'blocking: stale accepted content (raw-edit cause) blocks readiness');
}
{
  const sections = fullyReadySections();
  sections.summary = acceptedWs<SummaryAccepted>({ subject: 's', affectedScope: 'a' }, { staleDueToControlChange: true });
  const r = computeTechnicalAlertReadinessV2(baseInput({ sections }));
  assert(r.status === 'Blocked' && r.blockingIssues.some(b => b.toLowerCase().includes('stale')), 'blocking: stale accepted content (control-change cause) also blocks readiness');
}

// ===== Blocking: dangling exceptionRef =====
{
  const sections = fullyReadySections();
  sections.immediateAction = acceptedWs<ImmediateActionContent>({
    items: [actionItem({ requiredAction: 'x', exceptionRef: 'nonexistent' })],
    exceptions: [],
  });
  const r = computeTechnicalAlertReadinessV2(baseInput({ sections }));
  assert(r.status === 'Blocked' && r.blockingIssues.some(b => b.includes('exception')), 'blocking: dangling exceptionRef');
  // Bug fix, 2026-07-28 (TECHNICAL_ALERT_BUG_REPORT.md finding #4): this used
  // to be reported TWICE -- once from readiness.ts's own inline loop, once
  // from crossSectionReview.ts's checkExceptionRefValidity merged in below --
  // confirmed live during testing. Now readiness.ts relies solely on the
  // merged cross-section check for this condition.
  const exceptionMessages = r.blockingIssues.filter(b => b.toLowerCase().includes('exception'));
  assert(exceptionMessages.length === 1, `blocking: dangling exceptionRef is reported exactly once, not duplicated (got ${exceptionMessages.length})`);
}

// ===== Blocking: exception with empty condition =====
{
  const sections = fullyReadySections();
  const item = actionItem({ requiredAction: 'x', exceptionRef: 'e1' });
  sections.immediateAction = acceptedWs<ImmediateActionContent>({
    items: [item],
    exceptions: [{ id: 'e1', appliesTo: [item.id], condition: '', limitations: [], requiredApprovers: [], requiredEvidence: [] }],
  });
  const r = computeTechnicalAlertReadinessV2(baseInput({ sections }));
  assert(r.status === 'Blocked' && r.blockingIssues.some(b => b.includes('no condition')), 'blocking: exception record with empty condition');
}

// ===== Blocking: acknowledgement required but incomplete =====
{
  const r = computeTechnicalAlertReadinessV2(
    baseInput({ controlInformation: { ...validControlInfo, acknowledgementRequired: true } })
  );
  assert(r.status === 'Blocked' && r.blockingIssues.some(b => b.includes('Acknowledgement')), 'blocking: acknowledgementRequired with no acknowledgement block');
}
{
  const r = computeTechnicalAlertReadinessV2(
    baseInput({
      controlInformation: { ...validControlInfo, acknowledgementRequired: true },
      supportingContent: { ...emptySupportingContent, acknowledgement: { completionMethod: 'Quiz', applicationOrSystem: 'Portal', completionDeadline: '2026-08-01', targetAudience: ['Ops'], completionInstructions: 'Complete the quiz.' } },
    })
  );
  assert(!r.blockingIssues.some(b => b.includes('Acknowledgement')), 'blocking: a COMPLETE acknowledgement block does not block');
}

// ===== Blocking: cross-section duplication (immediate/follow-up) =====
{
  const sections = fullyReadySections();
  sections.immediateAction = acceptedWs<ImmediateActionContent>({ items: [actionItem({ requiredAction: 'Stop all welding repairs immediately' })], exceptions: [] });
  sections.followUpAction = acceptedWs<FollowUpActionContent>({ items: [actionItem({ requiredAction: 'Stop all welding repairs immediately' })], notApplicable: false });
  const r = computeTechnicalAlertReadinessV2(baseInput({ sections }));
  assert(r.status === 'Blocked' && r.blockingIssues.some(b => b.includes('duplicated')), 'blocking: cross-section duplication finding surfaces in readiness blockingIssues');
}

// ===== Warnings (non-blocking) =====
{
  const sections = fullyReadySections();
  sections.reasons = emptyWs<ReasonsAccepted>();
  const r = computeTechnicalAlertReadinessV2(baseInput({ sections }));
  assert(r.status !== 'Blocked' && r.warnings.some(w => w.includes('reasons')), 'warning: empty Reasons is a warning, never blocking');
}
{
  const sections = fullyReadySections();
  sections.followUpAction = emptyWs<FollowUpActionContent>();
  const r = computeTechnicalAlertReadinessV2(baseInput({ sections }));
  assert(r.status !== 'Blocked' && r.warnings.some(w => w.includes('Follow-Up')), 'warning: empty Follow-Up without notApplicable is a warning, never blocking');
}
{
  const r = computeTechnicalAlertReadinessV2(baseInput({ controlInformation: { ...validControlInfo, deadline: '', effectiveTiming: '' } }));
  assert(r.status !== 'Blocked' && r.warnings.some(w => w.includes('deadline')), 'warning: missing deadline/effectiveTiming is a warning, never blocking');
}

// ===== Status thresholds =====
{
  const r = computeTechnicalAlertReadinessV2(
    baseInput({
      sections: (() => {
        const s = fullyReadySections();
        s.reasons = emptyWs<ReasonsAccepted>();
        s.followUpAction = emptyWs<FollowUpActionContent>();
        return s;
      })(),
      controlInformation: { ...validControlInfo, deadline: '', effectiveTiming: '' },
    })
  );
  assert(r.status === 'Needs major fixes', `3+ warnings escalates status to "Needs major fixes" (got ${r.status})`);
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
