const fs = require('fs');
let code = fs.readFileSync('src/components/technical-alert/v2/TechnicalAlertWorkflowV2.tsx', 'utf8');

const effectBlock = `  React.useEffect(() => {
    console.log('[DEBUG] TechnicalAlertWorkflowV2 MOUNTED. Title:', administrativeMetadata.documentNumber, 'DraftGen:', draftGeneration);
    return () => console.log('[DEBUG] TechnicalAlertWorkflowV2 UNMOUNTED');
  }, [draftGeneration]);`;

code = code.replace(effectBlock, '');
code = code.replace(
  '  const [showClearConfirm, setShowClearConfirm] = useState(false);',
  '  const [showClearConfirm, setShowClearConfirm] = useState(false);\n' + effectBlock
);

fs.writeFileSync('src/components/technical-alert/v2/TechnicalAlertWorkflowV2.tsx', code);
