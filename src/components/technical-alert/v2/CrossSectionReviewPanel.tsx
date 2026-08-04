import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Sparkles, X } from 'lucide-react';
import { CrossSectionFinding, SectionId, TechnicalAlertSections } from './types';
import { runDeterministicCrossSectionChecks } from './crossSectionReview';
import { runCrossSectionDeepCheck } from '../../../services/technicalAlertApiV2';

// Findings triage UI -- interaction pattern inspired by FCO's
// ProcedureReadinessPanel (a list of AI/deterministic findings with
// dismiss/acknowledge controls), reimplemented against TA's own
// CrossSectionFinding type per the refactor plan's reuse assessment (pattern
// reuse, not code import -- FCO's ProcedureReadinessSuggestion type is
// FCO-procedure-shaped and was never a drop-in fit).

interface Props {
  sections: TechnicalAlertSections;
  onJumpToSection: (id: SectionId) => void;
}

const SECTION_LABELS: Record<SectionId, string> = {
  summary: 'Summary',
  reasons: 'Reasons',
  immediateAction: 'Immediate Action',
  followUpAction: 'Follow-Up Action',
};

export default function CrossSectionReviewPanel({ sections, onJumpToSection }: Props) {
  const [findings, setFindings] = useState<CrossSectionFinding[]>(() => runDeterministicCrossSectionChecks(sections));
  const [deepCheckLoading, setDeepCheckLoading] = useState(false);
  const [deepCheckError, setDeepCheckError] = useState<string | null>(null);

  // Re-run the cheap deterministic checks whenever accepted content changes;
  // mark any existing AI findings stale (never silently trusted after the
  // fact) rather than dropping them.
  useEffect(() => {
    setFindings(prev => [...runDeterministicCrossSectionChecks(sections), ...prev.filter(f => f.source === 'ai').map(f => ({ ...f, stale: true }))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const handleDeepCheck = async () => {
    setDeepCheckLoading(true);
    setDeepCheckError(null);
    try {
      const payload: Record<string, unknown> = {};
      (Object.keys(sections) as SectionId[]).forEach(id => {
        if (sections[id].accepted) payload[id] = sections[id].accepted!.value;
      });
      const { findings: aiFindingsRaw } = await runCrossSectionDeepCheck(payload);
      const aiFindings: CrossSectionFinding[] = aiFindingsRaw.map(f => ({
        id: crypto.randomUUID(),
        severity: 'review_recommended',
        message: f.message,
        relatedSections: f.relatedSections as SectionId[],
        source: 'ai',
        blocking: false,
        dismissed: false,
        stale: false,
      }));
      setFindings(prev => [...prev.filter(f => f.source !== 'ai'), ...aiFindings]);
    } catch (err: any) {
      setDeepCheckError(err.message || 'Deep consistency check failed.');
    } finally {
      setDeepCheckLoading(false);
    }
  };

  const dismiss = (id: string) => setFindings(prev => prev.map(f => (f.id === id ? { ...f, dismissed: true } : f)));

  const active = findings.filter(f => !f.dismissed);
  const blocking = active.filter(f => f.blocking);
  const advisory = active.filter(f => !f.blocking);
  const acceptedCount = (Object.keys(sections) as SectionId[]).filter(id => !!sections[id].accepted).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Cross-Section Review</h2>
        <button
          onClick={handleDeepCheck}
          disabled={deepCheckLoading || acceptedCount === 0}
          title={acceptedCount === 0 ? 'Accept at least one section in Drafting first' : undefined}
          className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 rounded-lg disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {deepCheckLoading ? 'Checking…' : 'Deep Consistency Check (AI)'}
        </button>
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
        <p>
          This automatically compares the sections you've <strong>accepted</strong> so far for contradictions or gaps -- for
          example, a control accidentally duplicated in both Immediate and Follow-Up Action, or a requirement stated in Summary
          that isn't reflected in any action. Free checks re-run automatically each time you accept a section. Click
          "Deep Consistency Check (AI)" above for a deeper, AI-assisted semantic review on demand.
        </p>
      </div>

      {deepCheckError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{deepCheckError}</div>}

      {acceptedCount === 0 ? (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-center gap-2">
          <Info className="w-4 h-4 flex-shrink-0" /> Nothing to check yet -- accept at least one section in Drafting first.
        </div>
      ) : active.length === 0 ? (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Checked {acceptedCount} accepted section{acceptedCount === 1 ? '' : 's'}, no consistency issues found.
        </div>
      ) : (
        <div className="space-y-2">
          {[...blocking, ...advisory].map(finding => (
            <div
              key={finding.id}
              className={`p-3 rounded-lg border flex items-start gap-3 ${finding.blocking ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} ${finding.stale ? 'opacity-60' : ''}`}
            >
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${finding.blocking ? 'text-red-600' : 'text-amber-600'}`} />
              <div className="flex-1 text-sm">
                <p className={finding.blocking ? 'text-red-900' : 'text-amber-900'}>
                  {finding.message}
                  {finding.stale && <span className="italic text-slate-500"> (stale — related content changed, re-run deep check)</span>}
                </p>
                <div className="flex gap-2 mt-1">
                  {finding.relatedSections.map(id => (
                    <button key={id} onClick={() => onJumpToSection(id)} className="text-xs underline text-slate-600 hover:text-slate-900">
                      Go to {SECTION_LABELS[id]}
                    </button>
                  ))}
                  <span className="text-xs text-slate-400">
                    {finding.source === 'ai' ? 'AI-assisted' : 'deterministic'} · {finding.blocking ? 'blocking' : 'advisory'}
                  </span>
                </div>
              </div>
              <button onClick={() => dismiss(finding.id)} className="text-slate-400 hover:text-slate-700 p-1" title="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
