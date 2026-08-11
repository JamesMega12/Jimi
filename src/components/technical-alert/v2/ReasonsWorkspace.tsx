import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { ReasonsAccepted, CauseStatus, SectionWorkspace, EvidenceItem } from './types';
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
} from './sectionWorkspace';
import { analyzeReasons, rewriteReasons } from '../../../services/technicalAlertApiV2';
import { FieldHint, Collapsible, StaleExplanation } from './SectionHelpers';
import { REASONS_FIELD_GUIDANCE } from './guidance';

type Workspace = SectionWorkspace<ReasonsAccepted, ReasonsAccepted>;
type Updater = (updater: (prev: Workspace) => Workspace) => void;

interface Props {
  workspace: Workspace;
  onChange: Updater;
}

const CAUSE_STATUS_OPTIONS: CauseStatus[] = ['confirmed', 'preliminary', 'suspected', 'unknown'];
// Pre-seeded with one empty narrative + evidence item rather than starting
// fully empty, so the section shows something ready to fill in immediately
// instead of requiring "+ Add Narrative"/"+ Add Evidence Item" first. Purely
// a display fallback -- read-only until the user edits a field, at which
// point it becomes real committed state under the same id (see
// updateNarrativeField/updateEvidenceItem below).
const EMPTY: ReasonsAccepted = {
  narrative: { causeStatus: 'unknown' },
  evidenceItems: [{ id: 'default-evidence', component: '', concern: '' }],
};

// Same local operation-status model as SummaryWorkspace -- see there for the
// full rationale.
type OpStatus =
  | { kind: 'idle' }
  | { kind: 'analyzing' | 'rewriting' }
  | { kind: 'succeeded'; op: 'analyze' | 'rewrite' }
  | { kind: 'failed'; op: 'analyze' | 'rewrite' };

function ReasonsContent({ value }: { value: ReasonsAccepted }) {
  const evidenceItems = value.evidenceItems || [];
  return (
    <div className="space-y-2">
      {value.narrative && (
        value.narrative.renderedText ? (
          <div>
            <p className="text-sm leading-relaxed">{value.narrative.renderedText}</p>
            <span className="text-xs text-slate-500">Cause status: {value.narrative.causeStatus}</span>
            <Collapsible label="Show field breakdown">
              <div className="text-xs space-y-1 text-slate-600">
                {value.narrative.technicalBasis && <div><strong>Technical Basis:</strong> {value.narrative.technicalBasis}</div>}
                {value.narrative.complianceBasis && <div><strong>Compliance Basis:</strong> {value.narrative.complianceBasis}</div>}
                {value.narrative.consequence && <div><strong>Consequence:</strong> {value.narrative.consequence}</div>}
              </div>
            </Collapsible>
          </div>
        ) : (
          <p className="text-sm"><strong>Cause status:</strong> {value.narrative.causeStatus} — {value.narrative.technicalBasis}</p>
        )
      )}
      {evidenceItems.length > 0 && (
        <ul className="list-disc pl-5 text-sm">
          {evidenceItems.map(e => <li key={e.id}>{e.component}: {e.concern}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function ReasonsWorkspace({ workspace, onChange }: Props) {
  const [causeStatusEdited, setCauseStatusEdited] = useState(false);
  // FCO-style reveal: see SummaryWorkspace.tsx for the full rationale.
  const [editMode, setEditMode] = useState(false);
  const [opStatus, setOpStatus] = useState<OpStatus>({ kind: 'idle' });
  const [warnings, setWarnings] = useState<{ gate: string; message: string }[]>([]);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const content = workspace.analysis.components ?? EMPTY;
  const narrative = content.narrative;
  const evidenceItems = content.evidenceItems || [];

  // See SummaryWorkspace.tsx for the full rationale -- mirrors the latest
  // `workspace` prop so handleAnalyze/handleRewrite can check staleness
  // synchronously before calling onChange, instead of inside its updater.
  const workspaceRef = useRef(workspace);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

  useEffect(() => {
    if (opStatus.kind !== 'succeeded') return;
    const t = setTimeout(() => setOpStatus({ kind: 'idle' }), 4000);
    return () => clearTimeout(t);
  }, [opStatus]);

  const setRaw = (raw: string) => onChange(prev => editRaw(prev, raw));
  const setContent = (next: ReasonsAccepted) => onChange(prev => editComponents(prev, next));

  const ensureNarrative = () => narrative || { causeStatus: 'unknown' as CauseStatus };

  const updateNarrativeField = (field: 'technicalBasis' | 'complianceBasis' | 'consequence', value: string) => {
    setContent({ ...content, narrative: { ...ensureNarrative(), [field]: value || undefined } });
  };
  const updateCauseStatus = (value: CauseStatus) => {
    setCauseStatusEdited(true);
    setContent({ ...content, narrative: { ...ensureNarrative(), causeStatus: value } });
  };
  const removeNarrative = () => setContent({ ...content, narrative: undefined });
  const addNarrative = () => setContent({ ...content, narrative: { causeStatus: 'unknown' } });

  const updateEvidenceItem = (id: string, patch: Partial<EvidenceItem>) => {
    setContent({ ...content, evidenceItems: evidenceItems.map(e => (e.id === id ? { ...e, ...patch } : e)) });
  };
  const removeEvidenceItem = (id: string) => setContent({ ...content, evidenceItems: evidenceItems.filter(e => e.id !== id) });
  const addEvidenceItem = () =>
    setContent({ ...content, evidenceItems: [...evidenceItems, { id: crypto.randomUUID(), component: '', concern: '' }] });

  const handleAnalyze = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: 'analyzing' });
    onChange(prev => beginRequest(prev, requestId));
    try {
      const result = await analyzeReasons(workspace.raw);
      if (!isResponseCurrent(workspaceRef.current, requestId)) return;
      onChange(prev => applyAnalysisResult(prev, result, []));
      setOpStatus({ kind: 'succeeded', op: 'analyze' });
    } catch (err: any) {
      setOpStatus({ kind: 'failed', op: 'analyze' });
      onChange(prev => failRequest(prev, requestId, err.message || 'Failed to analyze reasons.'));
    }
  };

  const handleRewrite = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: 'rewriting' });
    setWarnings([]);
    onChange(prev => beginRequest(prev, requestId));
    try {
      const { result, warnings: newWarnings } = await rewriteReasons(workspace.raw, content, undefined, causeStatusEdited);
      if (!isResponseCurrent(workspaceRef.current, requestId)) return;
      onChange(prev => applySuggestion(prev, result, requestId));
      setOpStatus({ kind: 'succeeded', op: 'rewrite' });
      setWarnings(newWarnings || []);
      setTimeout(() => suggestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } catch (err: any) {
      setOpStatus({ kind: 'failed', op: 'rewrite' });
      onChange(prev => failRequest(prev, requestId, err.message || 'Failed to rewrite reasons.'));
    }
  };

  const handleAccept = () => {
    onChange(prev => acceptSuggestion(prev));
    setWarnings([]);
    setEditMode(false);
  };
  const handleDismiss = () => {
    onChange(prev => dismissSuggestion(prev));
    setWarnings([]);
  };
  const handleManualAccept = () => {
    onChange(prev => manualAccept(prev, content));
    setEditMode(false);
  };

  const stale = isStale(workspace);
  const analyzeLabel = opStatus.kind === 'analyzing' ? 'Analyzing…' : 'Analyze';
  const rewriteLabel = opStatus.kind === 'rewriting' ? 'Rewriting…' : 'Rewrite with AI';
  const busy = workspace.loading;
  // Reasons has no hard-required field in readiness.ts (it's optional for
  // export) -- so the checkmark just tracks "is there any real content here"
  // rather than a specific field, unlike Summary/Immediate Action.
  const hasRealContent =
    (!!narrative && (narrative.causeStatus !== 'unknown' || !!narrative.technicalBasis?.trim() || !!narrative.complianceBasis?.trim() || !!narrative.consequence?.trim())) ||
    evidenceItems.some(e => !!e.component?.trim() || !!e.concern?.trim());
  const showComponents = !!workspace.analysis.ranAt || hasRealContent;

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="sr-only">
        {opStatus.kind === 'analyzing' && 'Analyzing reasons…'}
        {opStatus.kind === 'rewriting' && 'Rewriting reasons…'}
        {opStatus.kind === 'succeeded' && opStatus.op === 'analyze' && 'Reasons analysis complete.'}
        {opStatus.kind === 'succeeded' && opStatus.op === 'rewrite' && 'Reasons rewrite ready for review.'}
        {opStatus.kind === 'failed' && `Reasons ${opStatus.op} failed.`}
      </div>

      {(!workspace.accepted || editMode) && (
        <>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Raw Reasons Content</label>
        <textarea
          value={workspace.raw}
          onChange={e => setRaw(e.target.value)}
          className="w-full h-28 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 resize-none font-mono text-sm"
          placeholder="Paste rough reasons/evidence content here (this section is optional for some alert types)..."
        />
        <div className="flex gap-2 mt-2 items-center">
          <button onClick={handleAnalyze} disabled={busy || !workspace.raw.trim()} className="px-4 py-2 flex items-center gap-2 bg-slate-800 text-white rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
            {opStatus.kind === 'analyzing' && <Loader2 className="w-4 h-4 animate-spin" />}
            {analyzeLabel}
          </button>
          {opStatus.kind === 'succeeded' && opStatus.op === 'analyze' && (
            <span className="text-xs font-medium text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Analysis complete</span>
          )}
        </div>
      </div>

      {workspace.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {workspace.error}
        </div>
      )}

      {showComponents && (
      <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            {hasRealContent && <CheckCircle2 className="w-5 h-5 text-emerald-600" />} Reasons Components
          </h4>

          {narrative ? (
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Narrative</span>
                <button onClick={removeNarrative} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div>
                <textarea value={narrative.technicalBasis || ''} onChange={e => updateNarrativeField('technicalBasis', e.target.value)} placeholder={REASONS_FIELD_GUIDANCE.technicalBasis.placeholder} className="w-full p-2 text-sm border rounded-md" rows={2} />
                <FieldHint text={REASONS_FIELD_GUIDANCE.technicalBasis.hint} />
              </div>
              <div>
                <textarea value={narrative.consequence || ''} onChange={e => updateNarrativeField('consequence', e.target.value)} placeholder={REASONS_FIELD_GUIDANCE.consequence.placeholder} className="w-full p-2 text-sm border rounded-md" rows={2} />
                <FieldHint text={REASONS_FIELD_GUIDANCE.consequence.hint} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cause Status</label>
                <select value={narrative.causeStatus} onChange={e => updateCauseStatus(e.target.value as CauseStatus)} className="p-1.5 border rounded text-sm">
                  {CAUSE_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <span className="text-xs text-slate-400 ml-2">(AI cannot upgrade this toward "confirmed" without your edit)</span>
                <FieldHint text={REASONS_FIELD_GUIDANCE.causeStatus.hint} />
              </div>
              <Collapsible label="Advanced">
                <div>
                  <textarea value={narrative.complianceBasis || ''} onChange={e => updateNarrativeField('complianceBasis', e.target.value)} placeholder={REASONS_FIELD_GUIDANCE.complianceBasis.placeholder} className="w-full p-2 text-sm border rounded-md" rows={2} />
                  <FieldHint text={REASONS_FIELD_GUIDANCE.complianceBasis.hint} />
                </div>
              </Collapsible>
            </div>
          ) : (
            <button onClick={addNarrative} className="text-sm text-amber-700 font-semibold hover:underline flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Narrative
            </button>
          )}

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-500">Evidence Items</span>
            {evidenceItems.map(item => (
              <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input type="text" value={item.component} onChange={e => updateEvidenceItem(item.id, { component: e.target.value })} placeholder={REASONS_FIELD_GUIDANCE.evidenceComponent.placeholder} className="w-full p-1.5 border rounded text-sm" />
                    <FieldHint text={REASONS_FIELD_GUIDANCE.evidenceComponent.hint} />
                  </div>
                  <div>
                    <input type="text" value={item.concern} onChange={e => updateEvidenceItem(item.id, { concern: e.target.value })} placeholder={REASONS_FIELD_GUIDANCE.evidenceConcern.placeholder} className="w-full p-1.5 border rounded text-sm" />
                    <FieldHint text={REASONS_FIELD_GUIDANCE.evidenceConcern.hint} />
                  </div>
                </div>
                <Collapsible label="Advanced">
                  <div>
                    <input type="text" value={item.evidence || ''} onChange={e => updateEvidenceItem(item.id, { evidence: e.target.value || undefined })} placeholder={REASONS_FIELD_GUIDANCE.evidenceEvidence.placeholder} className="w-full p-1.5 border rounded text-sm" />
                    <FieldHint text={REASONS_FIELD_GUIDANCE.evidenceEvidence.hint} />
                  </div>
                </Collapsible>
                <button onClick={() => removeEvidenceItem(item.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={addEvidenceItem} className="text-sm text-amber-700 font-semibold hover:underline flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Evidence Item
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-amber-200">
            <button onClick={handleManualAccept} className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-md text-sm font-medium hover:bg-emerald-50">
              Mark Ready (No AI)
            </button>
            <button onClick={handleRewrite} disabled={busy} className="px-4 py-2 flex items-center gap-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
              {opStatus.kind === 'rewriting' && <Loader2 className="w-4 h-4 animate-spin" />}
              {rewriteLabel}
            </button>
          </div>
        </div>
      )}

      {opStatus.kind === 'failed' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {opStatus.op === 'analyze' ? 'Analysis failed.' : 'Rewrite failed.'} {workspace.error} Your previously accepted content, if any, is unchanged.
        </div>
      )}

      {workspace.suggestion.value && (
        <div ref={suggestionRef} className="p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
          <h4 className="font-bold text-blue-900 flex items-center gap-2">
            Rewrite Suggestion
            <span className="text-xs font-normal text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">pending review -- not yet accepted</span>
          </h4>
          <ReasonsContent value={workspace.suggestion.value} />
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
            <button onClick={handleDismiss} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">Dismiss</button>
          </div>
        </div>
      )}
        </>
      )}

      {workspace.accepted && !editMode && (
        <div className={`p-4 border rounded-lg ${stale ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <h4 className={`font-bold mb-2 flex items-center gap-2 ${stale ? 'text-amber-900' : 'text-emerald-900'}`}>
            {stale && <AlertCircle className="w-4 h-4" />}
            {stale ? 'Accepted — needs another review' : 'Accepted'}
            <span className="text-xs font-normal opacity-70">({workspace.accepted.source === 'ai' ? 'AI-assisted' : 'manually authored'})</span>
          </h4>
          {stale && <StaleExplanation ws={workspace} />}
          <ReasonsContent value={workspace.accepted.value} />
          <button onClick={() => setEditMode(true)} className="text-xs font-semibold text-slate-600 hover:text-slate-800 hover:underline mt-3">
            Edit / Redraft
          </button>
        </div>
      )}
    </div>
  );

}
