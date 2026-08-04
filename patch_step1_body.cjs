const fs = require('fs');
let code = fs.readFileSync('src/components/Step1Context.tsx', 'utf8');

const injectionPointRegex = /(<\/div>\s*)(<\/div>\s*)(<\/div>\s*)(<div className="flex justify-end pt-4">)/;

const injection = `
        {/* AI REVIEW STUDIO & RESULTS */}
        <div className="mt-10 border-t border-slate-200 pt-8">
          <AiReviewStudio 
            formData={formData}
            setFormData={setFormData}
            inputMode={inputMode}
            docxAnalysis={docxAnalysis}
            onBack={() => {}} 
            onSubmit={() => onSubmit && onSubmit()}
            developerMode={developerMode}
          />
        </div>
        
        {loading && (
          <div className="mt-8 p-12 bg-white rounded-2xl border border-indigo-100 shadow-sm flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <p className="text-indigo-900 font-bold">{loadingMessage || 'Processing...'}</p>
          </div>
        )}
        
        {error && (
          <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-xl text-red-800">
            <div className="flex gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-red-900 mb-2">Rewrite Failed</h3>
                <pre className="text-sm font-mono whitespace-pre-wrap">{error}</pre>
              </div>
            </div>
          </div>
        )}

        {apiResponse && !loading && (
          <div className="mt-8 space-y-8">
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-emerald-900">Rewrite Complete</h3>
                  <p className="text-emerald-700 text-sm">Review the updated Draft Summary and Procedure below.</p>
                </div>
              </div>
            </div>
            
            <RewrittenDraft 
              apiResponse={apiResponse} 
              rawProcedureText={formData.rawProcedure}
              developerMode={developerMode}
              inputMode={inputMode}
              formData={formData}
              onUpdateFormData={setFormData}
            />
            
            {apiResponse.diagnostics?.procedureReadinessSuggestions && (
              <ProcedureReadinessPanel 
                suggestions={apiResponse.diagnostics.procedureReadinessSuggestions} 
                developerMode={developerMode} 
              />
            )}
          </div>
        )}
        
$1$2$3$4`;

code = code.replace(injectionPointRegex, injection);

// Also change "Next: Technical Content" to "Next: Advanced Metadata"
code = code.replace(/Next: Technical Content/, 'Next: Advanced Metadata');

fs.writeFileSync('src/components/Step1Context.tsx', code);
