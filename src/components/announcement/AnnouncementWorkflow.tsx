import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import {
  AnnouncementDraft,
  AnnouncementMetadata,
  SummaryAccepted,
  ReasonAccepted,
  ActionAccepted,
  SectionWorkspace,
  WorkflowStage,
  AnnouncementAcceptedSectionsView,
} from "./announcementTypes";
import { createEmptySectionWorkspace, isStale } from "./lib/sectionLifecycle";
import { buildAnnouncementSnapshot } from "./announcementSnapshot";
import { exportAnnouncementDocx } from "../../services/announcementApi";
import { loadAnnouncementState, saveAnnouncementState, clearAnnouncementState } from "../../lib/announcementPersistence";
import { useDisclosure, AccordionSection } from "../common/Accordion";
import SummaryWorkspace from "./SummaryWorkspace";
import ReasonWorkspace from "./ReasonWorkspace";
import ActionWorkspace from "./ActionWorkspace";
import AnnouncementReview from "./AnnouncementReview";

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
    workflow: { currentStage: "drafting" },
  };
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
  const disclosure = useDisclosure(["summary"]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Persist on every change. Single overwritten key; a full quota degrades to
  // in-memory only (handled inside saveAnnouncementState).
  useEffect(() => {
    saveAnnouncementState(draft, stage);
  }, [draft, stage]);

  const handleStartOver = () => {
    if (!window.confirm("Start a new Announcement? This clears the current draft.")) return;
    clearAnnouncementState();
    setDraft(createInitialDraft());
    setStage("drafting");
  };

  const updateSummary = (updater: (prev: SummaryWs) => SummaryWs) =>
    setDraft((prev) => ({ ...prev, sections: { ...prev.sections, summary: updater(prev.sections.summary) } }));

  const updateReason = (updater: (prev: ReasonWs) => ReasonWs) =>
    setDraft((prev) => ({ ...prev, sections: { ...prev.sections, reason: updater(prev.sections.reason) } }));

  const updateAction = (updater: (prev: ActionWs) => ActionWs) =>
    setDraft((prev) => ({ ...prev, sections: { ...prev.sections, action: updater(prev.sections.action) } }));

  const updateMeta = (field: keyof AnnouncementMetadata, value: string) =>
    setDraft((prev) => ({ ...prev, metadata: { ...prev.metadata, [field]: value } }));

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
    () => buildAnnouncementSnapshot({ metadata: draft.metadata, sections: acceptedView }),
    [draft.metadata, acceptedView]
  );

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportAnnouncementDocx(draft.metadata, acceptedView);
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
        <button
          onClick={handleStartOver}
          title="Clear the current draft and start a new Announcement"
          className="ml-auto px-3 py-2 flex items-center gap-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Start Over
        </button>
      </div>

      {stage === "drafting" && (
        <div className="space-y-3">
          <AccordionSection
            id="summary"
            title="Summary"
            statusBadge={sectionStatusBadge(!!draft.sections.summary.accepted, isStale(draft.sections.summary))}
            isOpen={disclosure.isOpen("summary")}
            onToggle={disclosure.toggle}
          >
            <SummaryWorkspace workspace={draft.sections.summary} onChange={updateSummary} />
          </AccordionSection>

          <AccordionSection
            id="reason"
            title="Reason"
            statusBadge={sectionStatusBadge(!!draft.sections.reason.accepted, isStale(draft.sections.reason))}
            isOpen={disclosure.isOpen("reason")}
            onToggle={disclosure.toggle}
          >
            <ReasonWorkspace workspace={draft.sections.reason} onChange={updateReason} />
          </AccordionSection>

          <AccordionSection
            id="action"
            title="Action"
            statusBadge={sectionStatusBadge(!!draft.sections.action.accepted, isStale(draft.sections.action))}
            isOpen={disclosure.isOpen("action")}
            onToggle={disclosure.toggle}
          >
            <ActionWorkspace workspace={draft.sections.action} onChange={updateAction} />
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
