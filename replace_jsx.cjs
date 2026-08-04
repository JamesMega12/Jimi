const fs = require('fs');
let code = fs.readFileSync('src/components/Step1Context.tsx', 'utf8');

const startMarker = '<hr className="border-slate-200 mb-8" />';
const endMarker = '<div className="flex justify-end pt-4">';

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found', startIndex, endIndex);
  process.exit(1);
}

const newJsx = `<hr className="border-slate-200 mb-8" />
      
      <div className="space-y-6 mb-8">
        
        {/* START DRAFT */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="p-4 grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">
                Draft Summary
              </label>
              <textarea
                value={formData.fcoDraft?.technicalContent.draftSummary || formData.rawSummary || ''}
                onChange={(e) => handleDraftChange('technicalContent', 'draftSummary', e.target.value)}
                placeholder="What is the problem, cause, solution, and benefit? e.g. The seal leaks during operation. Replace the seal..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">
                Draft Procedure
              </label>
              <textarea
                value={formData.fcoDraft?.technicalContent.draftProcedure || formData.rawProcedure || ''}
                onChange={(e) => handleDraftChange('technicalContent', 'draftProcedure', e.target.value)}
                placeholder="List the steps to fix the issue. e.g. 1. Turn off power. 2. Remove cover..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[200px]"
              />
            </div>

            {/* AI Capability Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
              <div className="flex flex-col items-center text-center p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <ListChecks className="w-5 h-5 text-indigo-600 mb-2" />
                <h4 className="font-bold text-xs text-indigo-900 mb-1">Analyze Summary</h4>
                <p className="text-[10px] text-indigo-700">Check Problem, Cause, Solution, and Benefit completeness.</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <Sparkles className="w-5 h-5 text-indigo-600 mb-2" />
                <h4 className="font-bold text-xs text-indigo-900 mb-1">Improve Procedure</h4>
                <p className="text-[10px] text-indigo-700">Rewrite rough steps into clearer procedure instructions.</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <ScanSearch className="w-5 h-5 text-indigo-600 mb-2" />
                <h4 className="font-bold text-xs text-indigo-900 mb-1">Find Placeholders</h4>
                <p className="text-[10px] text-indigo-700">Detect figure and table placeholders.</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <Lightbulb className="w-5 h-5 text-indigo-600 mb-2" />
                <h4 className="font-bold text-xs text-indigo-900 mb-1">Suggest Missing Details</h4>
                <p className="text-[10px] text-indigo-700">Highlight information that may need review.</p>
              </div>
            </div>
          </div>
        </div>

        {/* MINIMUM FCO IDENTITY */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-800 text-sm">Minimum FCO Identity</div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Base Product Code</label>
              <input
                type="text"
                value={formData.fcoDraft?.fcoMetadata.baseProductCode || ''}
                onChange={(e) => handleDraftChange('fcoMetadata', 'baseProductCode', e.target.value)}
                placeholder="e.g. AUTOPROFILER"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">FCO Number</label>
              <input
                type="text"
                value={formData.fcoDraft?.fcoMetadata.fcoNumber || ''}
                onChange={(e) => handleDraftChange('fcoMetadata', 'fcoNumber', e.target.value)}
                placeholder="e.g. 8299443"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.fcoDraft?.fcoMetadata.priority || formData.priority || ''}
                onChange={(e) => handleDraftChange('fcoMetadata', 'priority', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="" disabled>Select priority...</option>
                <option value="Urgent">Urgent</option>
                <option value="Required">Required</option>
                <option value="Preferred">Preferred</option>
              </select>
              {showValidation && !(formData.fcoDraft?.fcoMetadata.priority || formData.priority) && <p className="text-xs text-red-600 mt-1">Priority is required.</p>}
            </div>
            
            <div className="md:col-span-3">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">
                FCO Title <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.fcoDraft?.fcoMetadata.fcoTitle || formData.title || ''}
                  onChange={(e) => handleDraftChange('fcoMetadata', 'fcoTitle', e.target.value)}
                  placeholder="e.g. SLB-400 O-ring Upgrade"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 text-xs font-bold bg-indigo-50 text-indigo-300 border border-indigo-100 rounded-lg cursor-not-allowed whitespace-nowrap"
                  title="Title suggestion is coming soon"
                >
                  Suggest Title
                </button>
              </div>
              {showValidation && !(formData.fcoDraft?.fcoMetadata.fcoTitle || formData.title) && <p className="text-xs text-red-600 mt-1">FCO Title is required.</p>}
              {titleWarning && <p className="text-xs text-amber-600 mt-1">Warning: FCO Title is over 15 words.</p>}
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">
                Affected Equipment / Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.fcoDraft?.fcoMetadata.affectedEquipmentModel || formData.affectedEquipment || ''}
                onChange={(e) => handleDraftChange('fcoMetadata', 'affectedEquipmentModel', e.target.value)}
                placeholder="e.g. SLB-400 Separator Skid"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {showValidation && !(formData.fcoDraft?.fcoMetadata.affectedEquipmentModel || formData.affectedEquipment) && <p className="text-xs text-red-600 mt-1">Equipment / Model is required.</p>}
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Applies To</label>
              <textarea
                value={formData.fcoDraft?.fcoMetadata.appliesTo || formData.appliesTo || ''}
                onChange={(e) => handleDraftChange('fcoMetadata', 'appliesTo', e.target.value)}
                placeholder="<< Example: Asset type/code, example: All Batch Mixers, CPF-xxx >>"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[42px]"
              />
              {showValidation && !(formData.fcoDraft?.fcoMetadata.appliesTo || formData.appliesTo) && <p className="text-xs text-amber-600 mt-1">Applies To is recommended for clearer FCO applicability.</p>}
            </div>
          </div>
        </div>

        {/* ADVANCED METADATA ACCORDION */}
        <details className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm group">
          <summary className="bg-slate-50 px-4 py-3 font-bold text-slate-800 text-sm cursor-pointer hover:bg-slate-100 flex items-center justify-between list-none">
            Advanced Metadata
            <ChevronDown className="w-4 h-4 text-slate-500 group-open:hidden" />
            <ChevronUp className="w-4 h-4 text-slate-500 hidden group-open:block" />
          </summary>
          <div className="p-4 space-y-6 border-t border-slate-200">
            
            {/* From Core FCO Context */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans uppercase">
                  Effective Date
                </label>
                <input
                  type="text"
                  value={formData.fcoDraft?.fcoMetadata.effectiveDate || formData.effectiveDate || ''}
                  onChange={(e) => {
                    handleDraftChange('fcoMetadata', 'effectiveDate', e.target.value);
                    if (showValidation) {
                      setEffectiveDateError(validateEffectiveDate(e.target.value));
                    }
                  }}
                  placeholder="DD-MM-YYYY"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {showValidation && effectiveDateError && <p className="text-xs text-red-600 mt-1">{effectiveDateError}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans uppercase">
                  Production Start
                </label>
                <input
                  type="text"
                  value={formData.fcoDraft?.fcoMetadata.productionStart || formData.productionStart || ''}
                  onChange={(e) => handleDraftChange('fcoMetadata', 'productionStart', e.target.value)}
                  placeholder="e.g. Immediate, Q3 builds, All units before 2026"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Application</label>
                <input
                  type="text"
                  value={formData.fcoDraft?.fcoMetadata.application || ''}
                  onChange={(e) => handleDraftChange('fcoMetadata', 'application', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Existing References / Documents</label>
                <input
                  type="text"
                  value={formData.fcoDraft?.technicalContent.existingReferences || ''}
                  onChange={(e) => handleDraftChange('technicalContent', 'existingReferences', e.target.value)}
                  placeholder="e.g. InTouch 7404070"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <hr className="border-slate-200" />
            
            {/* Associated Information */}
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-4">Associated Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Associated RFI</label>
                  <input type="text" value={formData.fcoDraft?.associatedInfo.associatedRFI || ''} onChange={(e) => handleDraftChange('associatedInfo', 'associatedRFI', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Superseded FCO(s)</label>
                  <input type="text" value={formData.fcoDraft?.associatedInfo.supersededFCOs || ''} onChange={(e) => handleDraftChange('associatedInfo', 'supersededFCOs', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Associated FCO(s)</label>
                  <input type="text" value={formData.fcoDraft?.associatedInfo.associatedFCOs || ''} onChange={(e) => handleDraftChange('associatedInfo', 'associatedFCOs', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Associated COCA(s)</label>
                  <input type="text" value={formData.fcoDraft?.associatedInfo.associatedCOCAs || ''} onChange={(e) => handleDraftChange('associatedInfo', 'associatedCOCAs', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Tech Alert(s)</label>
                  <input type="text" value={formData.fcoDraft?.associatedInfo.associatedTechAlerts || ''} onChange={(e) => handleDraftChange('associatedInfo', 'associatedTechAlerts', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Q-Check Service Level</label>
                  <select value={formData.fcoDraft?.associatedInfo.qCheckServiceLevel || ''} onChange={(e) => handleDraftChange('associatedInfo', 'qCheckServiceLevel', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select...</option>
                    <option value="Standard">Standard</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Coding Changes Required?</label>
                  <select value={formData.fcoDraft?.associatedInfo.codingChanges || ''} onChange={(e) => handleDraftChange('associatedInfo', 'codingChanges', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select...</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Capitalize Cost?</label>
                  <select value={formData.fcoDraft?.associatedInfo.capitalize || ''} onChange={(e) => handleDraftChange('associatedInfo', 'capitalize', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select...</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Comments by Operations</label>
                  <textarea value={formData.fcoDraft?.associatedInfo.commentsByOperations || ''} onChange={(e) => handleDraftChange('associatedInfo', 'commentsByOperations', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px]" />
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Cost and Schedule */}
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-4">Cost and Schedule</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated FCO Cost (USD)</label>
                  <input type="text" value={formData.fcoDraft?.costSchedule.estimatedFcoCostUsd || ''} onChange={(e) => handleDraftChange('costSchedule', 'estimatedFcoCostUsd', e.target.value)} placeholder="$0.00" className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Special Equipment Cost (USD)</label>
                  <input type="text" value={formData.fcoDraft?.costSchedule.estimatedSpecialEquipmentCostUsd || ''} onChange={(e) => handleDraftChange('costSchedule', 'estimatedSpecialEquipmentCostUsd', e.target.value)} placeholder="$0.00" className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Time (Hours)</label>
                  <input type="text" value={formData.fcoDraft?.costSchedule.estimatedTimeHours || ''} onChange={(e) => handleDraftChange('costSchedule', 'estimatedTimeHours', e.target.value)} placeholder="e.g. 2.5" className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input type="text" value={formData.fcoDraft?.costSchedule.dueDate || ''} onChange={(e) => handleDraftChange('costSchedule', 'dueDate', e.target.value)} placeholder="DD-MM-YYYY" className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Additional FCO Information */}
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-4">Additional FCO Information</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Changes to Maintenance & Test Procedures, SWIs, or Manuals</label>
                  <textarea value={formData.fcoDraft?.additionalFcoInfo.maintenanceProcedureChanges || ''} onChange={(e) => handleDraftChange('additionalFcoInfo', 'maintenanceProcedureChanges', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Marking Information</label>
                  <input type="text" value={formData.fcoDraft?.additionalFcoInfo.markingInformation || ''} onChange={(e) => handleDraftChange('additionalFcoInfo', 'markingInformation', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Design Engineer</label>
                    <input type="text" value={formData.fcoDraft?.approvalRoles.designEngineer || ''} onChange={(e) => handleDraftChange('approvalRoles', 'designEngineer', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">InTouch Engineer</label>
                    <input type="text" value={formData.fcoDraft?.approvalRoles.inTouchEngineer || ''} onChange={(e) => handleDraftChange('approvalRoles', 'inTouchEngineer', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Field Decision Maker</label>
                    <input type="text" value={formData.fcoDraft?.approvalRoles.fieldDecisionMaker || ''} onChange={(e) => handleDraftChange('approvalRoles', 'fieldDecisionMaker', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </details>

        <FcoTablesEditor formData={formData} setFormData={setFormData} />
        <VisualPlaceholdersEditor formData={formData} setFormData={setFormData} />

        {/* EXTRA DIRECTIVES (Optional Rewrite Instructions & Known Safety Risks) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">
              Known Safety Risks
            </label>
            <input
              type="text"
              value={formData.fcoDraft?.technicalContent.knownSafetyRisks || formData.knownSafetyRisks || ''}
              onChange={(e) => handleDraftChange('technicalContent', 'knownSafetyRisks', e.target.value)}
              placeholder="e.g. Hydraulic spray release risks"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">
              Optional Rewrite Instructions
            </label>
            <input
              type="text"
              value={formData.fcoDraft?.technicalContent.optionalRewriteInstructions || formData.customDirectives || ''}
              onChange={(e) => handleDraftChange('technicalContent', 'optionalRewriteInstructions', e.target.value)}
              placeholder="Example: Emphasize risk of skin injection."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {unsafeWarning && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>This instruction may conflict with safety or TechCom rules. The app will not follow unsafe or unsupported instructions.</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      `;

const newCode = code.substring(0, startIndex) + newJsx + code.substring(endIndex);

// Also replace the Hero section string at the top
const finalCode = newCode.replace(
  `<h2 className="text-xl font-bold text-slate-800 font-sans">Step 1: FCO Context</h2>`,
  `<div>
          <h2 className="text-xl font-bold text-slate-800 font-sans">Start Draft</h2>
          <p className="text-sm text-slate-600 mt-1">
            Start with rough Summary and Procedure notes. The assistant will help structure, review, and improve the FCO draft.
          </p>
        </div>`
).replace(
  `<div className="flex sm:flex-row flex-col sm:items-center justify-between mb-6 gap-4">`,
  `<div className="flex sm:flex-row flex-col sm:items-start justify-between mb-6 gap-4">`
);

fs.writeFileSync('src/components/Step1Context.tsx', finalCode);
console.log('Patch complete.');
