const fs = require('fs');
let code = fs.readFileSync('src/components/Step1Context.tsx', 'utf8');

const regex = /<RewrittenDraft[\s\S]*?<\/div>\s*\)\}\s*<\/div>/;

const replacement = `{(() => {
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
            )}
          </div>
        )}
        
      </div>
    </div>
  </div>`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/Step1Context.tsx', code);
