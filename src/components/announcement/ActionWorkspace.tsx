import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { ActionAccepted, ActionItem, ActionKind, SectionWorkspace } from "./announcementTypes";
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
import { analyzeAction, rewriteAction, RewriteWarning } from "../../services/announcementApi";
import { Collapsible } from "./AnnouncementHelpers";
import { ACTION_KIND_LABELS, actionItemMeta } from "./announcementActionRender";

type Workspace = SectionWorkspace<ActionAccepted, ActionAccepted>;
type Updater = (updater: (prev: Workspace) => Workspace) => void;

interface Props {
  workspace: Workspace;
  onChange: Updater;
}

const EMPTY: ActionAccepted = { items: [] };
const KIND_ORDER: ActionKind[] = ["immediate", "restriction", "short-term", "long-term", "operator", "requirement", "condition"];

type OpStatus =
  | { kind: "idle" }
  | { kind: "analyzing" | "rewriting" }
  | { kind: "succeeded"; op: "analyze" | "rewrite" }
  | { kind: "failed"; op: "analyze" | "rewrite" };

function newItem(): ActionItem {
  return { id: crypto.randomUUID(), kind: "requirement", text: "" };
}

function ActionItemsView({ value }: { value: ActionAccepted }) {
  return (
    <div className="space-y-1.5 text-sm">
      {value.lead && value.lead.trim() && <p className="leading-relaxed">{value.lead.trim()}</p>}
      <ul className="space-y-1">
        {value.items.map((item) => (
          <li key={item.id} className="flex gap-2">
            <span className="text-slate-400">•</span>
            <span>
              <strong>{ACTION_KIND_LABELS[item.kind]}:</strong> {item.text}
              <span className="text-slate-500">{actionItemMeta(item)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ActionWorkspace({ workspace, onChange }: Props) {
  const [instructions, setInstructions] = useState("");
  const [opStatus, setOpStatus] = useState<OpStatus>({ kind: "idle" });
  const [warnings, setWarnings] = useState<RewriteWarning[]>([]);
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
  const setContent = (next: ActionAccepted) => onChange((prev) => editComponents(prev, next));
  const setLead = (v: string) => setContent({ ...content, lead: v || undefined });
  const setItems = (items: ActionItem[]) => setContent({ ...content, items });
  const updateItem = (id: string, patch: Partial<ActionItem>) =>
    setItems(content.items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItems(content.items.filter((it) => it.id !== id));
  const addItem = () => setItems([...content.items, newItem()]);

  const handleAnalyze = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: "analyzing" });
    onChange((prev) => beginRequest(prev, requestId));
    try {
      const result = await analyzeAction(workspace.raw);
      onChange((prev) => (isResponseCurrent(prev, requestId) ? applyAnalysisResult(prev, result, []) : prev));
      if (isResponseCurrent(wsRef.current, requestId)) setOpStatus({ kind: "succeeded", op: "analyze" });
    } catch (err: any) {
      setOpStatus({ kind: "failed", op: "analyze" });
      onChange((prev) => failRequest(prev, requestId, err.message || "Failed to analyze action."));
    }
  };

  const handleRewrite = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: "rewriting" });
    setWarnings([]);
    onChange((prev) => beginRequest(prev, requestId));
    try {
      const { result, warnings: newWarnings } = await rewriteAction(workspace.raw, content, instructions);
      onChange((prev) => (isResponseCurrent(prev, requestId) ? applySuggestion(prev, result, requestId) : prev));
      if (isResponseCurrent(wsRef.current, requestId)) {
        setOpStatus({ kind: "succeeded", op: "rewrite" });
        setWarnings(newWarnings || []);
        setTimeout(() => suggestionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
      }
    } catch (err: any) {
      setOpStatus({ kind: "failed", op: "rewrite" });
      onChange((prev) => failRequest(prev, requestId, err.message || "Failed to rewrite action."));
    }
  };

  const handleAccept = () => {
    onChange((prev) => acceptSuggestion(prev));
    setWarnings([]);
  };
  const handleDismiss = () => {
    onChange((prev) => dismissSuggestion(prev));
    setWarnings([]);
  };
  const handleManualAccept = () => onChange((prev) => manualAccept(prev, content));

  const stale = isStale(workspace);
  const busy = workspace.loading;
  const analyzeLabel = opStatus.kind === "analyzing" ? "Analyzing…" : "Analyze";
  const rewriteLabel = opStatus.kind === "rewriting" ? "Rewriting…" : "Rewrite with AI";

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="sr-only">
        {opStatus.kind === "analyzing" && "Analyzing action…"}
        {opStatus.kind === "rewriting" && "Rewriting action…"}
        {opStatus.kind === "succeeded" && opStatus.op === "analyze" && "Action analysis complete."}
        {opStatus.kind === "succeeded" && opStatus.op === "rewrite" && "Action rewrite ready for review."}
        {opStatus.kind === "failed" && `Action ${opStatus.op} failed.`}
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Raw Action Content</label>
        <textarea
          aria-label="Raw Action Content"
          value={workspace.raw}
          onChange={(e) => setRaw(e.target.value)}
          className="w-full h-28 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 resize-none font-mono text-sm"
          placeholder="What must be done -- instructions, restrictions, short/long-term solutions, requirements, deadlines..."
        />
        <div className="flex gap-2 mt-2 items-center">
          <input
            type="text"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Optional rewrite instructions"
            className="flex-1 p-2 text-sm border border-slate-300 rounded-md"
          />
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

      

      <div className="p-4 bg-teal-50 border border-teal-100 rounded-lg space-y-3">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Action Items
          </h4>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Lead / overview (optional)</label>
            <textarea
              aria-label="Action Lead"
              value={content.lead || ""}
              onChange={(e) => setLead(e.target.value)}
              placeholder="An optional opening sentence before the itemized actions."
              className="w-full p-2 text-sm border border-slate-200 rounded-md bg-white"
              rows={1}
            />
          </div>

          {content.items.length === 0 && (
            <p className="text-xs text-slate-500 italic">No action items detected. Add one below, or edit the raw content and re-analyze.</p>
          )}

          <div className="space-y-3">
            {content.items.map((item, i) => (
              <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-md space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 w-5">{i + 1}.</span>
                  <select
                    aria-label={`Item ${i + 1} type`}
                    value={item.kind}
                    onChange={(e) => updateItem(item.id, { kind: e.target.value as ActionKind })}
                    className="p-1.5 text-xs border border-slate-200 rounded-md bg-white"
                  >
                    {KIND_ORDER.map((k) => (
                      <option key={k} value={k}>{ACTION_KIND_LABELS[k]}</option>
                    ))}
                  </select>
                  <button onClick={() => removeItem(item.id)} className="ml-auto text-slate-400 hover:text-red-600" title="Remove item">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  aria-label={`Item ${i + 1} text`}
                  value={item.text}
                  onChange={(e) => updateItem(item.id, { text: e.target.value })}
                  placeholder="The action, restriction, or requirement."
                  className="w-full p-2 text-sm border border-slate-200 rounded-md"
                  rows={2}
                />
                <Collapsible label="Deadline / responsible / reference (optional)" defaultOpen={!!(item.deadline || item.responsibleRole || item.reference)}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input aria-label={`Item ${i + 1} deadline`} value={item.deadline || ""} onChange={(e) => updateItem(item.id, { deadline: e.target.value || undefined })} placeholder="Deadline" className="p-1.5 text-xs border border-slate-200 rounded-md" />
                    <input aria-label={`Item ${i + 1} responsible`} value={item.responsibleRole || ""} onChange={(e) => updateItem(item.id, { responsibleRole: e.target.value || undefined })} placeholder="Responsible role" className="p-1.5 text-xs border border-slate-200 rounded-md" />
                    <input aria-label={`Item ${i + 1} reference`} value={item.reference || ""} onChange={(e) => updateItem(item.id, { reference: e.target.value || undefined })} placeholder="Reference (InTouch, standard)" className="p-1.5 text-xs border border-slate-200 rounded-md" />
                  </div>
                </Collapsible>
              </div>
            ))}
          </div>

          <button onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">
            <Plus className="w-3.5 h-3.5" /> Add item
          </button>

          <div className="flex justify-end gap-2 pt-2 border-t border-teal-200">
            <button onClick={handleManualAccept} className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-md text-sm font-medium hover:bg-emerald-50">
              Mark Ready (No AI)
            </button>
            <button onClick={handleRewrite} disabled={busy || content.items.length === 0} className="px-4 py-2 flex items-center gap-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {opStatus.kind === "rewriting" && <Loader2 className="w-4 h-4 animate-spin" />}
              {rewriteLabel}
            </button>
          </div>
        </div>
      

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
          <ActionItemsView value={workspace.suggestion.value} />
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

      {workspace.accepted && (
        <div className={`p-4 border rounded-lg ${stale ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
          <h4 className={`font-bold mb-2 flex items-center gap-2 ${stale ? "text-amber-900" : "text-emerald-900"}`}>
            {stale && <AlertCircle className="w-4 h-4" />}
            {stale ? "Accepted (stale — review before export)" : "Accepted"}
            <span className="text-xs font-normal opacity-70">({workspace.accepted.source === "ai" ? "AI-assisted" : "manually authored"})</span>
          </h4>
          <ActionItemsView value={workspace.accepted.value} />
        </div>
      )}
    </div>
  );
}
