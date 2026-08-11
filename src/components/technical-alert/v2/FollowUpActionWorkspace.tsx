import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { ActionItem, FollowUpActionContent, ObligationStrength, FollowUpCategory, SectionWorkspace } from './types';
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
import { analyzeFollowUpAction, rewriteFollowUpAction } from '../../../services/technicalAlertApiV2';
import { FieldHint, Collapsible, StaleExplanation } from './SectionHelpers';
import { FOLLOW_UP_FIELD_GUIDANCE, ACTION_FIELD_GUIDANCE } from './guidance';

type Workspace = SectionWorkspace<FollowUpActionContent, FollowUpActionContent>;
type Updater = (updater: (prev: Workspace) => Workspace) => void;

interface Props {
  workspace: Workspace;
  onChange: Updater;
}

const OBLIGATION_OPTIONS: ObligationStrength[] = ['mandatory', 'prohibited', 'conditional', 'advisory', 'unclear'];
const CATEGORY_OPTIONS: FollowUpCategory[] = ['monitoring', 'reporting', 'procedural_update', 'replacement', 'engineering_change', 'way_forward'];
// Pre-seeded with one empty action item rather than starting fully empty, so
// the section shows something ready to fill in immediately instead of
// requiring "+ Add Follow-Up Action Item" first. Purely a display fallback --
// read-only until the user edits a field, at which point it becomes real
// committed state under the same id (see updateItem below).
const EMPTY: FollowUpActionContent = {
  items: [{ id: 'default-item', actor: [], requiredAction: '', obligationStrength: 'advisory' }],
  notApplicable: false,
};

function newActionItem(): ActionItem {
  return { id: crypto.randomUUID(), actor: [], requiredAction: '', obligationStrength: 'advisory' };
}

// Same local operation-status model as the other three workspaces -- see
// SummaryWorkspace.tsx for the full rationale.
type OpStatus =
  | { kind: 'idle' }
  | { kind: 'analyzing' | 'rewriting' }
  | { kind: 'succeeded'; op: 'analyze' | 'rewrite' }
  | { kind: 'failed'; op: 'analyze' | 'rewrite' };

export default function FollowUpActionWorkspace({ workspace, onChange }: Props) {
  // FCO-style reveal: see SummaryWorkspace.tsx for the full rationale.
  const [editMode, setEditMode] = useState(false);
  const [opStatus, setOpStatus] = useState<OpStatus>({ kind: 'idle' });
  const [warnings, setWarnings] = useState<{ gate: string; message: string }[]>([]);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const content = workspace.analysis.components ?? EMPTY;

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
  const setContent = (next: FollowUpActionContent) => onChange(prev => editComponents(prev, next));

  const updateItem = (id: string, patch: Partial<ActionItem>) => setContent({ ...content, items: content.items.map(i => (i.id === id ? { ...i, ...patch } : i)) });
  const removeItem = (id: string) => setContent({ ...content, items: content.items.filter(i => i.id !== id) });
  const addItem = () => setContent({ ...content, items: [...content.items, newActionItem()] });
  const setNotApplicable = (value: boolean) => setContent({ ...content, notApplicable: value, items: value ? [] : content.items });

  const handleAnalyze = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: 'analyzing' });
    onChange(prev => beginRequest(prev, requestId));
    try {
      const result = await analyzeFollowUpAction(workspace.raw);
      if (!isResponseCurrent(workspaceRef.current, requestId)) return;
      onChange(prev => applyAnalysisResult(prev, result, []));
      setOpStatus({ kind: 'succeeded', op: 'analyze' });
    } catch (err: any) {
      setOpStatus({ kind: 'failed', op: 'analyze' });
      onChange(prev => failRequest(prev, requestId, err.message || 'Failed to analyze follow-up action.'));
    }
  };

  const handleRewrite = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: 'rewriting' });
    setWarnings([]);
    onChange(prev => beginRequest(prev, requestId));
    try {
      const { result, warnings: newWarnings } = await rewriteFollowUpAction(workspace.raw, content);
      if (!isResponseCurrent(workspaceRef.current, requestId)) return;
      onChange(prev => applySuggestion(prev, result, requestId));
      setOpStatus({ kind: 'succeeded', op: 'rewrite' });
      setWarnings(newWarnings || []);
      setTimeout(() => suggestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } catch (err: any) {
      setOpStatus({ kind: 'failed', op: 'rewrite' });
      onChange(prev => failRequest(prev, requestId, err.message || 'Failed to rewrite follow-up action.'));
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
  const handleAcceptNotApplicable = () => {
    onChange(prev => manualAccept(prev, { items: [], notApplicable: true }));
    setEditMode(false);
  };

  const stale = isStale(workspace);
  const analyzeLabel = opStatus.kind === 'analyzing' ? 'Analyzing…' : 'Analyze';
  const rewriteLabel = opStatus.kind === 'rewriting' ? 'Rewriting…' : 'Rewrite with AI';
  const busy = workspace.loading;
  // Both a filled item and an explicit Not Applicable are valid "handled"
  // states for this optional section.
  const hasRequiredContent = content.notApplicable || content.items.some(i => !!i.requiredAction?.trim());
  const showComponents = !!workspace.analysis.ranAt || hasRequiredContent;

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="sr-only">
        {opStatus.kind === 'analyzing' && 'Analyzing follow-up action…'}
        {opStatus.kind === 'rewriting' && 'Rewriting follow-up action…'}
        {opStatus.kind === 'succeeded' && opStatus.op === 'analyze' && 'Follow-up action analysis complete.'}
        {opStatus.kind === 'succeeded' && opStatus.op === 'rewrite' && 'Follow-up action rewrite ready for review.'}
        {opStatus.kind === 'failed' && `Follow-up action ${opStatus.op} failed.`}
      </div>
      {(!workspace.accepted || editMode) && (
        <>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={content.notApplicable} onChange={e => setNotApplicable(e.target.checked)} />
          Not Applicable to this alert
        </label>
        {content.notApplicable && (
          <button onClick={handleAcceptNotApplicable} className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 rounded-md text-sm font-medium hover:bg-emerald-50">
            Accept as Not Applicable
          </button>
        )}
      </div>

      {!content.notApplicable && (
        <>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Raw Follow-Up Action Content</label>
            <textarea
              value={workspace.raw}
              onChange={e => setRaw(e.target.value)}
              className="w-full h-28 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 resize-none font-mono text-sm"
              placeholder="Paste rough follow-up/monitoring/reporting instructions here..."
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
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                {hasRequiredContent && <CheckCircle2 className="w-5 h-5 text-emerald-600" />} Follow-Up Action Items
              </h4>
              {content.items.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                  <div>
                    <textarea value={item.requiredAction} onChange={e => updateItem(item.id, { requiredAction: e.target.value })} className="w-full p-2 text-sm border rounded-md" rows={2} placeholder={FOLLOW_UP_FIELD_GUIDANCE.requiredAction.placeholder} />
                    <FieldHint text={FOLLOW_UP_FIELD_GUIDANCE.requiredAction.hint} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input type="text" value={item.actor.join(', ')} onChange={e => updateItem(item.id, { actor: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder={ACTION_FIELD_GUIDANCE.actor.placeholder} className="w-full p-1.5 border rounded text-sm" />
                      <FieldHint text={ACTION_FIELD_GUIDANCE.actor.hint} />
                    </div>
                    <div>
                      <select value={item.obligationStrength} onChange={e => updateItem(item.id, { obligationStrength: e.target.value as ObligationStrength })} className="w-full p-1.5 border rounded text-sm">
                        {OBLIGATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <FieldHint text={ACTION_FIELD_GUIDANCE.obligationStrength.hint} />
                    </div>
                  </div>
                  <Collapsible label="Advanced (timing, category)">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input type="text" value={item.timing || ''} onChange={e => updateItem(item.id, { timing: e.target.value || undefined })} placeholder={ACTION_FIELD_GUIDANCE.timing.placeholder} className="w-full p-1.5 border rounded text-sm" />
                        <FieldHint text={ACTION_FIELD_GUIDANCE.timing.hint} />
                      </div>
                      <div>
                        <select value={item.followUpCategory || ''} onChange={e => updateItem(item.id, { followUpCategory: (e.target.value || undefined) as FollowUpCategory | undefined })} className="w-full p-1.5 border rounded text-sm">
                          <option value="">No category</option>
                          {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                        </select>
                        <FieldHint text={FOLLOW_UP_FIELD_GUIDANCE.followUpCategory.hint} />
                      </div>
                    </div>
                  </Collapsible>
                  <div className="flex justify-end">
                    <button onClick={() => removeItem(item.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <button onClick={addItem} className="text-sm text-amber-700 font-semibold hover:underline flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add Follow-Up Action Item
              </button>
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
              <ul className="list-disc pl-5 text-sm space-y-1">
                {workspace.suggestion.value.items.map(i => (
                  <li key={i.id}>{i.instructionText || i.requiredAction} <span className="font-semibold">({i.obligationStrength}{i.followUpCategory ? `, ${i.followUpCategory}` : ''})</span></li>
                ))}
              </ul>
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
          {workspace.accepted.value.notApplicable ? (
            <p className="text-sm italic">Marked Not Applicable.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm space-y-1">
              {workspace.accepted.value.items.map(i => <li key={i.id}>{i.instructionText || i.requiredAction} <span className="font-semibold">({i.obligationStrength})</span></li>)}
            </ul>
          )}
          <button onClick={() => setEditMode(true)} className="text-xs font-semibold text-slate-600 hover:text-slate-800 hover:underline mt-3">
            Edit / Redraft
          </button>
        </div>
      )}
    </div>
  );
}
