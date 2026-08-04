const fs = require('fs');
let code = fs.readFileSync('src/components/Step1Context.tsx', 'utf8');

// Remove imports
code = code.replace(/import \{ FcoTablesEditor \} from '\.\/FcoTablesEditor';\n/, '');
code = code.replace(/import \{ AdvancedMetadataPanel \} from '\.\/AdvancedMetadataPanel';\n/, '');
code = code.replace(/import \{ VisualPlaceholdersEditor \} from '\.\/VisualPlaceholdersEditor';\n/, '');

// Remove rendering
const renderRegex = /\{\/\* ADVANCED METADATA ACCORDION \*\/\}\s*<AdvancedMetadataPanel[\s\S]*?\/>\s*<FcoTablesEditor formData=\{formData\} setFormData=\{setFormData\} \/>\s*<VisualPlaceholdersEditor formData=\{formData\} setFormData=\{setFormData\} \/>/;

code = code.replace(renderRegex, '');

fs.writeFileSync('src/components/Step1Context.tsx', code);
