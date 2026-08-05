import { useState, useRef, Dispatch, SetStateAction } from 'react';
import { FCORequestData, FCOProcedure, FCOSummary, FcoSummaryAnalysis, ProcedureReadinessSuggestion, FCOPartInvolved, FCODiagnostics } from '../types';
import { stampProcedureIdentity, mergeAcceptedChecks } from '../utils/procedureMerge';
import { parseJsonResponse } from '../utils/apiResponse';
import { createGuard, begin, bump, isCurrent, isInFlight, settle, ownsLoading } from './fcoRequestGuard';

/**
 * Shared Summary/Title/Parts/Procedure drafting state for the FCO workflow.
 * Called once (in AppWorkflow) so state and its invalidation cascade are
 * shared across whichever pages currently render Summary vs. Procedure —
 * calling this hook independently in more than one component would give
 * each its own disconnected copy of this state.
 */
export function useFcoDraftingState(
  formData: FCORequestData,
  setFormData: Dispatch<SetStateAction<FCORequestData>>
) {
  // --- Title ---
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [selectedTitleSuggestion, setSelectedTitleSuggestion] = useState('');

  // --- Summary ---
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [generatedSummary, setGeneratedSummary] = useState<FCOSummary | null>(null);
  // Diagnostics from the most recent /api/fco/rewrite-summary response — pending
  // (non-canonical) until Accept Summary promotes it to acceptedSummaryDiagnostics.
  const [pendingSummaryDiagnostics, setPendingSummaryDiagnostics] = useState<FCODiagnostics | null>(null);

  // Summary analysis (PCSB) state — the "Analyze" step runs before rewrite.
  const [analyzing, setAnalyzing] = useState(false);
  const [summaryAnalysis, setSummaryAnalysis] = useState<FcoSummaryAnalysis | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // --- Procedure ---
  const [loadingProcedure, setLoadingProcedure] = useState(false);
  const [procedureError, setProcedureError] = useState<string | null>(null);
  const [generatedProcedure, setGeneratedProcedure] = useState<FCOProcedure | null>(null);
  // Diagnostics from the most recent /api/fco/rewrite-procedure response — pending
  // until Accept Procedure promotes it to acceptedProcedureDiagnostics.
  const [pendingProcedureDiagnostics, setPendingProcedureDiagnostics] = useState<FCODiagnostics | null>(null);

  // Grounding provenance + deterministic corrections from the most recent
  // rewrite (summary or procedure), surfaced in the developer Grounding panel.
  const [lastGrounding, setLastGrounding] = useState<any>(null);
  const [lastDeterministicCorrections, setLastDeterministicCorrections] = useState<any[]>([]);

  // Readiness suggestions for the freshly generated (not yet accepted) procedure.
  // Reviewed inline; accepted ones are baked into the procedure on accept.
  const [readinessSuggestions, setReadinessSuggestions] = useState<ProcedureReadinessSuggestion[]>([]);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [readinessChecked, setReadinessChecked] = useState(false);

  // --- Stale-response guards (one per async section) ---
  // Refs, not state: the async resolvers must compare against the LATEST
  // revision, so a stale closure over a state value would defeat the guard.
  // summaryGuard covers analyze + rewrite summary (sequential, never concurrent);
  // procedureGuard covers the procedure rewrite; readinessGuard covers the
  // readiness fetch that a successful rewrite chains into (separate guard so it
  // doesn't steal loading-ownership from the rewrite it follows).
  const summaryGuard = useRef(createGuard());
  const procedureGuard = useRef(createGuard());
  const readinessGuard = useRef(createGuard());
  // "Inputs changed while a request was in flight" — drives the subtle inline
  // "rewrite to refresh" hint. Set only when an invalidating edit lands on top of
  // a genuinely in-flight request; cleared when a new request starts or applies.
  const [summaryInputsChanged, setSummaryInputsChanged] = useState(false);
  const [procedureInputsChanged, setProcedureInputsChanged] = useState(false);

  // --- Declared parts (engineer-provided authoritative parts list) ---
  const declaredParts: FCOPartInvolved[] = formData.fcoDraft?.technicalContent.declaredParts || [];
  const updateDeclaredParts = (parts: FCOPartInvolved[]) => {
    handleDraftChange('technicalContent', 'declaredParts', parts);
  };
  const addDeclaredPart = () => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    updateDeclaredParts([...declaredParts, { id, name: '', identifier: '', role: 'installed', relatedTo: [] }]);
  };
  const updateDeclaredPart = (idx: number, field: 'name' | 'identifier' | 'role', value: string) => {
    const next = declaredParts.map((p, i) => i === idx ? { ...p, [field]: value } : p);
    updateDeclaredParts(next);
  };
  const removeDeclaredPart = (idx: number) => {
    updateDeclaredParts(declaredParts.filter((_, i) => i !== idx));
  };

  // Stale-state invalidation contract: raw Summary / Priority changes invalidate
  // Summary analysis + pending/accepted Summary + its diagnostics, and (since
  // they also clear acceptedSummary) cascade into invalidating Procedure too —
  // Procedure's accepted content was generated using that accepted Summary as
  // prompt context. Raw Procedure / Parts & Components changes invalidate
  // pending/accepted Procedure + readiness + its diagnostics. The
  // manually-entered Title is never auto-cleared by any of this — only the
  // pending (unaccepted) title suggestions are.
  function handleDraftChange(section: keyof NonNullable<FCORequestData['fcoDraft']>, field: string, value: any) {
    const invalidatesSummary =
      (section === 'technicalContent' && field === 'draftSummary') ||
      (section === 'fcoMetadata' && field === 'priority');
    // Anything that clears/replaces acceptedSummary — directly (Accept Summary,
    // Edit/Redraft) or as a side effect (editing raw Summary or Priority also
    // clears it via invalidatesSummary above) — invalidates Procedure. This is
    // a UI-state consistency rule, distinct from (and does not affect) Priority
    // never being sent to or influencing the Procedure rewrite prompt itself.
    const invalidatesProcedureFromAcceptedSummaryChange =
      invalidatesSummary || (section === 'technicalContent' && field === 'acceptedSummary');
    const invalidatesProcedure =
      (section === 'technicalContent' && field === 'draftProcedure') ||
      (section === 'technicalContent' && field === 'declaredParts') ||
      invalidatesProcedureFromAcceptedSummaryChange;

    if (invalidatesSummary) {
      // If a Summary request is genuinely in flight, its result is about to be
      // dropped by the guard below — surface the "inputs changed" hint.
      if (isInFlight(summaryGuard.current)) setSummaryInputsChanged(true);
      bump(summaryGuard.current);
      setSummaryAnalysis(null);
      setShowAnalysisModal(false);
      setGeneratedSummary(null);
      setPendingSummaryDiagnostics(null);
      setSummaryError(null);
      setTitleSuggestions([]);
      setSelectedTitleSuggestion('');
    }
    if (invalidatesProcedure) {
      if (isInFlight(procedureGuard.current) || isInFlight(readinessGuard.current)) {
        setProcedureInputsChanged(true);
      }
      bump(procedureGuard.current);
      bump(readinessGuard.current);
      setGeneratedProcedure(null);
      setReadinessSuggestions([]);
      setReadinessChecked(false);
      setPendingProcedureDiagnostics(null);
      setProcedureError(null);
    }

    setFormData(prev => {
      const draft = prev.fcoDraft ? { ...prev.fcoDraft } : {
        fcoMetadata: { baseProductCode: '', fcoNumber: '', fcoTitle: '', priority: '', appliesTo: '', effectiveDate: '', productionStart: '', application: '', affectedEquipmentModel: '' },
        associatedInfo: { associatedRFI: '', supersededFCOs: '', associatedFCOs: '', associatedCOCAs: '', associatedTechAlerts: '', qCheckServiceLevel: '', codingChanges: '', capitalize: '', commentsByOperations: '' },
        costSchedule: { estimatedFcoCostUsd: '', estimatedSpecialEquipmentCostUsd: '', estimatedTimeHours: '', dueDate: '' },
        additionalFcoInfo: { maintenanceProcedureChanges: '', markingInformation: '' },
        approvalRoles: { designEngineer: '', inTouchEngineer: '', fieldDecisionMaker: '' },
        technicalContent: { draftSummary: '', draftProcedure: '', knownSafetyRisks: '', existingReferences: '', optionalRewriteInstructions: '' },
        fcoTables: {
          fcoHistory: { status: 'active', rows: [] },
          partsOrKitsRequired: { status: 'active', rows: [] },
          specialEquipmentRequired: { status: 'active', rows: [] },
          partsRequiringRework: { status: 'active', rows: [] },
          partsToScrap: { status: 'active', rows: [] }
        }
      } as NonNullable<FCORequestData['fcoDraft']>;

      draft[section] = { ...draft[section], [field]: value } as any;

      // Cascade-clear accepted state + diagnostics that depended on whatever
      // just changed, atomically with the field being set.
      if (invalidatesSummary) {
        draft.technicalContent = {
          ...draft.technicalContent,
          acceptedSummary: undefined,
          acceptedSummaryDiagnostics: undefined
        };
      }
      if (invalidatesProcedure) {
        draft.technicalContent = {
          ...draft.technicalContent,
          acceptedProcedure: undefined,
          acceptedProcedureDiagnostics: undefined,
          procedureReadinessSuggestions: [],
          // Checks reference ids stamped onto this one accepted procedure
          // snapshot (parts/stepGroups) — they cannot outlive it.
          checks: []
        };
      }

      const legacySync: Partial<FCORequestData> = {};
      if (section === 'fcoMetadata' && field === 'fcoTitle') legacySync.title = value;
      if (section === 'fcoMetadata' && field === 'priority') legacySync.priority = value;
      if (section === 'fcoMetadata' && field === 'affectedEquipmentModel') legacySync.affectedEquipment = value;
      if (section === 'fcoMetadata' && field === 'appliesTo') legacySync.appliesTo = value;
      if (section === 'technicalContent' && field === 'knownSafetyRisks') legacySync.knownSafetyRisks = value;
      if (section === 'technicalContent' && field === 'optionalRewriteInstructions') legacySync.customDirectives = value;
      if (section === 'technicalContent' && field === 'draftSummary') legacySync.rawSummary = value;
      if (section === 'technicalContent' && field === 'draftProcedure') legacySync.rawProcedure = value;

      return { ...prev, ...legacySync, fcoDraft: draft };
    });
  }

  const handleSuggestTitle = async (summaryOverride?: string) => {
    setIsSuggestingTitle(true);
    try {
      const payload = {
        draftSummary: summaryOverride || formData.fcoDraft?.technicalContent?.acceptedSummary || formData.fcoDraft?.technicalContent.draftSummary || formData.rawSummary || '',
        draftProcedure: formData.fcoDraft?.technicalContent?.acceptedProcedure ? JSON.stringify(formData.fcoDraft.technicalContent.acceptedProcedure) : (formData.fcoDraft?.technicalContent.draftProcedure || formData.rawProcedure || ''),
        baseProductCode: formData.fcoDraft?.fcoMetadata.baseProductCode || '',
        fcoNumber: formData.fcoDraft?.fcoMetadata.fcoNumber || '',
        affectedEquipmentModel: formData.fcoDraft?.fcoMetadata.affectedEquipmentModel || formData.affectedEquipment || '',
        appliesTo: formData.fcoDraft?.fcoMetadata.appliesTo || formData.appliesTo || '',
        priority: formData.fcoDraft?.fcoMetadata.priority || formData.priority || ''
      };

      const res = await fetch('/api/fco/suggest-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseJsonResponse(res);

      if (data.suggestions && data.suggestions.length > 0) {
        setTitleSuggestions(data.suggestions);
        setSelectedTitleSuggestion(data.suggestions[0]);
      }
    } catch (error) {
      console.error(error);
      alert('Could not generate title suggestions. Please try again.');
    } finally {
      setIsSuggestingTitle(false);
    }
  };

  const handleAnalyzeSummary = async () => {
     setAnalyzing(true);
     setSummaryError(null);
     setSummaryInputsChanged(false);
     const { id, signal } = begin(summaryGuard.current);
     try {
       const res = await fetch('/api/fco/analyze-summary', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(formData),
         signal
       });
       if (!isCurrent(summaryGuard.current, id)) return; // superseded/invalidated — drop
       // parseJsonResponse guards Content-Type so an HTML error page / proxy
       // redirect surfaces a clear message instead of an opaque JSON.parse crash.
       const data: FcoSummaryAnalysis = await parseJsonResponse(res);
       if (!isCurrent(summaryGuard.current, id)) return; // re-check after await
       setSummaryAnalysis(data);
       setShowAnalysisModal(true);
       settle(summaryGuard.current, id);
     } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (!isCurrent(summaryGuard.current, id)) return;
        setSummaryError(err.message || 'Error analyzing summary');
        settle(summaryGuard.current, id);
     } finally {
        if (ownsLoading(summaryGuard.current, id)) setAnalyzing(false);
     }
  };

  // Rewrites the raw summary. When called from the analysis modal, the
  // reviewer-confirmed PCSB components are sent as the typed `confirmedPCSB`
  // request field (not folded into customDirectives prose) — the backend
  // treats them as authoritative grounding per component.
  const handleRewriteSummary = async (confirmedPCSB?: { problem: string; cause: string; solution: string; benefit: string }) => {
     setLoadingSummary(true);
     setSummaryError(null);
     setSummaryInputsChanged(false);
     const { id, signal } = begin(summaryGuard.current);
     try {
       const body: FCORequestData = confirmedPCSB ? { ...formData, confirmedPCSB } : formData;
       const res = await fetch('/api/fco/rewrite-summary', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(body),
         signal
       });
       if (!isCurrent(summaryGuard.current, id)) return; // superseded/invalidated — drop
       const data = await parseJsonResponse(res);
       if (!isCurrent(summaryGuard.current, id)) return; // re-check after await
       if (data.rewrittenSummary) {
           setGeneratedSummary(data.rewrittenSummary);
           setPendingSummaryDiagnostics(data.diagnostics || null);
           if (data.grounding) setLastGrounding(data.grounding);
           setLastDeterministicCorrections(data.deterministicCorrections || []);
           setShowAnalysisModal(false);
           settle(summaryGuard.current, id);
       } else {
           throw new Error("No summary returned.");
       }
     } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (!isCurrent(summaryGuard.current, id)) return;
        setSummaryError(err.message || 'Error generating summary');
        settle(summaryGuard.current, id);
     } finally {
        if (ownsLoading(summaryGuard.current, id)) setLoadingSummary(false);
     }
  };

  const handleAcceptSummary = () => {
      if (generatedSummary) {
          // acceptedSummary is a plain string (the paragraph) downstream.
          const paragraph = generatedSummary.paragraph || '';
          handleDraftChange('technicalContent', 'acceptedSummary', paragraph);
          // Promote the pending rewrite's diagnostics to accepted-output
          // diagnostics — this field is not an invalidation trigger, so it
          // doesn't re-run the cascade set by the acceptedSummary write above.
          handleDraftChange('technicalContent', 'acceptedSummaryDiagnostics', pendingSummaryDiagnostics || undefined);
          setGeneratedSummary(null);
          setPendingSummaryDiagnostics(null);
          setSummaryInputsChanged(false);
          // Auto-suggest a title right after acceptance when none exists yet,
          // using the just-accepted paragraph (state update hasn't landed yet).
          if (!(formData.fcoDraft?.fcoMetadata.fcoTitle || formData.title) && !isSuggestingTitle) {
              handleSuggestTitle(paragraph);
          }
      }
  };

  const fetchReadinessSuggestions = async (procedure: FCOProcedure) => {
     setLoadingReadiness(true);
     setReadinessChecked(false);
     const { id, signal } = begin(readinessGuard.current);
     try {
       const res = await fetch('/api/fco/procedure-readiness', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ fcoDraft: formData.fcoDraft, rewrittenProcedure: procedure }),
         signal
       });
       if (!isCurrent(readinessGuard.current, id)) return; // procedure changed under us — drop
       const data = await parseJsonResponse(res); // throws on non-JSON/!ok → swallowed below
       if (!isCurrent(readinessGuard.current, id)) return; // re-check after await
       setReadinessSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
       setReadinessChecked(true);
       settle(readinessGuard.current, id);
     } catch {
       // Readiness is advisory; a failure should never block the drafting flow.
       settle(readinessGuard.current, id);
     } finally {
       if (ownsLoading(readinessGuard.current, id)) setLoadingReadiness(false);
     }
  };

  const handleRewriteProcedure = async () => {
     setLoadingProcedure(true);
     setProcedureError(null);
     setProcedureInputsChanged(false);
     setReadinessSuggestions([]);
     setReadinessChecked(false);
     const { id, signal } = begin(procedureGuard.current);
     try {
       // The backend reads acceptedSummary from the top level of the payload,
       // so lift it out of fcoDraft to give the rewrite summary context.
       const res = await fetch('/api/fco/rewrite-procedure', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           ...formData,
           acceptedSummary: formData.fcoDraft?.technicalContent?.acceptedSummary || ''
         }),
         signal
       });
       if (!isCurrent(procedureGuard.current, id)) return; // superseded/invalidated — drop
       const data = await parseJsonResponse(res);
       if (!isCurrent(procedureGuard.current, id)) return; // re-check after await
       if (data.rewrittenProcedure) {
           setGeneratedProcedure(data.rewrittenProcedure);
           setPendingProcedureDiagnostics(data.diagnostics || null);
           if (data.grounding) setLastGrounding(data.grounding);
           setLastDeterministicCorrections(data.deterministicCorrections || []);
           settle(procedureGuard.current, id);
           // Run the readiness check on the generated draft so gaps are
           // reviewed BEFORE the user accepts the procedure. (Uses its own guard
           // so it doesn't steal loading-ownership from this rewrite.)
           fetchReadinessSuggestions(data.rewrittenProcedure);
       } else {
           throw new Error("No procedure returned.");
       }
     } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (!isCurrent(procedureGuard.current, id)) return;
        setProcedureError(err.message || 'Error generating procedure');
        settle(procedureGuard.current, id);
     } finally {
        if (ownsLoading(procedureGuard.current, id)) setLoadingProcedure(false);
     }
  };

  const handleAcceptProcedure = () => {
      if (!generatedProcedure) return;
      // Stamp stable ids onto parts/stepGroups before this snapshot becomes
      // canonical — accept time is the one point a procedure's identity can
      // be fixed (see stampProcedureIdentity's doc comment).
      const stamped = stampProcedureIdentity(generatedProcedure, declaredParts);
      // Turn accepted/edited readiness suggestions into structured checks —
      // exactly once, here — preserving category/reason/id/source instead of
      // flattening them into anonymous procedure steps. The accepted state,
      // final review, and the DOCX export all read this same acceptedProcedure
      // + checks directly with no further merge, so a suggestion can never be
      // double-applied downstream.
      const existingChecks = formData.fcoDraft?.technicalContent?.checks || [];
      const mergedChecks = mergeAcceptedChecks(existingChecks, readinessSuggestions, stamped);
      handleDraftChange('technicalContent', 'acceptedProcedure', stamped);
      handleDraftChange('technicalContent', 'checks', mergedChecks);
      handleDraftChange('technicalContent', 'acceptedProcedureDiagnostics', pendingProcedureDiagnostics || undefined);
      handleDraftChange('technicalContent', 'procedureReadinessSuggestions', []);
      setGeneratedProcedure(null);
      setReadinessSuggestions([]);
      setReadinessChecked(false);
      setPendingProcedureDiagnostics(null);
      setProcedureInputsChanged(false);
  };

  // Clears all local pending/advisory state (Summary + Procedure sides) — used
  // when the FCO sample is loaded, Start New Draft, or Clear Preset, so nothing
  // stale carries over from whatever draft was in progress. Bumps every guard so
  // any request still in flight against the old draft is aborted and dropped.
  const resetPendingDraftingState = () => {
    bump(summaryGuard.current);
    bump(procedureGuard.current);
    bump(readinessGuard.current);
    setGeneratedSummary(null);
    setPendingSummaryDiagnostics(null);
    setGeneratedProcedure(null);
    setPendingProcedureDiagnostics(null);
    setLastGrounding(null);
    setLastDeterministicCorrections([]);
    setReadinessSuggestions([]);
    setReadinessChecked(false);
    setSummaryAnalysis(null);
    setShowAnalysisModal(false);
    setSummaryError(null);
    setProcedureError(null);
    setTitleSuggestions([]);
    setSelectedTitleSuggestion('');
    setSummaryInputsChanged(false);
    setProcedureInputsChanged(false);
  };

  return {
    // Title
    isSuggestingTitle, titleSuggestions, setTitleSuggestions, selectedTitleSuggestion, setSelectedTitleSuggestion,
    handleSuggestTitle,
    // Summary
    loadingSummary, summaryError, generatedSummary, setGeneratedSummary,
    analyzing, summaryAnalysis, showAnalysisModal, setShowAnalysisModal,
    handleAnalyzeSummary, handleRewriteSummary, handleAcceptSummary,
    summaryInputsChanged, pendingSummaryDiagnostics,
    // Procedure
    loadingProcedure, procedureError, generatedProcedure, setGeneratedProcedure,
    readinessSuggestions, setReadinessSuggestions, loadingReadiness, readinessChecked,
    handleRewriteProcedure, handleAcceptProcedure,
    procedureInputsChanged, pendingProcedureDiagnostics,
    // Parts
    declaredParts, addDeclaredPart, updateDeclaredPart, removeDeclaredPart,
    // Grounding / deterministic corrections from the most recent rewrite
    lastGrounding, lastDeterministicCorrections,
    // Shared
    handleDraftChange, resetPendingDraftingState
  };
}

export type FcoDraftingState = ReturnType<typeof useFcoDraftingState>;
