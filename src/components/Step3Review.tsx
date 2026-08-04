import React from 'react';
import { FCORequestData } from '../types';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import RewrittenDraft from './RewrittenDraft';
import ExportPanel from './ExportPanel';

interface Step3ReviewProps {
  loading: boolean;
  loadingMessage?: string;
  error: string | null;
  onStartNew: () => void;
  inputMode: 'manual' | 'docx';
  formData: FCORequestData;
  developerMode: boolean;
  onNavigateToSummaryTitle: () => void;
  onNavigateToPartsProcedure: () => void;
  onNavigateToTechnicalContent: () => void;
}

export default function Step3Review({
  onStartNew, formData, developerMode,
  onNavigateToSummaryTitle, onNavigateToPartsProcedure, onNavigateToTechnicalContent
}: Step3ReviewProps) {

  const acceptedSummary = formData.fcoDraft?.technicalContent?.acceptedSummary;
  const acceptedProcedure = formData.fcoDraft?.technicalContent?.acceptedProcedure;
  const summaryDiagnostics = formData.fcoDraft?.technicalContent?.acceptedSummaryDiagnostics;
  const procedureDiagnostics = formData.fcoDraft?.technicalContent?.acceptedProcedureDiagnostics;

  // Read-only final preview: acceptedProcedure already has any accepted
  // readiness suggestions baked in at the moment it was accepted in Step 1 —
  // it is not re-merged here, so preview and export always show identical
  // content and readiness can never be applied twice.
  const summaryObj = acceptedSummary ? { paragraph: acceptedSummary, problem: '', cause: '', solution: '', benefit: '' } : undefined;

  const isExportReady = !!acceptedSummary && !!acceptedProcedure;

  return (
    <div className="bg-transparent flex flex-col h-full space-y-8 max-w-5xl mx-auto" id="output-workspace">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-slate-800 font-sans mb-1">Review & Export</h2>
        <p className="text-sm text-slate-600 mb-4">
          Read-only final preview of the accepted Summary and Procedure. Use the links below to make corrections.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={onNavigateToSummaryTitle} className="text-xs font-bold text-slate-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Return to Summary & Title
          </button>
          <button onClick={onNavigateToPartsProcedure} className="text-xs font-bold text-slate-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Return to Procedure
          </button>
          <button onClick={onNavigateToTechnicalContent} className="text-xs font-bold text-slate-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Return to Technical Content
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-6 space-y-8">

        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Final Summary & Procedure Preview</h3>
          {!isExportReady ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 text-sm">Missing Accepted Content</h4>
                <p className="text-amber-800 text-xs mt-1">You must accept both a Summary (Summary &amp; Title) and a Procedure (Parts &amp; Procedure) before previewing or exporting.</p>
              </div>
            </div>
          ) : (
            <RewrittenDraft
              summary={summaryObj as any}
              procedure={acceptedProcedure as any}
              procedureCallouts={formData.fcoDraft?.technicalContent?.procedureCallouts}
              checks={formData.fcoDraft?.technicalContent?.checks}
            />
          )}
        </div>

      </div>

      {/* Export Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {!isExportReady ? (
           <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500">
             Export is disabled until both Summary and Procedure are accepted.
           </div>
        ) : (
           <ExportPanel
             formData={formData}
             summaryDiagnostics={summaryDiagnostics}
             procedureDiagnostics={procedureDiagnostics}
             developerMode={developerMode}
           />
        )}

        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
           <button onClick={onStartNew} className="text-sm font-bold text-slate-600 hover:text-slate-900 px-6 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition">
             Start New Draft
           </button>
        </div>
      </div>

    </div>
  );
}
