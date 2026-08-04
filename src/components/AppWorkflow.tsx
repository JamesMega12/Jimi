import React, { useState } from 'react';
import { FCORequestData, DocxAnalysisResponse, FCOApiResponse } from '../types';
import Header from './Header';
import FcoPageSummaryTitle from './FcoPageSummaryTitle';
import FcoPagePartsProcedure from './FcoPagePartsProcedure';
import Step2Content from './Step2Content';
import Step3Review from './Step3Review';
import SourceTruthAdminPage from './SourceTruthAdminPage';
import DeveloperKnowledgePanel from './DeveloperKnowledgePanel';
import { parseJsonResponse } from '../utils/apiResponse';
import { createFcoSampleFormData } from '../data/fcoSamplePresets';
import { loadFcoState, saveFcoState, clearFcoState } from '../lib/fcoPersistence';
import { detectPlaceholders, consolidatePlaceholders, findConflictingPlaceholderCaptions } from '../lib/placeholderDetection';
import { AlertCircle, FileText, ChevronRight, Check } from 'lucide-react';
import { useFcoDraftingState } from '../hooks/useFcoDraftingState';

const ENABLE_LEGACY_GROUNDING_KB_UI = false;

export default function AppWorkflow() {
  // Restore a persisted in-progress FCO draft once, on mount. Used as the lazy
  // initial value for formData / currentStep so a refresh cannot overwrite a
  // freshly-typed draft (it only seeds the very first render).
  const persisted = React.useMemo(() => loadFcoState(), []);

  const [currentStep, setCurrentStep] = useState<number>(() => persisted?.currentStep ?? 1);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Preparing Draft...");
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [showKbAdmin, setShowKbAdmin] = useState<boolean>(false);
  const [showDevKnowledge, setShowDevKnowledge] = useState<boolean>(false);
  const [developerMode, setDeveloperMode] = useState<boolean>(false);

  const [inputMode, setInputMode] = useState<'manual' | 'docx'>('docx');
  const [docxAnalysis, setDocxAnalysis] = useState<DocxAnalysisResponse | null>(null);
  
  const [formData, setFormData] = useState<FCORequestData>(() => persisted?.formData ?? {
    title: '',
    priority: '',
    changeType: '',
    detectedChangeType: '',
    confirmedChangeType: false,
    affectedEquipment: '',
    knownSafetyRisks: '',
    customDirectives: '',
    rawSummary: '',
    rawProcedure: '',
    originalProcedure: '',
    suggestedProcedure: '',
    confirmedProcedure: '',
    inputSource: 'manual',
    fcoDraft: {
      fcoMetadata: {
        baseProductCode: '',
        fcoNumber: '',
        fcoTitle: '',
        priority: '',
        appliesTo: '',
        effectiveDate: '',
        productionStart: '',
        application: '',
        affectedEquipmentModel: ''
      },
      associatedInfo: {
        associatedRFI: '',
        supersededFCOs: '',
        associatedFCOs: '',
        associatedCOCAs: '',
        associatedTechAlerts: '',
        qCheckServiceLevel: '',
        codingChanges: '',
        capitalize: '',
        commentsByOperations: ''
      },
      costSchedule: {
        estimatedFcoCostUsd: '',
        estimatedSpecialEquipmentCostUsd: '',
        estimatedTimeHours: '',
        dueDate: ''
      },
      additionalFcoInfo: {
        maintenanceProcedureChanges: '',
        markingInformation: ''
      },
      approvalRoles: {
        designEngineer: '',
        inTouchEngineer: '',
        fieldDecisionMaker: ''
      },
      technicalContent: {
        draftSummary: '',
        draftProcedure: '',
        knownSafetyRisks: '',
        existingReferences: '',
        optionalRewriteInstructions: '',
        procedureCallouts: [],
        procedureReadinessSuggestions: []
      },
      fcoTables: {
        fcoHistory: { status: 'active', rows: [] },
        partsOrKitsRequired: { status: 'active', rows: [] },
        specialEquipmentRequired: { status: 'active', rows: [] },
        partsRequiringRework: { status: 'active', rows: [] },
        partsToScrap: { status: 'active', rows: [] }
      },
      visualPlaceholders: []
    }
  });

  const [response, setResponse] = useState<FCOApiResponse | null>(null);

  const [ragStatus, setRagStatus] = useState<'checked' | 'seed_only' | 'ready'>('checked');

  // Shared Summary/Title/Parts/Procedure drafting state — called once here so
  // its stale-state invalidation cascade works across both the Summary & Title
  // page and the Parts & Procedure page.
  const drafting = useFcoDraftingState(formData, setFormData);

  React.useEffect(() => {
    fetch('/api/kb/documents')
      .then(res => res.json())
      .then(docs => {
        const hasUploaded = docs.some((d: any) => !d.isSeedData);
        setRagStatus(hasUploaded ? 'ready' : 'seed_only');
      })
      .catch(err => console.warn(err));
  }, []);

  // Autosave the canonical draft + current step (debounced) so a refresh
  // restores in-progress work. Only formData/currentStep are persisted; pending
  // AI output and loading/guard state live in the drafting hook and are never
  // saved, so a restore never brings back a stuck spinner or stale suggestion.
  React.useEffect(() => {
    const t = setTimeout(() => saveFcoState(formData, currentStep), 400);
    return () => clearTimeout(t);
  }, [formData, currentStep]);

  // Four-page navigation. Pages are permissive — moving forward or back never
  // clears or destroys fcoDraft state; only Start New Draft / Load FCO Sample do.
  const goToPage = (page: number) => setCurrentStep(page);

  /* DEAD CODE (Phase 4 cleanup) — legacy full-draft rewrite path. Unreachable:
     nothing wires handleAutoRewriteTrigger / handleTestPresetAutoRun, so
     handleRewriteSubmit (the only caller of POST /api/fco/rewrite[-from-docx]
     and the only writer of the `response` state) never runs. The active FCO
     drafting path is the split summary/procedure rewrites in
     useFcoDraftingState. Kept commented for reference; the backend
     /api/fco/rewrite routes are intentionally left intact. */
  /*
  const handleAutoRewriteTrigger = (data: DocxAnalysisResponse, latestFormData: FCORequestData) => {
    handleRewriteSubmit({ docx: data, form: latestFormData });
  };

  const handleTestPresetAutoRun = (presetData: FCORequestData) => {
    handleRewriteSubmit({ docx: null as any, form: presetData });
  };

  const handleRewriteSubmit = async (autoData?: { docx: DocxAnalysisResponse, form: FCORequestData }) => {
    setLoading(true);
    setErrorStatus(null);
    
    // Clear any stale suggestions immediately
    setFormData(prev => {
      if (!prev.fcoDraft) return prev;
      return {
        ...prev,
        fcoDraft: {
          ...prev.fcoDraft,
          technicalContent: {
            ...prev.fcoDraft.technicalContent,
            procedureReadinessSuggestions: []
          }
        }
      };
    });

    const targetDocx = autoData ? autoData.docx : docxAnalysis;
    const targetForm = autoData ? autoData.form : { ...formData };

    const sumDetected = detectPlaceholders(targetForm.rawSummary || '', 'Summary');
    const procDetected = detectPlaceholders(targetForm.rawProcedure || '', 'Procedure');
    const conflicts = findConflictingPlaceholderCaptions([...sumDetected, ...procDetected]);
    
    if (conflicts.length > 0) {
      setLoading(false);
      const conflictMsg = conflicts.map(c => 
        `${c.type} ${c.number} has conflicting captions:\n${c.captions.map(cap => `- ${cap.caption} (in ${cap.source})`).join('\n')}`
      ).join('\n\n');
      setErrorStatus(`PLACEHOLDER_CONFLICTING_CAPTIONS:\n${conflictMsg}\n\nPlease use the same caption for ${conflicts[0].type} ${conflicts[0].number} or renumber one of the placeholders before rewriting.`);
      return;
    }

    // setCurrentStep(3); // Removed for UI-2C immediately to show loading state
    
    // Ensure fcoDraft is in fully synced state
    if (!targetForm.fcoDraft) {
      targetForm.fcoDraft = {
        fcoMetadata: { baseProductCode: '', fcoNumber: '', fcoTitle: targetForm.title || '', priority: targetForm.priority || '', appliesTo: targetForm.appliesTo || '', effectiveDate: targetForm.effectiveDate || '', productionStart: targetForm.productionStart || '', application: '', affectedEquipmentModel: targetForm.affectedEquipment || '' },
        associatedInfo: { associatedRFI: '', supersededFCOs: '', associatedFCOs: '', associatedCOCAs: '', associatedTechAlerts: '', qCheckServiceLevel: '', codingChanges: '', capitalize: '', commentsByOperations: '' },
        costSchedule: { estimatedFcoCostUsd: '', estimatedSpecialEquipmentCostUsd: '', estimatedTimeHours: '', dueDate: '' },
        additionalFcoInfo: { maintenanceProcedureChanges: '', markingInformation: '' },
        approvalRoles: { designEngineer: '', inTouchEngineer: '', fieldDecisionMaker: '' },
        technicalContent: { draftSummary: targetForm.rawSummary || '', draftProcedure: targetForm.rawProcedure || '', knownSafetyRisks: targetForm.knownSafetyRisks || '', existingReferences: '', optionalRewriteInstructions: targetForm.customDirectives || '', procedureCallouts: [], procedureReadinessSuggestions: [] },
        visualPlaceholders: []
      };
    } else {
      targetForm.fcoDraft.technicalContent.draftSummary = targetForm.rawSummary;
      targetForm.fcoDraft.technicalContent.draftProcedure = targetForm.rawProcedure;
      targetForm.fcoDraft.technicalContent.procedureReadinessSuggestions = [];
    }

    // Sync inline placeholders
    if (targetForm.fcoDraft) {
       const sumDetected = detectPlaceholders(targetForm.rawSummary || '', 'Summary');
       const procDetected = detectPlaceholders(targetForm.rawProcedure || '', 'Procedure');
       const allDetected = consolidatePlaceholders(sumDetected, procDetected);
       const existingPlaceholders = targetForm.fcoDraft.visualPlaceholders || [];
       
       const generateId = () => {
         if (typeof crypto !== 'undefined' && crypto.randomUUID) {
           return crypto.randomUUID();
         }
         return Math.random().toString(36).substring(2, 15);
       };
       
       const newPlaceholders: Array<{
         id: string;
         type: 'figure' | 'table';
         number: string;
         caption: string;
         linkedSection: string;
         status: string;
         notes: string;
       }> = [];

       allDetected.forEach(d => {
         // Only add explicit ones that aren't warnings/references
         if (!d.warning?.includes('is referenced')) {
           const existing = existingPlaceholders.find(
             p => p.type.toLowerCase() === d.type.toLowerCase() && p.number === d.number
           );
           
           if (existing) {
             // Preserve existing placeholder (retaining id, status, notes) but update caption and section
             newPlaceholders.push({
               ...existing,
               caption: d.caption,
               linkedSection: d.source
             });
           } else {
             newPlaceholders.push({
               id: generateId(),
               type: d.type.toLowerCase() as 'figure' | 'table',
               number: d.number,
               caption: d.caption,
               linkedSection: d.source,
               status: 'placeholder_only',
               notes: 'Auto-detected from text'
             });
           }
         }
       });
       targetForm.fcoDraft.visualPlaceholders = newPlaceholders;
    }

    // Persist targetForm modifications to state so Step 3 / ExportPanel have correct data
    setFormData(targetForm);

    const jobId = Date.now().toString();
    setLoadingMessage("Preparing Draft...");
    
    // Create the final data payload
    const submissionData = { ...targetForm, inputSource: inputMode, jobId };
    if (inputMode === 'docx' && targetDocx) {
      submissionData.docxExtraction = {
        documentId: targetDocx.documentId,
        fileName: targetDocx.fileName,
        summaryBlockIds: targetDocx.detectedSummary.blockIds,
        procedureBlockIds: targetDocx.detectedProcedure.blockIds,
        figureMap: targetDocx.figures || [],
        tableMap: targetDocx.procedureTables || [],
        extractionConfidence: targetDocx.overallExtractionConfidence,
        userConfirmed: true,
        extractionConfirmationMode: autoData ? "auto-confirmed" : "user-confirmed",
        autoRewriteTriggered: !!autoData,
        summaryConfidence: targetDocx.summaryConfidence,
        procedureConfidence: targetDocx.procedureConfidence,
        overallExtractionConfidence: targetDocx.overallExtractionConfidence,
        criticalExtractionWarnings: [...targetDocx.detectedSummary.warnings, ...targetDocx.detectedProcedure.warnings]
      };
    }

    let interval: any;
    if (typeof window !== 'undefined') {
      interval = setInterval(async () => {
          try {
             const res = await fetch(`/api/fco/status?id=${jobId}`);
             if (res.ok) {
                 const data = await res.json();
                 if (data.message) setLoadingMessage(data.message);
             }
          } catch(e) {}
      }, 1000);
    }

    try {
      const endpoint = inputMode === 'docx' ? '/api/fco/rewrite-from-docx' : '/api/fco/rewrite';
      const apiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData),
      });

      const payload: FCOApiResponse = await parseJsonResponse(apiResponse);
      setResponse(payload);

      // Fetch readiness suggestions asynchronously
      if (payload.rewrittenProcedure && submissionData.fcoDraft) {
        fetch('/api/fco/procedure-readiness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fcoDraft: submissionData.fcoDraft,
            rewrittenProcedure: payload.rewrittenProcedure
          })
        })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data.suggestions && Array.isArray(data.suggestions)) {
              setFormData(prev => ({
                ...prev,
                fcoDraft: {
                  ...prev.fcoDraft!,
                  technicalContent: {
                    ...prev.fcoDraft!.technicalContent,
                    procedureReadinessSuggestions: data.suggestions
                  }
                }
              }));
            }
          }
        })
        .catch(err => {
          console.error("Failed to fetch procedure readiness suggestions:", err);
        });
      }

    } catch (err: any) {
      console.error("Rewrite failed:", err.message || err);
      setErrorStatus(err.message || "An unexpected network or pipeline failure occurred while drafting your FCO rewrite.");
      // setCurrentStep(2); // removed for UI-2C/D/E
    } finally {
      if (interval) clearInterval(interval);
      setLoading(false);
    }
  };
  */

  const handleStartNew = () => {
    // Clear response and form data completely to start fresh
    setResponse(null);
    setDocxAnalysis(null);
    // Clear pending AI drafting state (Summary + Procedure) and abort any
    // in-flight request so nothing stale carries onto the blank draft.
    drafting.resetPendingDraftingState();
    // Drop the persisted draft immediately (autosave would also overwrite it,
    // but clearing now covers a tab-close before the debounce fires).
    clearFcoState();
    setFormData({
      title: '',
      priority: '',
      changeType: '',
      detectedChangeType: '',
      confirmedChangeType: false,
      affectedEquipment: '',
      appliesTo: '',
      effectiveDate: '',
      productionStart: '',
      knownSafetyRisks: '',
      customDirectives: '',
      rawSummary: '',
      rawProcedure: '',
      originalProcedure: '',
      suggestedProcedure: '',
      confirmedProcedure: '',
      inputSource: 'manual',
      fcoDraft: {
        fcoMetadata: {
          baseProductCode: '',
          fcoNumber: '',
          fcoTitle: '',
          priority: '',
          appliesTo: '',
          effectiveDate: '',
          productionStart: '',
          application: '',
          affectedEquipmentModel: ''
        },
        associatedInfo: {
          associatedRFI: '',
          supersededFCOs: '',
          associatedFCOs: '',
          associatedCOCAs: '',
          associatedTechAlerts: '',
          qCheckServiceLevel: '',
          codingChanges: '',
          capitalize: '',
          commentsByOperations: ''
        },
        costSchedule: {
          estimatedFcoCostUsd: '',
          estimatedSpecialEquipmentCostUsd: '',
          estimatedTimeHours: '',
          dueDate: ''
        },
        additionalFcoInfo: {
          maintenanceProcedureChanges: '',
          markingInformation: ''
        },
        approvalRoles: {
          designEngineer: '',
          inTouchEngineer: '',
          fieldDecisionMaker: ''
        },
        technicalContent: {
          draftSummary: '',
          draftProcedure: '',
          knownSafetyRisks: '',
          existingReferences: '',
          optionalRewriteInstructions: '',
          procedureCallouts: [],
          procedureReadinessSuggestions: []
        },
        fcoTables: {
          fcoHistory: { status: 'active', rows: [] },
          partsOrKitsRequired: { status: 'active', rows: [] },
          specialEquipmentRequired: { status: 'active', rows: [] },
          partsRequiringRework: { status: 'active', rows: [] },
          partsToScrap: { status: 'active', rows: [] }
        },
        visualPlaceholders: []
      }
    });
    setCurrentStep(1);
    setErrorStatus(null);
  };

  const handleLoadFcoSample = () => {
    // Load the fictional FCO sample into the FCO workflow only.
    // Replaces the draft, clears any prior rewrite response / uploaded docx,
    // switches to manual input, and keeps the user on Step 1. Does not call Gemini.
    setFormData(createFcoSampleFormData());
    setInputMode('manual');
    setDocxAnalysis(null);
    setResponse(null);
    setErrorStatus(null);
    setCurrentStep(1);
  };

  const handleClearPresetData = () => {
    // Abort/clear any in-flight or pending drafting state before wiping the draft.
    drafting.resetPendingDraftingState();
    clearFcoState();
    setFormData({
      title: '',
      priority: '',
      changeType: '',
      detectedChangeType: '',
      confirmedChangeType: false,
      affectedEquipment: '',
      appliesTo: '',
      effectiveDate: '',
      productionStart: '',
      knownSafetyRisks: '',
      customDirectives: '',
      rawSummary: '',
      rawProcedure: '',
      originalProcedure: '',
      suggestedProcedure: '',
      confirmedProcedure: '',
      inputSource: 'manual',
      testPreset: {
        used: false,
        presetName: null,
        syntheticData: false
      } as any,
      fcoDraft: {
        fcoMetadata: {
          baseProductCode: '',
          fcoNumber: '',
          fcoTitle: '',
          priority: '',
          appliesTo: '',
          effectiveDate: '',
          productionStart: '',
          application: '',
          affectedEquipmentModel: ''
        },
        associatedInfo: {
          associatedRFI: '',
          supersededFCOs: '',
          associatedFCOs: '',
          associatedCOCAs: '',
          associatedTechAlerts: '',
          qCheckServiceLevel: '',
          codingChanges: '',
          capitalize: '',
          commentsByOperations: ''
        },
        costSchedule: {
          estimatedFcoCostUsd: '',
          estimatedSpecialEquipmentCostUsd: '',
          estimatedTimeHours: '',
          dueDate: ''
        },
        additionalFcoInfo: {
          maintenanceProcedureChanges: '',
          markingInformation: ''
        },
        approvalRoles: {
          designEngineer: '',
          inTouchEngineer: '',
          fieldDecisionMaker: ''
        },
        technicalContent: {
          draftSummary: '',
          draftProcedure: '',
          knownSafetyRisks: '',
          existingReferences: '',
          optionalRewriteInstructions: '',
          procedureCallouts: [],
          procedureReadinessSuggestions: []
        },
        fcoTables: {
          fcoHistory: { status: 'active', rows: [] },
          partsOrKitsRequired: { status: 'active', rows: [] },
          specialEquipmentRequired: { status: 'active', rows: [] },
          partsRequiringRework: { status: 'active', rows: [] },
          partsToScrap: { status: 'active', rows: [] }
        },
        visualPlaceholders: []
      }
    });
    setResponse(null);
    setDocxAnalysis(null);
    setErrorStatus(null);
    setCurrentStep(1);
  };

  // Stepper Header Component
  const StepperHeader = () => {
    const steps = [
      { num: 1, title: 'Summary & Title' },
      { num: 2, title: 'Parts & Procedure' },
      { num: 3, title: 'Technical Content' },
      { num: 4, title: 'Review & Export' }
    ];

    return (
      <div className="bg-white border-b border-slate-200 py-4 px-6 mb-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {steps.map((step, idx) => {
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;
            
            return (
              <React.Fragment key={step.num}>
                <div className={`flex items-center gap-2 ${isActive ? 'text-indigo-600' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 
                    ${isActive ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 
                      isCompleted ? 'border-slate-700 bg-slate-700 text-white' : 
                      'border-slate-300'} transition-all`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : step.num}
                  </div>
                  <span className={`font-semibold text-sm ${isActive ? 'text-indigo-800' : ''}`}>
                    {step.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex-1 px-4 text-center">
                    <div className={`h-1 mx-2 rounded-full ${currentStep > step.num ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800" id="fco-main-root">
      {/* Header Bar */}
      <Header 
        diagnostics={response?.diagnostics} 
        loading={loading} 
        onOpenKbAdmin={() => setShowKbAdmin(true)} 
        onOpenDevKnowledge={() => setShowDevKnowledge(true)}
        ragStatus={ragStatus}
        developerMode={developerMode}
        setDeveloperMode={setDeveloperMode}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col" id="app-workspace-body">
        
        {developerMode && ragStatus === 'seed_only' && currentStep !== 4 && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold text-amber-800 text-sm">Action Recommended</strong>
              <p className="text-amber-800 text-sm">
                RAG is using seeded demo guidance only. Upload approved source-truth documents for production-quality grounding.
              </p>
            </div>
            <button
              onClick={() => setShowKbAdmin(true)}
              className="ml-auto bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            >
              Upload Sources
            </button>
          </div>
        )}

        {errorStatus && currentStep !== 4 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-sm shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-650 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold">Draft Pipeline Error</strong>
              <p className="whitespace-pre-wrap">{errorStatus}</p>
            </div>
          </div>
        )}

        <StepperHeader />

        <div className="flex-1 min-h-[400px]">
          {currentStep === 1 && (
            <FcoPageSummaryTitle
              formData={formData}
              setFormData={setFormData}
              docxAnalysis={docxAnalysis}
              setDocxAnalysis={setDocxAnalysis}
              setInputMode={setInputMode}
              onNext={() => goToPage(2)}
              onLoadFcoSample={handleLoadFcoSample}
              drafting={drafting}
            />
          )}

          {currentStep === 2 && (
            <FcoPagePartsProcedure
              formData={formData}
              developerMode={developerMode}
              onBack={() => goToPage(1)}
              onNext={() => goToPage(3)}
              drafting={drafting}
            />
          )}

          {currentStep === 3 && (
            <Step2Content
              formData={formData}
              setFormData={setFormData}
              onBack={() => goToPage(2)}
              onNext={() => goToPage(4)}
            />
          )}

          {currentStep === 4 && (
            <Step3Review
              loading={loading}
              loadingMessage={loadingMessage}
              error={errorStatus}
              onStartNew={handleStartNew}
              inputMode={inputMode}
              formData={formData}
              developerMode={developerMode}
              onNavigateToSummaryTitle={() => goToPage(1)}
              onNavigateToPartsProcedure={() => goToPage(2)}
              onNavigateToTechnicalContent={() => goToPage(3)}
            />
          )}
        </div>
      </main>

      {/* RAG Knowledge Base Overlay */}
      {ENABLE_LEGACY_GROUNDING_KB_UI && showKbAdmin && developerMode && (
        <SourceTruthAdminPage onClose={() => setShowKbAdmin(false)} />
      )}

      {/* Developer Knowledge & Instructions Overlay */}
      {showDevKnowledge && developerMode && (
        <DeveloperKnowledgePanel 
          onClose={() => setShowDevKnowledge(false)} 
          latestTrace={response?.diagnostics?.instructionTrace}
        />
      )}
    </div>
  );
}
