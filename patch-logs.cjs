const fs = require('fs');
const file = 'src/components/technical-alert/v2/TechnicalAlertWorkflowV2.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add logs in clearDraft
content = content.replace('const clearDraft = () => {', `const clearDraft = () => {
    console.log('[DEBUG] clearDraft clicked');
    if (typeof window !== 'undefined' && !window.confirm('This will permanently clear the current Technical Alert draft. Continue?')) {
      console.log('[DEBUG] clearDraft cancelled');
      return;
    }
    console.log('[DEBUG] clearDraft confirmed');
    console.log('[DEBUG] Before clearPersistedTechnicalAlertStateV2');
`);

content = content.replace('clearPersistedTechnicalAlertStateV2();', `clearPersistedTechnicalAlertStateV2();
    console.log('[DEBUG] After clearPersistedTechnicalAlertStateV2. V1:', !!window.localStorage.getItem('ta_workflow_state_v1'), 'V2:', !!window.localStorage.getItem('ta_workflow_state_v2'));
    console.log('[DEBUG] Before React state reset');
`);

content = content.replace('setDraftGeneration(g => g + 1);', `setDraftGeneration(g => g + 1);
    console.log('[DEBUG] After React state reset');
`);

// 2. Add logs to the auto-save effect
content = content.replace('saveTechnicalAlertStateV2({ administrativeMetadata, controlInformation, supportingContent, sections, stage });', `console.log('[DEBUG] Auto-saving state. Title:', administrativeMetadata.documentNumber, 'Stage:', stage, 'DraftGen:', draftGeneration);
    saveTechnicalAlertStateV2({ administrativeMetadata, controlInformation, supportingContent, sections, stage });`);

// 3. Add logs for component unmount and remount.
content = content.replace('const stageIndex = STAGES.findIndex(s => s.id === stage);', `const stageIndex = STAGES.findIndex(s => s.id === stage);
  
  React.useEffect(() => {
    console.log('[DEBUG] TechnicalAlertWorkflowV2 MOUNTED. Title:', administrativeMetadata.documentNumber, 'DraftGen:', draftGeneration);
    return () => console.log('[DEBUG] TechnicalAlertWorkflowV2 UNMOUNTED');
  }, []);
`);

fs.writeFileSync(file, content);
