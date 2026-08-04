import React, { useState, useMemo } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, Sparkles, Loader2 } from 'lucide-react';
import { FcoSummaryAnalysis, FcoPcsbField, FcoPcsbConfidence } from '../types';

interface ConfirmedPCSB {
  problem: string;
  cause: string;
  solution: string;
  benefit: string;
}

interface Props {
  analysis: FcoSummaryAnalysis;
  rewriting: boolean;
  onClose: () => void;
  /** Called with the reviewer-confirmed wording for all four components — sent
   * to the rewrite as the typed `confirmedPCSB` request field. */
  onAcceptAndRewrite: (confirmedPCSB: ConfirmedPCSB) => void;
}

const FIELDS: { key: FcoPcsbField; label: string; critical: boolean }[] = [
  { key: 'problem', label: 'Problem', critical: true },
  { key: 'cause', label: 'Cause', critical: false },
  { key: 'solution', label: 'Solution', critical: true },
  { key: 'benefit', label: 'Benefit', critical: false }
];

function statusFor(field: FcoPcsbField, analysis: FcoSummaryAnalysis): 'present' | 'weak' | 'missing' {
  if (analysis.missingFields?.includes(field)) return 'missing';
  if (analysis.weakFields?.includes(field)) return 'weak';
  const conf: FcoPcsbConfidence = analysis.confidence?.[field] ?? 'missing';
  if (conf === 'missing') return 'missing';
  if (conf === 'low') return 'weak';
  return 'present';
}

const STATUS_STYLES = {
  present: { label: 'Present', badge: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2, iconColor: 'text-emerald-600' },
  weak: { label: 'Weak', badge: 'bg-amber-100 text-amber-800', Icon: AlertTriangle, iconColor: 'text-amber-600' },
  missing: { label: 'Missing', badge: 'bg-red-100 text-red-800', Icon: XCircle, iconColor: 'text-red-600' }
} as const;

export default function FcoSummaryAnalysisModal({ analysis, rewriting, onClose, onAcceptAndRewrite }: Props) {
  // Map each suggestion by field (the backend only returns suggestions for
  // missing/weak fields; present fields simply have no entry here).
  const suggestionsByField = useMemo(() => {
    const map: Partial<Record<FcoPcsbField, { text: string; reason: string; status: string }>> = {};
    (analysis.suggestions || []).forEach(s => {
      if (!map[s.field]) map[s.field] = { text: s.suggestedText, reason: s.reason, status: s.status };
    });
    return map;
  }, [analysis]);

  // The editable text per field — seeded from the AI suggestion if one
  // exists, otherwise from the detected text so present fields have a
  // sensible starting point for editing. Whatever's here when the user
  // clicks Rewrite is sent as that component's confirmed guidance.
  const [editedText, setEditedText] = useState<Record<FcoPcsbField, string>>(() => {
    const init = {} as Record<FcoPcsbField, string>;
    FIELDS.forEach(f => {
      const sug = suggestionsByField[f.key];
      init[f.key] = sug ? sug.text : (analysis.pcsb?.[f.key] || '');
    });
    return init;
  });

  const anyGaps = FIELDS.some(f => statusFor(f.key, analysis) !== 'present');

  // Editing components here never touches the raw Summary — it only builds
  // the confirmedPCSB rewrite-guidance object from whatever's currently in
  // each field.
  const handleAcceptAndRewrite = () => {
    const confirmedPCSB = {} as ConfirmedPCSB;
    FIELDS.forEach(f => {
      const detected = analysis.pcsb?.[f.key] || '';
      confirmedPCSB[f.key] = (editedText[f.key] ?? detected).trim();
    });
    onAcceptAndRewrite(confirmedPCSB);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Summary Analysis
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Review and edit each component before rewriting. Editing here does not change your Rough Draft.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto space-y-3">
          {!anyGaps && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              All four components are present. You can adjust wording below or rewrite directly.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELDS.map(f => {
              const status = statusFor(f.key, analysis);
              const style = STATUS_STYLES[status];
              const sug = suggestionsByField[f.key];
              return (
                <div key={f.key} className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <style.Icon className={`w-4 h-4 ${style.iconColor}`} />
                      <span className="font-bold text-slate-800 text-sm">{f.label}</span>
                      {f.critical && <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Critical</span>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <textarea
                      value={editedText[f.key] ?? ''}
                      onChange={(e) => setEditedText(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={`Describe the ${f.label.toLowerCase()}...`}
                      className="w-full flex-1 px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[100px] resize-y"
                    />
                    {sug?.reason && <p className="text-xs text-slate-500 mt-1">{sug.reason}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={rewriting}
            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAcceptAndRewrite}
            disabled={rewriting}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-60"
          >
            {rewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {rewriting ? 'Rewriting...' : 'Rewrite Summary Using These Components'}
          </button>
        </div>
      </div>
    </div>
  );
}
