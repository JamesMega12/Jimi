import React from 'react';
import { GroundingDiagnostics } from '../types';
import { ShieldCheck, BookOpen, AlertTriangle, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';

interface GroundingPanelProps {
  grounding?: GroundingDiagnostics;
}

export default function GroundingPanel({ grounding }: GroundingPanelProps) {
  if (!grounding) {
    return (
      <div className="p-6 text-center text-slate-500 font-sans" id="grounding-panel-missing">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-slate-700">Diagnostics Unavailable</h4>
        <p className="text-xs text-slate-400 mt-1">Grounding diagnostics were not returned by this rewrite pass.</p>
      </div>
    );
  }

  const { groundingUsed, retrievedSources, retrievedChunkCount, knowledgeBaseVersion, retrievalWarnings, usedSeedData } = grounding;

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

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="rag-grounding-panel">
      {/* RAG Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="text-indigo-600 w-5.5 h-5.5 flex-shrink-0" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest font-sans">
              Source Truth Grounding
            </h2>
            <p className="text-xxs text-slate-500 font-mono mt-0.5">
              Dual-mode Hybrid RAG Retrieval Engine • KB v{knowledgeBaseVersion || '1.0'}
            </p>
          </div>
        </div>
        
        <div className={`px-3 py-1 rounded-full text-xxs font-extrabold tracking-wider uppercase flex items-center gap-1.5 ${
          groundingUsed && !usedSeedData
            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
            : groundingUsed && usedSeedData
            ? 'bg-amber-100 text-amber-800 border border-amber-200'
            : 'bg-slate-100 text-slate-800 border border-slate-200'
        }`}>
          {groundingUsed && !usedSeedData ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-650" />
              Source Truth Active
            </>
          ) : groundingUsed && usedSeedData ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-650" />
              Seed Guidance Active
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-slate-650" />
              Heuristic Fallback
            </>
          )}
        </div>
      </div>

      {retretivalWarnsBlock(retrievalWarnings)}
      
      {(!grounding.knowledgeState && retrievedChunkCount > 0) && (
         <div className="p-3 mb-2 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-900 text-xs">
           <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
           <p className="font-bold">Retrieved chunks were returned, but knowledgeState was not provided.</p>
         </div>
      )}

      {/* Stats Summary Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider font-sans">Retrieved Chunks</span>
          <span className="text-2xl font-black text-slate-800 mt-1">{retrievedChunkCount}</span>
          <span className="text-xxxs text-slate-500 mt-0.5">Guidelines loaded into prompt workspace</span>
        </div>
        
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider font-sans">Search Precision</span>
          <span className="text-2xl font-black text-slate-800 mt-1">
            {retrievedSources.length > 0 ? `${Math.round(retrievedSources[0].relevanceScore * 100)}%` : '0%'}
          </span>
          <span className="text-xxxs text-slate-500 mt-0.5">Max Cosine vector similarity</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider font-sans">Knowledge State</span>
          <span className="text-xl font-black text-indigo-600 mt-1">
            {grounding.knowledgeState === 'uploaded_active' ? 'Uploaded Source Truth Active' :
             grounding.knowledgeState === 'seed_only' ? 'Seed Data Only' :
             grounding.knowledgeState === 'mixed' ? 'Mixed Source Truth' :
             grounding.knowledgeState === 'none' ? 'No Source Truth Retrieved' :
             grounding.knowledgeState === 'status_failed' ? 'Status Check Failed' :
             grounding.knowledgeState === 'diagnostics_missing' ? 'Diagnostics Missing' :
             'Diagnostics Missing'}
          </span>
          <span className="text-xxxs mt-0.5 font-bold uppercase tracking-wider">
            {grounding.knowledgeState === 'seed_only' ? (
               <span className="text-amber-600 bg-amber-50 px-1 py-0.5 rounded">Not Production Ready</span>
            ) : grounding.knowledgeState === 'uploaded_active' || grounding.knowledgeState === 'mixed' ? (
               <span className="text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">Source Truth Active</span>
            ) : (
               <span className="text-slate-500 bg-slate-50 px-1 py-0.5 border border-slate-200 rounded">Inactive</span>
            )}
          </span>
        </div>
      </div>

      {/* Retrieved Guidelines Lists */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <h3>Retrieved Standard Guidelines</h3>
        </div>

        {retrievedSources.length === 0 ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            No source documents retrieved for this prompt context. Submit an FCO draft to trigger RAG search.
          </div>
        ) : (
          <div className="space-y-3">
            {retrievedSources.map((src, index) => (
              <div 
                key={src.chunkId} 
                className={`bg-white border hover:border-slate-350 shadow-xs rounded-xl p-4 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${src.isSeedData ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'}`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xxs font-bold border px-2 py-0.5 rounded font-mono ${src.isSeedData ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                      #{index + 1}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 font-sans">
                      {src.documentName}
                    </h4>
                    {src.isSeedData && (
                      <span className="text-xxxs font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-sm">
                        SEED DATA
                      </span>
                    )}
                    <span className="text-xxxs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm capitalize">
                      {src.documentType}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs text-slate-600 font-sans">
                      <strong className="text-slate-800 capitalize">{src.ruleCategory} Category:</strong>{' '}
                      {categoryRoles[src.ruleCategory] || categoryRoles['other']}
                    </p>
                  </div>
                  
                  <p className="text-xxs text-slate-400 font-mono">
                    Chunk ID Check: <span className="text-slate-500">{src.chunkId}</span>
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

      {/* Grounding safety and architecture disclaimer */}
      <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 text-xxs text-indigo-900 leading-normal space-y-2 font-sans">
        <div className="flex items-center gap-1.5 font-bold text-indigo-950 uppercase tracking-wider">
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <h4>Grounding Architecture Guardrails</h4>
        </div>
        <p>
          RAG grounding helps keep our language model compliant with TLM and TechCom simplified terminology standards. To avoid safe design violations:
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Technical Facts Safeguard:</strong> All part numbers, models, pressure ratings, and calibration values must correspond directly to the operator's manual and your input. We disallow guideline text from seeding fabricated values.</li>
          <li><strong>Sequence Integrity:</strong> Structural subheadings are controlled by system parsing, not by file context. Grounding text is strictly parsed for phrasing/safety keywords.</li>
        </ul>
      </div>
    </div>
  );
}

function retretivalWarnsBlock(warnings: string[]) {
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
