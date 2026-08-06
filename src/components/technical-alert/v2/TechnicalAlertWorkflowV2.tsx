import React, { useEffect, useState } from 'react';
import { Sparkles, Trash2, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { AccordionSection, accordionSectionDomId, useDisclosure } from '../../common/Accordion';
import { createEmptySectionWorkspace, markStaleDueToControlChange, markStaleDueToNeighborChange, isStale } from './sectionWorkspace';
import {
  ImmediateActionContent,
  ReasonsAccepted,
  SummaryAccepted,
  FollowUpActionContent,
  TechnicalAlertSections,
  SectionId,
  WorkflowStage,
  ControlInformation,
  AdministrativeMetadata,
  SupportingContent,
  Finding,
} from './types';
import { computeDependentSectionsFromControlInfoChange } from './controlInfoDependency';
import ImmediateActionWorkspace from './ImmediateActionWorkspace';
import SummaryWorkspace from './SummaryWorkspace';
import ReasonsWorkspace from './ReasonsWorkspace';
import FollowUpActionWorkspace from './FollowUpActionWorkspace';
import CrossSectionReviewPanel from './CrossSectionReviewPanel';
import ControlInfoStrip from './ControlInfoStrip';
import MetadataStage from './MetadataStage';
import ReadinessPanel from './ReadinessPanel';
import FinalReviewPanel from './FinalReviewPanel';
import { buildTechnicalAlertSnapshot } from './snapshot';
import { exportTechnicalAlertDocxV2 } from '../../../services/technicalAlertApiV2';
import { createTechnicalAlertSampleV2 } from './technicalAlertPresetV2';
import { loadOrMigrateTechnicalAlertStateV2, saveTechnicalAlertStateV2, clearPersistedTechnicalAlertStateV2 } from '../../../lib/technicalAlertPersistenceV2';

// The Technical Alert workflow (Phase 9: this is now the live workflow,
// mounted at /technical-alert -- the old v1 implementation has been retired).
// See plans/role-you-are-working-delightful-cupcake.md for the full design.

function createInitialSections(): TechnicalAlertSections {
  return {
    summary: createEmptySectionWorkspace<SummaryAccepted, SummaryAccepted>(),
    reasons: createEmptySectionWorkspace<ReasonsAccepted, ReasonsAccepted>(),
    immediateAction: createEmptySectionWorkspace<ImmediateActionContent, ImmediateActionContent>(),
    followUpAction: createEmptySectionWorkspace<FollowUpActionContent, FollowUpActionContent>(),
  };
}

const initialControlInformation: ControlInformation = {
  deadline: '',
  actionBy: [],
  informationFor: [],
  effectiveTiming: '',
  acknowledgementRequired: false,
  quizRequired: false,
};

const initialAdministrativeMetadata: AdministrativeMetadata = {
  title: '',
  documentNumber: '',
  inTouchId: '',
  date: '',
  gemsNo: '',
  classification: '',
};

const initialSupportingContent: SupportingContent = {
  acknowledgement: null,
  figures: [],
  tables: [],
  references: [],
};

// 3 stages, not 4 (2026-07-23 revision): Cross-Section Review is no longer
// its own stage -- its advisory findings and AI deep-check button are now
// rendered inside Final Review & Export (see below), since its blocking
// checks were already independently wired into readiness regardless of
// whether this page existed, and its only unique contribution (advisory
// findings + the optional AI button) doesn't need its own navigation stop.
const STAGES: { id: WorkflowStage; label: string }[] = [
  { id: 'drafting', label: '1. Drafting' },
  { id: 'metadataAndSupportingContent', label: '2. Metadata & Supporting Content' },
  { id: 'finalReviewExport', label: '3. Final Review & Export' },
];

const VALID_STAGE_IDS = new Set<WorkflowStage>(STAGES.map(s => s.id));
// Defensive fallback for a persisted stage value that no longer exists (e.g.
// a draft saved mid-development with the now-removed 'crossSectionReview'
// stage) -- lands the user somewhere sensible instead of a blank content area.
function normalizeStage(stage: WorkflowStage | undefined): WorkflowStage {
  return stage && VALID_STAGE_IDS.has(stage) ? stage : 'drafting';
}

export default function TechnicalAlertWorkflowV2() {
  const [loaded] = useState(() => loadOrMigrateTechnicalAlertStateV2());
  const [migrationFindings, setMigrationFindings] = useState<Finding[] | null>(loaded.migrationFindings);

  const [stage, setStage] = useState<WorkflowStage>(normalizeStage(loaded.state?.stage));
  const [sections, setSections] = useState<TechnicalAlertSections>(loaded.state?.sections ?? createInitialSections);
  const [controlInformation, setControlInformationState] = useState<ControlInformation>(loaded.state?.controlInformation ?? initialControlInformation);
  const [administrativeMetadata, setAdministrativeMetadata] = useState<AdministrativeMetadata>(loaded.state?.administrativeMetadata ?? initialAdministrativeMetadata);
  const [supportingContent, setSupportingContent] = useState<SupportingContent>(loaded.state?.supportingContent ?? initialSupportingContent);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Transient "it worked" signal, same auto-dismiss pattern as each
  // workspace's opStatus 'succeeded' state (see SummaryWorkspace.tsx) --
  // export previously gave zero on-screen feedback on success (confirmed via
  // live UX trace, 2026-08-06).
  useEffect(() => {
    if (!exportSuccess) return;
    const t = setTimeout(() => setExportSuccess(false), 4000);
    return () => clearTimeout(t);
  }, [exportSuccess]);
  // All sections start collapsed -- a single pre-expanded section on first
  // load (previously 'immediateAction', the largest/densest section) had no
  // labeled rationale and was a confirmed contributor to "overwhelming at the
  // start" feedback (live UX trace, 2026-08-06). Revisit only if product
  // confirms a deliberate "start here" section is wanted -- that needs an
  // explicit affordance, not just leaving one open unexplained.
  const { isOpen, toggle, open, reset: resetAccordion } = useDisclosure([]);
  const stageIndex = STAGES.findIndex(s => s.id === stage);
  



  // Bumped on loadSample()/clearDraft() only -- passed as `key` to each of
  // the 4 workspace components below so they fully remount exactly then
  // (2026-07-28 fix). Local per-workspace UI state (opStatus/warnings/typed
  // rewrite instructions) previously survived a sample load or draft clear,
  // since replacing `sections` via setSections is just a prop change, not
  // something React resets local state for on its own -- a remount is the
  // standard way to force a clean reset for a "the underlying data changed
  // discontinuously" event like this, without having to track every piece of
  // local state by hand (fragile against future additions).
  const [draftGeneration, setDraftGeneration] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [readinessExpanded, setReadinessExpanded] = useState(false);

  // Persist on every change so a refresh or navigating away doesn't lose the draft.
  useEffect(() => {
    saveTechnicalAlertStateV2({ administrativeMetadata, controlInformation, supportingContent, sections, stage });
  }, [administrativeMetadata, controlInformation, supportingContent, sections, stage]);

  // Cross-section staleness: if Summary's accepted content was AI-generated
  // using neighbor sections as read-only grounding, and a neighbor is later
  // re-accepted with different content, that grounding is now out of date --
  // mark Summary stale the same way staleDueToControlChange already does for
  // control-info edits (RC7, 2026-08-06). Only fires for AI-sourced Summary
  // content that actually recorded a grounding snapshot; manual accepts never
  // used neighbors, so they're never touched by this.
  useEffect(() => {
    const summaryAccepted = sections.summary.accepted;
    const grounded = summaryAccepted?.groundedOnNeighbors;
    if (!summaryAccepted || summaryAccepted.source !== 'ai' || !grounded) return;
    if (sections.summary.staleDueToNeighborChange) return;
    const current: Record<string, string | null> = {
      reasons: sections.reasons.accepted ? JSON.stringify(sections.reasons.accepted.value) : null,
      immediateAction: sections.immediateAction.accepted ? JSON.stringify(sections.immediateAction.accepted.value) : null,
      followUpAction: sections.followUpAction.accepted ? JSON.stringify(sections.followUpAction.accepted.value) : null,
    };
    const changed = Object.keys(current).some(k => current[k] !== (grounded[k] ?? null));
    if (changed) {
      setSections(prev => ({ ...prev, summary: markStaleDueToNeighborChange(prev.summary) }));
    }
  }, [sections.reasons.accepted, sections.immediateAction.accepted, sections.followUpAction.accepted, sections.summary.accepted, sections.summary.staleDueToNeighborChange]);

  const handleJumpToSection = (id: SectionId) => {
    setStage('drafting');
    open(id);
    // Let the stage switch + accordion expansion render first, then scroll
    // (2026-07-28 fix -- previously nothing scrolled at all, since
    // AccordionSection had no id to scroll to). Same short-delay-after-
    // state-change pattern already used for the suggestion-panel auto-scroll
    // in all 4 workspace components.
    setTimeout(() => {
      document.getElementById(accordionSectionDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const updateSummary: Parameters<typeof SummaryWorkspace>[0]['onChange'] = updater =>
    setSections(prev => ({ ...prev, summary: updater(prev.summary) }));
  const updateReasons: Parameters<typeof ReasonsWorkspace>[0]['onChange'] = updater =>
    setSections(prev => ({ ...prev, reasons: updater(prev.reasons) }));
  const updateImmediateAction: Parameters<typeof ImmediateActionWorkspace>[0]['onChange'] = updater =>
    setSections(prev => ({ ...prev, immediateAction: updater(prev.immediateAction) }));
  const updateFollowUpAction: Parameters<typeof FollowUpActionWorkspace>[0]['onChange'] = updater =>
    setSections(prev => ({ ...prev, followUpAction: updater(prev.followUpAction) }));

  // Freshness and Dependency Model: when a tracked control-info field changes,
  // mark exactly the listed dependent sections' accepted content stale (a
  // distinct cause from a raw/component edit -- see CONTROL_INFO_DEPENDENTS).
  const setControlInformation = (next: ControlInformation) => {
    const dependentSections = computeDependentSectionsFromControlInfoChange(controlInformation, next);
    if (dependentSections.size > 0) {
      setSections(prev => {
        const updated = { ...prev };
        dependentSections.forEach(id => {
          (updated as any)[id] = markStaleDueToControlChange(prev[id] as any);
        });
        return updated;
      });
    }
    setControlInformationState(next);
  };

  const hasContent = () =>
    !!(administrativeMetadata.title || sections.summary.raw || sections.reasons.raw || sections.immediateAction.raw || sections.followUpAction.raw);

  const loadSample = () => {
    if (hasContent() && typeof window !== 'undefined' && !window.confirm('Loading a sample will replace the current draft. Continue?')) {
      return;
    }
    const sample = createTechnicalAlertSampleV2();
    setAdministrativeMetadata(sample.administrativeMetadata);
    setControlInformationState(sample.controlInformation);
    setSupportingContent(sample.supportingContent);
    setSections(sample.sections);
    setStage('drafting');
    setMigrationFindings(null);
    setDraftGeneration(g => g + 1);
  };

  const clearDraft = () => {
    setShowClearConfirm(false);
    clearPersistedTechnicalAlertStateV2();
    setAdministrativeMetadata(initialAdministrativeMetadata);
    setControlInformationState(initialControlInformation);
    setSupportingContent(initialSupportingContent);
    setSections(createInitialSections());
    setStage('drafting');
    setMigrationFindings(null);
    setExportError(null);
    resetAccordion();
    setDraftGeneration(g => g + 1);
  };

  // The canonical snapshot -- computed once per render, consumed by both the
  // readiness panel and the review panel below, so they can never disagree
  // (both looking at literally the same object).
  const currentSnapshot = buildTechnicalAlertSnapshot({ administrativeMetadata, controlInformation, supportingContent, sections });

  // Locked decision #5: Summary's rewrite may optionally read already-accepted
  // neighbor sections as read-only synthesis grounding.
  const acceptedNeighborsForSummary = {
    reasons: sections.reasons.accepted?.value,
    immediateAction: sections.immediateAction.accepted?.value,
    followUpAction: sections.followUpAction.accepted?.value,
  };

  const sectionStatus = (accepted: boolean, stale: boolean) => {
    if (stale) return <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Stale</span>;
    if (accepted) return <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Accepted</span>;
    return <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Not started</span>;
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Technical Alert</h1>
          <p className="text-slate-600 text-sm">Create a controlled Technical Alert with restrictions, exemptions, and required actions.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={loadSample}
            className="px-3 py-1.5 flex items-center justify-center gap-2 text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-lg shadow-sm transition-colors"
            title="Load a fictional Technical Alert sample for testing"
          >
            <Sparkles className="w-4 h-4" />
            Load Technical Alert Sample
          </button>
          {showClearConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-red-600">Are you sure?</span>
              <button
                onClick={clearDraft}
                className="px-3 py-1.5 flex items-center justify-center gap-1 text-xs font-bold bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-sm transition-colors"
              >
                Yes, Clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 flex items-center justify-center gap-1 text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg shadow-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-1.5 flex items-center justify-center gap-2 text-xs font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg shadow-sm transition-colors"
              title="Clear the saved draft and start over"
            >
              <Trash2 className="w-4 h-4" />
              Clear Draft
            </button>
          )}
        </div>
      </div>

      {migrationFindings && migrationFindings.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <strong className="block mb-1">Draft migrated from the previous version</strong>
              <p className="mb-2">Your existing draft was automatically upgraded. Please review these items:</p>
              <ul className="list-disc pl-5 space-y-1">
                {migrationFindings.map(f => <li key={f.id}>{f.message}</li>)}
              </ul>
            </div>
            <button onClick={() => setMigrationFindings(null)} className="text-blue-700 hover:text-blue-900 text-xs font-semibold flex-shrink-0">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {STAGES.map(s => (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              stage === s.id ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {stage === 'drafting' && (
        <>
          {/* Collapsed-by-default readiness summary -- reuses the snapshot
              already computed unconditionally above (no new computation) and
              the same ReadinessPanel shown in Final Review, so Drafting and
              Final Review can never disagree. Collapsed by default so it adds
              a glanceable one-line status without reintroducing the density
              problem this addresses (RC5/RC1). */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setReadinessExpanded(v => !v)}
              aria-expanded={readinessExpanded}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                currentSnapshot.readiness.status === 'Ready'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : currentSnapshot.readiness.status === 'Blocked'
                  ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                  : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <span className="flex items-center gap-2">
                {currentSnapshot.readiness.status === 'Ready' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                Readiness: {currentSnapshot.readiness.status}
                {currentSnapshot.readiness.blockingIssues.length + currentSnapshot.readiness.warnings.length > 0 && (
                  <span className="font-normal opacity-75">
                    ({currentSnapshot.readiness.blockingIssues.length + currentSnapshot.readiness.warnings.length} item
                    {currentSnapshot.readiness.blockingIssues.length + currentSnapshot.readiness.warnings.length === 1 ? '' : 's'})
                  </span>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${readinessExpanded ? 'rotate-180' : ''}`} />
            </button>
            {readinessExpanded && (
              <div className="mt-2">
                <ReadinessPanel readiness={currentSnapshot.readiness} />
              </div>
            )}
          </div>

          <ControlInfoStrip
            key={`control-info-${draftGeneration}`}
            controlInformation={controlInformation}
            onChange={setControlInformation}
            summaryEffectiveTimingHint={sections.summary.analysis.components?.effectiveTiming || sections.summary.accepted?.value.effectiveTiming}
          />
          <div className="space-y-3">
            <AccordionSection
              id="summary"
              title="Summary"
              statusBadge={sectionStatus(!!sections.summary.accepted, isStale(sections.summary))}
              isOpen={isOpen('summary')}
              onToggle={toggle}
            >
              <div key={draftGeneration}>
                <SummaryWorkspace workspace={sections.summary} onChange={updateSummary} acceptedNeighbors={acceptedNeighborsForSummary} />
              </div>
            </AccordionSection>

            <AccordionSection
              id="reasons"
              title="Reasons"
              statusBadge={sectionStatus(!!sections.reasons.accepted, isStale(sections.reasons))}
              isOpen={isOpen('reasons')}
              onToggle={toggle}
            >
              <div key={draftGeneration}>
                <ReasonsWorkspace workspace={sections.reasons} onChange={updateReasons} />
              </div>
            </AccordionSection>

            <AccordionSection
              id="immediateAction"
              title="Immediate Action"
              statusBadge={sectionStatus(!!sections.immediateAction.accepted, isStale(sections.immediateAction))}
              isOpen={isOpen('immediateAction')}
              onToggle={toggle}
            >
              <div key={draftGeneration}>
                <ImmediateActionWorkspace workspace={sections.immediateAction} onChange={updateImmediateAction} />
              </div>
            </AccordionSection>

            <AccordionSection
              id="followUpAction"
              title="Follow-Up Action"
              statusBadge={sectionStatus(!!sections.followUpAction.accepted, isStale(sections.followUpAction))}
              isOpen={isOpen('followUpAction')}
              onToggle={toggle}
            >
              <div key={draftGeneration}>
                <FollowUpActionWorkspace workspace={sections.followUpAction} onChange={updateFollowUpAction} />
              </div>
            </AccordionSection>
          </div>
        </>
      )}

      {stage === 'metadataAndSupportingContent' && (
        <MetadataStage
          administrativeMetadata={administrativeMetadata}
          onMetadataChange={setAdministrativeMetadata}
          controlInformation={controlInformation}
          supportingContent={supportingContent}
          onSupportingContentChange={setSupportingContent}
        />
      )}

      {stage === 'finalReviewExport' && (
        <div className="space-y-4">
          {exportError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{exportError}</div>}
          {exportSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Technical Alert exported successfully.
            </div>
          )}
          <ReadinessPanel readiness={currentSnapshot.readiness} />
          <CrossSectionReviewPanel sections={sections} onJumpToSection={handleJumpToSection} />
          <FinalReviewPanel
            snapshot={currentSnapshot}
            exporting={exporting}
            onExport={async () => {
              setExporting(true);
              setExportError(null);
              setExportSuccess(false);
              try {
                // The same accepted-only payload shape the backend rebuilds its own
                // snapshot from server-side -- the client never sends a pre-built
                // snapshot, only the underlying accepted section state.
                await exportTechnicalAlertDocxV2({ administrativeMetadata, controlInformation, supportingContent, sections });
                setExportSuccess(true);
              } catch (err: any) {
                setExportError(err.message || 'Failed to export DOCX.');
              } finally {
                setExporting(false);
              }
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-200">
        {stageIndex > 0 ? (
          <button
            onClick={() => setStage(STAGES[stageIndex - 1].id)}
            className="px-4 py-2 flex items-center gap-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back: {STAGES[stageIndex - 1].label.replace(/^\d+\.\s*/, '')}
          </button>
        ) : (
          <span />
        )}
        {stageIndex < STAGES.length - 1 && (
          <button
            onClick={() => setStage(STAGES[stageIndex + 1].id)}
            className="px-4 py-2 flex items-center gap-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Continue: {STAGES[stageIndex + 1].label.replace(/^\d+\.\s*/, '')}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
