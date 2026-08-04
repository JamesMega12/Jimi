import React from 'react';
import { FCODiagnostics } from '../types';
import { Activity, XCircle, CheckCircle2 } from 'lucide-react';

interface EngineDiagnosticsPanelProps {
  diagnostics: FCODiagnostics;
}

export default function EngineDiagnosticsPanel({ diagnostics }: EngineDiagnosticsPanelProps) {
  const isFallback = diagnostics.engineUsed === 'local_fallback' || diagnostics.fallbackUsed;

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="engine-diagnostics-panel">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3">
        <Activity className="text-indigo-600 w-5 h-5 flex-shrink-0" />
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-sans font-medium">Engine Diagnostics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Engine used</span>
            <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">{diagnostics.engineUsed}</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">LLM Attempts</span>
            <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">{diagnostics.llmAttemptsUsed || 1}</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Validation Repairs</span>
            <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">{diagnostics.validationRepairAttemptsUsed || 0}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Confidence level</span>
            <span className={`font-mono px-2 py-0.5 rounded text-xs uppercase font-bold tracking-wider ${
              diagnostics.confidenceLevel === 'high' ? 'bg-emerald-100 text-emerald-800' :
              diagnostics.confidenceLevel === 'medium' ? 'bg-amber-100 text-amber-800' :
              'bg-rose-100 text-rose-800'
            }`}>
              {diagnostics.confidenceLevel}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Retrieval mode</span>
            <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">{diagnostics.retrievalMode}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Retrieved chunk count</span>
            <span className="font-mono text-slate-800 font-bold">{diagnostics.retrievedChunkCount}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Fallback active</span>
            <span className={`font-mono px-2 py-0.5 rounded text-xs uppercase font-bold ${
              isFallback ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {isFallback ? 'Active' : 'Inactive'}
            </span>
          </div>

          {isFallback && diagnostics.fallbackReason && (
            <div className="flex flex-col py-2 border-b border-slate-100 bg-rose-50/50 p-3 rounded border border-rose-100">
              <span className="text-rose-800 font-bold mb-1">Fallback reason</span>
              <span className="font-mono text-rose-700 text-xs break-words">{diagnostics.fallbackReason}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
