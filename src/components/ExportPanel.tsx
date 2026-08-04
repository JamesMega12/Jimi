import React, { useState } from 'react';
import { Copy, Download, Check, FileText, Code, File as FileIcon, AlertTriangle } from 'lucide-react';
import { FCODiagnostics, FCORequestData } from '../types';

interface ExportPanelProps {
  formData: FCORequestData;
  summaryDiagnostics?: FCODiagnostics;
  procedureDiagnostics?: FCODiagnostics;
  developerMode?: boolean;
}

export default function ExportPanel({ formData, summaryDiagnostics, procedureDiagnostics, developerMode }: ExportPanelProps) {
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const criticalCodes = [
    'PLACEHOLDER_REMOVED',
    'PLACEHOLDER_EXPLICIT_SYNTAX_LOST',
    'PLACEHOLDER_CAPTION_CHANGED',
    'PLACEHOLDER_TYPE_CHANGED',
    'PLACEHOLDER_NUMBER_CHANGED'
  ];

  const reviewCodes = [
    'PLACEHOLDER_DUPLICATE_AFTER_REWRITE',
    'PLACEHOLDER_ADDED_BY_REWRITE',
    'PLACEHOLDER_REFERENCE_WITHOUT_PLACEHOLDER',
    'PLACEHOLDER_SOURCE_CHANGED'
  ];

  // Accepted-output diagnostics only — captured at Accept Summary / Accept
  // Procedure. The legacy full-rewrite apiResponse is never consulted here.
  const validationErrors = [
    ...(summaryDiagnostics?.validationErrors || []),
    ...(procedureDiagnostics?.validationErrors || [])
  ];
  const criticalPlaceholderErrors = validationErrors.filter(err =>
    criticalCodes.some(code => err.startsWith(code) || err.includes(code))
  );
  const reviewPlaceholderWarnings = validationErrors.filter(err =>
    reviewCodes.some(code => err.startsWith(code) || err.includes(code))
  );

  const hasCriticalErrors = criticalPlaceholderErrors.length > 0;
  const hasAnyPlaceholderIssue = hasCriticalErrors || reviewPlaceholderWarnings.length > 0;

  const handleDownloadDocx = async () => {
    if (hasCriticalErrors && !acknowledged) {
      alert("Please review and acknowledge the critical draft integrity warnings below before exporting.");
      return;
    }

    if (!formData?.fcoDraft?.technicalContent?.acceptedSummary || !formData?.fcoDraft?.technicalContent?.acceptedProcedure) {
      alert("Summary and Procedure must be accepted before export.");
      return;
    }

    try {
      setDownloadingDocx(true);
      const acceptedSummaryText = formData.fcoDraft.technicalContent.acceptedSummary;
      const acceptedWordCount = acceptedSummaryText.split(/\s+/).filter(Boolean).length;
      const res = await fetch('/api/fco/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fcoContext: formData || {},
          rewrittenSummary: {
            paragraph: acceptedSummaryText,
            components: { problem: '', cause: '', solution: '', benefit: '' },
            wordCount: acceptedWordCount,
            withinWordLimit: acceptedWordCount <= 150
          },
          // acceptedProcedure already has any accepted readiness suggestions
          // baked in at Accept Procedure — sent directly, exactly as Step 3
          // previews it, with no further merge (avoids double-applying
          // readiness suggestions).
          rewrittenProcedure: formData.fcoDraft.technicalContent.acceptedProcedure,
          diagnostics: procedureDiagnostics || summaryDiagnostics,
          developerMode
        })
      });

      if (!res.ok) {
        // Error responses are JSON, but a misconfigured proxy could return HTML;
        // read defensively so the user gets a message, not an opaque parse crash.
        const ct = res.headers.get('content-type') || '';
        let message = `Failed to export DOCX (status ${res.status}).`;
        if (ct.includes('application/json')) {
          const err = await res.json().catch(() => null);
          if (err?.error) message = err.error;
        } else {
          const text = await res.text().catch(() => '');
          if (text) message += ` Response preview: ${text.slice(0, 120)}`;
        }
        throw new Error(message);
      }

      // Guard the success path: only treat the body as a .docx if it actually is
      // one. If a proxy/SPA fallback served HTML with a 200, downloading it as
      // .docx would produce a silently corrupt file.
      const okCt = res.headers.get('content-type') || '';
      if (!okCt.includes('wordprocessingml') && !okCt.includes('application/octet-stream')) {
        throw new Error(`Expected a DOCX file but received ${okCt || 'unknown content type'}. Check the backend route/proxy.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().getTime();
      link.download = `FCO_Draft_${timestamp}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || "Failed to export DOCX.");
    } finally {
      setDownloadingDocx(false);
    }
  };

  const isExportBlocked = hasCriticalErrors && !acknowledged;

  return (
    <div className="space-y-6 font-sans text-sm" id="export-panel-tab-view">
      {/* Draft Integrity Warning Block inside Export panel */}
      {hasAnyPlaceholderIssue && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl shadow-sm text-xs space-y-3" id="export-integrity-warning">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-rose-900 text-sm font-sans uppercase tracking-wide">
                Draft Integrity Warnings Pending Review
              </h4>
              <p className="text-rose-800 leading-normal">
                Visual placeholder checks have detected issues created during the AI rewrite. Export is restricted until you acknowledge these warnings.
              </p>
            </div>
          </div>
          
          <div className="pl-7 space-y-1.5 border-t border-rose-100 pt-2.5">
            {criticalPlaceholderErrors.map((err, i) => {
              const userMessage = err.replace(/^[A-Z_]+:\s*/, '');
              return (
                <div key={`crit-${i}`} className="text-rose-700 flex items-start gap-2 font-sans font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0"></span>
                  <span>
                    <strong className="text-rose-900 uppercase text-xxs font-extrabold mr-1 bg-rose-100 px-1 py-0.5 rounded">[CRITICAL]</strong>
                    {userMessage}
                  </span>
                </div>
              );
            })}
            {reviewPlaceholderWarnings.map((err, i) => {
              const userMessage = err.replace(/^[A-Z_]+:\s*/, '');
              return (
                <div key={`rev-${i}`} className="text-amber-800 flex items-start gap-2 font-sans font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
                  <span>
                    <strong className="text-amber-950 uppercase text-xxs font-extrabold mr-1 bg-amber-100 px-1 py-0.5 rounded">[WARNING]</strong>
                    {userMessage}
                  </span>
                </div>
              );
            })}
          </div>

          {hasCriticalErrors && (
            <div className="pl-7 pt-2.5 border-t border-rose-100 flex items-start gap-2.5">
              <input
                type="checkbox"
                id="ack-checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="ack-checkbox" className="text-slate-700 font-bold select-none cursor-pointer leading-normal">
                I acknowledge that this draft has unresolved critical placeholder integrity warnings and I want to export anyway.
              </label>
            </div>
          )}
        </div>
      )}

      {/* DOCX Block */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <FileIcon className="w-5 h-5 text-gray-700" />
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase">
                Export as DOCX (.docx)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 font-sans">
                Professional Word Document containing the context, summary, and procedure.
              </p>
            </div>
          </div>
          
          <div className="flex gap-2.5">
            <button
              onClick={handleDownloadDocx}
              disabled={downloadingDocx || isExportBlocked}
              className="px-3.5 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-98"
              id="btn-download-docx"
            >
              <Download className="w-4 h-4" />
              {downloadingDocx ? 'Generating...' : 'Export DOCX'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
