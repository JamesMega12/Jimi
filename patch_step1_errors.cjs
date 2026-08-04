const fs = require('fs');
let code = fs.readFileSync('src/components/Step1Context.tsx', 'utf8');

// Import buildDisplayProcedure
const importRegex = /import RewrittenDraft from '.\/RewrittenDraft';\nimport ProcedureReadinessPanel from '.\/ProcedureReadinessPanel';/;
const newImport = `import RewrittenDraft from './RewrittenDraft';
import ProcedureReadinessPanel from './ProcedureReadinessPanel';
import { buildDisplayProcedure } from '../utils/procedureMerge';`;
code = code.replace(importRegex, newImport);

// Replace RewrittenDraft and ProcedureReadinessPanel rendering
const renderRegex = /<RewrittenDraft[\s\S]*?onUpdateFormData=\{setFormData\}\n\s*\/>\n\s*\{apiResponse\.diagnostics\?\.procedureReadinessSuggestions && \([\s\S]*?\}\)\}/;

const newRender = `{(() => {
              const rewrittenSummary = typeof apiResponse.response.fcoDraft.summary === 'string' 
                ? apiResponse.response.fcoDraft.summary 
                : apiResponse.response.fcoDraft.summary?.paragraph || '';
              
              const mergedProcedure = buildDisplayProcedure(
                formData.rawProcedure,
                apiResponse.response.fcoDraft.procedure || [],
                formData.fcoDraft?.technicalContent?.procedureCallouts || []
              );

              return (
                <RewrittenDraft 
                  summary={rewrittenSummary} 
                  procedure={mergedProcedure} 
                  apiResponse={apiResponse} 
                  procedureCallouts={formData.fcoDraft?.technicalContent?.procedureCallouts}
                />
              );
            })()}
            
            {formData.fcoDraft?.technicalContent?.procedureReadinessSuggestions && formData.fcoDraft.technicalContent.procedureReadinessSuggestions.length > 0 && (
              <ProcedureReadinessPanel 
                suggestions={formData.fcoDraft.technicalContent.procedureReadinessSuggestions}
                developerMode={developerMode}
                onUpdateSuggestions={(suggestions) => {
                  setFormData({
                    ...formData,
                    fcoDraft: {
                      ...formData.fcoDraft!,
                      technicalContent: {
                        ...formData.fcoDraft!.technicalContent,
                        procedureReadinessSuggestions: suggestions
                      }
                    }
                  });
                }}
              />
            )}`;

code = code.replace(renderRegex, newRender);

fs.writeFileSync('src/components/Step1Context.tsx', code);
