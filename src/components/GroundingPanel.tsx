import React from 'react';
import { GroundingDiagnostics, CorrectionRecord } from '../types';
import { ShieldCheck, BookOpen, AlertTriangle, CheckCircle2, ChevronRight, HelpCircle, Database, Wand2 } from 'lucide-react';

interface GroundingPanelProps {
  grounding?: GroundingDiagnostics;
  /** Deterministic auto-correct pass results (top-level response field). */
  corrections?: CorrectionRecord[];
}

export default function GroundingPanel({ grounding, corrections }: GroundingPanelProps) {
  const hasCorrections = !!(corrections && corrections.length);
  if (!grounding && !hasCorrections) {
    return (
      <div className="p-6 text-center text-slate-500 font-sans" id="grounding-panel-missing">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-slate-700">Diagnostics Unavailable</h4>
        <p className="text-xs text-slate-400 mt-1">Run a rewrite first — grounding diagnostics are attached to the rewrite response.</p>
      </div>
    );
  }

  const g = grounding || {};
  const {
    groundingUsed,
    retrievedSources = [],
    retrievedChunkCount = 0,
    retrievalWarnings,
    usedSeedData,
    usedSystemKnowledge,
    retrievalStatus,
    systemKnowledge,
  } = g;
  // When only deterministic corrections are present (per-section interactive
  // rewrite, which does no retrieval), the grounding sections show their empty
  // states and the corrections section carries the signal.
  const retrievalRan = !!grounding;

  const sk = systemKnowledge || {};
  const backendMismatch = sk.backendMismatchCount || 0;

  // Dictionary explaining chunk classifications
  const categoryRoles: Record<string, string> = {
    summary: 'Governs the strict 150-word limitation, forced labels (Problem, Cause, Solution, Benefit), and concise field focus.',
    procedure: 'Requires chronological subdivisions, restarted numbered sequences starting at index 1, and action-verb phrasing.',
    language: 'Drives active voice commands, American English spellers, short sentence lengths, and defining abbreviations on first use.',
    safety: 'Enforces Lockout/Tagout (LOTO), pressure bleed instructions, hands/body position warnings, and strict WARNING/CAUTION styles.',
    terminology: 'Standardizes equipment name consistency, component designations, and disallows colloquial or qualitative modifiers.',
    formatting: 'Format measurements unit spacing rules (e.g., "120 ft-lbs") and spells out integers from one to nine.',
    'legal/style': 'Restricts trademark, supply chain, or unverified safety compliance assertions.',
    template: 'Establishes correct checklist triggers, Tools/Materials boxes, and subheading structures.',
    other: 'General grammatical quality and readability recommendations.'
  };

  const statusBadge =
    groundingUsed && usedSystemKnowledge
      ? { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'System Knowledge Active' }
      : groundingUsed && !usedSeedData
      ? { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Source Truth Active' }
      : groundingUsed && usedSeedData
      ? { cls: 'bg-amber-100 text-amber-800 border-amber-200', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Seed Guidance Active' }
      : { cls: 'bg-slate-100 text-slate-800 border-slate-200', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'No Retrieval' };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="rag-grounding-panel">
      {/* RAG Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="text-indigo-600 w-5 h-5 flex-shrink-0" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest font-sans">
              Source Truth Grounding
            </h2>
            <p className="text-xxs text-slate-500 font-mono mt-0.5">
              Retrieval status: <span className="font-bold">{retrievalStatus || 'unknown'}</span> • Backend: {sk.embeddingBackend || 'n/a'}
            </p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-xxs font-extrabold tracking-wider uppercase flex items-center gap-1.5 border ${statusBadge.cls}`}>
          {statusBadge.icon}
          {statusBadge.label}
        </div>
      </div>

      {!retrievalRan && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600" id="no-retrieval-note">
          This rewrite was a per-section interactive rewrite, which applies deterministic writing conventions but does not run semantic retrieval. Retrieval provenance below is shown only for the full rewrite path.
        </div>
      )}

      {/* backend dimension-mismatch alarm: the permanent "embeddings broke" signal */}
      {backendMismatch > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-900 text-xs" id="backend-mismatch-banner">
          <AlertTriangle className="w-4.5 h-4.5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="font-bold font-sans">Embedding backend mismatch ({backendMismatch} chunk{backendMismatch === 1 ? '' : 's'})</strong>
            <p className="font-sans text-red-800">
              {backendMismatch} indexed chunk{backendMismatch === 1 ? ' has an embedding whose dimension does not' : 's have embeddings whose dimensions do not'} match the
              active backend (<span className="font-mono">{sk.embeddingBackend || '?'}</span>). Those chunks score 0 on semantic similarity and are effectively invisible to retrieval — reindex them.
            </p>
          </div>
        </div>
      )}

      {retrievalWarningsBlock(retrievalWarnings)}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider font-sans">Retrieved Chunks</span>
          <span className="text-2xl font-black text-slate-800 mt-1">{retrievedChunkCount}</span>
          <span className="text-xxxs text-slate-500 mt-0.5">Guidelines injected into the rewrite prompt</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider font-sans">Top Relevance</span>
          <span className="text-2xl font-black text-slate-800 mt-1">
            {retrievedSources.length > 0 ? `${Math.round(retrievedSources[0].relevanceScore * 100)}%` : '0%'}
          </span>
          <span className="text-xxxs text-slate-500 mt-0.5">Max hybrid similarity score</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider font-sans">Chunks Searched</span>
          <span className="text-2xl font-black text-indigo-600 mt-1">{sk.searchedChunkCount ?? '—'}</span>
          <span className="text-xxxs text-slate-500 mt-0.5">Eligible chunks across all tiers</span>
        </div>
      </div>

      {/* System Knowledge Provenance: proves WHICH handbook + version was searched */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Database className="w-4 h-4 text-indigo-500" />
          <h3>System Knowledge Provenance</h3>
        </div>
        {(!sk.sources || sk.sources.length === 0) ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            No system-owned knowledge sources are indexed. The approved handbook has not been ingested (status: {sk.status || 'n/a'}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xxs tracking-wider">
                <tr>
                  <th className="text-left font-bold px-3 py-2">Source</th>
                  <th className="text-left font-bold px-3 py-2">Version</th>
                  <th className="text-left font-bold px-3 py-2">Content hash</th>
                  <th className="text-right font-bold px-3 py-2">Chunks</th>
                </tr>
              </thead>
              <tbody>
                {sk.sources.map((s: any) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-bold text-slate-800">{s.name}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{s.version || '—'}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{s.contentHashShort || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{s.chunkCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Retrieved Guidelines Lists */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <h3>Retrieved Standard Guidelines</h3>
        </div>

        {retrievedSources.length === 0 ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            No source documents retrieved for this prompt context.
          </div>
        ) : (
          <div className="space-y-3">
            {retrievedSources.map((src, index) => (
              <div
                key={src.chunkId}
                className={`bg-white border hover:border-slate-350 shadow-xs rounded-xl p-4 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${src.isSeedData ? 'border-amber-200 bg-amber-50/20' : src.isSystemKnowledge ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'}`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xxs font-bold border px-2 py-0.5 rounded font-mono ${src.isSeedData ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                      #{index + 1}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 font-sans">
                      {src.documentName}
                    </h4>
                    {src.isSystemKnowledge && (
                      <span className="text-xxxs font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-sm">
                        SYSTEM KNOWLEDGE
                      </span>
                    )}
                    {src.isSeedData && (
                      <span className="text-xxxs font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-sm">
                        SEED DATA
                      </span>
                    )}
                    {src.documentType && (
                      <span className="text-xxxs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm capitalize">
                        {src.documentType}
                      </span>
                    )}
                  </div>

                  {src.sectionTitle && (
                    <p className="text-xxs text-slate-500 font-sans">Section: <span className="text-slate-700 font-medium">{src.sectionTitle}</span></p>
                  )}

                  {src.ruleCategory && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-xs text-slate-600 font-sans">
                        <strong className="text-slate-800 capitalize">{src.ruleCategory} Category:</strong>{' '}
                        {categoryRoles[src.ruleCategory] || categoryRoles['other']}
                      </p>
                    </div>
                  )}

                  <p className="text-xxs text-slate-400 font-mono">
                    Chunk ID: <span className="text-slate-500">{src.chunkId}</span>
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                  <span className="text-xxs font-bold text-slate-400 uppercase tracking-widest sm:block">
                    Relevance
                  </span>
                  <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded mt-1">
                    {(src.relevanceScore * 100).toFixed(1)}% Match
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deterministic corrections: the guaranteed-enforcement tier, distinct from RAG */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Wand2 className="w-4 h-4 text-indigo-500" />
          <h3>Deterministic Corrections</h3>
        </div>
        {(!corrections || corrections.length === 0) ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            No deterministic writing-convention corrections were needed for this rewrite.
          </div>
        ) : (
          <div className="space-y-2">
            {corrections.map((c, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xxxs font-mono font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-sm">{c.ruleType}</span>
                  <span className="text-xxs font-mono text-slate-500">{c.ruleId}</span>
                  <span className="text-xxs font-mono text-slate-400">· {c.field}</span>
                </div>
                <p className="text-xxs text-slate-500 font-mono truncate" title={c.before}><span className="text-red-600">−</span> {c.before}</p>
                <p className="text-xxs text-slate-700 font-mono truncate" title={c.after}><span className="text-emerald-600">+</span> {c.after}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grounding safety and architecture disclaimer */}
      <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 text-xxs text-indigo-900 leading-normal space-y-2 font-sans">
        <div className="flex items-center gap-1.5 font-bold text-indigo-950 uppercase tracking-wider">
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <h4>Grounding Architecture Guardrails</h4>
        </div>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Technical Facts Safeguard:</strong> Retrieved guidance governs writing conventions only — it never invents or overrides part numbers, values, hazards, tools, procedural order, or verification requirements.</li>
          <li><strong>Deterministic tier:</strong> Closed-set conventions (unit notation, disallowed abbreviations, spellings) are enforced by the deterministic pass above, not left to probabilistic retrieval; the numeric value is never altered.</li>
        </ul>
      </div>
    </div>
  );
}

function retrievalWarningsBlock(warnings?: string[]) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs text-left" id="retrieval-warnings-block">
      <AlertTriangle className="w-4.5 h-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <strong className="font-bold font-sans">Grounding Notice</strong>
        <p className="font-sans text-amber-800">{warnings.join(' ')}</p>
      </div>
    </div>
  );
}
