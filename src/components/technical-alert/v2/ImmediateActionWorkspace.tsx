import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { ActionItem, ExceptionRecord, ImmediateActionContent, ObligationStrength, ControlType, SectionWorkspace } from './types';
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
import { analyzeImmediateAction, rewriteImmediateAction } from '../../../services/technicalAlertApiV2';
import { FieldHint, Collapsible } from './SectionHelpers';
import { ACTION_FIELD_GUIDANCE } from './guidance';

type Workspace = SectionWorkspace<ImmediateActionContent, ImmediateActionContent>;
type Updater = (updater: (prev: Workspace) => Workspace) => void;

interface Props {
  workspace: Workspace;
  onChange: Updater;
}

const OBLIGATION_OPTIONS: ObligationStrength[] = ['mandatory', 'prohibited', 'conditional', 'advisory', 'unclear'];
const CONTROL_TYPE_OPTIONS: ControlType[] = ['removal_from_service', 'red_tag', 'quarantine', 'escalation'];
const EMPTY_CONTENT: ImmediateActionContent = { items: [], exceptions: [] };

function newActionItem(): ActionItem {
  return { id: crypto.randomUUID(), actor: [], requiredAction: '', obligationStrength: 'mandatory' };
}

// Same local operation-status model as SummaryWorkspace/ReasonsWorkspace --
// see SummaryWorkspace.tsx for the full rationale.
type OpStatus =
  | { kind: 'idle' }
  | { kind: 'analyzing' | 'rewriting' }
  | { kind: 'succeeded'; op: 'analyze' | 'rewrite' }
  | { kind: 'failed'; op: 'analyze' | 'rewrite' };

export default function ImmediateActionWorkspace({ workspace, onChange }: Props) {
  const [instructions, setInstructions] = useState('');
  const [opStatus, setOpStatus] = useState<OpStatus>({ kind: 'idle' });
  const [warnings, setWarnings] = useState<{ gate: string; message: string }[]>([]);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const content = workspace.analysis.components ?? EMPTY_CONTENT;

  useEffect(() => {
    if (opStatus.kind !== 'succeeded') return;
    const t = setTimeout(() => setOpStatus({ kind: 'idle' }), 4000);
    return () => clearTimeout(t);
  }, [opStatus]);

  const setRaw = (raw: string) => onChange(prev => editRaw(prev, raw));
  const setContent = (next: ImmediateActionContent) => onChange(prev => editComponents(prev, next));

  const handleAnalyze = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: 'analyzing' });
    onChange(prev => beginRequest(prev, requestId));
    try {
      const result = await analyzeImmediateAction(workspace.raw);
      onChange(prev => {
        if (!isResponseCurrent(prev, requestId)) return prev;
        setOpStatus({ kind: 'succeeded', op: 'analyze' });
        return applyAnalysisResult(prev, result, []);
      });
    } catch (err: any) {
      setOpStatus({ kind: 'failed', op: 'analyze' });
      onChange(prev => failRequest(prev, requestId, err.message || 'Failed to analyze immediate action.'));
    }
  };

  const handleRewrite = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: 'rewriting' });
    setWarnings([]);
    onChange(prev => beginRequest(prev, requestId));
    try {
      const { result, warnings: newWarnings } = await rewriteImmediateAction(workspace.raw, content, instructions);
      onChange(prev => {
        if (!isResponseCurrent(prev, requestId)) return prev;
        setOpStatus({ kind: 'succeeded', op: 'rewrite' });
        setWarnings(newWarnings || []);
        setTimeout(() => suggestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        return applySuggestion(prev, result, requestId);
      });
    } catch (err: any) {
      setOpStatus({ kind: 'failed', op: 'rewrite' });
      onChange(prev => failRequest(prev, requestId, err.message || 'Failed to rewrite immediate action.'));
    }
  };

  const handleAccept = () => {
    onChange(prev => acceptSuggestion(prev));
    setWarnings([]);
  };
  const handleDismiss = () => {
    onChange(prev => dismissSuggestion(prev));
    setWarnings([]);
  };
  const handleManualAccept = () => onChange(prev => manualAccept(prev, content));

  // --- item editing (operates on whichever content is currently being edited:
  // analysis.components, pre-accept) ---
  const updateItem = (id: string, patch: Partial<ActionItem>) => {
    setContent({ ...content, items: content.items.map(i => (i.id === id ? { ...i, ...patch } : i)) });
  };
  const removeItem = (id: string) => {
    setContent({
      items: content.items.filter(i => i.id !== id),
      exceptions: content.exceptions.map(e => ({ ...e, appliesTo: e.appliesTo.filter(ref => ref !== id) })),
    });
  };
  const addItem = () => setContent({ ...content, items: [...content.items, newActionItem()] });

  const toggleControlType = (item: ActionItem, tag: ControlType) => {
    const current = item.controlType || [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    updateItem(item.id, { controlType: next.length > 0 ? next : undefined });
  };

  const toggleExceptionLink = (item: ActionItem, exceptionId: string | undefined) => {
    updateItem(item.id, { exceptionRef: exceptionId });
  };

  const updateException = (id: string, patch: Partial<ExceptionRecord>) => {
    setContent({ ...content, exceptions: content.exceptions.map(e => (e.id === id ? { ...e, ...patch } : e)) });
  };
  const removeException = (id: string) => {
    setContent({
      items: content.items.map(i => (i.exceptionRef === id ? { ...i, exceptionRef: undefined } : i)),
      exceptions: content.exceptions.filter(e => e.id !== id),
    });
  };
  const addException = () =>
    setContent({
      ...content,
      exceptions: [
        ...content.exceptions,
        { id: crypto.randomUUID(), appliesTo: [], condition: '', limitations: [], requiredApprovers: [], requiredEvidence: [] },
      ],
    });

  const stale = isStale(workspace);
  const analyzeLabel = opStatus.kind === 'analyzing' ? 'Analyzing…' : 'Analyze';
  const rewriteLabel = opStatus.kind === 'rewriting' ? 'Rewriting…' : 'Rewrite with AI';
  const busy = workspace.loading;

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="sr-only">
        {opStatus.kind === 'analyzing' && 'Analyzing immediate action…'}
        {opStatus.kind === 'rewriting' && 'Rewriting immediate action…'}
        {opStatus.kind === 'succeeded' && opStatus.op === 'analyze' && 'Immediate action analysis complete.'}
        {opStatus.kind === 'succeeded' && opStatus.op === 'rewrite' && 'Immediate action rewrite ready for review.'}
        {opStatus.kind === 'failed' && `Immediate action ${opStatus.op} failed.`}
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Raw Immediate Action Content</label>
        <textarea
          value={workspace.raw}
          onChange={e => setRaw(e.target.value)}
          className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 resize-none font-mono text-sm"
          placeholder="Paste rough immediate-action instructions here..."
        />
        <div className="flex gap-2 mt-2 items-center">
          <input
            type="text"
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Optional rewrite instructions"
            className="flex-1 p-2 text-sm border border-slate-300 rounded-md"
          />
          <button
            onClick={handleAnalyze}
            disabled={busy || !workspace.raw.trim()}
            className="px-4 py-2 flex items-center gap-2 bg-slate-800 text-white rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
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
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {workspace.error}
        </div>
      )}

      

      <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg space-y-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Action Items
          </h4>
          <div className="space-y-3">
            {content.items.map(item => (
              <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                <div>
                  <textarea
                    value={item.requiredAction}
                    onChange={e => updateItem(item.id, { requiredAction: e.target.value })}
                    className="w-full p-2 text-sm border rounded-md"
                    rows={2}
                    placeholder={ACTION_FIELD_GUIDANCE.requiredAction.placeholder}
                  />
                  <FieldHint text={ACTION_FIELD_GUIDANCE.requiredAction.hint} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      value={item.actor.join(', ')}
                      onChange={e => updateItem(item.id, { actor: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder={ACTION_FIELD_GUIDANCE.actor.placeholder}
                      className="w-full p-1.5 border rounded text-sm"
                    />
                    <FieldHint text={ACTION_FIELD_GUIDANCE.actor.hint} />
                  </div>
                  <div>
                    <select
                      value={item.obligationStrength}
                      onChange={e => updateItem(item.id, { obligationStrength: e.target.value as ObligationStrength })}
                      className="w-full p-1.5 border rounded text-sm"
                    >
                      {OBLIGATION_OPTIONS.map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    <FieldHint text={ACTION_FIELD_GUIDANCE.obligationStrength.hint} />
                  </div>
                </div>

                <Collapsible
                  label="Advanced (target, timing, control type, exception link)"
                  defaultOpen={!!(item.target || item.timing || (item.controlType && item.controlType.length > 0) || item.exceptionRef)}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        value={item.timing || ''}
                        onChange={e => updateItem(item.id, { timing: e.target.value || undefined })}
                        placeholder={ACTION_FIELD_GUIDANCE.timing.placeholder}
                        className="w-full p-1.5 border rounded text-sm"
                      />
                      <FieldHint text={ACTION_FIELD_GUIDANCE.timing.hint} />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={item.target || ''}
                        onChange={e => updateItem(item.id, { target: e.target.value || undefined })}
                        placeholder={ACTION_FIELD_GUIDANCE.target.placeholder}
                        className="w-full p-1.5 border rounded text-sm"
                      />
                      <FieldHint text={ACTION_FIELD_GUIDANCE.target.hint} />
                    </div>
                  </div>
                  <div>
                    <FieldHint text={ACTION_FIELD_GUIDANCE.controlType.hint} />
                    <div className="flex flex-wrap gap-3 text-xs items-center mt-1">
                      {CONTROL_TYPE_OPTIONS.map(tag => (
                        <label key={tag} className="flex items-center gap-1">
                          <input type="checkbox" checked={(item.controlType || []).includes(tag)} onChange={() => toggleControlType(item, tag)} />
                          {tag.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </div>
                  {content.exceptions.length > 0 && (
                    <div>
                      <select
                        value={item.exceptionRef || ''}
                        onChange={e => toggleExceptionLink(item, e.target.value || undefined)}
                        className="p-1 border rounded text-xs"
                      >
                        <option value="">No exception</option>
                        {content.exceptions.map((exc, i) => (
                          <option key={exc.id} value={exc.id}>Exception {i + 1}</option>
                        ))}
                      </select>
                      <FieldHint text={ACTION_FIELD_GUIDANCE.exceptionRef.hint} />
                    </div>
                  )}
                </Collapsible>

                <div className="flex justify-end">
                  <button onClick={() => removeItem(item.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addItem} className="text-sm text-amber-700 font-semibold hover:underline flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Action Item
            </button>
          </div>

          <h4 className="font-bold text-slate-800 flex items-center gap-2 pt-2 border-t border-amber-200">
            Exceptions
          </h4>
          <div className="space-y-3">
            {content.exceptions.map((exc, i) => (
              <div key={exc.id} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Exception {i + 1}</span>
                  <button onClick={() => removeException(exc.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <textarea
                    value={exc.condition}
                    onChange={e => updateException(exc.id, { condition: e.target.value })}
                    placeholder={ACTION_FIELD_GUIDANCE.exceptionCondition.placeholder}
                    className="w-full p-2 text-sm border rounded-md"
                    rows={2}
                  />
                  <FieldHint text={ACTION_FIELD_GUIDANCE.exceptionCondition.hint} />
                </div>
                <div>
                  <textarea
                    value={exc.limitations.join('\n')}
                    onChange={e => updateException(exc.id, { limitations: e.target.value.split('\n').filter(Boolean) })}
                    placeholder={ACTION_FIELD_GUIDANCE.exceptionLimitations.placeholder}
                    className="w-full p-2 text-sm border rounded-md"
                    rows={3}
                  />
                  <FieldHint text={ACTION_FIELD_GUIDANCE.exceptionLimitations.hint} />
                </div>
                <div>
                  <input
                    type="text"
                    value={exc.requiredApprovers.join(', ')}
                    onChange={e => updateException(exc.id, { requiredApprovers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder={ACTION_FIELD_GUIDANCE.exceptionApprovers.placeholder}
                    className="w-full p-1.5 border rounded text-sm"
                  />
                  <FieldHint text={ACTION_FIELD_GUIDANCE.exceptionApprovers.hint} />
                </div>
                <Collapsible label="Advanced (submission system, related standard)" defaultOpen={!!(exc.submissionSystem || exc.relatedStandard)}>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={exc.submissionSystem || ''}
                      onChange={e => updateException(exc.id, { submissionSystem: e.target.value || undefined })}
                      placeholder="Submission system"
                      className="p-1.5 border rounded text-sm"
                    />
                    <input
                      type="text"
                      value={exc.relatedStandard || ''}
                      onChange={e => updateException(exc.id, { relatedStandard: e.target.value || undefined })}
                      placeholder="Related standard"
                      className="p-1.5 border rounded text-sm"
                    />
                  </div>
                </Collapsible>
              </div>
            ))}
            <button onClick={addException} className="text-sm text-amber-700 font-semibold hover:underline flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Exception
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-amber-200">
            <button
              onClick={handleManualAccept}
              className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-md text-sm font-medium hover:bg-emerald-50"
              title="Skip AI rewrite and mark this content ready as-is"
            >
              Mark Ready (No AI)
            </button>
            <button
              onClick={handleRewrite}
              disabled={busy}
              className="px-4 py-2 flex items-center gap-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {opStatus.kind === 'rewriting' && <Loader2 className="w-4 h-4 animate-spin" />}
              {rewriteLabel}
            </button>
          </div>
        </div>
      

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
              <li key={i.id}>
                {i.instructionText || i.requiredAction} <span className="font-semibold">({i.obligationStrength})</span>
                {i.controlType && i.controlType.length > 0 && <span className="text-red-700"> [{i.controlType.join(', ')}]</span>}
              </li>
            ))}
          </ul>
          {workspace.suggestion.value.exceptions.length > 0 && (
            <div className="text-sm text-slate-700">
              {workspace.suggestion.value.exceptions.length} exception(s) included.
            </div>
          )}
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
            <button onClick={handleAccept} className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700">
              Accept
            </button>
            <button onClick={handleDismiss} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {workspace.accepted && (
        <div className={`p-4 border rounded-lg ${stale ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <h4 className={`font-bold mb-2 flex items-center gap-2 ${stale ? 'text-amber-900' : 'text-emerald-900'}`}>
            {stale && <AlertCircle className="w-4 h-4" />}
            {stale ? 'Accepted (stale — review before export)' : 'Accepted'}
            <span className="text-xs font-normal opacity-70">({workspace.accepted.source === 'ai' ? 'AI-assisted' : 'manually authored'})</span>
          </h4>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {workspace.accepted.value.items.map(i => (
              <li key={i.id}>
                {i.instructionText || i.requiredAction} <span className="font-semibold">({i.obligationStrength})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
