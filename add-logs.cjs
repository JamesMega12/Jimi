const fs = require('fs');

let file = 'src/components/technical-alert/v2/TechnicalAlertWorkflowV2.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Log workspace unmount and remount
content = content.replace(
  /React\.useEffect\(\(\) => \{\n    console\.log\('\[DEBUG\] TechnicalAlertWorkflowV2 MOUNTED. Title:', administrativeMetadata\.documentNumber, 'DraftGen:', draftGeneration\);\n    return \(\) => console\.log\('\[DEBUG\] TechnicalAlertWorkflowV2 UNMOUNTED'\);\n  \}, \[\]\);/,
  `React.useEffect(() => {
    console.log('[DEBUG] TechnicalAlertWorkflowV2 MOUNTED. Title:', administrativeMetadata.documentNumber, 'DraftGen:', draftGeneration);
    return () => console.log('[DEBUG] TechnicalAlertWorkflowV2 UNMOUNTED');
  }, [draftGeneration]);`
);

// 2. persistence/autosave writes
content = content.replace(
  /console\.log\('\[DEBUG\] Auto-saving state\. Title:', administrativeMetadata\.documentNumber, 'Stage:', stage, 'DraftGen:', draftGeneration\);/,
  `console.log('[DEBUG] Auto-saving state. Title:', administrativeMetadata.documentNumber, 'Stage:', stage, 'DraftGen:', draftGeneration, 'Summary len:', sections.summary.raw.length, 'V2 exists:', !!window.localStorage.getItem('ta_workflow_state_v2'));`
);

// 3. Clear handler
content = content.replace(
  /const handleClearDraft = \(\) => \{[\s\S]*?console\.log\('\[DEBUG\] After React state reset'\);\n  \};/,
  `const clearDraft = () => {
    console.log('[DEBUG] clear handler entry. DraftGen:', draftGeneration, 'Title:', administrativeMetadata.title, 'Stage:', stage);
    setShowClearConfirm(false);
    console.log('[DEBUG] confirmation result: true');
    console.log('[DEBUG] Before localStorage removal. V1:', !!window.localStorage.getItem('ta_workflow_state_v1'), 'V2:', !!window.localStorage.getItem('ta_workflow_state_v2'));
    clearPersistedTechnicalAlertStateV2();
    console.log('[DEBUG] After localStorage removal. V1:', !!window.localStorage.getItem('ta_workflow_state_v1'), 'V2:', !!window.localStorage.getItem('ta_workflow_state_v2'));
    console.log('[DEBUG] Before React state reset');
    
    setAdministrativeMetadata(initialAdministrativeMetadata);
    setControlInformationState(initialControlInformation);
    setSupportingContent(initialSupportingContent);
    setSections(createInitialSections());
    setStage('drafting');
    setMigrationFindings(null);
    setExportError(null);
    resetAccordion();
    setDraftGeneration(g => g + 1);
    console.log('[DEBUG] After React state reset');
  };`
);

// 4. Fix button
content = content.replace(
  /onClick=\{handleClearDraft\}/g,
  `onClick={clearDraft}`
);

content = content.replace(
  /onClick=\{\(\) => setShowClearConfirm\(true\)\}/,
  `onClick={() => { console.log('[DEBUG] button click (Clear Draft)'); setShowClearConfirm(true); }}`
);

fs.writeFileSync(file, content);
