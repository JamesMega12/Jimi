import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { ReasonAccepted, CauseStatus, SectionWorkspace } from "./announcementTypes";
import {
  editRaw,
  editComponents,
  beginRequest,
  applyAnalysisResult,
  applySuggestion,
  dismissSuggestion,
  acceptSuggestion,
  manualAccept,
  isStale,
  isResponseCurrent,
  failRequest,
} from "./lib/sectionLifecycle";
import { analyzeReason, rewriteReason, RewriteWarning } from "../../services/announcementApi";
import { FieldHint, Collapsible, StaleExplanation } from "./AnnouncementHelpers";
import { reasonHasContent } from "./announcementReadiness";
import { RichTextContent } from "./RichTextContent";

type Workspace = SectionWorkspace<ReasonAccepted, ReasonAccepted>;
type Updater = (updater: (prev: Workspace) => Workspace) => void;

interface Props {
  workspace: Workspace;
  onChange: Updater;
}

const EMPTY: ReasonAccepted = { rationale: "" };
const CAUSE_OPTIONS: { value: CauseStatus; label: string }[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "preliminary", label: "Preliminary" },
  { value: "suspected", label: "Suspected" },
  { value: "unknown", label: "Unknown / under investigation" },
];

type OpStatus =
  | { kind: "idle" }
  | { kind: "analyzing" | "rewriting" }
  | { kind: "succeeded"; op: "analyze" | "rewrite" }
  | { kind: "failed"; op: "analyze" | "rewrite" };

function causeLabel(status?: CauseStatus): string | null {
  if (!status) return null;
  return CAUSE_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function ReasonContent({ value }: { value: ReasonAccepted }) {
  const cause = causeLabel(value.causeStatus);
  return (
    <div className="space-y-2">
      {value.renderedText ? (
        <RichTextContent text={value.renderedText} className="space-y-2" />
      ) : (
        <div className="text-sm space-y-1">
          {value.rationale && <RichTextContent text={value.rationale} className="space-y-1" />}
          {value.triggeringObservation && (
            <div>
              <strong>Triggering Observation:</strong>{" "}
              <RichTextContent text={value.triggeringObservation} className="inline space-y-1" />
            </div>
          )}
        </div>
      )}
      {cause && (
        <span className="inline-block text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
          Cause certainty: {cause}
        </span>
      )}
    </div>
  );
}

export default function ReasonWorkspace({ workspace, onChange }: Props) {
  const [opStatus, setOpStatus] = useState<OpStatus>({ kind: "idle" });
  const [warnings, setWarnings] = useState<RewriteWarning[]>([]);
  const [editMode, setEditMode] = useState(false);
  // Tracks whether the user has explicitly set/changed the cause certainty this
  // drafting round -- passed to rewrite so the certainty-preservation backstop
  // knows a change was intentional (and won't revert it).
  const [causeStatusEdited, setCauseStatusEdited] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const content = workspace.analysis.components ?? EMPTY;

  const wsRef = useRef(workspace);
  useEffect(() => {
    wsRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    if (opStatus.kind !== "succeeded") return;
    const t = setTimeout(() => setOpStatus({ kind: "idle" }), 4000);
    return () => clearTimeout(t);
  }, [opStatus]);

  const setRaw = (raw: string) => onChange((prev) => editRaw(prev, raw));
  const setField = (field: keyof ReasonAccepted, value: string) =>
    onChange((prev) => editComponents(prev, { ...content, [field]: value || undefined }));
  const setCauseStatus = (status: CauseStatus | undefined) => {
    setCauseStatusEdited(true);
    onChange((prev) => editComponents(prev, { ...content, causeStatus: status }));
  };

  const handleAnalyze = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: "analyzing" });
    setCauseStatusEdited(false);
    onChange((prev) => beginRequest(prev, requestId));
    try {
      const result = await analyzeReason(workspace.raw);
      onChange((prev) => (isResponseCurrent(prev, requestId) ? applyAnalysisResult(prev, result, []) : prev));
      if (isResponseCurrent(wsRef.current, requestId)) setOpStatus({ kind: "succeeded", op: "analyze" });
    } catch (err: any) {
      setOpStatus({ kind: "failed", op: "analyze" });
      onChange((prev) => failRequest(prev, requestId, err.message || "Failed to analyze reason."));
    }
  };

  const handleRewrite = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: "rewriting" });
    setWarnings([]);
    onChange((prev) => beginRequest(prev, requestId));
    try {
      const { result, warnings: newWarnings } = await rewriteReason(workspace.raw, content, undefined, causeStatusEdited);
      onChange((prev) => (isResponseCurrent(prev, requestId) ? applySuggestion(prev, result, requestId) : prev));
      if (isResponseCurrent(wsRef.current, requestId)) {
        setOpStatus({ kind: "succeeded", op: "rewrite" });
        setWarnings(newWarnings || []);
        setTimeout(() => suggestionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
      }
    } catch (err: any) {
      setOpStatus({ kind: "failed", op: "rewrite" });
      onChange((prev) => failRequest(prev, requestId, err.message || "Failed to rewrite reason."));
    }
  };

  const handleAccept = () => {
    onChange((prev) => acceptSuggestion(prev));
    setWarnings([]);
    setCauseStatusEdited(false);
    setEditMode(false);
  };
  const handleDismiss = () => {
    onChange((prev) => dismissSuggestion(prev));
    setWarnings([]);
  };
  const handleManualAccept = () => {
    onChange((prev) => manualAccept(prev, content));
    setEditMode(false);
  };

  const stale = isStale(workspace);
  const causeSet = content.causeStatus !== undefined;
  const busy = workspace.loading;
  const analyzeLabel = opStatus.kind === "analyzing" ? "Analyzing…" : "Analyze";
  const rewriteLabel = opStatus.kind === "rewriting" ? "Rewriting…" : "Rewrite with AI";
  const hasRequiredContent = reasonHasContent(content);
  const showComponents = !!workspace.analysis.ranAt || hasRequiredContent;

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="sr-only">
        {opStatus.kind === "analyzing" && "Analyzing reason…"}
        {opStatus.kind === "rewriting" && "Rewriting reason…"}
        {opStatus.kind === "succeeded" && opStatus.op === "analyze" && "Reason analysis complete."}
        {opStatus.kind === "succeeded" && opStatus.op === "rewrite" && "Reason rewrite ready for review."}
        {opStatus.kind === "failed" && `Reason ${opStatus.op} failed.`}
      </div>

      {(!workspace.accepted || editMode) && (
        <>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Raw Reason Content</label>
            <textarea
              aria-label="Raw Reason Content"
              value={workspace.raw}
              onChange={(e) => setRaw(e.target.value)}
              className="w-full h-28 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 resize-none font-mono text-sm"
              placeholder="Why is this being announced? Objectives, background, a suspected cause..."
            />
            <div className="flex gap-2 mt-2 items-center">
              <button
                onClick={handleAnalyze}
                disabled={busy || !workspace.raw.trim()}
                className="px-4 py-2 flex items-center gap-2 bg-slate-800 text-white rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                {opStatus.kind === "analyzing" && <Loader2 className="w-4 h-4 animate-spin" />}
                {analyzeLabel}
              </button>
              {opStatus.kind === "succeeded" && opStatus.op === "analyze" && (
                <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Analysis complete
                </span>
              )}
            </div>
          </div>

          {workspace.error && opStatus.kind !== "failed" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {workspace.error}
            </div>
          )}

          {showComponents && (
            <div className="p-4 bg-teal-50 border border-teal-100 rounded-lg space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                {hasRequiredContent && <CheckCircle2 className="w-5 h-5 text-emerald-600" />} Reason Components
              </h4>
              <FieldHint text="Supports **bold**, *italic*, [link](url), and &quot;- &quot; for bullet points." />
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Rationale</label>
                <textarea
                  aria-label="Rationale"
                  value={content.rationale || ""}
                  onChange={(e) => setField("rationale", e.target.value)}
                  placeholder="Why the Announcement is being issued -- objectives, background, or the problem being addressed."
                  className="w-full p-2 text-sm border border-slate-200 rounded-md bg-white"
                  rows={3}
                />
                <FieldHint text="The core of the Reason." />
              </div>

              {/* Conditional certainty control: shown only when a cause is asserted.
                  For objectives/rationale-style reasons it stays hidden. */}
              {causeSet ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-2">
                    Cause certainty
                    <button
                      type="button"
                      onClick={() => setCauseStatus(undefined)}
                      className="text-slate-400 hover:text-slate-600 flex items-center gap-0.5 text-[11px]"
                      title="This Reason does not assert a cause"
                    >
                      <X className="w-3 h-3" /> no cause asserted
                    </button>
                  </label>
                  <select
                    aria-label="Cause certainty"
                    value={content.causeStatus}
                    onChange={(e) => setCauseStatus(e.target.value as CauseStatus)}
                    className="w-full p-2 text-sm border border-slate-200 rounded-md bg-white"
                  >
                    {CAUSE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <FieldHint text="Preserved exactly by AI -- a rewrite will never make a suspected cause read as confirmed unless you change this." />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCauseStatus("suspected")}
                  className="text-xs font-semibold text-teal-700 hover:underline"
                >
                  + This Reason states a cause (add certainty)
                </button>
              )}

              <Collapsible label="Add triggering observation (optional)" defaultOpen={!!content.triggeringObservation}>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Triggering Observation</label>
                  <textarea
                    aria-label="Triggering Observation"
                    value={content.triggeringObservation || ""}
                    onChange={(e) => setField("triggeringObservation", e.target.value)}
                    placeholder="The event, failure, or finding that prompted this Announcement."
                    className="w-full p-2 text-sm border border-slate-200 rounded-md bg-white"
                    rows={2}
                  />
                  <FieldHint text="Optional -- leave blank if the source doesn't state one." />
                </div>
              </Collapsible>

              <div className="flex justify-end gap-2 pt-2 border-t border-teal-200">
                <button onClick={handleManualAccept} className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-md text-sm font-medium hover:bg-emerald-50">
                  Mark Ready (No AI)
                </button>
                <button onClick={handleRewrite} disabled={busy} className="px-4 py-2 flex items-center gap-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                  {opStatus.kind === "rewriting" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {rewriteLabel}
                </button>
              </div>
            </div>
          )}

          {opStatus.kind === "failed" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {opStatus.op === "analyze" ? "Analysis failed." : "Rewrite failed."} {workspace.error} Your previously accepted content, if any, is unchanged.
            </div>
          )}

          {workspace.suggestion.value && (
            <div ref={suggestionRef} className="p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
              <h4 className="font-bold text-blue-900 flex items-center gap-2">
                Rewrite Suggestion
                <span className="text-xs font-normal text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">pending review -- not yet accepted</span>
              </h4>
              <ReasonContent value={workspace.suggestion.value} />
              {warnings.length > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-md space-y-1">
                  {warnings.map((w, i) => (
                    <div key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {w.message}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={handleAccept} className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700">Accept</button>
                <button onClick={handleRewrite} disabled={busy} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Regenerate</button>
                <button onClick={handleDismiss} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Dismiss</button>
              </div>
            </div>
          )}
        </>
      )}

      {workspace.accepted && !editMode && (
        <div className={`p-4 border rounded-lg ${stale ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
          <h4 className={`font-bold mb-2 flex items-center gap-2 ${stale ? "text-amber-900" : "text-emerald-900"}`}>
            {stale && <AlertCircle className="w-4 h-4" />}
            {stale ? "Accepted — needs another review" : "Accepted"}
            <span className="text-xs font-normal opacity-70">({workspace.accepted.source === "ai" ? "AI-assisted" : "manually authored"})</span>
          </h4>
          {stale && <StaleExplanation ws={workspace} />}
          <ReasonContent value={workspace.accepted.value} />
          <button
            onClick={() => setEditMode(true)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 hover:underline mt-3"
          >
            Edit / Redraft
          </button>
        </div>
      )}
    </div>
  );
}
