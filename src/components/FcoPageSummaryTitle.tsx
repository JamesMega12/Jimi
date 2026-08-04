import React, { useState } from 'react';
import { FCORequestData, DocxAnalysisResponse } from '../types';
import DocxUploadModal from './DocxUploadModal';
import FcoSummaryAnalysisModal from './FcoSummaryAnalysisModal';
import { FileText, ChevronRight, CheckCircle2, Sparkles, Loader2, ClipboardCheck, AlertCircle } from 'lucide-react';
import { FcoDraftingState } from '../hooks/useFcoDraftingState';

interface FcoPageSummaryTitleProps {
  formData: FCORequestData;
  setFormData: React.Dispatch<React.SetStateAction<FCORequestData>>;
  docxAnalysis: DocxAnalysisResponse | null;
  setDocxAnalysis: (data: DocxAnalysisResponse | null) => void;
  setInputMode: (mode: 'manual' | 'docx') => void;
  onNext: () => void;
  onLoadFcoSample?: () => void;
  drafting: FcoDraftingState;
}

export default function FcoPageSummaryTitle({
  formData, setFormData, docxAnalysis, setDocxAnalysis, setInputMode, onNext, onLoadFcoSample, drafting
}: FcoPageSummaryTitleProps) {
  const [showValidation, setShowValidation] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    handleDraftChange,
    isSuggestingTitle, titleSuggestions, setTitleSuggestions, selectedTitleSuggestion, setSelectedTitleSuggestion,
    handleSuggestTitle,
    loadingSummary, summaryError, generatedSummary, setGeneratedSummary,
    analyzing, summaryAnalysis, showAnalysisModal, setShowAnalysisModal,
    handleAnalyzeSummary, handleRewriteSummary, handleAcceptSummary,
    summaryInputsChanged, pendingSummaryDiagnostics,
    resetPendingDraftingState
  } = drafting;

  const summaryIsFallback =
    pendingSummaryDiagnostics?.engineUsed === 'local_fallback' || pendingSummaryDiagnostics?.fallbackUsed;

  const handleDocxAnalyzed = (data: DocxAnalysisResponse) => {
    setDocxAnalysis(data);
    setFormData(prev => {
        let updatedFormData = { ...prev, inputSource: 'docx' as const };
        if (data.detectedMetadata) {
            const draft = { ...updatedFormData.fcoDraft } as NonNullable<FCORequestData['fcoDraft']>;
            draft.fcoMetadata = {
                ...draft.fcoMetadata,
                fcoTitle: data.detectedMetadata.title || draft.fcoMetadata.fcoTitle || '',
                priority: (data.detectedMetadata.priority as any) || draft.fcoMetadata.priority || '',
                appliesTo: data.detectedMetadata.appliesTo || draft.fcoMetadata.appliesTo || '',
                effectiveDate: data.detectedMetadata.effectiveDate || draft.fcoMetadata.effectiveDate || '',
                productionStart: data.detectedMetadata.productionStart || draft.fcoMetadata.productionStart || '',
                affectedEquipmentModel: data.detectedMetadata.affectedEquipment || draft.fcoMetadata.affectedEquipmentModel || ''
            };
            if (data.detectedMetadata.knownSafetyRisks) {
                draft.technicalContent = { ...draft.technicalContent, knownSafetyRisks: data.detectedMetadata.knownSafetyRisks };
            }
            // Auto populate rawSummary and rawProcedure from extraction
            draft.technicalContent = {
               ...draft.technicalContent,
               draftSummary: data.detectedSummary.text || draft.technicalContent.draftSummary || '',
               draftProcedure: data.detectedProcedure.text || draft.technicalContent.draftProcedure || ''
            };

            updatedFormData = {
                ...updatedFormData,
                title: draft.fcoMetadata.fcoTitle,
                priority: draft.fcoMetadata.priority,
                appliesTo: draft.fcoMetadata.appliesTo,
                effectiveDate: draft.fcoMetadata.effectiveDate,
                productionStart: draft.fcoMetadata.productionStart,
                affectedEquipment: draft.fcoMetadata.affectedEquipmentModel,
                knownSafetyRisks: draft.technicalContent.knownSafetyRisks || '',
                rawSummary: draft.technicalContent.draftSummary,
                rawProcedure: draft.technicalContent.draftProcedure,
                fcoDraft: draft
            };
        }
        return updatedFormData;
    });
    setInputMode('docx');
  };

  const handleLoadSampleClick = () => {
    if (!onLoadFcoSample) return;
    const hasContent = !!(
      formData.fcoDraft?.technicalContent.draftSummary ||
      formData.rawSummary ||
      formData.fcoDraft?.technicalContent.draftProcedure ||
      formData.rawProcedure ||
      formData.fcoDraft?.fcoMetadata.fcoTitle ||
      formData.title
    );
    if (hasContent && typeof window !== 'undefined' &&
        !window.confirm('Loading the FCO sample will replace your current draft. Continue?')) {
      return;
    }
    // Load sample into shared state (parent clears response / docx / step).
    onLoadFcoSample();
    // Clear local pending AI suggestion state (both Summary and Procedure
    // sides — Procedure state lives in the shared drafting hook) so nothing
    // stale carries over.
    resetPendingDraftingState();
    setShowValidation(false);
  };

  const handleNextClick = () => {
    setShowValidation(true);
    // Let them proceed even if missing accepted ones — final export readiness
    // is checked on the Review & Export page, not here.
    onNext();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-4xl mx-auto relative">
      <div className="flex sm:flex-row flex-col sm:items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-sans">Summary & Title</h2>
          <p className="text-sm text-slate-600 mt-1">
            Set context and priority, draft and accept a Summary, then generate a Title.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onLoadFcoSample && (
            <button
               onClick={handleLoadSampleClick}
               className="px-3 py-1.5 flex items-center justify-center gap-2 text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg shadow-sm transition-colors"
               title="Load a fictional FCO sample for testing"
            >
               <Sparkles className="w-4 h-4" />
               Load FCO Sample
            </button>
          )}
          <button
             onClick={() => setIsModalOpen(true)}
             className="px-3 py-1.5 flex items-center justify-center gap-2 text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
             title="Upload an existing FCO document"
          >
             <FileText className="w-4 h-4" />
             Upload DOCX
          </button>
        </div>
      </div>

      {docxAnalysis && (
        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex sm:flex-row flex-col sm:items-center justify-between shadow-sm gap-4">
           <div className="flex items-center gap-3">
             <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
             <div>
               <h4 className="font-bold text-emerald-900 text-sm">DOCX Document Analyzed</h4>
               <p className="text-emerald-700 text-xs font-mono">{docxAnalysis.fileName}</p>
             </div>
           </div>
           <button onClick={() => setIsModalOpen(true)} className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200 rounded-lg transition-colors border border-emerald-200 shadow-sm whitespace-nowrap">
             Replace
           </button>
        </div>
      )}

      <div className="space-y-6 mb-8">

        {/* CARD 1: FCO Context & Priority */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-800 text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-xs">1</div>
            FCO Context & Priority
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.fcoDraft?.fcoMetadata.priority || formData.priority || ''}
                onChange={(e) => handleDraftChange('fcoMetadata', 'priority', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="" disabled>Select priority...</option>
                <option value="Urgent">Urgent</option>
                <option value="Required">Required</option>
                <option value="Preferred">Preferred</option>
              </select>
              {showValidation && !(formData.fcoDraft?.fcoMetadata.priority || formData.priority) && <p className="text-xs text-red-600 mt-1">Priority is required.</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">
                Affected Equipment / Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.fcoDraft?.fcoMetadata.affectedEquipmentModel || formData.affectedEquipment || ''}
                onChange={(e) => handleDraftChange('fcoMetadata', 'affectedEquipmentModel', e.target.value)}
                placeholder="e.g. SLB-400"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Applies To</label>
              <input
                type="text"
                value={formData.fcoDraft?.fcoMetadata.appliesTo || formData.appliesTo || ''}
                onChange={(e) => handleDraftChange('fcoMetadata', 'appliesTo', e.target.value)}
                placeholder="All Batch Mixers"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* CARD 2: Summary */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-xs">2</div>
              Summary
              {formData.fcoDraft?.technicalContent.acceptedSummary && (
                <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] uppercase rounded flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Accepted
                </span>
              )}
            </div>
          </div>
          <div className="p-4 flex flex-col gap-4">
             <div>
               <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                 Rough Draft
               </label>
               <textarea
                 value={formData.fcoDraft?.technicalContent.draftSummary || formData.rawSummary || ''}
                 onChange={(e) => handleDraftChange('technicalContent', 'draftSummary', e.target.value)}
                 placeholder="What is the problem, cause, solution, and benefit?"
                 className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
               />
               <div className="mt-2 flex flex-wrap items-center gap-2">
                 <button
                    onClick={handleAnalyzeSummary}
                    disabled={analyzing || loadingSummary || !formData.fcoDraft?.technicalContent.draftSummary?.trim()}
                    className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white border border-indigo-700 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                 >
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                    {analyzing ? 'Analyzing...' : 'Analyze Summary'}
                 </button>
                 <button
                    onClick={() => handleRewriteSummary()}
                    disabled={loadingSummary || analyzing || !formData.fcoDraft?.technicalContent.draftSummary?.trim()}
                    className="px-4 py-2 text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                    title="Skip analysis and rewrite the summary directly"
                 >
                    {loadingSummary && !showAnalysisModal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {loadingSummary && !showAnalysisModal ? 'Rewriting...' : 'Rewrite Directly'}
                 </button>
               </div>
               <p className="text-xs text-slate-500 mt-1.5">Recommended: analyze first to check the four components (Problem, Cause, Solution, Benefit), then rewrite.</p>
               {summaryError && <p className="text-red-500 text-xs mt-2">{summaryError}</p>}
               {summaryInputsChanged && !loadingSummary && !generatedSummary && !formData.fcoDraft?.technicalContent.acceptedSummary && (
                 <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                   <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                   Inputs changed since this result was requested. Rewrite to refresh.
                 </p>
               )}
             </div>

             {generatedSummary && !formData.fcoDraft?.technicalContent.acceptedSummary && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl mt-2">
                   {summaryIsFallback && (
                     <div className="mb-3 flex items-start gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                       <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                       <span>
                         Generated by local fallback (AI provider unavailable) — this is formatting only and needs technical review before accepting.
                         {pendingSummaryDiagnostics?.fallbackReason ? ` Reason: ${pendingSummaryDiagnostics.fallbackReason}` : ''}
                       </span>
                     </div>
                   )}
                   <label className="block text-xs font-semibold text-indigo-900 mb-1.5 uppercase tracking-wide">
                     Generated Summary
                     <span className="ml-2 font-normal normal-case text-slate-500">— editable, adjust wording before accepting</span>
                     {typeof generatedSummary.wordCount === 'number' && (
                       <span className={`ml-2 font-normal ${generatedSummary.withinWordLimit === false ? 'text-red-600' : 'text-slate-500'}`}>
                         {(generatedSummary.paragraph || '').split(/\s+/).filter(Boolean).length} words
                       </span>
                     )}
                   </label>
                   <textarea
                      value={generatedSummary.paragraph}
                      onChange={(e) => setGeneratedSummary(prev => prev ? { ...prev, paragraph: e.target.value } : prev)}
                      className="w-full text-sm text-slate-700 leading-relaxed mb-3 bg-white p-3 border border-indigo-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[110px] resize-y"
                   />
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 text-xs">
                      <div className="bg-white border border-indigo-100 rounded p-2 text-slate-600"><strong className="text-slate-800">Problem:</strong> {generatedSummary.components?.problem}</div>
                      <div className="bg-white border border-indigo-100 rounded p-2 text-slate-600"><strong className="text-slate-800">Cause:</strong> {generatedSummary.components?.cause}</div>
                      <div className="bg-white border border-indigo-100 rounded p-2 text-slate-600"><strong className="text-slate-800">Solution:</strong> {generatedSummary.components?.solution}</div>
                      <div className="bg-white border border-indigo-100 rounded p-2 text-slate-600"><strong className="text-slate-800">Benefit:</strong> {generatedSummary.components?.benefit}</div>
                   </div>
                   <button
                      onClick={handleAcceptSummary}
                      className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                   >
                      <CheckCircle2 className="w-4 h-4" /> Accept Summary
                   </button>
                </div>
             )}

             {formData.fcoDraft?.technicalContent.acceptedSummary && (
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl mt-2">
                   <div className="flex items-center justify-between mb-2">
                     <label className="block text-xs font-semibold text-emerald-900 uppercase tracking-wide">
                       Accepted Summary
                     </label>
                     <button
                        onClick={() => handleDraftChange('technicalContent', 'acceptedSummary', undefined)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-700"
                     >
                        Edit / Redraft
                     </button>
                   </div>
                   <div className="text-sm text-slate-700 font-mono whitespace-pre-wrap">
                      {formData.fcoDraft?.technicalContent.acceptedSummary}
                   </div>
                </div>
             )}
          </div>
        </div>

        {/* CARD 3: Title */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-xs">3</div>
              Title
            </div>
          </div>
          <div className="p-4">
             <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
                <input
                  type="text"
                  value={formData.fcoDraft?.fcoMetadata.fcoTitle || formData.title || ''}
                  onChange={(e) => handleDraftChange('fcoMetadata', 'fcoTitle', e.target.value)}
                  placeholder="e.g. SLB-400 O-ring Upgrade"
                  className="w-full md:flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => handleSuggestTitle()}
                  disabled={isSuggestingTitle || (!formData.fcoDraft?.technicalContent.acceptedSummary && !formData.fcoDraft?.technicalContent.draftSummary)}
                  className="px-4 py-2 text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                >
                  {isSuggestingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Suggest Title
                </button>
             </div>
             {titleSuggestions.length > 0 && (
                <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="text-xs font-bold text-indigo-800 mb-3 uppercase tracking-wide">Suggested Titles</div>
                  <div className="flex flex-col gap-2">
                    {titleSuggestions.map((sug, idx) => (
                      <label key={idx} className="flex items-start gap-3 p-3 bg-white border border-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors shadow-sm">
                        <input
                          type="radio"
                          name="titleSuggestion"
                          className="mt-0.5"
                          checked={selectedTitleSuggestion === sug}
                          onChange={() => setSelectedTitleSuggestion(sug)}
                        />
                        <span className="text-sm font-semibold text-slate-800 leading-snug">{sug}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-4 justify-end">
                     <button
                       type="button"
                       onClick={() => setTitleSuggestions([])}
                       className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                     >
                       Dismiss
                     </button>
                     <button
                       type="button"
                       onClick={() => {
                         handleDraftChange('fcoMetadata', 'fcoTitle', selectedTitleSuggestion);
                         setTitleSuggestions([]);
                       }}
                       className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 border border-indigo-700 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                     >
                       <CheckCircle2 className="w-4 h-4" /> Accept Title
                     </button>
                  </div>
                </div>
              )}
          </div>
        </div>

      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          onClick={handleNextClick}
          className="px-6 py-2.5 text-sm font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          Next: Parts & Procedure
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <DocxUploadModal
         isOpen={isModalOpen}
         onClose={() => setIsModalOpen(false)}
         onAnalyzed={handleDocxAnalyzed}
      />

      {showAnalysisModal && summaryAnalysis && (
        <FcoSummaryAnalysisModal
          analysis={summaryAnalysis}
          rewriting={loadingSummary}
          onClose={() => setShowAnalysisModal(false)}
          onAcceptAndRewrite={(accepted) => handleRewriteSummary(accepted)}
        />
      )}

    </div>
  );
}
