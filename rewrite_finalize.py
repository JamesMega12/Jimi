import re

content = open('src/components/techcom/TechComStepRewriteFinalize.tsx').read()

imports = """import { ChevronDown, ChevronUp } from 'lucide-react';"""
new_imports = """import { ChevronDown, ChevronUp, CheckCircle, ArrowRight } from 'lucide-react';"""
content = content.replace(imports, new_imports)

init_state = """  const [showRawJson, setShowRawJson] = useState(false);"""
new_init_state = """  const [showRawJson, setShowRawJson] = useState(false);
  const [acceptedSections, setAcceptedSections] = useState<Record<string, boolean>>({});"""
content = content.replace(init_state, new_init_state)

old_logic = """  const handleAcceptSummary = () => {
    if (suggestion.summarySuggestion) {
      setDraft(prev => ({ ...prev, summary: suggestion.summarySuggestion! }));
      updateUiState({
        pendingSuggestion: { ...suggestion, summarySuggestion: undefined }
      });
    }
  };

  const handleAcceptReason = () => {
    if (suggestion.reasonSuggestion) {
      setDraft(prev => ({ ...prev, reasonOrBackground: suggestion.reasonSuggestion! }));
      updateUiState({
        pendingSuggestion: { ...suggestion, reasonSuggestion: undefined }
      });
    }
  };

  const handleAcceptAction = () => {
    if (suggestion.actionSuggestion) {
      setDraft(prev => ({ ...prev, actions: suggestion.actionSuggestion! }));
      updateUiState({
        pendingSuggestion: { ...suggestion, actionSuggestion: undefined }
      });
    }
  };

  const handleAcceptAll = () => {
    if (suggestion.summarySuggestion) {
      setDraft(prev => ({ ...prev, summary: suggestion.summarySuggestion! }));
    }
    if (suggestion.reasonSuggestion) {
      setDraft(prev => ({ ...prev, reasonOrBackground: suggestion.reasonSuggestion! }));
    }
    if (suggestion.actionSuggestion) {
      setDraft(prev => ({ ...prev, actions: suggestion.actionSuggestion! }));
    }
    updateUiState({ rewriteAccepted: true, pendingSuggestion: null, currentStep: "previewExport" });
  };

  const handleDismiss = () => {
    updateUiState({ pendingSuggestion: null, currentStep: "draftAnalyze" });
  };

  const handleAcceptSection = (section: string) => {
    if (section === 'summary') handleAcceptSummary();
    if (section === 'reason') handleAcceptReason();
    if (section === 'action') handleAcceptAction();
    
    // Check if there are any other suggestions left
    const remainingSuggestions = { ...suggestion };
    if (section === 'summary') delete remainingSuggestions.summarySuggestion;
    if (section === 'reason') delete remainingSuggestions.reasonSuggestion;
    if (section === 'action') delete remainingSuggestions.actionSuggestion;

    const hasMore = !!remainingSuggestions.summarySuggestion || !!remainingSuggestions.reasonSuggestion || !!remainingSuggestions.actionSuggestion;

    if (target !== 'all' || !hasMore) {
      updateUiState({ rewriteAccepted: true, pendingSuggestion: null, currentStep: "previewExport" });
    }
  };"""

new_logic = """  const handleAcceptSummary = () => {
    if (suggestion.summarySuggestion) {
      setDraft(prev => ({ ...prev, summary: suggestion.summarySuggestion! }));
      setAcceptedSections(prev => ({ ...prev, summary: true }));
      updateUiState({ rewriteAccepted: true });
    }
  };

  const handleAcceptReason = () => {
    if (suggestion.reasonSuggestion) {
      setDraft(prev => ({ ...prev, reasonOrBackground: suggestion.reasonSuggestion! }));
      setAcceptedSections(prev => ({ ...prev, reason: true }));
      updateUiState({ rewriteAccepted: true });
    }
  };

  const handleAcceptAction = () => {
    if (suggestion.actionSuggestion) {
      setDraft(prev => ({ ...prev, actions: suggestion.actionSuggestion! }));
      setAcceptedSections(prev => ({ ...prev, action: true }));
      updateUiState({ rewriteAccepted: true });
    }
  };

  const handleAcceptAll = () => {
    if (suggestion.summarySuggestion) {
      setDraft(prev => ({ ...prev, summary: suggestion.summarySuggestion! }));
    }
    if (suggestion.reasonSuggestion) {
      setDraft(prev => ({ ...prev, reasonOrBackground: suggestion.reasonSuggestion! }));
    }
    if (suggestion.actionSuggestion) {
      setDraft(prev => ({ ...prev, actions: suggestion.actionSuggestion! }));
    }
    setAcceptedSections({ summary: true, reason: true, action: true });
    updateUiState({ rewriteAccepted: true });
  };

  const handleDismiss = () => {
    updateUiState({ pendingSuggestion: null, currentStep: "draftAnalyze" });
  };

  const handleAcceptSection = (section: string) => {
    if (section === 'summary') handleAcceptSummary();
    if (section === 'reason') handleAcceptReason();
    if (section === 'action') handleAcceptAction();
  };"""

content = content.replace(old_logic, new_logic)

# Replace summary section buttons
old_summary = """            <div className="mt-4 flex gap-2">
              <button onClick={() => handleAcceptSection('summary')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm">Accept Summary</button>
              <button onClick={() => alert('Edit Summary: TODO')} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium text-sm">Edit</button>
            </div>"""

new_summary = """            <div className="mt-4 flex gap-2 items-center">
              {acceptedSections.summary ? (
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium px-4 py-2 bg-emerald-100 rounded-md text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Accepted
                </div>
              ) : (
                <button onClick={() => handleAcceptSection('summary')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors">Accept Summary</button>
              )}
              <button onClick={() => alert('Edit Summary: TODO')} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium text-sm transition-colors">Edit</button>
            </div>"""

content = content.replace(old_summary, new_summary)


# Replace reason section buttons
old_reason = """            <div className="mt-4 flex gap-2">
              <button onClick={() => handleAcceptSection('reason')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm">Accept Reason</button>
              <button onClick={() => alert('Edit Reason: TODO')} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium text-sm">Edit</button>
            </div>"""

new_reason = """            <div className="mt-4 flex gap-2 items-center">
              {acceptedSections.reason ? (
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium px-4 py-2 bg-emerald-100 rounded-md text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Accepted
                </div>
              ) : (
                <button onClick={() => handleAcceptSection('reason')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors">Accept Reason</button>
              )}
              <button onClick={() => alert('Edit Reason: TODO')} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium text-sm transition-colors">Edit</button>
            </div>"""

content = content.replace(old_reason, new_reason)


# Replace action section buttons
old_action = """            <div className="mt-4 flex gap-2">
              <button onClick={() => handleAcceptSection('action')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm">Accept Action</button>
              <button onClick={() => alert('Edit Action: TODO')} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium text-sm">Edit</button>
            </div>"""

new_action = """            <div className="mt-4 flex gap-2 items-center">
              {acceptedSections.action ? (
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium px-4 py-2 bg-emerald-100 rounded-md text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Accepted
                </div>
              ) : (
                <button onClick={() => handleAcceptSection('action')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors">Accept Action</button>
              )}
              <button onClick={() => alert('Edit Action: TODO')} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium text-sm transition-colors">Edit</button>
            </div>"""

content = content.replace(old_action, new_action)


# Replace bottom buttons
old_bottom = """      <div className="flex gap-4 pt-6 border-t border-slate-200 mt-6">
        {target === 'all' && (
          <button onClick={handleAcceptAll} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-colors text-sm">
            Accept All Suggestions
          </button>
        )}
        <button onClick={handleDismiss} className="text-slate-500 hover:bg-slate-100 border border-transparent font-medium py-2 px-6 rounded-md transition-colors text-sm">
          Dismiss {target === 'all' ? 'All' : 'Suggestion'}
        </button>
      </div>"""

new_bottom = """      <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-6">
        <div className="flex gap-4">
          {target === 'all' && (
            <button onClick={handleAcceptAll} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-colors text-sm">
              Accept All Suggestions
            </button>
          )}
          <button onClick={handleDismiss} className="text-slate-500 hover:bg-slate-100 border border-transparent font-medium py-2 px-6 rounded-md transition-colors text-sm">
            Dismiss {target === 'all' ? 'All' : 'Suggestion'}
          </button>
        </div>
        
        {Object.keys(acceptedSections).length > 0 && (
          <button 
            onClick={() => updateUiState({ currentStep: "previewExport" })}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-colors text-sm"
          >
            Continue to Preview & Export
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>"""

content = content.replace(old_bottom, new_bottom)

open('src/components/techcom/TechComStepRewriteFinalize.tsx', 'w').write(content)
