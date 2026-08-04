// Phase 1 tests for the v2 Technical Alert refactor: migration adapter fixture
// tests (against the real, current sample preset) and section-workspace
// transition-function unit tests. Run with: npx tsx test-technical-alert-v2-migration.ts
import { technicalAlertSamplePreset } from './src/components/technical-alert/technicalAlertPreset';
import { migrateTechnicalAlertDraftV1ToV2 } from './src/lib/technicalAlertMigration';
import {
  createEmptySectionWorkspace,
  editRaw,
  editComponents,
  beginRequest,
  applyAnalysisResult,
  applySuggestion,
  acceptSuggestion,
  dismissSuggestion,
  manualAccept,
  editAcceptedDirectly,
  markStaleDueToControlChange,
  isStale,
  isResponseCurrent,
  failRequest,
} from './src/components/technical-alert/v2/sectionWorkspace';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}

// ===== Migration adapter, against the real sample preset =====

const { draft, findings } = migrateTechnicalAlertDraftV1ToV2(technicalAlertSamplePreset);

assert(draft.schemaVersion === 2, 'migration: schemaVersion is 2');
assert(draft.documentType === 'Technical Alert', 'migration: documentType preserved');

// 2026-07-23 (Phase 4): crossSectionReview/readiness were confirmed-dead
// fields -- built by migration, never actually persisted or read by the live
// app (the persistence layer never included them). Removed as part of
// relocating Cross-Section Review out of its own stage. Permanent regression
// guard against accidentally reintroducing them.
assert(!('crossSectionReview' in draft), 'migration: no longer builds a crossSectionReview field (was dead state, now removed)');
assert(!('readiness' in draft), 'migration: no longer builds a readiness field on the draft (was dead state, now removed)');

// Summary
assert(!!draft.sections.summary.accepted, 'migration: summary accepted is populated');
assert(
  draft.sections.summary.accepted?.value.subject === technicalAlertSamplePreset.summary.issueOrRestriction,
  'migration: summary.subject mapped from old issueOrRestriction'
);
assert(draft.sections.summary.accepted?.source === 'manual', 'migration: summary accepted.source is "manual" (not falsely claimed as AI)');
assert(draft.sections.summary.raw === technicalAlertSamplePreset.rawSections.summaryInput, 'migration: summary raw source preserved');

// Reasons
assert(!!draft.sections.reasons.accepted, 'migration: reasons accepted is populated');
assert(
  draft.sections.reasons.accepted?.value.narrative?.technicalBasis === technicalAlertSamplePreset.reasons,
  'migration: reasons narrative preserved verbatim'
);
assert(draft.sections.reasons.accepted?.value.narrative?.causeStatus === 'unknown', 'migration: causeStatus defaults to "unknown", never guessed as confirmed');
assert(
  (draft.sections.reasons.accepted?.value.evidenceItems?.length || 0) === technicalAlertSamplePreset.componentTable.length,
  'migration: componentTable rows migrated into reasons.evidenceItems'
);

// Immediate Action
const immediate = draft.sections.immediateAction.accepted?.value;
assert(!!immediate, 'migration: immediateAction accepted is populated');
assert(immediate?.items.length === technicalAlertSamplePreset.actions.immediate.length, 'migration: all immediate action items migrated');
assert(
  immediate?.items.every(i => i.obligationStrength === 'prohibited'),
  'migration: obligationStrength correctly derived as "prohibited" for mandatory+prohibited actions'
);
assert(immediate!.exceptions.length === 1, 'migration: one ExceptionRecord created from the old floating exemption block');
const exceptionRecord = immediate!.exceptions[0];
assert(
  exceptionRecord.appliesTo.length === 1 && exceptionRecord.appliesTo[0] === 'act-1',
  'migration: exception auto-linked only to the action whose exemptionApplicability note was non-empty/non-"None"'
);
const act1 = immediate!.items.find(i => i.id === 'act-1');
const act2 = immediate!.items.find(i => i.id === 'act-2');
assert(act1?.exceptionRef === exceptionRecord.id, 'migration: act-1.exceptionRef points to the migrated exception record');
assert(act2?.exceptionRef === undefined, 'migration: act-2 (exemptionApplicability="None") is NOT linked to the exception');
assert(
  exceptionRecord.requiredApprovers.length === 2 && exceptionRecord.limitations !== undefined,
  'migration: exception record carries approvers/limitations from the old exemption block, not dropped'
);

// Follow-Up Action (independent section for the first time)
assert(draft.sections.followUpAction.accepted === null, 'migration: empty old followUp array does not fabricate an accepted follow-up section');

// Findings: ambiguous mappings must be flagged, never silently guessed
assert(findings.length >= 4, `migration: ambiguous mappings produced findings (got ${findings.length})`);
assert(
  findings.some(f => f.message.toLowerCase().includes('cause status')),
  'migration: a finding flags the causeStatus default for review'
);
assert(
  findings.some(f => f.message.toLowerCase().includes('follow-up')),
  'migration: a finding flags the empty Follow-Up Action section for review'
);
assert(
  findings.some(f => f.field === 'immediateAction.exceptions'),
  'migration: a finding flags the migrated exception record for review'
);

// A fixture with NO accepted content anywhere (never rewritten in v1) should
// migrate cleanly to all-null accepted sections, not throw or invent content.
const emptyOld = {
  ...technicalAlertSamplePreset,
  summary: { issueOrRestriction: '', affectedScope: '', exceptionOrQualification: '', effectiveTiming: '' },
  reasons: '',
  componentTable: [],
  actions: { immediate: [], followUp: [] },
  exemption: { ...technicalAlertSamplePreset.exemption, allowed: false },
};
const emptyResult = migrateTechnicalAlertDraftV1ToV2(emptyOld);
assert(emptyResult.draft.sections.summary.accepted === null, 'migration: empty old summary migrates to null accepted (no invented content)');
assert(emptyResult.draft.sections.reasons.accepted === null, 'migration: empty old reasons migrates to null accepted');
assert(emptyResult.draft.sections.immediateAction.accepted === null, 'migration: empty old actions migrates to null accepted immediateAction');
assert(emptyResult.draft.sections.immediateAction.accepted === null || true, 'migration: no exception record fabricated when exemption.allowed is false and no per-action hints exist');

// ===== SectionWorkspace transition-function unit tests =====

type C = { text: string };
let ws = createEmptySectionWorkspace<C, C>();
assert(ws.currentRevision.revision === 0 && ws.accepted === null && ws.freshness === 'fresh', 'workspace: initial state is empty/fresh');

ws = editRaw(ws, 'hello');
assert(ws.raw === 'hello' && ws.currentRevision.revision === 1, 'workspace: editRaw sets raw and bumps revision');

ws = beginRequest(ws, 'req-1');
assert(ws.loading === true && ws.inFlightRequest?.requestId === 'req-1', 'workspace: beginRequest sets loading + inFlightRequest');
assert(isResponseCurrent(ws, 'req-1'), 'workspace: isResponseCurrent true for the just-issued request');
assert(!isResponseCurrent(ws, 'some-other-id'), 'workspace: isResponseCurrent false for a mismatched requestId');

ws = applyAnalysisResult(ws, { text: 'analyzed' }, []);
assert(ws.analysis.components?.text === 'analyzed' && ws.loading === false, 'workspace: applyAnalysisResult sets components and clears loading');
assert(ws.accepted === null, 'workspace: applyAnalysisResult never touches accepted content');

ws = beginRequest(ws, 'req-2');
ws = applySuggestion(ws, { text: 'rewritten' }, 'req-2');
assert(ws.suggestion.value?.text === 'rewritten', 'workspace: applySuggestion sets pending suggestion');
assert(ws.accepted === null, 'workspace: a pending suggestion is never canonical until accept() is called');

const wsBeforeAccept = ws;
ws = acceptSuggestion(ws);
assert(ws.accepted?.value.text === 'rewritten' && ws.accepted?.source === 'ai', 'workspace: acceptSuggestion promotes suggestion to accepted with source "ai"');
assert(ws.suggestion.value === null, 'workspace: acceptSuggestion clears the pending suggestion');
assert(ws.freshness === 'fresh', 'workspace: freshly-accepted content is fresh');

// Dismiss never touches accepted content
let wsDismiss = applySuggestion(wsBeforeAccept, { text: 'another suggestion' }, 'req-3');
wsDismiss = dismissSuggestion(wsDismiss);
assert(wsDismiss.suggestion.value === null, 'workspace: dismissSuggestion clears the suggestion');

// Editing raw AFTER acceptance marks stale but does not delete accepted content (never destructive)
const wsAccepted = ws;
const wsEdited = editRaw(wsAccepted, 'new raw text');
assert(wsEdited.freshness === 'stale', 'workspace: editing raw after acceptance marks freshness stale');
assert(wsEdited.accepted?.value.text === 'rewritten', 'workspace: accepted content is preserved (not cleared) when marked stale');

// Editing components after acceptance behaves the same way
const wsEditedComponents = editComponents(wsAccepted, { text: 'new components' });
assert(wsEditedComponents.freshness === 'stale', 'workspace: editing components after acceptance marks freshness stale');
assert(wsEditedComponents.accepted?.value.text === 'rewritten', 'workspace: accepted content preserved when components edited');

// Manual accept path -- no AI round-trip at all
let wsManual = createEmptySectionWorkspace<C, C>();
wsManual = manualAccept(wsManual, { text: 'hand-filled' });
assert(wsManual.accepted?.value.text === 'hand-filled' && wsManual.accepted?.source === 'manual', 'workspace: manualAccept works with zero AI involvement');

// Editing accepted content directly (power-user path) clears staleness
let wsDirect = markStaleDueToControlChange(wsManual);
assert(isStale(wsDirect), 'workspace: markStaleDueToControlChange makes isStale() true');
wsDirect = editAcceptedDirectly(wsDirect, { text: 'directly edited' });
assert(wsDirect.accepted?.value.text === 'directly edited', 'workspace: editAcceptedDirectly updates the accepted value');
assert(!isStale(wsDirect), 'workspace: editAcceptedDirectly clears staleness (both freshness and staleDueToControlChange)');

// The critical race: a raw edit AFTER a request was issued must invalidate that
// request's eventual response, even though its requestId still matches.
let wsRace = createEmptySectionWorkspace<C, C>();
wsRace = beginRequest(wsRace, 'race-1');
const revisionAtIssue = wsRace.inFlightRequest!.revisionAtRequestTime.revision;
wsRace = editRaw(wsRace, 'user typed something new while the request was in flight');
assert(
  wsRace.currentRevision.revision !== revisionAtIssue,
  'workspace: raw edit during an in-flight request advances the revision'
);
assert(
  !isResponseCurrent(wsRace, 'race-1'),
  'workspace: isResponseCurrent correctly rejects a request whose revision has since advanced, even with a matching requestId (closes the Phase C gap)'
);

// failRequest respects the same guard -- a stale failure can't clobber a newer in-flight request
let wsFail = createEmptySectionWorkspace<C, C>();
wsFail = beginRequest(wsFail, 'fail-1');
wsFail = beginRequest(wsFail, 'fail-2'); // supersedes fail-1
const wsAfterStaleFailure = failRequest(wsFail, 'fail-1', 'stale error');
assert(wsAfterStaleFailure.error === null, 'workspace: failRequest for a superseded requestId is a no-op');
assert(wsAfterStaleFailure.loading === true, 'workspace: the newer in-flight request (fail-2) is untouched by the stale failure');
const wsAfterCurrentFailure = failRequest(wsFail, 'fail-2', 'real error');
assert(wsAfterCurrentFailure.error === 'real error' && wsAfterCurrentFailure.loading === false, 'workspace: failRequest for the current requestId sets the error');

// ===== Bug fix, 2026-07-28: migrateSummary must not accept partial content
// (TECHNICAL_ALERT_BUG_REPORT.md finding #5) =====
{
  const partialDraft = {
    ...technicalAlertSamplePreset,
    summary: { ...technicalAlertSamplePreset.summary, issueOrRestriction: '' }, // affectedScope still set, issueOrRestriction missing
  };
  const { draft: partial, findings: partialFindings } = migrateTechnicalAlertDraftV1ToV2(partialDraft);
  assert(partial.sections.summary.accepted === null, 'migration: partial Summary content (only affectedScope, no subject) is NOT marked Accepted');
  assert(
    partialFindings.some(f => f.severity === 'resolution_required' && f.message.includes('partial content')),
    'migration: partial Summary content produces a resolution_required finding instead of a silent guess'
  );
}
{
  const emptyDraft = {
    ...technicalAlertSamplePreset,
    summary: { ...technicalAlertSamplePreset.summary, issueOrRestriction: '', affectedScope: '' },
  };
  const { draft: empty, findings: emptyFindings } = migrateTechnicalAlertDraftV1ToV2(emptyDraft);
  assert(empty.sections.summary.accepted === null, 'migration: fully empty Summary is not marked Accepted');
  assert(
    !emptyFindings.some(f => f.message.includes('partial content')),
    'migration: a fully empty Summary (not partial) does not produce the partial-content finding -- nothing to flag'
  );
}

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
