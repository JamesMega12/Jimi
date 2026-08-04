const fs = require('fs');
let code = fs.readFileSync('src/components/Step1Context.tsx', 'utf8');

// Add import
code = code.replace(/import \{ FcoTablesEditor \} from '\.\/FcoTablesEditor';/, "import { FcoTablesEditor } from './FcoTablesEditor';\nimport { AdvancedMetadataPanel } from './AdvancedMetadataPanel';");

// Replace the details block
const regex = /<details className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm group">[\s\S]*?<\/details>/;

const replacement = `<AdvancedMetadataPanel 
          formData={formData} 
          setFormData={setFormData} 
          showValidation={showValidation} 
          effectiveDateError={effectiveDateError} 
          setEffectiveDateError={setEffectiveDateError}
          validateEffectiveDate={validateEffectiveDate}
        />`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/Step1Context.tsx', code);
