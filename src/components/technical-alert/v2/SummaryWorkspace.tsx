import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { SummaryAccepted, SectionWorkspace } from './types';
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
import { analyzeSummary, rewriteSummary } from '../../../services/technicalAlertApiV2';
import { FieldHint, Collapsible, StaleExplanation } from './SectionHelpers';
import { SUMMARY_FIELD_GUIDANCE } from './guidance';

type Workspace = SectionWorkspace<SummaryAccepted, SummaryAccepted>;
type Updater = (updater: (prev: Workspace) => Workspace) => void;

interface Props {
  workspace: Workspace;
  onChange: Updater;
  // Read-only accepted content from other sections, offered to the rewrite
  // call as optional synthesis grounding (locked decision #5 -- Summary only).
  acceptedNeighbors?: Record<string, unknown>;
}

const EMPTY: SummaryAccepted = { subject: '', affectedScope: '' };
const CORE_FIELDS: (keyof SummaryAccepted)[] = ['subject', 'affectedScope', 'riskOrIssue'];
const OPTIONAL_FIELDS: (keyof SummaryAccepted)[] = ['centralRequirement', 'centralProhibition', 'revocation', 'effectiveTiming', 'exceptionNote'];
const FIELDS: (keyof SummaryAccepted)[] = [...CORE_FIELDS, ...OPTIONAL_FIELDS];
const LABELS: Record<string, string> = {
  subject: 'Subject',
  affectedScope: 'Affected Scope',
  riskOrIssue: 'Risk / Issue',
  centralRequirement: 'Central Requirement',
  centralProhibition: 'Central Prohibition',
  revocation: 'Revocation',
  effectiveTiming: 'Effective Timing',
  exceptionNote: 'Exception Note',
};

// Local, per-section operation status -- distinct from workspace.loading
// (which still drives disabling/dedup unchanged). This only powers richer
// UI text: "Analyzing…" vs "Rewriting…", a brief success confirmation that
// never says "Accepted" (a check mark here must never imply canonical
// status), and a clear failed state. See plan §8.
type OpStatus =
  | { kind: 'idle' }
  | { kind: 'analyzing' | 'rewriting' }
  | { kind: 'succeeded'; op: 'analyze' | 'rewrite' }
  | { kind: 'failed'; op: 'analyze' | 'rewrite' };

interface RenderableSummary {
  renderedText?: string;
  fields: SummaryAccepted;
}

function SummaryContent({ value }: { value: RenderableSummary }) {
  if (value.renderedText) {
    return (
      <div className="space-y-2">
        <p className="text-sm leading-relaxed">{value.renderedText}</p>
        <Collapsible label="Show field breakdown">
          <div className="text-xs space-y-1 text-slate-600">
            {FIELDS.filter(f => value.fields[f]).map(f => (
              <div key={f}><strong>{LABELS[f]}:</strong> {value.fields[f] as string}</div>
            ))}
          </div>
        </Collapsible>
      </div>
    );
  }
  // Fallback for content with no renderedText yet (manual accept, pre-rewrite
  // analysis, or content migrated/accepted before this capability existed).
  return (
    <div className="text-sm space-y-1">
      {FIELDS.filter(f => value.fields[f]).map(f => (
        <div key={f}><strong>{LABELS[f]}:</strong> {value.fields[f] as string}</div>
      ))}
    </div>
  );
}

export default function SummaryWorkspace({ workspace, onChange, acceptedNeighbors }: Props) {
  const [opStatus, setOpStatus] = useState<OpStatus>({ kind: 'idle' });
  const [warnings, setWarnings] = useState<{ gate: string; message: string }[]>([]);
  // Snapshot of acceptedNeighbors as of the rewrite call that produced the
  // current pending suggestion -- carried into acceptSuggestion() so later
  // cross-section staleness detection (RC7) compares against what the AI
  // actually saw, not whatever neighbors look like at accept-click time.
  const [pendingGroundedOn, setPendingGroundedOn] = useState<Record<string, string | null> | undefined>(undefined);
  // FCO-style reveal: the Components panel doesn't render until Analyze/
  // Rewrite has run or real content already exists (loaded/migrated draft).
  // editMode lets a user return to the editing view after something is
  // already Accepted (FCO's "Edit / Redraft" pattern) without touching the
  // underlying accepted value until they actually complete a new accept.
  const [editMode, setEditMode] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const content = workspace.analysis.components ?? EMPTY;

  // Mirrors the latest `workspace` prop for async callbacks to read (see
  // handleAnalyze/handleRewrite) -- setState updater functions passed to
  // onChange run during the PARENT's render phase, so any local setState
  // (setOpStatus/setWarnings) called from inside one triggers React's
  // "Cannot update a component while rendering a different component"
  // warning (confirmed live, 2026-08-06). Checking staleness against this
  // ref instead, synchronously before calling onChange, keeps the updater
  // itself pure and moves side effects back into normal handler-body code.
  const workspaceRef = useRef(workspace);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

  // Auto-dismiss the brief success confirmation after a few seconds -- it's a
  // transient "it worked" signal, not a persistent status.
  useEffect(() => {
    if (opStatus.kind !== 'succeeded') return;
    const t = setTimeout(() => setOpStatus({ kind: 'idle' }), 4000);
    return () => clearTimeout(t);
  }, [opStatus]);

  const setRaw = (raw: string) => onChange(prev => editRaw(prev, raw));
  const setField = (field: keyof SummaryAccepted, value: string) => onChange(prev => editComponents(prev, { ...content, [field]: value || undefined }));

  const handleAnalyze = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: 'analyzing' });
    onChange(prev => beginRequest(prev, requestId));
    try {
      const result = await analyzeSummary(workspace.raw);
      if (!isResponseCurrent(workspaceRef.current, requestId)) return;
      onChange(prev => applyAnalysisResult(prev, result, []));
      setOpStatus({ kind: 'succeeded', op: 'analyze' });
    } catch (err: any) {
      setOpStatus({ kind: 'failed', op: 'analyze' });
      onChange(prev => failRequest(prev, requestId, err.message || 'Failed to analyze summary.'));
    }
  };

  const handleRewrite = async () => {
    const requestId = crypto.randomUUID();
    setOpStatus({ kind: 'rewriting' });
    setWarnings([]);
    onChange(prev => beginRequest(prev, requestId));
    try {
      const { result, warnings: newWarnings } = await rewriteSummary(workspace.raw, content, undefined, acceptedNeighbors);
      if (!isResponseCurrent(workspaceRef.current, requestId)) return;
      onChange(prev => applySuggestion(prev, result, requestId));
      setOpStatus({ kind: 'succeeded', op: 'rewrite' });
      setWarnings(newWarnings || []);
      setPendingGroundedOn(
        acceptedNeighbors
          ? Object.fromEntries(Object.entries(acceptedNeighbors).map(([k, v]) => [k, v ? JSON.stringify(v) : null]))
          : undefined
      );
      setTimeout(() => suggestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } catch (err: any) {
      setOpStatus({ kind: 'failed', op: 'rewrite' });
      onChange(prev => failRequest(prev, requestId, err.message || 'Failed to rewrite summary.'));
    }
  };

  const handleAccept = () => {
    onChange(prev => acceptSuggestion(prev, undefined, pendingGroundedOn));
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
  // Mirrors readiness.ts's own blocking check for Summary -- the checkmark
  // should only claim "done" once the same fields export actually requires.
  const hasRequiredContent = !!content.subject?.trim() && !!content.affectedScope?.trim();
  const showComponents = !!workspace.analysis.ranAt || hasRequiredContent;

  const analyzeLabel = opStatus.kind === 'analyzing' ? 'Analyzing…' : 'Analyze';
  const rewriteLabel = opStatus.kind === 'rewriting' ? 'Rewriting…' : 'Rewrite with AI';
  const busy = workspace.loading;

  return (
    <div className="space-y-4">
      {/* Accessible live announcements for operation status -- distinct from
          "Accepted", so a screen-reader user never hears success confused
          with canonical acceptance. */}
      <div aria-live="polite" className="sr-only">
        {opStatus.kind === 'analyzing' && 'Analyzing summary…'}
        {opStatus.kind === 'rewriting' && 'Rewriting summary…'}
        {opStatus.kind === 'succeeded' && opStatus.op === 'analyze' && 'Summary analysis complete.'}
        {opStatus.kind === 'succeeded' && opStatus.op === 'rewrite' && 'Summary rewrite ready for review.'}
        {opStatus.kind === 'failed' && `Summary ${opStatus.op} failed.`}
      </div>

      {(!workspace.accepted || editMode) && (
        <>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Raw Summary Content</label>
            <textarea
              value={workspace.raw}
              onChange={e => setRaw(e.target.value)}
              className="w-full h-28 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 resize-none font-mono text-sm"
              placeholder="Paste rough summary content here..."
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
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {workspace.error}
            </div>
          )}

          {showComponents && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                {hasRequiredContent && <CheckCircle2 className="w-5 h-5 text-emerald-600" />} Summary Components
              </h4>
              {CORE_FIELDS.map(field => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {LABELS[field]} {(field === 'subject' || field === 'affectedScope') && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={(content[field] as string) || ''}
                    onChange={e => setField(field, e.target.value)}
                    placeholder={SUMMARY_FIELD_GUIDANCE[field]?.placeholder}
                    className="w-full p-2 text-sm border border-slate-200 rounded-md bg-white"
                    rows={field === 'subject' || field === 'affectedScope' ? 1 : 2}
                  />
                  <FieldHint text={SUMMARY_FIELD_GUIDANCE[field]?.hint} />
                </div>
              ))}
              <Collapsible label={`Add more detail (${OPTIONAL_FIELDS.length} optional fields)`}>
                {OPTIONAL_FIELDS.map(field => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{LABELS[field]}</label>
                    <textarea
                      value={(content[field] as string) || ''}
                      onChange={e => setField(field, e.target.value)}
                      placeholder={SUMMARY_FIELD_GUIDANCE[field]?.placeholder}
                      className="w-full p-2 text-sm border border-slate-200 rounded-md bg-white"
                      rows={2}
                    />
                    <FieldHint text={SUMMARY_FIELD_GUIDANCE[field]?.hint} />
                  </div>
                ))}
              </Collapsible>
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
              <SummaryContent value={{ renderedText: workspace.suggestion.value.renderedText, fields: workspace.suggestion.value }} />
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
          <SummaryContent value={{ renderedText: workspace.accepted.value.renderedText, fields: workspace.accepted.value }} />
          <button onClick={() => setEditMode(true)} className="text-xs font-semibold text-slate-600 hover:text-slate-800 hover:underline mt-3">
            Edit / Redraft
          </button>
        </div>
      )}
    </div>
  );
}
