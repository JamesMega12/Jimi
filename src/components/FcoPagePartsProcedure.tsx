import React from 'react';
import { FCORequestData } from '../types';
import { ChevronRight, ChevronLeft, CheckCircle2, Sparkles, Loader2, AlertCircle, ClipboardCheck, Wrench, Plus, Trash2 } from 'lucide-react';
import ProcedureReadinessPanel from './ProcedureReadinessPanel';
import EditableProcedureView from './EditableProcedureView';
import RewrittenDraft from './RewrittenDraft';
import { buildDisplayProcedure } from '../utils/procedureMerge';
import { FcoDraftingState } from '../hooks/useFcoDraftingState';

interface FcoPagePartsProcedureProps {
  formData: FCORequestData;
  developerMode: boolean;
  onBack: () => void;
  onNext: () => void;
  drafting: FcoDraftingState;
}

export default function FcoPagePartsProcedure({ formData, developerMode, onBack, onNext, drafting }: FcoPagePartsProcedureProps) {
  const {
    handleDraftChange,
    declaredParts, addDeclaredPart, updateDeclaredPart, removeDeclaredPart,
    loadingProcedure, procedureError, generatedProcedure, setGeneratedProcedure,
    readinessSuggestions, setReadinessSuggestions, loadingReadiness, readinessChecked,
    handleRewriteProcedure, handleAcceptProcedure,
    procedureInputsChanged, pendingProcedureDiagnostics
  } = drafting;

  const procedureIsFallback =
    pendingProcedureDiagnostics?.engineUsed === 'local_fallback' || pendingProcedureDiagnostics?.fallbackUsed;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-4xl mx-auto relative">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-sans">Parts & Procedure</h2>
        <p className="text-sm text-slate-600 mt-1">
          Declare the parts and components this FCO works on, then structure and rewrite the Procedure.
        </p>
      </div>

      <div className="space-y-6 mb-8">

        {/* CARD 1: Parts & Components */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-xs">1</div>
              Parts &amp; Components
              {declaredParts.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] uppercase rounded">
                  {declaredParts.length} declared
                </span>
              )}
            </div>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-500">
              List the parts, kits, assemblies, and tools this FCO works on. The procedure rewrite treats this list as the source of truth — it will not invent parts beyond it. Leave empty to let the AI detect parts from your notes.
            </p>
            {declaredParts.length > 0 && (
              <div className="space-y-2">
                {declaredParts.map((part, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
                    <input
                      type="text"
                      value={part.name}
                      onChange={(e) => updateDeclaredPart(idx, 'name', e.target.value)}
                      placeholder="Part / component name (e.g. DM-500 clamp assembly)"
                      className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={part.identifier || ''}
                      onChange={(e) => updateDeclaredPart(idx, 'identifier', e.target.value)}
                      placeholder="Part number"
                      className="w-full md:w-40 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <select
                      value={part.role}
                      onChange={(e) => updateDeclaredPart(idx, 'role', e.target.value)}
                      className="w-full md:w-36 px-2 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="replaced">Replaced</option>
                      <option value="installed">Installed</option>
                      <option value="reworked">Reworked</option>
                      <option value="inspected">Inspected</option>
                      <option value="tool">Tool</option>
                      <option value="affected">Affected</option>
                    </select>
                    <button
                      onClick={() => removeDeclaredPart(idx)}
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors flex-shrink-0 self-center"
                      title="Remove part"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={addDeclaredPart}
              className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Part
            </button>
          </div>
        </div>

        {/* CARD 2: Procedure */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-xs">2</div>
              Procedure
              {formData.fcoDraft?.technicalContent.acceptedProcedure && (
                <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] uppercase rounded flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Accepted
                </span>
              )}
              {generatedProcedure && !formData.fcoDraft?.technicalContent.acceptedProcedure && readinessChecked && (
                readinessSuggestions.filter(s => s.status === 'pending').length > 0 ? (
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] uppercase rounded flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {readinessSuggestions.filter(s => s.status === 'pending').length} readiness gaps
                  </span>
                ) : (
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] uppercase rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Readiness OK
                  </span>
                )
              )}
            </div>
          </div>
          <div className="p-4 flex flex-col gap-4">
             <div>
               <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                 Rough Draft
               </label>
               <textarea
                 value={formData.fcoDraft?.technicalContent.draftProcedure || formData.rawProcedure || ''}
                 onChange={(e) => handleDraftChange('technicalContent', 'draftProcedure', e.target.value)}
                 placeholder="List the steps to fix the issue."
                 className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[140px]"
               />
               <button
                  onClick={handleRewriteProcedure}
                  disabled={loadingProcedure || !formData.fcoDraft?.technicalContent.draftProcedure?.trim()}
                  className="mt-2 px-4 py-2 text-sm font-bold bg-indigo-600 text-white border border-indigo-700 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
               >
                  {loadingProcedure ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  {loadingProcedure ? 'Rewriting...' : 'Structure & Rewrite Procedure'}
               </button>
               <p className="text-xs text-slate-500 mt-1.5">Structures and rewrites your notes into sectioned, numbered steps in one pass, using the declared Parts &amp; Components above as grounding, then runs a readiness check for missing safety, parts, and verification steps.</p>
               {procedureError && <p className="text-red-500 text-xs mt-2">{procedureError}</p>}
               {procedureInputsChanged && !loadingProcedure && !generatedProcedure && !formData.fcoDraft?.technicalContent.acceptedProcedure && (
                 <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                   <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                   Inputs changed since this result was requested. Rewrite to refresh.
                 </p>
               )}
             </div>

             {generatedProcedure && !formData.fcoDraft?.technicalContent.acceptedProcedure && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl mt-2">
                   {procedureIsFallback && (
                     <div className="mb-3 flex items-start gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                       <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                       <span>
                         Generated by local fallback (AI provider unavailable) — this is formatting only and needs technical review before accepting.
                         {pendingProcedureDiagnostics?.fallbackReason ? ` Reason: ${pendingProcedureDiagnostics.fallbackReason}` : ''}
                       </span>
                     </div>
                   )}
                   <label className="block text-xs font-semibold text-indigo-900 mb-1.5 uppercase tracking-wide">
                     Rewritten Procedure — Review Before Accepting
                   </label>

                   {generatedProcedure.partsInvolved && generatedProcedure.partsInvolved.length > 0 && (
                     <div className="mb-3 p-3 bg-white border border-indigo-100 rounded-lg">
                       <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                         <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                         Parts / Components Involved ({generatedProcedure.partsInvolved.length})
                       </div>
                       <div className="flex flex-wrap gap-1.5">
                         {generatedProcedure.partsInvolved.map((p, i) => (
                           <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700" title={p.relatedTo && p.relatedTo.length > 0 ? `Related to: ${p.relatedTo.join(', ')}` : undefined}>
                             <span className="font-semibold">{p.name}</span>
                             {p.identifier && <span className="font-mono text-slate-500">{p.identifier}</span>}
                             <span className="text-[10px] uppercase text-indigo-600 font-bold">{p.role}</span>
                           </span>
                         ))}
                       </div>
                       <p className="text-[11px] text-slate-500 mt-2">Confirm every part above is correct and none are missing. Steps are grouped and ordered by component.</p>
                     </div>
                   )}

                   <div className="bg-white p-4 border border-indigo-100 rounded-lg mb-4">
                     <EditableProcedureView
                       procedure={generatedProcedure}
                       onChange={setGeneratedProcedure}
                     />
                   </div>

                   {loadingReadiness && (
                     <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
                       <Loader2 className="w-3.5 h-3.5 animate-spin" />
                       Checking the procedure for missing safety, parts, and verification steps...
                     </div>
                   )}
                   {readinessSuggestions.length > 0 && (
                     <ProcedureReadinessPanel
                       suggestions={readinessSuggestions}
                       onUpdateSuggestions={setReadinessSuggestions}
                       developerMode={developerMode}
                     />
                   )}

                   <div className="flex flex-wrap items-center gap-2">
                     <button
                        onClick={handleAcceptProcedure}
                        className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                     >
                        <CheckCircle2 className="w-4 h-4" /> Accept Procedure
                     </button>
                     <button
                        onClick={handleRewriteProcedure}
                        disabled={loadingProcedure}
                        className="px-4 py-2 text-sm font-bold bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                        title="Discard this result and rewrite again from the raw notes and current Parts & Components (edit the notes or add rewrite instructions first for a different outcome)"
                     >
                        {loadingProcedure ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {loadingProcedure ? 'Regenerating...' : 'Regenerate'}
                     </button>
                     {readinessSuggestions.some(s => s.status === 'accepted' || s.status === 'edited') && (
                       <span className="text-xs text-emerald-700 font-semibold">
                         Accepted readiness steps will be added to the procedure.
                       </span>
                     )}
                   </div>
                </div>
             )}

             {formData.fcoDraft?.technicalContent.acceptedProcedure && (
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl mt-2">
                   <div className="flex items-center justify-between mb-2">
                     <label className="block text-xs font-semibold text-emerald-900 uppercase tracking-wide">
                       Accepted Procedure
                     </label>
                     <button
                        onClick={() => handleDraftChange('technicalContent', 'acceptedProcedure', undefined)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-700"
                     >
                        Edit / Redraft
                     </button>
                   </div>
                   <div className="bg-white p-4 border border-emerald-100 rounded-lg opacity-80 pointer-events-none">
                     <RewrittenDraft
                       summary={undefined}
                       procedure={buildDisplayProcedure(formData.fcoDraft.technicalContent.acceptedProcedure, [])}
                       procedureCallouts={[]}
                     />
                   </div>
                </div>
             )}
          </div>
        </div>

      </div>

      <div className="flex justify-between pt-4 border-t border-slate-200">
        <button
          onClick={onBack}
          className="px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back: Summary & Title
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 text-sm font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          Next: Technical Content
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
