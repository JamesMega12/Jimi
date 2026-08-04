import React, { useState } from 'react';
import { RefreshCw, Layout, ShieldCheck, ArrowRight, FileText, ToggleLeft, ToggleRight, Download } from 'lucide-react';
import { WhatWasEdited, DiffTrace, DiffToken } from '../types';

interface EditTraceProps {
  whatWasEdited: WhatWasEdited;
  wordDiffTrace?: DiffTrace;
}

export default function EditTrace({ whatWasEdited, wordDiffTrace }: EditTraceProps) {
  const [viewMode, setViewMode] = useState<'high-level' | 'word-by-word'>('word-by-word');

  const renderDiffTokens = (tokens: DiffToken[]) => {
    return tokens.map((t, idx) => {
      if (t.type === 'added') {
        return <span key={idx} className="bg-emerald-100 text-emerald-800 underline decoration-emerald-400 font-medium px-0.5 rounded-sm">{t.text} </span>;
      } else if (t.type === 'removed') {
        return <span key={idx} className="bg-red-100 text-red-800 line-through decoration-red-400 font-medium px-0.5 rounded-sm">{t.text} </span>;
      }
      return <span key={idx} className="text-gray-700">{t.text} </span>;
    });
  };

  const handleDownloadJSON = () => {
    if (!wordDiffTrace) return;
    const blob = new Blob([JSON.stringify(wordDiffTrace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `word-diff-trace-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 font-sans text-sm" id="edit-trace-tab-view">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-gray-700" />
          <h3 className="text-sm font-bold text-gray-900 uppercase">
            Ingestion & Transformation Trace
          </h3>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
             onClick={() => setViewMode('high-level')}
             className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${viewMode === 'high-level' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            High-Level Summary
          </button>
          <button 
             onClick={() => setViewMode('word-by-word')}
             className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors flex items-center gap-1.5 ${viewMode === 'word-by-word' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <FileText className="w-4 h-4" />
            Word-by-Word Diff
          </button>
          {wordDiffTrace && (
            <button 
               onClick={handleDownloadJSON}
               className="ml-2 px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
               title="Download full JSON trace"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {viewMode === 'word-by-word' && wordDiffTrace ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-gray-900 uppercase border-b border-gray-100 pb-2">Summary Word-by-Word Trace</h4>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {wordDiffTrace.summary?.diffTokens ? renderDiffTokens(wordDiffTrace.summary.diffTokens) : <span className="text-gray-400 italic">No summary diff available.</span>}
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
             <h4 className="text-sm font-bold text-gray-900 uppercase border-b border-gray-100 pb-2">Procedure Word-by-Word Trace</h4>
             {wordDiffTrace.procedure?.sections.length ? (
                wordDiffTrace.procedure.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-2 mb-4 last:mb-0">
                    <h5 className="text-xs font-bold text-gray-500 uppercase">{sec.title}</h5>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap border bg-gray-50 p-4 rounded-lg">
                      {renderDiffTokens(sec.diffTokens)}
                    </div>
                  </div>
                ))
             ) : (
                <span className="text-gray-400 italic">No procedure diff available.</span>
             )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">
              Change Type Categorization:
            </span>
            <span className="text-xs font-bold text-gray-900 bg-white border border-gray-200 px-2.5 py-1 rounded shadow-sm">
              {whatWasEdited.changeTypeIdentified}
            </span>
          </div>

          {/* 1. Summary Wording Edits */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">
              Summary Wording Transformations
            </h4>
            <div className="border border-gray-150 rounded-xl overflow-hidden divide-y divide-gray-100 bg-white">
              {whatWasEdited.summaryWordingEdits && whatWasEdited.summaryWordingEdits.length > 0 ? (
                whatWasEdited.summaryWordingEdits.map((edit, idx) => {
                  const parts = edit.split(' → ');
                  const original = parts[0]?.replace(/^"/, '').replace(/"$/, '') || edit;
                  const rewritten = parts[1]?.replace(/^"/, '').replace(/"$/, '') || '';
                  return (
                    <div key={idx} className="p-3 bg-white/50 space-y-1.5 leading-relaxed font-sans">
                      <div className="text-xs text-red-500 font-mono line-through bg-red-50/50 px-2 py-0.5 rounded border border-red-100/30">
                        {original}
                      </div>
                      {rewritten && (
                        <>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 pl-2">
                            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                            <span>rewritten for simplicity and operator focus</span>
                          </div>
                          <div className="text-xs text-emerald-800 font-mono font-semibold bg-emerald-50/50 px-2 py-0.5 rounded border border-emerald-100/30">
                            {rewritten}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-xs text-gray-400 italic">None identified.</div>
              )}
            </div>
          </div>

          {/* 2. Procedure Wording Edits */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">
              Procedure Wording Transformations
            </h4>
            <div className="border border-gray-150 rounded-xl overflow-hidden divide-y divide-gray-100 bg-white">
              {whatWasEdited.procedureWordingEdits && whatWasEdited.procedureWordingEdits.length > 0 ? (
                whatWasEdited.procedureWordingEdits.map((edit, idx) => {
                  const parts = edit.split(' → ');
                  const original = parts[0]?.replace(/^"/, '').replace(/"$/, '') || edit;
                  const rewritten = parts[1]?.replace(/^"/, '').replace(/"$/, '') || '';
                  return (
                    <div key={idx} className="p-3 bg-white/50 space-y-1.5 leading-relaxed font-sans">
                      <div className="text-xs text-red-500 font-mono line-through bg-red-50/50 px-2 py-0.5 rounded border border-red-100/30">
                        {original}
                      </div>
                      {rewritten && (
                        <>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 pl-2">
                            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                            <span>rewritten to active imperative verb format</span>
                          </div>
                          <div className="text-xs text-emerald-800 font-mono font-semibold bg-emerald-50/50 px-2 py-0.5 rounded border border-emerald-100/30">
                            {rewritten}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-xs text-gray-400 italic">None identified.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Structural Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Structural Edits */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-tight flex items-center gap-1.5 border-b border-gray-100 pb-2">
            <Layout className="w-4.5 h-4.5 text-gray-700" />
            Structural Changes
          </h4>
          <ul className="space-y-2 text-xs text-gray-600">
            {whatWasEdited.structuralEdits.map((edit, idx) => (
              <li key={idx} className="flex gap-2 items-start font-sans">
                <span className="text-gray-400 font-mono">-</span>
                <span>{edit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Preserved Technical Facts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-tight flex items-center gap-1.5 border-b border-gray-100 pb-2">
            <ShieldCheck className="w-4.5 h-4.5 text-gray-700" />
            Preserved Crucial Values
          </h4>
          {whatWasEdited.preservedTechnicalInformation && whatWasEdited.preservedTechnicalInformation.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {whatWasEdited.preservedTechnicalInformation.map((info, idx) => (
                <span key={idx} className="text-xxs font-mono font-semibold bg-gray-100 text-gray-700 border border-gray-200 px-2 py-1 rounded">
                  {info}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No specific technical part numbers, models, or tolerances detected in raw inputs.</p>
          )}
        </div>
      </div>
    </div>
  );
}
