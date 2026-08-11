import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Plus, Trash2, Sparkles, ChevronDown } from "lucide-react";
import {
  AnnouncementDraft,
  AnnouncementMetadata,
  SummaryAccepted,
  ReasonAccepted,
  ActionAccepted,
  SectionWorkspace,
  WorkflowStage,
  AnnouncementAcceptedSectionsView,
  Figure,
  SupportingContent,
} from "./announcementTypes";
import { createEmptySectionWorkspace, isStale } from "./lib/sectionLifecycle";
import { createAnnouncementSample } from "./announcementSample";
import { buildAnnouncementSnapshot } from "./announcementSnapshot";
import { exportAnnouncementDocx } from "../../services/announcementApi";
import { loadAnnouncementState, saveAnnouncementState, clearAnnouncementState } from "../../lib/announcementPersistence";
import { useDisclosure, AccordionSection } from "../common/Accordion";
import SummaryWorkspace from "./SummaryWorkspace";
import ReasonWorkspace from "./ReasonWorkspace";
import ActionWorkspace from "./ActionWorkspace";
import AnnouncementReview from "./AnnouncementReview";
import AnnouncementReadinessPanel from "./AnnouncementReadinessPanel";
import { Collapsible } from "./AnnouncementHelpers";
import { ANNOUNCEMENT_FIGURES_ENABLED } from "./announcementFeatureFlags";

type SummaryWs = SectionWorkspace<SummaryAccepted, SummaryAccepted>;
type ReasonWs = SectionWorkspace<ReasonAccepted, ReasonAccepted>;
type ActionWs = SectionWorkspace<ActionAccepted, ActionAccepted>;

const STAGES: { id: WorkflowStage; label: string }[] = [
  { id: "drafting", label: "Draft" },
  { id: "details", label: "Details" },
  { id: "reviewExport", label: "Review & Export" },
];

function createInitialDraft(): AnnouncementDraft {
  return {
    documentType: "Announcement",
    schemaVersion: 1,
    identity: { id: crypto.randomUUID(), createdAt: new Date().toISOString() },
    metadata: {
      title: "",
      announcementNumber: "",
      inTouchId: "",
      date: "",
      gemsNo: "",
      classification: "SLB-Private",
    },
    sections: {
      summary: createEmptySectionWorkspace<SummaryAccepted, SummaryAccepted>(),
      reason: createEmptySectionWorkspace<ReasonAccepted, ReasonAccepted>(),
      action: createEmptySectionWorkspace<ActionAccepted, ActionAccepted>(),
    },
    supportingContent: { figures: [] },
    workflow: { currentStage: "drafting" },
  };
}

function newFigure(figures: Figure[]): Figure {
  return { id: crypto.randomUUID(), number: figures.length + 1, caption: "" };
}

function sectionStatusBadge(accepted: boolean, stale: boolean) {
  if (accepted) {
    return stale ? (
      <span className="text-xs font-medium text-amber-700 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Stale</span>
    ) : (
      <span className="text-xs font-medium text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Accepted</span>
    );
  }
  return <span className="text-xs font-medium text-slate-400">Not started</span>;
}

export default function AnnouncementWorkflow() {
  // Restore any persisted draft once on mount (survives a refresh); fall back to
  // a fresh draft. Transient per-request fields are reset by the loader.
  const restored = useMemo(() => loadAnnouncementState(), []);
  const [draft, setDraft] = useState<AnnouncementDraft>(() => restored?.draft ?? createInitialDraft());
  const [stage, setStage] = useState<WorkflowStage>(() => restored?.stage ?? "drafting");
  // All sections start collapsed -- a single pre-expanded section has no
  // principled rationale for which one matters more (mirrors Technical
  // Alert v2's TechnicalAlertWorkflowV2.tsx, which made the same change after
  // UX feedback flagged a pre-expanded section as "overwhelming at the start").
  const disclosure = useDisclosure([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [readinessExpanded, setReadinessExpanded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // Bumped on loadSample()/clearDraft() only -- passed as `key` to each of the
  // three workspace components below so they fully remount exactly then
  // (mirrors TechnicalAlertWorkflowV2.tsx's draftGeneration fix). Local
  // per-workspace UI state (opStatus/editMode) otherwise survives a sample
  // load or draft clear, since replacing `sections` via setDraft is just a
  // prop change, not something React resets local state for on its own.
  const [draftGeneration, setDraftGeneration] = useState(0);

  // Persist on every change. Single overwritten key; a full quota degrades to
  // in-memory only (handled inside saveAnnouncementState).
  useEffect(() => {
    saveAnnouncementState(draft, stage);
  }, [draft, stage]);

  const hasContent = () =>
    !!(draft.metadata.title || draft.sections.summary.raw || draft.sections.reason.raw || draft.sections.action.raw);

  const clearDraft = () => {
    setShowClearConfirm(false);
    clearAnnouncementState();
    setDraft(createInitialDraft());
    setStage("drafting");
    setDraftGeneration((g) => g + 1);
  };

  const loadSample = () => {
    if (hasContent() && !window.confirm("Loading a sample will replace the current draft. Continue?")) return;
    const sample = createAnnouncementSample();
    setDraft((prev) => ({
      ...prev,
      metadata: sample.metadata,
      supportingContent: sample.supportingContent,
      sections: sample.sections,
    }));
    setStage("drafting");
    setDraftGeneration((g) => g + 1);
  };

  const updateSummary = (updater: (prev: SummaryWs) => SummaryWs) =>
    setDraft((prev) => ({ ...prev, sections: { ...prev.sections, summary: updater(prev.sections.summary) } }));

  const updateReason = (updater: (prev: ReasonWs) => ReasonWs) =>
    setDraft((prev) => ({ ...prev, sections: { ...prev.sections, reason: updater(prev.sections.reason) } }));

  const updateAction = (updater: (prev: ActionWs) => ActionWs) =>
    setDraft((prev) => ({ ...prev, sections: { ...prev.sections, action: updater(prev.sections.action) } }));

  const updateMeta = (field: keyof AnnouncementMetadata, value: string) =>
    setDraft((prev) => ({ ...prev, metadata: { ...prev.metadata, [field]: value } }));

  const setSupportingContent = (next: SupportingContent) =>
    setDraft((prev) => ({ ...prev, supportingContent: next }));
  const setFigures = (figures: Figure[]) => setSupportingContent({ ...draft.supportingContent, figures });

  const acceptedView: AnnouncementAcceptedSectionsView = useMemo(
    () => ({
      summary: {
        accepted: draft.sections.summary.accepted ? { value: draft.sections.summary.accepted.value } : null,
        freshness: draft.sections.summary.freshness,
      },
      reason: {
        accepted: draft.sections.reason.accepted ? { value: draft.sections.reason.accepted.value } : null,
        freshness: draft.sections.reason.freshness,
      },
      action: {
        accepted: draft.sections.action.accepted ? { value: draft.sections.action.accepted.value } : null,
        freshness: draft.sections.action.freshness,
      },
    }),
    [
      draft.sections.summary.accepted, draft.sections.summary.freshness,
      draft.sections.reason.accepted, draft.sections.reason.freshness,
      draft.sections.action.accepted, draft.sections.action.freshness,
    ]
  );

  // Same builder the backend export route calls -- review and export cannot drift.
  const snapshot = useMemo(
    () => buildAnnouncementSnapshot({ metadata: draft.metadata, sections: acceptedView, supportingContent: draft.supportingContent }),
    [draft.metadata, acceptedView, draft.supportingContent]
  );

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportAnnouncementDocx(draft.metadata, acceptedView, draft.supportingContent);
      // Exported successfully -- the draft is "delivered", so drop the persisted
      // copy (a later refresh starts fresh). The in-memory draft stays visible
      // for re-export in this session.
      clearAnnouncementState();
    } catch (err: any) {
      setExportError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
      {/* Stage tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {STAGES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              stage === s.id ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={loadSample}
            title="Load a fictional Announcement sample for testing"
            className="px-3 py-1.5 flex items-center justify-center gap-2 text-xs font-bold bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 rounded-lg shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Load Announcement Sample
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

      {stage === "drafting" && (
        <div className="space-y-3">
          <div className="mb-1">
            <button
              type="button"
              onClick={() => setReadinessExpanded((v) => !v)}
              aria-expanded={readinessExpanded}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                snapshot.readiness.status === "Ready"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                  : snapshot.readiness.status === "Blocked"
                  ? "bg-red-50 border-red-200 text-red-800 hover:bg-red-100"
                  : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
              }`}
            >
              <span className="flex items-center gap-2">
                {snapshot.readiness.status === "Ready" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                Readiness: {snapshot.readiness.status}
                {snapshot.readiness.blockingIssues.length + snapshot.readiness.warnings.length > 0 && (
                  <span className="font-normal opacity-75">
                    ({snapshot.readiness.blockingIssues.length + snapshot.readiness.warnings.length} item
                    {snapshot.readiness.blockingIssues.length + snapshot.readiness.warnings.length === 1 ? "" : "s"})
                  </span>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${readinessExpanded ? "rotate-180" : ""}`} />
            </button>
            {readinessExpanded && (
              <div className="mt-2">
                <AnnouncementReadinessPanel readiness={snapshot.readiness} />
              </div>
            )}
          </div>

          <AccordionSection
            id="summary"
            title="Summary"
            statusBadge={sectionStatusBadge(!!draft.sections.summary.accepted, isStale(draft.sections.summary))}
            isOpen={disclosure.isOpen("summary")}
            onToggle={disclosure.toggle}
          >
            <React.Fragment key={draftGeneration}>
              <SummaryWorkspace workspace={draft.sections.summary} onChange={updateSummary} />
            </React.Fragment>
          </AccordionSection>

          <AccordionSection
            id="reason"
            title="Reason"
            statusBadge={sectionStatusBadge(!!draft.sections.reason.accepted, isStale(draft.sections.reason))}
            isOpen={disclosure.isOpen("reason")}
            onToggle={disclosure.toggle}
          >
            <React.Fragment key={draftGeneration}>
              <ReasonWorkspace workspace={draft.sections.reason} onChange={updateReason} />
            </React.Fragment>
          </AccordionSection>

          <AccordionSection
            id="action"
            title="Action"
            statusBadge={sectionStatusBadge(!!draft.sections.action.accepted, isStale(draft.sections.action))}
            isOpen={disclosure.isOpen("action")}
            onToggle={disclosure.toggle}
          >
            <React.Fragment key={draftGeneration}>
              <ActionWorkspace workspace={draft.sections.action} onChange={updateAction} />
            </React.Fragment>
          </AccordionSection>

          <div className="flex justify-end pt-2">
            <button onClick={() => setStage("details")} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
              Continue to Details
            </button>
          </div>
        </div>
      )}

      {stage === "details" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="font-bold text-slate-800">Document Control</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Title" required value={draft.metadata.title} onChange={(v) => updateMeta("title", v)} />
              <Field label="Announcement Number" value={draft.metadata.announcementNumber} onChange={(v) => updateMeta("announcementNumber", v)} placeholder="e.g. WCF-AN 2026-01" />
              <Field label="InTouch ID" value={draft.metadata.inTouchId} onChange={(v) => updateMeta("inTouchId", v)} />
              <Field label="Date" value={draft.metadata.date} onChange={(v) => updateMeta("date", v)} placeholder="e.g. 02-Dec-2026" />
              <Field label="GEMS No" value={draft.metadata.gemsNo} onChange={(v) => updateMeta("gemsNo", v)} placeholder="N/A" />
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Classification</label>
                <select
                  value={draft.metadata.classification}
                  onChange={(e) => updateMeta("classification", e.target.value)}
                  className="w-full p-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  <option>SLB-Private</option>
                  <option>SLB-Confidential</option>
                  <option>Public</option>
                </select>
              </div>
            </div>
          </div>

          {ANNOUNCEMENT_FIGURES_ENABLED && (
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <Collapsible
              label={`Figures (optional)${draft.supportingContent.figures.length > 0 ? ` -- ${draft.supportingContent.figures.length} added` : ""}`}
              defaultOpen={draft.supportingContent.figures.length > 0}
            >
              <div className="space-y-2 pt-1">
                <p className="text-xs text-slate-500">
                  A numbered caption placeholder -- paste the real image into the exported document afterward.
                </p>
                {draft.supportingContent.figures.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No figures added.</p>
                ) : (
                  draft.supportingContent.figures.map((f, idx) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-500 w-20 flex-shrink-0">Figure {f.number ?? idx + 1}</span>
                      <input
                        type="text"
                        value={f.caption}
                        onChange={(e) =>
                          setFigures(draft.supportingContent.figures.map((x) => (x.id === f.id ? { ...x, caption: e.target.value } : x)))
                        }
                        placeholder="Caption"
                        className="flex-1 p-2 border border-slate-300 rounded-md text-sm"
                      />
                      <button
                        onClick={() => setFigures(draft.supportingContent.figures.filter((x) => x.id !== f.id))}
                        className="text-red-500 hover:bg-red-50 p-1 rounded"
                        title="Remove figure"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
                <button
                  onClick={() => setFigures([...draft.supportingContent.figures, newFigure(draft.supportingContent.figures)])}
                  className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Figure
                </button>
              </div>
            </Collapsible>
          </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStage("drafting")} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">Back</button>
            <button onClick={() => setStage("reviewExport")} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">Continue to Review &amp; Export</button>
          </div>
        </div>
      )}

      {stage === "reviewExport" && (
        <div className="space-y-4">
          <AnnouncementReview snapshot={snapshot} onExport={handleExport} exporting={exporting} exportError={exportError} />
          <div className="flex justify-start">
            <button onClick={() => setStage("drafting")} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">Back to Draft</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2 text-sm border border-slate-300 rounded-md"
      />
    </div>
  );
}
