const fs = require('fs');
let code = fs.readFileSync('src/components/AppWorkflow.tsx', 'utf8');

const regex2 = /<Step2Content[\s\S]*?\/>/;
const replacement2 = `<Step2Content 
              formData={formData}
              setFormData={setFormData}
              onBack={handleBackToStep1}
              onNext={() => setCurrentStep(3)}
            />`;

code = code.replace(regex2, replacement2);
fs.writeFileSync('src/components/AppWorkflow.tsx', code);
