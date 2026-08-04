// Phase 5 tests: deterministic cross-section consistency checks. Fixture-based,
// no LLM dependency. Run with: npx tsx test-technical-alert-v2-cross-section.ts
import { runDeterministicCrossSectionChecks } from './src/components/technical-alert/v2/crossSectionReview';
import { createEmptySectionWorkspace } from './src/components/technical-alert/v2/sectionWorkspace';
import {
  TechnicalAlertSections,
  SummaryAccepted,
  ReasonsAccepted,
  ImmediateActionContent,
  FollowUpActionContent,
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

function accepted<T>(value: T) {
  return createSection(value);
}
function createSection<T>(value: T) {
  const ws = createEmptySectionWorkspace<T, T>();
  ws.accepted = { value, source: 'manual', basedOn: ws.currentRevision, acceptedAt: new Date().toISOString() };
  return ws;
}
function empty<T>() {
  return createEmptySectionWorkspace<T, T>();
}
function actionItem(overrides: Partial<ActionItem>): ActionItem {
  return { id: crypto.randomUUID(), actor: [], requiredAction: 'do the thing', obligationStrength: 'mandatory', ...overrides };
}

function baseSections(): TechnicalAlertSections {
  return {
    summary: empty<SummaryAccepted>(),
    reasons: empty<ReasonsAccepted>(),
    immediateAction: empty<ImmediateActionContent>(),
    followUpAction: empty<FollowUpActionContent>(),
  };
}

// ===== Immediate/Follow-up duplication (blocking) =====
{
  const sections = baseSections();
  sections.immediateAction = accepted<ImmediateActionContent>({
    items: [actionItem({ id: 'i1', requiredAction: 'Stop all welding repairs on cement head immediately' })],
    exceptions: [],
  });
  sections.followUpAction = accepted<FollowUpActionContent>({
    items: [actionItem({ id: 'f1', requiredAction: 'Stop all welding repairs on cement head immediately' })],
    notApplicable: false,
  });
  const findings = runDeterministicCrossSectionChecks(sections);
  assert(
    findings.some(f => f.relatedSections.includes('immediateAction') && f.relatedSections.includes('followUpAction') && f.blocking),
    'check(duplication): REQUIRED — a control duplicated verbatim across Immediate and Follow-Up is flagged as BLOCKING'
  );
}

// ===== No duplication when items are genuinely different =====
{
  const sections = baseSections();
  sections.immediateAction = accepted<ImmediateActionContent>({ items: [actionItem({ requiredAction: 'Stop welding repairs immediately' })], exceptions: [] });
  sections.followUpAction = accepted<FollowUpActionContent>({ items: [actionItem({ requiredAction: 'Update the training curriculum for next quarter' })], notApplicable: false });
  const findings = runDeterministicCrossSectionChecks(sections);
  assert(!findings.some(f => f.message.includes('duplicated')), 'check(duplication): genuinely different items are not falsely flagged');
}

// ===== exceptionRef validity =====
{
  const sections = baseSections();
  sections.immediateAction = accepted<ImmediateActionContent>({
    items: [actionItem({ id: 'i1', exceptionRef: 'does-not-exist' })],
    exceptions: [{ id: 'e1', appliesTo: [], condition: 'c', limitations: [], requiredApprovers: [], requiredEvidence: [] }],
  });
  const findings = runDeterministicCrossSectionChecks(sections);
  assert(
    findings.some(f => f.message.includes('references an exception that no longer exists') && f.blocking),
    'check(exceptionRef): a dangling exceptionRef is flagged as BLOCKING'
  );
}
{
  const sections = baseSections();
  sections.immediateAction = accepted<ImmediateActionContent>({
    items: [actionItem({ id: 'i1', exceptionRef: 'e1' })],
    exceptions: [{ id: 'e1', appliesTo: ['i1'], condition: 'c', limitations: [], requiredApprovers: [], requiredEvidence: [] }],
  });
  const findings = runDeterministicCrossSectionChecks(sections);
  assert(!findings.some(f => f.message.includes('no longer exists')), 'check(exceptionRef): a valid exceptionRef is not flagged');
}

// ===== Summary requirement/prohibition echoed in Immediate Action =====
{
  const sections = baseSections();
  sections.summary = accepted<SummaryAccepted>({ subject: 's', affectedScope: 'a', centralProhibition: 'Welding repairs on cement heads must not be performed.' });
  sections.immediateAction = accepted<ImmediateActionContent>({ items: [actionItem({ requiredAction: 'Perform routine equipment inspection.' })], exceptions: [] });
  const findings = runDeterministicCrossSectionChecks(sections);
  assert(
    findings.some(f => f.message.includes('isn\'t reflected in any Immediate Action item') && !f.blocking),
    'check(summaryEcho): an unreflected central prohibition is flagged as ADVISORY (not blocking)'
  );
}
{
  const sections = baseSections();
  sections.summary = accepted<SummaryAccepted>({ subject: 's', affectedScope: 'a', centralProhibition: 'Welding repairs on cement heads must not be performed.' });
  sections.immediateAction = accepted<ImmediateActionContent>({ items: [actionItem({ requiredAction: 'Stop all welding repairs on cement heads immediately.' })], exceptions: [] });
  const findings = runDeterministicCrossSectionChecks(sections);
  assert(!findings.some(f => f.message.includes('isn\'t reflected')), 'check(summaryEcho): a prohibition that IS reflected in an action item is not flagged');
}

// ===== Summary supported by Reasons (only fires when Reasons has content) =====
{
  const sections = baseSections();
  sections.summary = accepted<SummaryAccepted>({ subject: 's', affectedScope: 'a', riskOrIssue: 'Valve seals are cracking under high pressure conditions.' });
  sections.reasons = accepted<ReasonsAccepted>({ narrative: { technicalBasis: 'The onboarding paperwork for new hires was delayed.', causeStatus: 'confirmed' } });
  const findings = runDeterministicCrossSectionChecks(sections);
  assert(findings.some(f => f.message.includes('not appear to be supported')), 'check(summarySupported): an unrelated Reasons narrative is flagged as advisory');
}
{
  const sections = baseSections();
  sections.summary = accepted<SummaryAccepted>({ subject: 's', affectedScope: 'a', riskOrIssue: 'Valve seals are cracking under high pressure.' });
  // Reasons left empty -- the check must be SUPPRESSED, since Reasons is optional (readiness treats it as such).
  const findings = runDeterministicCrossSectionChecks(sections);
  assert(!findings.some(f => f.message.includes('not appear to be supported')), 'check(summarySupported): suppressed entirely when Reasons is empty (optional section, not a violation)');
}

// ===== Fully empty draft produces no findings (no false positives on nothing) =====
{
  const findings = runDeterministicCrossSectionChecks(baseSections());
  assert(findings.length === 0, 'check(empty): a fully empty draft produces zero findings');
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
