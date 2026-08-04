const fs = require('fs');

let content = fs.readFileSync('src/components/Step2Content.tsx', 'utf-8');

// ISSUE 1: handleConfirmProcedure
const oldHandleConfirmProcedure = `const handleConfirmProcedure = (mode: 'accept' | 'keep' | 'edit_save') => {
      let finalProcedure = '';
      if (mode === 'accept') finalProcedure = suggestedSteps || '';
      else if (mode === 'keep') finalProcedure = formData.originalProcedure || formData.rawProcedure;
      else if (mode === 'edit_save') finalProcedure = editedSteps;
      
      setFormData(prev => ({
          ...prev,
          confirmedProcedure: finalProcedure,
          rawProcedure: finalProcedure // Override so the rewrite uses it!
      }));
      setIsProcedureConfirmed(true);
      setEditingProcedure(false);
  };`;

const newHandleConfirmProcedure = `const handleConfirmProcedure = (mode: 'accept' | 'keep' | 'edit_save') => {
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
      
      setIsProcedureConfirmed(true);
      setEditingProcedure(false);
  };`;

content = content.replace(oldHandleConfirmProcedure, newHandleConfirmProcedure);

// ISSUE 2: Summary suggestion missing/weak editability
const oldSummaryCheck = `const hasSuggestion = !!editedSuggestions[field];`;
const newSummaryCheck = `const hasSuggestion = isMissing || isWeak || editedSuggestions[field] !== undefined;`;

content = content.replace(oldSummaryCheck, newSummaryCheck);

// Also update the textarea value to be controlled properly
const oldTextareaValue = `value={editedSuggestions[field]}`;
const newTextareaValue = `value={editedSuggestions[field] || ''}`;

content = content.replace(oldTextareaValue, newTextareaValue);

fs.writeFileSync('src/components/Step2Content.tsx', content);
