const fs = require('fs');
let code = fs.readFileSync('src/components/AppWorkflow.tsx', 'utf8');

const regex = /<Step1Context[\s\S]*?\/>/;
const replacement = `<Step1Context 
              formData={formData} 
              setFormData={setFormData}
              inputMode={inputMode}
              setInputMode={setInputMode}
              docxAnalysis={docxAnalysis}
              setDocxAnalysis={setDocxAnalysis}
              onNext={handleNextToStep2}
              onAutoRewrite={handleAutoRewriteTrigger}
              onTestPresetAutoRun={handleTestPresetAutoRun}
              developerMode={developerMode}
              onClearPresetData={handleClearPresetData}
              apiResponse={response}
              loading={loading}
              loadingMessage={loadingMessage}
              error={errorStatus}
              onSubmit={handleRewriteSubmit}
            />`;

code = code.replace(regex, replacement);

const regex2 = /<Step2Content[\s\S]*?\/>/;
const replacement2 = `<Step2Content 
              onBack={handleBackToStep1}
              onNext={() => setCurrentStep(3)}
            />`;

code = code.replace(regex2, replacement2);
fs.writeFileSync('src/components/AppWorkflow.tsx', code);
