import React, { useState, useEffect, useMemo } from 'react';
import { FCORequestData, DocxAnalysisResponse } from '../types';
import { ChevronLeft, CheckCircle2, FileText, Image as ImageIcon, Sparkles, AlertTriangle, Edit3 } from 'lucide-react';
import { detectPlaceholders, consolidatePlaceholders } from '../lib/placeholderDetection';
import { InsertPlaceholderButton, PlaceholderPreviewPanel } from './PlaceholderPreviewPanel';
import { ProcedureCalloutsEditor } from './ProcedureCalloutsEditor';

interface AiReviewStudioProps {
  formData: FCORequestData;
  setFormData: React.Dispatch<React.SetStateAction<FCORequestData>>;
  inputMode: 'manual' | 'docx';
  docxAnalysis: DocxAnalysisResponse | null;
  onBack: () => void;
  onSubmit: () => void;
  developerMode: boolean;
}

export function AiReviewStudio({
  formData, setFormData, inputMode, docxAnalysis, onBack, onSubmit, developerMode
}: AiReviewStudioProps) {
  
  const [showValidation, setShowValidation] = useState(false);
  const [confirmedDocx, setConfirmedDocx] = useState(false);
  const [isEditingSourceDraft, setIsEditingSourceDraft] = useState(false);

  // Normalizer state
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [hasNormalized, setHasNormalized] = useState(false);
  const [pasteNormalizerData, setPasteNormalizerData] = useState<any>(null);

  // For docs mode editing
  const [docSummary, setDocSummary] = useState('');
  const [docProcedure, setDocProcedure] = useState('');
  
  // AI Detection State
  const [detectedType, setDetectedType] = useState<string | null>(formData.detectedChangeType || null);
  const [isTypeConfirmed, setIsTypeConfirmed] = useState(formData.confirmedChangeType || false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isEditingType, setIsEditingType] = useState(false);
  
  // Procedure Analysis State
  const [isAnalyzingProcedure, setIsAnalyzingProcedure] = useState(false);
  const [suggestedSteps, setSuggestedSteps] = useState<string | null>(formData.suggestedProcedure || null);
  const [isProcedureConfirmed, setIsProcedureConfirmed] = useState(formData.confirmedProcedure !== undefined && formData.confirmedProcedure !== '');
  const [editingProcedure, setEditingProcedure] = useState(false);
  const [editedSteps, setEditedSteps] = useState(formData.confirmedProcedure || '');

  // Summary Evaluation State
  const [isEvaluatingSummary, setIsEvaluatingSummary] = useState(false);
  const [summaryEvaluation, setSummaryEvaluation] = useState<any>(null);
  const [isSummaryConfirmed, setIsSummaryConfirmed] = useState(false);
  const [editedSuggestions, setEditedSuggestions] = useState<any>({});

  const detectedPlaceholders = useMemo(() => {
    const summaryText = inputMode === 'manual' ? formData.rawSummary : docSummary;
    const procedureText = inputMode === 'manual' ? formData.rawProcedure : docProcedure;
    const summaryDetected = detectPlaceholders(summaryText, 'Summary');
    const procedureDetected = detectPlaceholders(procedureText, 'Procedure');
    return consolidatePlaceholders(summaryDetected, procedureDetected);
  }, [inputMode, formData.rawSummary, formData.rawProcedure, docSummary, docProcedure]);

  const handleManualSummaryInsert = (newText: string) => {
    setFormData(prev => ({ ...prev, rawSummary: newText }));
  };
  
  const handleManualProcedureInsert = (newText: string) => {
    setFormData(prev => ({ ...prev, rawProcedure: newText }));
  };

  const handleDocxSummaryInsert = (newText: string) => {
    setDocSummary(newText);
  };
  
  const handleDocxProcedureInsert = (newText: string) => {
    setDocProcedure(newText);
  };

  useEffect(() => {
    if (inputMode === 'docx' && docxAnalysis) {
      setDocSummary(docxAnalysis.detectedSummary.text);
      setDocProcedure(docxAnalysis.detectedProcedure.text);
    }
  }, [inputMode, docxAnalysis]);

  useEffect(() => {
     if (formData.detectedChangeType && formData.detectedChangeType !== detectedType) {
         setDetectedType(formData.detectedChangeType);
     }
     if (formData.confirmedChangeType !== undefined && formData.confirmedChangeType !== isTypeConfirmed) {
         setIsTypeConfirmed(formData.confirmedChangeType);
     }
  }, [formData.detectedChangeType, formData.confirmedChangeType]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'rawSummary' || name === 'rawProcedure') {
        const draft = updated.fcoDraft ? { ...updated.fcoDraft } : {
          fcoMetadata: { baseProductCode: '', fcoNumber: '', fcoTitle: '', priority: '', appliesTo: '', effectiveDate: '', productionStart: '', application: '', affectedEquipmentModel: '' },
          associatedInfo: { associatedRFI: '', supersededFCOs: '', associatedFCOs: '', associatedCOCAs: '', associatedTechAlerts: '', qCheckServiceLevel: '', codingChanges: '', capitalize: '', commentsByOperations: '' },
          costSchedule: { estimatedFcoCostUsd: '', estimatedSpecialEquipmentCostUsd: '', estimatedTimeHours: '', dueDate: '' },
          additionalFcoInfo: { maintenanceProcedureChanges: '', markingInformation: '' },
          approvalRoles: { designEngineer: '', inTouchEngineer: '', fieldDecisionMaker: '' },
          technicalContent: { draftSummary: '', draftProcedure: '', knownSafetyRisks: '', existingReferences: '', optionalRewriteInstructions: '', procedureCallouts: [] }
        } as NonNullable<FCORequestData['fcoDraft']>;
        if (name === 'rawSummary') draft.technicalContent.draftSummary = value;
        if (name === 'rawProcedure') draft.technicalContent.draftProcedure = value;
        updated.fcoDraft = draft;
      }
      return updated;
    });
  };

  const handleDocxConfirm = () => {
    setConfirmedDocx(true);
    setFormData(prev => {
      const draft = prev.fcoDraft ? { ...prev.fcoDraft } : {
        fcoMetadata: { baseProductCode: '', fcoNumber: '', fcoTitle: '', priority: '', appliesTo: '', effectiveDate: '', productionStart: '', application: '', affectedEquipmentModel: '' },
        associatedInfo: { associatedRFI: '', supersededFCOs: '', associatedFCOs: '', associatedCOCAs: '', associatedTechAlerts: '', qCheckServiceLevel: '', codingChanges: '', capitalize: '', commentsByOperations: '' },
        costSchedule: { estimatedFcoCostUsd: '', estimatedSpecialEquipmentCostUsd: '', estimatedTimeHours: '', dueDate: '' },
        additionalFcoInfo: { maintenanceProcedureChanges: '', markingInformation: '' },
        approvalRoles: { designEngineer: '', inTouchEngineer: '', fieldDecisionMaker: '' },
        technicalContent: { draftSummary: '', draftProcedure: '', knownSafetyRisks: '', existingReferences: '', optionalRewriteInstructions: '', procedureCallouts: [] }
      } as NonNullable<FCORequestData['fcoDraft']>;
      draft.technicalContent.draftSummary = docSummary;
      draft.technicalContent.draftProcedure = docProcedure;
      return {
        ...prev,
        rawSummary: docSummary,
        rawProcedure: docProcedure,
        fcoDraft: draft
      };
    });
  };
  
  const runDetection = () => {
    setIsDetecting(true);
    const summaryText = inputMode === 'manual' ? formData.rawSummary : docSummary;
    const procedureText = inputMode === 'manual' ? formData.rawProcedure : docProcedure;
    const text = (summaryText + " " + procedureText).toLowerCase();
    
    let type = "Physical / Hardware Change";
    
    const physicalScore = ['install', 'replace', 'remove', 'hardware', 'kit', 'part number'].reduce((a, b) => a + (text.includes(b) ? 1 : 0), 0);
    const softwareScore = ['update config', 'version', 'controller', 'upload', 'firmware'].reduce((a, b) => a + (text.includes(b) ? 1 : 0), 0);
    const processScore = ['checklist', 'inspection', 'workflow', 'requirement'].reduce((a, b) => a + (text.includes(b) ? 1 : 0), 0);
    
    if (softwareScore > physicalScore && softwareScore > processScore) {
       type = "Software / Configuration Change";
    } else if (processScore > physicalScore && processScore > softwareScore) {
       type = "Policy / Process Change";
    }
    
    setTimeout(() => {
        setDetectedType(type);
        setFormData(prev => ({ 
            ...prev, 
            changeType: type,
            detectedChangeType: type,
            confirmedChangeType: false
        }));
        setIsTypeConfirmed(false);
        setIsEditingType(false);
        setIsDetecting(false);
    }, 600);
  };

  const handleConfirmType = (confirmedType: string) => {
      setFormData(prev => ({
          ...prev,
          changeType: confirmedType,
          confirmedChangeType: true
      }));
      setIsTypeConfirmed(true);
      setIsEditingType(false);
  };

  const runSummaryEvaluation = async () => {
      setIsEvaluatingSummary(true);
      const summaryText = inputMode === 'manual' ? formData.rawSummary : docSummary;
      
      try {
          const res = await fetch('/api/fco/evaluate-summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rawSummary: summaryText })
          });
          const data = await res.json();
          if (data.success && data.evaluated) {
              setSummaryEvaluation(data.evaluated);
              const suggs: Record<string, string> = {};
              (['problem', 'cause', 'solution', 'benefit'] as const).forEach(field => {
                  const aiSuggestedText = data.evaluated.suggestions?.find((s: any) => s.field === field)?.suggestedText;
                  const analysisText = data.evaluated.pcsb?.[field];
                  suggs[field] = formData.confirmedPCSB?.[field] 
                                ?? editedSuggestions[field] 
                                ?? aiSuggestedText 
                                ?? analysisText 
                                ?? '';
              });
              setEditedSuggestions(suggs);

              const missingOrWeak = [...(data.evaluated.missingFields || []), ...(data.evaluated.weakFields || [])];
              if (missingOrWeak.length === 0) {
                  // Perfect score, auto-confirm
                  setIsSummaryConfirmed(true);
              }
          } else {
              setSummaryEvaluation({ success: true, perfect: true });
              setIsSummaryConfirmed(true);
          }
      } catch (e) {
          console.error("Summary evaluation failed", e);
          setSummaryEvaluation({ success: true, perfect: true });
          setIsSummaryConfirmed(true);
      } finally {
          setIsEvaluatingSummary(false);
      }
  };

  const handleConfirmSummaryComponents = () => {
      let summaryText = inputMode === 'manual' ? formData.rawSummary : docSummary;
      
      const confirmedPCSB = {
        problem: editedSuggestions.problem || '',
        cause: editedSuggestions.cause || '',
        solution: editedSuggestions.solution || '',
        benefit: editedSuggestions.benefit || ''
      };

      // Build appended text based on confirmed pieces
      let appendedText = "\n[User-confirmed Summary Components]\n";
      if (confirmedPCSB.problem) appendedText += `Problem: ${confirmedPCSB.problem}\n`;
      if (confirmedPCSB.cause) appendedText += `Cause: ${confirmedPCSB.cause}\n`;
      if (confirmedPCSB.solution) appendedText += `Solution: ${confirmedPCSB.solution}\n`;
      if (confirmedPCSB.benefit) appendedText += `Benefit: ${confirmedPCSB.benefit}\n`;
      appendedText += "[/User-confirmed Summary Components]\n";
      
      // Remove any previously appended "[User-confirmed Summary Components]" block
      const regex = /\n?\[User-confirmed Summary Components\][\s\S]*?\[\/User-confirmed Summary Components\]\n?/g;
      summaryText = summaryText.replace(regex, "");
      
      const newSummary = summaryText + appendedText;
      
      setFormData(prev => {
          const next = { ...prev, confirmedPCSB };
          if (inputMode === 'manual') {
              next.rawSummary = newSummary;
          }
          if (next.fcoDraft && next.fcoDraft.technicalContent) {
              next.fcoDraft = {
                  ...next.fcoDraft,
                  technicalContent: {
                      ...next.fcoDraft.technicalContent,
                      draftSummary: newSummary
                  }
              };
          }
          return next;
      });

      if (inputMode !== 'manual') {
          setDocSummary(newSummary);
      }
      
      setIsSummaryConfirmed(true);
  };

  const handleDismissSummaryComponents = () => {
      if (summaryEvaluation?.missingFields?.includes('problem') || summaryEvaluation?.missingFields?.includes('solution')) {
         alert("Problem and Solution are required fields. You must address or edit them.");
         return;
      }
      
      // Since all fields are editable, 'dismiss' just confirms the analysis values
      const pcsb = summaryEvaluation?.pcsb || {};
      const confirmedPCSB = {
        problem: pcsb.problem || '',
        cause: pcsb.cause || '',
        solution: pcsb.solution || '',
        benefit: pcsb.benefit || ''
      };
      
      setFormData(prev => ({ ...prev, confirmedPCSB }));
      setIsSummaryConfirmed(true);
  };

  const runProcedureAnalysis = async () => {
      setIsAnalyzingProcedure(true);
      const procedureText = inputMode === 'manual' ? formData.rawProcedure : docProcedure;
      
      try {
          const res = await fetch('/api/analyze-procedure', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rawProcedure: procedureText })
          });
          const data = await res.json();
          setSuggestedSteps(data.suggestedProcedure);
          setEditedSteps(data.suggestedProcedure);
          setFormData(prev => ({ 
              ...prev, 
              originalProcedure: procedureText,
              suggestedProcedure: data.suggestedProcedure 
          }));
      } catch (e) {
          console.error("Analysis failed", e);
      } finally {
          setIsAnalyzingProcedure(false);
      }
  };

  const handleConfirmProcedure = (mode: 'accept' | 'keep' | 'edit_save') => {
      let finalProcedure = '';
      if (mode === 'accept') finalProcedure = suggestedSteps || '';
      else if (mode === 'keep') finalProcedure = formData.originalProcedure || formData.rawProcedure;
      else if (mode === 'edit_save') finalProcedure = editedSteps;
      
      setFormData(prev => ({
          ...prev,
          confirmedProcedure: finalProcedure,
          rawProcedure: finalProcedure, // Override so the rewrite uses it!
          fcoDraft: {
              ...prev.fcoDraft,
              technicalContent: {
                  ...prev.fcoDraft?.technicalContent,
                  draftProcedure: finalProcedure
              }
          } as any
      }));
      
      if (inputMode === 'docx') {
          setDocProcedure(finalProcedure);
      }
      
      setSuggestedSteps(finalProcedure);
      
      setIsProcedureConfirmed(true);
      setEditingProcedure(false);
  };

  const handleApplyNormalizer = (mode: 'accept' | 'edit' | 'keep') => {
      if (mode === 'accept') {
          const newProc = pasteNormalizerData.detectedProcedure.join('\n');
          setFormData(prev => ({
              ...prev,
              rawSummary: pasteNormalizerData.detectedSummary,
              rawProcedure: newProc,
              originalProcedure: prev.rawProcedure,
              suggestedProcedure: newProc,
              confirmedProcedure: newProc
          }));
          setSuggestedSteps(newProc); // Fix: Ensure state is updated so UI renders
          setIsProcedureConfirmed(true);
      }
      if (mode === 'edit') {
          setFormData(prev => ({
              ...prev,
              rawSummary: pasteNormalizerData.detectedSummary,
              rawProcedure: pasteNormalizerData.detectedProcedure.join('\n'),
          }));
          // force procedure edit loop
          setSuggestedSteps(pasteNormalizerData.detectedProcedure.join('\n'));
          setEditedSteps(pasteNormalizerData.detectedProcedure.join('\n'));
          setEditingProcedure(true);
      }
      setPasteNormalizerData(null);
      setHasNormalized(true);
  };

  const handleSubmitClick = async () => {
    setShowValidation(true);
    
    if (inputMode === 'manual') {
      if (!formData.rawSummary.trim() || !formData.rawProcedure.trim()) return;
      
      if (!hasNormalized) {
          setIsNormalizing(true);
          try {
              const res = await fetch('/api/fco/normalize-paste', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      rawSummary: formData.rawSummary,
                      rawProcedure: formData.rawProcedure
                  })
              });
              const data = await res.json();
              if (data.sourceType === 'pasted_fco_document' || data.sourceType === 'mixed_document_content') {
                  setPasteNormalizerData(data);
                  setIsNormalizing(false);
                  return; // Stop here and wait for user to confirm modal
              } else {
                  // Silent apply for clean input
                  setFormData(prev => ({
                      ...prev,
                      rawSummary: data.detectedSummary || prev.rawSummary,
                      rawProcedure: (data.detectedProcedure && data.detectedProcedure.length > 0) ? data.detectedProcedure.join('\n') : prev.rawProcedure
                  }));
                  setHasNormalized(true);
              }
          } catch(e) {
              console.error(e);
              setHasNormalized(true);
          } finally {
              setIsNormalizing(false);
          }
      }
    } else {
      if (!confirmedDocx) return;
      if (!docSummary.trim() || !docProcedure.trim()) return;
    }
    
    if (!detectedType) {
        runDetection();
        return;
    }
    
    if (!isTypeConfirmed) {
        return;
    }
    
    if (!isSummaryConfirmed && !summaryEvaluation && !isEvaluatingSummary) {
        runSummaryEvaluation();
        return;
    }
    
    if (!isSummaryConfirmed) {
        return;
    }
    
    if (!isProcedureConfirmed && !suggestedSteps && !isAnalyzingProcedure) {
        runProcedureAnalysis();
        return;
    }
    
    if (!isProcedureConfirmed) {
        return;
    }
    
    onSubmit();
  };

  const renderManualMode = () => (
    <div className="space-y-6">
      <div className="flex justify-end mb-2">
         <button 
           onClick={() => setIsEditingSourceDraft(!isEditingSourceDraft)}
           className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${isEditingSourceDraft ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
         >
           <Edit3 className="w-3.5 h-3.5" /> {isEditingSourceDraft ? 'Done Editing' : 'Edit source draft'}
         </button>
      </div>
      
      {!isEditingSourceDraft ? (
        <>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-slate-700 font-sans">Draft Summary from Step 1</label>
            {formData.rawSummary.trim() ? (
                <div className="w-full flex-1 min-h-[140px] px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono whitespace-pre-wrap text-slate-700">
                  {formData.rawSummary}
                </div>
            ) : (
                <div className="w-full flex-1 p-4 text-sm bg-slate-50 border border-slate-200 border-dashed rounded-xl text-slate-500 flex items-center justify-center">
                  No draft summary yet. Go back to Step 1 to add one, or edit source draft here.
                </div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-slate-700 font-sans flex items-center justify-between">
               <span>Draft Procedure from Step 1</span>
            </label>
            {formData.changeType === 'Physical / Hardware Change' && (
               <p className="text-xs text-indigo-600 font-medium mb-1">Hardware change detected. Please ensure Tools / Materials Required are included.</p>
            )}
            {formData.rawProcedure.trim() ? (
                <div className="w-full flex-1 min-h-[220px] px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono whitespace-pre-wrap text-slate-700">
                  {formData.rawProcedure}
                </div>
            ) : (
                <div className="w-full flex-1 p-4 text-sm bg-slate-50 border border-slate-200 border-dashed rounded-xl text-slate-500 flex items-center justify-center">
                  No draft procedure yet. Go back to Step 1 to add one, or edit source draft here.
                </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex flex-col gap-0.5">
               <label className="block text-sm font-semibold text-slate-700 font-sans flex items-center justify-between">
                 <span>Draft FCO Summary <span className="text-red-500">*</span></span>
                 <span className="text-xs font-normal text-slate-450">Rough engineers' problem/cause/solution/benefit descriptions</span>
               </label>
               <span className="text-xs text-slate-500 font-medium">The generated summary will be limited to 150 words.</span>
            </div>
            <p className="text-xs text-slate-500 italic mt-1 mb-1">To reference figures or tables, type placeholders directly in your draft (e.g. [Insert Figure 1: Caption]).</p>
            <InsertPlaceholderButton textAreaId="rawSummaryInput" onInsert={handleManualSummaryInsert} />
            <textarea
              id="rawSummaryInput"
              name="rawSummary"
              value={formData.rawSummary}
              onChange={handleChange}
              placeholder="Paste rough, unstructured engineering summary notes here..."
              className="w-full flex-1 min-h-[140px] px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono resize-none"
            />
            {showValidation && !formData.rawSummary.trim() && <p className="text-xs text-red-600">Summary is required.</p>}
          </div>

          <div className="flex-1 flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-slate-700 font-sans flex items-center justify-between">
              <span>Draft FCO Procedure Instructions <span className="text-red-500">*</span></span>
              <span className="text-xs font-normal text-slate-450">Checklist steps, tools, pressures, inspections</span>
            </label>
            <p className="text-xs text-slate-500 italic">Place figure/table placeholders near the step where they belong (e.g. [Insert Table 1: Required parts]).</p>
            {formData.changeType === 'Physical / Hardware Change' && (
               <p className="text-xs text-indigo-600 font-medium mb-1">Hardware change detected. Please ensure Tools / Materials Required are included.</p>
            )}
            <InsertPlaceholderButton textAreaId="rawProcedureInput" onInsert={handleManualProcedureInsert} />
            <textarea
              id="rawProcedureInput"
              name="rawProcedure"
              value={formData.rawProcedure}
              onChange={handleChange}
              placeholder="Paste raw sequence, step-by-step notes, tool specifications, or torque limits here..."
              className="w-full flex-1 min-h-[220px] px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono resize-none"
            />
            {showValidation && !formData.rawProcedure.trim() && <p className="text-xs text-red-600">Procedure is required.</p>}
          </div>
        </>
      )}
      
      <PlaceholderPreviewPanel placeholders={detectedPlaceholders} developerMode={developerMode} />
      
      <ProcedureCalloutsEditor formData={formData} setFormData={setFormData} />
    </div>
  );

  const renderDocxMode = () => {
    if (!docxAnalysis) return <div className="p-4 bg-slate-50 text-slate-500 text-center rounded-xl">No DOCX uploaded. Go back to Step 1.</div>;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
           <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-600" />
              <div>
                 <strong className="text-sm font-bold text-slate-800">Uploaded Document</strong>
                 <p className="text-xs text-slate-500 font-mono">{docxAnalysis.fileName}</p>
              </div>
           </div>
           
        </div>
        <p className="text-sm text-slate-600 bg-blue-50 border border-blue-100 p-3 rounded-lg">Correct extracted DOCX content before AI analysis.</p>

        {docxAnalysis.requiresUserConfirmation && !confirmedDocx && (
           <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm flex gap-3">
               <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
               <div>
                  <strong className="block font-bold mb-1">Please review and confirm the detected Summary and Procedure before rewriting.</strong>
                  <p>The app could not confidently detect Summary or Procedure. Please review and correct the extracted content before rewriting.</p>
               </div>
           </div>
        )}

        {docxAnalysis.warnings.length > 0 && (
           <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs space-y-1">
               <strong className="block font-bold">Extraction Warnings</strong>
               <ul className="list-disc pl-4">
                   {docxAnalysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
               </ul>
           </div>
        )}

        <div className="space-y-2">
           <label className="text-sm font-bold text-slate-700 uppercase">Review Extracted Summary <span className="text-red-500">*</span></label>
           <p className="text-xs text-slate-500 italic mt-1 mb-1">To reference figures or tables, type placeholders directly in your draft: [Insert Figure 1: Caption]</p>
           {!confirmedDocx && <InsertPlaceholderButton textAreaId="docSummaryInput" onInsert={handleDocxSummaryInsert} />}
           <textarea
               id="docSummaryInput"
               className={`w-full text-sm font-mono p-4 border border-slate-300 rounded-xl bg-slate-50 min-h-[140px] whitespace-pre-wrap ${confirmedDocx ? 'opacity-75 cursor-not-allowed' : ''}`}
               value={docSummary}
               onChange={e => setDocSummary(e.target.value)}
               disabled={confirmedDocx}
           />
           {showValidation && !docSummary.trim() && <p className="text-xs text-red-600">Summary is required.</p>}
        </div>

        <div className="space-y-2">
           <label className="text-sm font-bold text-slate-700 uppercase">Review Extracted Procedure <span className="text-red-500">*</span></label>
           <p className="text-xs text-slate-500 italic">Place figure/table placeholders near the step where they belong (e.g. [Insert Table 1: Required parts]).</p>
           {!confirmedDocx && <InsertPlaceholderButton textAreaId="docProcedureInput" onInsert={handleDocxProcedureInsert} />}
           <textarea
               id="docProcedureInput"
               className={`w-full text-sm font-mono p-4 border border-slate-300 rounded-xl bg-slate-50 min-h-[220px] whitespace-pre-wrap ${confirmedDocx ? 'opacity-75 cursor-not-allowed' : ''}`}
               value={docProcedure}
               onChange={e => setDocProcedure(e.target.value)}
               disabled={confirmedDocx}
           />
           {showValidation && !docProcedure.trim() && <p className="text-xs text-red-600">Procedure is required.</p>}
        </div>

        <PlaceholderPreviewPanel placeholders={detectedPlaceholders} developerMode={developerMode} />
        
        <ProcedureCalloutsEditor formData={formData} setFormData={setFormData} />

        {/* Figures */}
        {docxAnalysis.figures && docxAnalysis.figures.length > 0 && (
           <div className="space-y-2">
               <label className="text-sm font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4" /> Detected Figures
               </label>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {docxAnalysis.figures.map(fig => (
                       <div key={fig.figureId} className="p-3 border border-slate-200 rounded-lg bg-white flex flex-col gap-1 text-xs">
                           <div className="flex items-center justify-between">
                                <strong className="font-bold text-indigo-700">{fig.figureNumber || 'Unknown Figure'} {fig.caption ? `: ${fig.caption}` : ''}</strong>
                           </div>
                           <div className="text-slate-600 font-mono text-xs mt-1 bg-slate-50 p-1.5 rounded">{fig.placeholder}</div>
                       </div>
                   ))}
               </div>
           </div>
        )}

        {/* Tables */}
        {docxAnalysis.procedureTables && docxAnalysis.procedureTables.length > 0 && (
           <div className="space-y-2">
               <label className="text-sm font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Detected Tables
               </label>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {docxAnalysis.procedureTables.map(table => (
                       <div key={table.tableId} className="p-3 border border-slate-200 rounded-lg bg-white flex flex-col gap-1 text-xs">
                           <div className="flex items-center justify-between">
                                <strong className="font-bold text-indigo-700">{table.tableNumber || 'Unknown Table'} {table.title ? `: ${table.title}` : ''}</strong>
                           </div>
                           <div className="text-slate-600 font-mono text-xs mt-1 bg-slate-50 p-1.5 rounded">{table.placeholder}</div>
                       </div>
                   ))}
               </div>
           </div>
        )}

        {!confirmedDocx && (
           <div className="pt-4 flex items-center justify-center">
              <button 
                onClick={handleDocxConfirm}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2 transition-all"
              >
                 <CheckCircle2 className="w-5 h-5" />
                 Confirm Extraction
              </button>
           </div>
        )}

        {confirmedDocx && (
           <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-sm flex items-center justify-center gap-2 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Extraction Confirmed
              <button onClick={() => setConfirmedDocx(false)} className="ml-4 text-xs underline font-medium text-emerald-700 hover:text-emerald-900">Edit extraction</button>
           </div>
        )}
      </div>
    );
  };

  const getSubmitButtonText = () => {
    if (inputMode === 'manual' && !hasNormalized && formData.rawSummary.trim() && formData.rawProcedure.trim()) {
      return 'Format Document Structure';
    }
    if (!detectedType) return 'Detect Change Type';
    if (!isTypeConfirmed) return 'Confirm Type to Continue';
    if (!isSummaryConfirmed && !summaryEvaluation) return 'Evaluate Summary';
    if (!isSummaryConfirmed) return 'Confirm Summary';
    if (!isProcedureConfirmed && !suggestedSteps) return 'Analyze Procedure';
    if (!isProcedureConfirmed) return 'Confirm Procedure to Continue';
    return 'Rewrite & Review';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-800 font-sans">Step 2: AI Review Studio</h2>
        <p className="text-sm text-slate-500 mb-6 mt-1">Review the draft content captured in Step 1, then run AI analysis to improve the Summary and Procedure.</p>
      </div>
      
      {inputMode === 'manual' ? renderManualMode() : renderDocxMode()}

      {detectedType && !isTypeConfirmed && (
          <div className="mt-8 p-5 bg-indigo-50 border border-indigo-200 rounded-xl">
              <h3 className="font-bold text-sm text-indigo-900 mb-2 uppercase tracking-tight">Detected Change Type:</h3>
              
              {!isEditingType ? (
                  <div className="flex items-center gap-4">
                      <div className="flex-1 p-3 bg-white border border-indigo-100 rounded-lg font-mono text-sm text-slate-800">
                          [ {detectedType} ]
                      </div>
                      <div className="flex gap-2">
                          <button 
                            onClick={() => handleConfirmType(formData.changeType || detectedType || '')} 
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded shadow-sm flex flex-col sm:flex-row items-center gap-1.5"
                          >
                            <span className="hidden sm:inline">✔ Confirm</span>
                            <span className="sm:hidden">✔</span>
                          </button>
                          <button 
                            onClick={() => setIsEditingType(true)} 
                            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded shadow-sm flex flex-col sm:flex-row items-center gap-1.5"
                          >
                            <span className="hidden sm:inline">✏ Change</span>
                            <span className="sm:hidden">✏</span>
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="flex items-center gap-4">
                      <div className="flex-1">
                          <select
                              value={formData.changeType || detectedType || ''}
                              onChange={(e) => {
                                  setFormData(prev => ({ ...prev, changeType: e.target.value }));
                                  setDetectedType(e.target.value);
                              }}
                              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                              <option value="Physical / Hardware Change">Physical / Hardware Change</option>
                              <option value="Software / Configuration Change">Software / Configuration Change</option>
                              <option value="Policy / Process Change">Policy / Process Change</option>
                          </select>
                      </div>
                      <button 
                        onClick={() => handleConfirmType(formData.changeType || detectedType || '')} 
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded shadow-sm flex items-center gap-1.5"
                      >
                        ✔ Confirm
                      </button>
                  </div>
              )}
          </div>
      )}

      {isTypeConfirmed && detectedType && (
          <div className="mt-8 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-sm flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                 <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                 Confirmed Change Type: <span className="font-mono bg-emerald-100 px-2 py-0.5 rounded ml-1 text-xs">{formData.changeType}</span>
              </div>
              <button 
                  onClick={() => {
                      setIsTypeConfirmed(false);
                      setFormData(prev => ({ ...prev, confirmedChangeType: false }));
                  }} 
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
              >
                  Change
              </button>
          </div>
      )}

      {isEvaluatingSummary && (
          <div className="mt-8 p-5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-slate-600 text-sm font-bold">
             <div className="w-4 h-4 border-2 border-slate-400 border-t-indigo-600 rounded-full animate-spin"></div>
             Checking Summary Completeness...
          </div>
      )}

      {summaryEvaluation && !isSummaryConfirmed && !isEvaluatingSummary && (
          <div className="mt-8 p-5 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm">
              <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm text-slate-900 uppercase">Summary Component Check</h3>
                  <p className="text-xs text-slate-500">Review the extracted components (Problem, Cause, Solution, Benefit) from your draft summary before generating the final rewrite.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['problem', 'cause', 'solution', 'benefit'] as const).map(field => {
                      const isMissing = summaryEvaluation.missingFields?.includes(field) || false;
                      const isWeak = summaryEvaluation.weakFields?.includes(field) || false;
                      const hasSuggestion = isMissing || isWeak || editedSuggestions[field] !== undefined;
                      const detectedText = summaryEvaluation.pcsb?.[field] || 'Not detected';
                      const confidence = summaryEvaluation.confidence?.[field] || 'missing';

                      return (
                          <div key={field} className={`p-4 border rounded-xl flex flex-col gap-2 relative ${isMissing ? 'bg-red-50/50 border-red-200' : isWeak ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50/50 border-slate-200'}`}>
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-800 capitalize flex items-center gap-1.5">
                                    {field}
                                    {isMissing && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono uppercase">Missing</span>}
                                    {isWeak && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono uppercase">Weak</span>}
                                </label>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                                  confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                                  confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  Conf: {confidence}
                                </span>
                              </div>
                              
                              <p className="text-xs text-slate-700 font-sans italic my-1">{detectedText}</p>
                              
                              {developerMode && summaryEvaluation.sourceEvidence?.[field] && (
                                <p className="text-[10px] text-slate-500 font-mono">Evidence: {summaryEvaluation.sourceEvidence[field]}</p>
                              )}

                              <div className="mt-2 space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  {hasSuggestion ? 'Suggested Update / Edit' : 'Edit Component'}
                                </label>
                                <textarea
                                    value={editedSuggestions[field] || ''}
                                    onChange={(e) => setEditedSuggestions(prev => ({...prev, [field]: e.target.value}))}
                                    className="w-full text-xs p-2.5 border border-amber-200 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[60px] shadow-sm resize-y"
                                />
                              </div>
                          </div>
                      );
                  })}
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                  <button 
                      onClick={handleConfirmSummaryComponents}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded shadow-sm flex items-center gap-2"
                  >
                      <CheckCircle2 className="w-4 h-4" /> Confirm Components
                  </button>
                  {Object.keys(editedSuggestions).length > 0 && (
                      <button 
                          onClick={handleDismissSummaryComponents}
                          className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded shadow-sm"
                      >
                          Dismiss Suggestions
                      </button>
                  )}
              </div>
          </div>
      )}

      {isSummaryConfirmed && summaryEvaluation && (
          <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm flex flex-col sm:flex-row sm:items-center justify-between font-bold shadow-sm">
              <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2">
                     <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                     <span className="text-emerald-800">Summary Completeness Confirmed</span>
                 </div>
                 {(!summaryEvaluation.missingFields || summaryEvaluation.missingFields.length === 0) && (!summaryEvaluation.weakFields || summaryEvaluation.weakFields.length === 0) && (
                     <p className="text-xs text-emerald-600 font-medium ml-7 mt-0.5">Perfect score! No missing components detected.</p>
                 )}
              </div>
              <button 
                  onClick={() => setIsSummaryConfirmed(false)} 
                  className="mt-2 sm:mt-0 text-xs font-bold text-emerald-700 hover:text-emerald-900 underline px-3 py-1 bg-white border border-emerald-200 rounded shadow-sm transition-colors"
              >
                  Review / Edit
              </button>
          </div>
      )}

      {isAnalyzingProcedure && (
          <div className="mt-8 p-5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-slate-600 text-sm font-bold">
             <div className="w-4 h-4 border-2 border-slate-400 border-t-indigo-600 rounded-full animate-spin"></div>
             Analyzing Procedure Structure...
          </div>
      )}

      {suggestedSteps && !isProcedureConfirmed && !isAnalyzingProcedure && (
          <div className="mt-8 p-5 bg-indigo-50 border border-indigo-200 rounded-xl">
             <h3 className="font-bold text-sm text-indigo-900 mb-2">We improved your procedure for clarity:</h3>
             {!editingProcedure ? (
                 <>
                     <div className="p-4 bg-white border border-indigo-100 rounded-lg text-sm text-slate-700 whitespace-pre-wrap font-mono mb-4 max-h-[300px] overflow-y-auto">
                         {suggestedSteps}
                     </div>
                     <div className="flex flex-wrap gap-2">
                         <button 
                             onClick={() => handleConfirmProcedure('accept')}
                             className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded shadow-sm"
                         >
                             ✔ Accept Suggested Steps
                         </button>
                         <button 
                             onClick={() => {
                                 setEditedSteps(suggestedSteps || '');
                                 setEditingProcedure(true);
                             }}
                             className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded shadow-sm"
                         >
                             ✏ Edit Steps
                         </button>
                         <button 
                             onClick={() => handleConfirmProcedure('keep')}
                             className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-500 font-bold text-sm rounded shadow-sm"
                         >
                             ↺ Keep Original
                         </button>
                     </div>
                 </>
             ) : (
                 <>
                     <textarea
                         value={editedSteps}
                         onChange={(e) => setEditedSteps(e.target.value)}
                         className="w-full min-h-[200px] p-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 font-mono"
                     />
                     <div className="flex gap-2">
                         <button 
                             onClick={() => handleConfirmProcedure('edit_save')}
                             className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded shadow-sm"
                         >
                             ✔ Save & Accept
                         </button>
                         <button 
                             onClick={() => setEditingProcedure(false)}
                             className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded shadow-sm"
                         >
                             Cancel
                         </button>
                     </div>
                 </>
             )}
          </div>
      )}

      {isProcedureConfirmed && (
          <div className="mt-8 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-sm flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                 <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                 Procedure Structure Confirmed
              </div>
              <button 
                  onClick={() => setIsProcedureConfirmed(false)} 
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
              >
                  Review
              </button>
          </div>
      )}

      {isDetecting && (
          <div className="mt-8 p-5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-slate-600 text-sm font-bold">
             <div className="w-4 h-4 border-2 border-slate-400 border-t-indigo-600 rounded-full animate-spin"></div>
             Analyzing Context & Detecting Change Type...
          </div>
      )}

      {pasteNormalizerData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
                      <div>
                          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-indigo-600" />
                              Pasted Document Detected
                          </h2>
                          <p className="text-sm text-gray-500 mt-1">We detected unstructured document content. Please review the normalized extraction before proceeding.</p>
                      </div>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6 flex-1">
                      <div>
                          <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Detected Summary</h3>
                          <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-sm font-mono text-slate-800">
                              {pasteNormalizerData.detectedSummary || <span className="text-gray-400 italic">No summary content found</span>}
                          </div>
                      </div>
                      <div>
                          <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Detected Procedure Structure</h3>
                          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm font-mono text-slate-800 break-words whitespace-pre-wrap">
                              {pasteNormalizerData.detectedProcedure.map((s: string, i: number) => (
                                  <div key={i} className="mb-1"><span className="text-blue-400 mr-2">{i+1}.</span>{s}</div>
                              ))}
                              {pasteNormalizerData.detectedProcedure.length === 0 && <span className="text-gray-400 italic">No valid steps found</span>}
                          </div>
                      </div>
                      
                      {pasteNormalizerData.detectedFigures && pasteNormalizerData.detectedFigures.length > 0 && (
                          <div>
                              <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Detected Figures</h3>
                              <ul className="text-sm border border-slate-200 rounded-xl p-4 space-y-1 font-mono text-slate-600 bg-slate-50">
                                  {pasteNormalizerData.detectedFigures.map((f: string, i: number) => (
                                      <li key={i}>{f}</li>
                                  ))}
                              </ul>
                          </div>
                      )}
                      
                      {pasteNormalizerData.removedContent && pasteNormalizerData.removedContent.length > 0 && (
                          <div>
                              <h3 className="text-sm font-bold text-red-700 mb-2 uppercase tracking-wider">Removed / Ignored Content</h3>
                              <div className="text-xs border border-red-100 bg-red-50 p-4 rounded-xl text-red-800 max-h-32 overflow-y-auto space-y-1 font-mono">
                                  {pasteNormalizerData.removedContent.map((r: string, i: number) => (
                                      <div key={i}><s>{r}</s></div>
                                  ))}
                              </div>
                          </div>
                      )}
                      
                      {pasteNormalizerData.warnings && pasteNormalizerData.warnings.length > 0 && (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                              <h3 className="text-sm font-bold text-amber-900 mb-2">Warnings to Confirm</h3>
                              <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                                  {pasteNormalizerData.warnings.map((w: string, i: number) => (
                                      <li key={i}>{w}</li>
                                  ))}
                              </ul>
                          </div>
                      )}
                  </div>
                  <div className="p-5 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-3 justify-end">
                      <button onClick={() => handleApplyNormalizer('keep')} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100">Keep Original</button>
                      <button onClick={() => handleApplyNormalizer('edit')} className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-200">Edit Suggested Structure</button>
                      <button onClick={() => handleApplyNormalizer('accept')} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700">Accept Suggested Structure</button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex justify-between pt-8 border-t border-slate-100 mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2.5 text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={handleSubmitClick}
          disabled={((inputMode === 'docx' && !confirmedDocx) || (inputMode === 'manual' && (!formData.rawSummary.trim() || !formData.rawProcedure.trim())) || isDetecting || isEvaluatingSummary || isAnalyzingProcedure)}
          className="px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          {getSubmitButtonText()}
        </button>
      </div>
    </div>
  );
}
