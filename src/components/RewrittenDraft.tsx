import React from 'react';
import { FileText, AlertTriangle, Info, ShieldAlert, CheckSquare, Square } from 'lucide-react';
import { FCOSummary, FCOProcedure, ProcedureCheck } from '../types';
import { computeProcedureBands } from '../utils/procedureBands';

function parseSummaryString(summaryStr: string): FCOSummary {
  const probRegex = /(?:Problem):\s*(.*?)(?=Cause:|Solution:|Benefit:|$)/i;
  const causeRegex = /(?:Cause):\s*(.*?)(?=Problem:|Solution:|Benefit:|$)/i;
  const solRegex = /(?:Solution):\s*(.*?)(?=Problem:|Cause:|Benefit:|$)/i;
  const benRegex = /Benefit:\s*(.*?)(?=Problem:|Cause:|Solution:|$)/i;

  const problem = (summaryStr.match(probRegex)?.[1] || '').trim() || '[Information required from submitter]';
  const cause = (summaryStr.match(causeRegex)?.[1] || '').trim() || '[Information required from submitter]';
  const solution = (summaryStr.match(solRegex)?.[1] || '').trim() || '[Information required from submitter]';
  const ben = (summaryStr.match(benRegex)?.[1] || '').trim() || '[Information required from submitter]';
  
  const text = `${problem} ${cause} ${solution} ${ben}`.replace(/\[Information required.*?\]/gi, '');
  const calcWordCount = text.split(/\s+/).filter(w => w.trim().length > 0).length;

  return {
    paragraph: text.trim(),
    components: {
      problem: problem,
      cause: cause,
      solution: solution,
      benefit: ben,
    },
    wordCount: calcWordCount,
    withinWordLimit: calcWordCount <= 150
  };
}

function cleanLabel(text: string): string {
  if (!text) return text;
  return text
    .replace(/^(WARNING:\s*)+/i, "")
    .replace(/^(CAUTION:\s*)+/i, "")
    .replace(/^(NOTE:\s*)+/i, "");
}

function normalizeSummary(summary: any): FCOSummary {
  if (!summary) {
    return {
      paragraph: "[Summary could not be generated. TechCom review required.]",
      components: {
        problem: "[Information required from submitter]",
        cause: "[Information required from submitter]",
        solution: "[Information required from submitter]",
        benefit: "[Information required from submitter]",
      },
      wordCount: 0,
      withinWordLimit: false
    };
  }

  if (typeof summary === "string") {
    return parseSummaryString(summary);
  }

  const problem = summary.components?.problem || summary.problem || summary.Problem || "[Information required from submitter]";
  const cause = summary.components?.cause || summary.cause || summary.Cause || "[Information required from submitter]";
  const solution = summary.components?.solution || summary.components?.action || summary.solution || summary.action || "[Information required from submitter]";
  const ben = summary.components?.benefit || summary.benefit || summary.Benefit || "[Information required from submitter]";
  
  let paragraph = summary.paragraph;
  if (!paragraph) {
    paragraph = `${problem} ${cause} ${solution} ${ben}`.replace(/\[Information required.*?\]/gi, '').trim();
  }

  const calcWordCount = paragraph.split(/\s+/).filter((w: string) => w.trim().length > 0).length;

  return {
    paragraph: paragraph || "[Summary could not be generated. TechCom review required.]",
    components: {
      problem: problem,
      cause: cause,
      solution: solution,
      benefit: ben,
    },
    wordCount: summary.wordCount || calcWordCount,
    withinWordLimit: summary.withinWordLimit ?? summary.summaryWordLimitPassed ?? true
  };
}

interface RewrittenDraftProps {
  summary: FCOSummary;
  procedure: FCOProcedure;
  apiResponse?: any;
  procedureCallouts?: any[];
  checks?: ProcedureCheck[];
}

// A check renders visually distinct from an ordinary step — checkbox glyph +
// category caption — matching the DOCX export's checkRow() treatment exactly,
// so what's previewed here matches what's exported. A plain function
// returning a keyed element (not a JSX-invoked component) — this project has
// no @types/react installed, so custom components lose the special `key`
// prop allowance intrinsic elements get; baking the key into the returned
// element itself sidesteps that.
function checkBadge(check: ProcedureCheck) {
  return (
    <div key={check.id} className="flex items-start gap-2.5 p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg">
      <Square className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
      <div className="flex-1 min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-0.5">
          {check.category.replace(/_/g, ' ')}
        </span>
        <span className="text-sm text-slate-700 leading-relaxed">{check.text}</span>
      </div>
    </div>
  );
}

export default function RewrittenDraft({ summary, procedure, apiResponse, procedureCallouts = [], checks = [] }: RewrittenDraftProps) {
  const normalizedSummary = summary ? normalizeSummary(summary) : null;
  const pcsbToUse = apiResponse?.confirmedPCSB || apiResponse?.summaryAnalysis?.pcsb || normalizedSummary?.components || ({} as any);

  return (
    <div className="space-y-6 font-sans" id="rewritten-draft-tab-view">
      {/* 1. Summary Block — only when a summary is actually provided */}
      {normalizedSummary && (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight uppercase">
            Rewritten FCO Summary
          </h3>
        </div>

        <div className="text-sm">
          <p className="text-slate-700 leading-relaxed font-sans font-medium">
            {normalizedSummary.paragraph}
          </p>

          <details className="mt-4 border border-slate-200 rounded-lg group">
            <summary className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono bg-slate-50 px-3 py-2 cursor-pointer list-none flex items-center justify-between group-open:border-b border-slate-200 group-open:bg-slate-100/50">
              <span>Summary Component Check (TechCom Diagnostics)</span>
              <span className="text-[10px] text-slate-400 font-normal">Expand for Idea Validation</span>
            </summary>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/30">
              <div className="bg-white border text-slate-600 rounded p-2"><strong className="text-slate-800">Problem:</strong> {pcsbToUse.problem || "[Information required from submitter]"}</div>
              <div className="bg-white border text-slate-600 rounded p-2"><strong className="text-slate-800">Cause:</strong> {pcsbToUse.cause || "[Information required from submitter]"}</div>
              <div className="bg-white border text-slate-600 rounded p-2"><strong className="text-slate-800">Solution:</strong> {pcsbToUse.solution || "[Information required from submitter]"}</div>
              <div className="bg-white border text-slate-600 rounded p-2"><strong className="text-slate-800">Benefit:</strong> {pcsbToUse.benefit || "[Information required from submitter]"}</div>
            </div>
          </details>
        </div>
      </div>
      )}

      {/* 2. Procedure Block */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <CheckSquare className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight uppercase">
            Rewritten Procedure Steps
          </h3>
          <span className="ml-auto text-xxs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-semibold font-mono uppercase">
            Type: {procedure.changeType}
          </span>
        </div>

        <div className="space-y-6">
          {procedure.changeType === 'Physical / Hardware Change' && procedure.toolsMaterialsRequired && (
            <div className="border border-slate-200 rounded-xl p-4 bg-indigo-50/10 text-sm space-y-3">
              <h4 className="text-sm font-bold text-slate-900 border-b border-slate-150 pb-1.5 flex items-center justify-between font-sans">
                <span>Tools / Materials Required</span>
              </h4>
              <div className="space-y-4 pt-1">
                {procedure.toolsMaterialsRequired.confirmedFromInput && procedure.toolsMaterialsRequired.confirmedFromInput.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold font-mono text-slate-700 uppercase mb-1.5">Confirmed from input</h5>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 text-sm">
                      {procedure.toolsMaterialsRequired.confirmedFromInput.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {procedure.toolsMaterialsRequired.suggestedToConfirm && procedure.toolsMaterialsRequired.suggestedToConfirm.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold font-mono text-slate-700 uppercase mb-1.5">Suggested to confirm</h5>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 text-sm">
                      {procedure.toolsMaterialsRequired.suggestedToConfirm.map((item, idx) => (
                        <li key={idx} className="italic text-slate-500">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bands + check placement mirror the DOCX export exactly (see
              procedureBands.ts) — what's previewed here is what gets
              exported, band-for-band, position-for-position. Step numbering
              runs continuously across all three bands, matching masterStepNum
              in docxExportService.ts, not restarting per band. */}
          {(() => {
            const bands = computeProcedureBands(procedure, checks);
            let stepNum = 0;
            return bands.map(band => {
              const anchoredCount = band.stepRows.reduce((n, r) =>
                n + (r.stepGroupId ? (band.checksByStepGroupId.get(r.stepGroupId)?.before.length || 0) + (band.checksByStepGroupId.get(r.stepGroupId)?.after.length || 0) : 0), 0);
              if (band.stepRows.length === 0 && anchoredCount === 0 && band.fallbackBeforeChecks.length === 0 && band.fallbackAfterChecks.length === 0 && band.preambleChecks.length === 0) {
                return null;
              }

              const bandCallouts = procedureCallouts.filter(c =>
                c.section && (c.section.toLowerCase() === band.title.toLowerCase() || band.title.toLowerCase().includes(c.section.toLowerCase()))
              );

              return (
                <div key={band.key} className="border border-slate-200 rounded-xl p-4 bg-slate-50/20 text-sm space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 border-b border-slate-150 pb-1.5 font-sans">
                    {band.title}
                  </h4>

                  {band.preambleChecks.map(c => checkBadge(c))}

                  {bandCallouts.length > 0 && (
                    <div className="space-y-2">
                      {bandCallouts.map((callout) => {
                        if (!callout.text || !callout.text.trim()) return null;
                        if (callout.type === 'warning') {
                          return (
                            <div key={callout.id} className="bg-red-50 border-l-4 border-red-650 p-2.5 rounded-r-lg flex items-start gap-2 text-red-900 font-sans text-xs">
                              <ShieldAlert className="w-4 h-4 text-red-650 flex-shrink-0 mt-0.5 animate-pulse" />
                              <div>
                                <strong className="font-bold font-mono uppercase tracking-wide mr-1 text-red-700">WARNING:</strong>
                                {cleanLabel(callout.text)}
                              </div>
                            </div>
                          );
                        }
                        if (callout.type === 'caution') {
                          return (
                            <div key={callout.id} className="bg-amber-50 border-l-4 border-amber-500 p-2.5 rounded-r-lg flex items-start gap-2 text-amber-900 font-sans text-xs">
                              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <strong className="font-bold font-mono uppercase tracking-wide mr-1 text-amber-700">CAUTION:</strong>
                                {cleanLabel(callout.text)}
                              </div>
                            </div>
                          );
                        }
                        if (callout.type === 'note') {
                          return (
                            <div key={callout.id} className="bg-blue-50/50 border-l-4 border-blue-550 p-2.5 rounded-r-lg flex items-start gap-2 text-blue-900 font-sans text-xs">
                              <Info className="w-4 h-4 text-blue-550 flex-shrink-0 mt-0.5" />
                              <div>
                                <strong className="font-bold font-mono uppercase tracking-wide mr-1 text-blue-800">Note:</strong>
                                {cleanLabel(callout.text)}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {band.fallbackBeforeChecks.map(c => checkBadge(c))}

                  {band.stepRows.length > 0 ? (
                    <div className="space-y-2">
                      {band.stepRows.map((row, rowIdx) => {
                        const anchored = row.stepGroupId ? band.checksByStepGroupId.get(row.stepGroupId) : undefined;
                        stepNum++;
                        const n = stepNum;
                        return (
                          <React.Fragment key={rowIdx}>
                            {(anchored?.before || []).map(c => checkBadge(c))}
                            {row.title ? (
                              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
                                  <span className="w-5 h-5 flex items-center justify-center bg-indigo-100 rounded-full text-xs font-bold text-indigo-700 font-mono flex-shrink-0">
                                    {n}
                                  </span>
                                  <span className="text-sm font-bold text-slate-800">{row.title}</span>
                                </div>
                                <ul className="divide-y divide-slate-100">
                                  {row.texts.map((step, stepIdx) => (
                                    <li key={stepIdx} className="flex gap-3 p-2.5 pl-5 text-slate-700 text-sm">
                                      <span className="text-slate-400 flex-shrink-0 font-mono text-xs mt-0.5">{stepIdx + 1}.</span>
                                      <span className="leading-relaxed font-sans">{step}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              <div className="flex gap-3.5 p-3 text-slate-700 bg-white border border-slate-200 rounded-lg">
                                <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-full text-xs font-bold text-slate-600 font-mono flex-shrink-0">
                                  {n}
                                </span>
                                <span className="leading-relaxed font-sans">
                                  {row.texts[0].split(/(\[Insert.*?\])/).map((part, i) => {
                                    if (part.startsWith('[Insert')) {
                                      return (
                                        <span key={i} className="inline-block mt-2 mb-2 w-full p-2 border-2 border-indigo-200 bg-indigo-50 text-indigo-800 rounded font-bold font-mono text-xs">
                                          {part}
                                        </span>
                                      );
                                    }
                                    return part;
                                  })}
                                </span>
                              </div>
                            )}
                            {(anchored?.after || []).map(c => checkBadge(c))}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No specific action steps provided for this section.</p>
                  )}

                  {band.fallbackAfterChecks.map(c => checkBadge(c))}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
