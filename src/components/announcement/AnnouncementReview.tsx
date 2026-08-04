import React from "react";
import { AlertCircle, CheckCircle2, Download, Loader2, AlertTriangle } from "lucide-react";
import { AnnouncementSnapshot } from "./announcementTypes";
import { ACTION_KIND_LABELS, actionItemMeta } from "./announcementActionRender";

// Read-only final review. Renders ONLY the canonical AnnouncementSnapshot -- the
// exact same object the backend export route rebuilds and prints -- so what is
// shown here is what gets exported (plan §17). No AI, no accept, no mutation.

interface Props {
  snapshot: AnnouncementSnapshot;
  onExport: () => void;
  exporting: boolean;
  exportError: string | null;
}

function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-slate-700">{p.trim()}</p>
      ))}
    </div>
  );
}

function SummaryBlock({ snapshot }: { snapshot: AnnouncementSnapshot }) {
  const s = snapshot.summary;
  if (!s) return <p className="text-sm text-slate-400 italic">No accepted Summary yet.</p>;
  if (s.renderedText && s.renderedText.trim()) return <Prose text={s.renderedText} />;
  return (
    <div className="text-sm space-y-1 text-slate-700">
      {s.centralMessage && <p>{s.centralMessage}</p>}
      {s.affectedScope && <div><strong>Affected Scope:</strong> {s.affectedScope}</div>}
      {s.impact && <div><strong>Impact:</strong> {s.impact}</div>}
      {s.implementationTiming && <div><strong>Implementation Timing:</strong> {s.implementationTiming}</div>}
    </div>
  );
}

function ReasonBlock({ snapshot }: { snapshot: AnnouncementSnapshot }) {
  const r = snapshot.reason;
  if (!r) return <p className="text-sm text-slate-400 italic">No accepted Reason yet.</p>;
  return (
    <div className="space-y-1">
      {r.renderedText && r.renderedText.trim() ? (
        <Prose text={r.renderedText} />
      ) : (
        <div className="text-sm space-y-1 text-slate-700">
          {r.rationale && <p>{r.rationale}</p>}
          {r.triggeringObservation && <div><strong>Triggering Observation:</strong> {r.triggeringObservation}</div>}
        </div>
      )}
      {r.causeStatus && (
        <span className="inline-block text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
          Cause certainty: {r.causeStatus}
        </span>
      )}
    </div>
  );
}

function ActionBlock({ snapshot }: { snapshot: AnnouncementSnapshot }) {
  const a = snapshot.action;
  if (!a) return <p className="text-sm text-slate-400 italic">No accepted Action yet.</p>;
  return (
    <div className="space-y-1.5 text-sm text-slate-700">
      {a.lead && a.lead.trim() && <p className="leading-relaxed">{a.lead.trim()}</p>}
      <ul className="space-y-1">
        {a.items.map((item) => (
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

export default function AnnouncementReview({ snapshot, onExport, exporting, exportError }: Props) {
  const { readiness, metadata } = snapshot;
  const canExport = readiness.blockingIssues.length === 0;

  return (
    <div className="space-y-4">
      {/* Readiness */}
      <div className={`p-4 rounded-lg border ${canExport ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        <h3 className={`font-bold flex items-center gap-2 ${canExport ? "text-emerald-900" : "text-amber-900"}`}>
          {canExport ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          Readiness: {readiness.status}
        </h3>
        {readiness.blockingIssues.length > 0 && (
          <ul className="mt-2 space-y-1">
            {readiness.blockingIssues.map((issue, i) => (
              <li key={i} className="text-sm text-red-800 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {issue}
              </li>
            ))}
          </ul>
        )}
        {readiness.warnings.length > 0 && (
          <ul className="mt-2 space-y-1">
            {readiness.warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-800 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {w}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Document preview */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-center text-slate-800">{metadata.title || "Untitled Announcement"}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600 border-y border-slate-100 py-3">
          <div><strong>Announcement No.:</strong> {metadata.announcementNumber || "—"}</div>
          <div><strong>InTouch ID:</strong> {metadata.inTouchId || "—"}</div>
          <div><strong>Date:</strong> {metadata.date || "—"}</div>
          <div><strong>GEMS No:</strong> {metadata.gemsNo || "N/A"}</div>
          <div><strong>Classification:</strong> {metadata.classification || "SLB-Private"}</div>
        </div>
        <div>
          <h3 className="font-bold text-slate-800 mb-1">SUMMARY</h3>
          <SummaryBlock snapshot={snapshot} />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 mb-1">REASON</h3>
          <ReasonBlock snapshot={snapshot} />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 mb-1">ACTION</h3>
          <ActionBlock snapshot={snapshot} />
        </div>
      </div>

      {exportError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {exportError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onExport}
          disabled={!canExport || exporting}
          title={canExport ? undefined : "Resolve the blocking issues above before exporting"}
          className="px-5 py-2.5 flex items-center gap-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export DOCX
        </button>
      </div>
    </div>
  );
}
