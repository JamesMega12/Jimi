import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FCORequestData } from '../types';

interface AdvancedMetadataPanelProps {
  formData: FCORequestData;
  setFormData: React.Dispatch<React.SetStateAction<FCORequestData>>;
  showValidation: boolean;
  effectiveDateError: string | null;
  setEffectiveDateError: (error: string | null) => void;
  validateEffectiveDate: (date: string | undefined) => string | null;
}

export const AdvancedMetadataPanel: React.FC<AdvancedMetadataPanelProps> = ({
  formData,
  setFormData,
  showValidation,
  effectiveDateError,
  setEffectiveDateError,
  validateEffectiveDate
}) => {
  const handleDraftChange = (section: keyof NonNullable<FCORequestData['fcoDraft']>, field: string, value: string) => {
    setFormData(prev => {
      const fcoDraft = prev.fcoDraft ? { ...prev.fcoDraft } : {} as NonNullable<FCORequestData['fcoDraft']>;
      if (!fcoDraft[section]) {
        (fcoDraft as any)[section] = {};
      }
      (fcoDraft as any)[section] = { ...(fcoDraft as any)[section], [field]: value };
      return { ...prev, fcoDraft };
    });
  };

  return (
    <details className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm group">
      <summary className="bg-slate-50 px-4 py-3 font-bold text-slate-800 text-sm cursor-pointer hover:bg-slate-100 flex items-center justify-between list-none">
        Advanced Metadata
        <ChevronDown className="w-4 h-4 text-slate-500 group-open:hidden" />
        <ChevronUp className="w-4 h-4 text-slate-500 hidden group-open:block" />
      </summary>
      <div className="p-4 space-y-6 border-t border-slate-200">

        {/* FCO Identifiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans uppercase">
              Base Product Code
            </label>
            <input
              type="text"
              value={formData.fcoDraft?.fcoMetadata.baseProductCode || ''}
              onChange={(e) => handleDraftChange('fcoMetadata', 'baseProductCode', e.target.value)}
              placeholder="e.g. AUTOPROFILER"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans uppercase">
              FCO Number
            </label>
            <input
              type="text"
              value={formData.fcoDraft?.fcoMetadata.fcoNumber || ''}
              onChange={(e) => handleDraftChange('fcoMetadata', 'fcoNumber', e.target.value)}
              placeholder="e.g. 8299443"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <hr className="border-slate-200" />

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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Superseded FCOs</label>
              <input type="text" value={formData.fcoDraft?.associatedInfo.supersededFCOs || ''} onChange={(e) => handleDraftChange('associatedInfo', 'supersededFCOs', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Associated FCOs</label>
              <input type="text" value={formData.fcoDraft?.associatedInfo.associatedFCOs || ''} onChange={(e) => handleDraftChange('associatedInfo', 'associatedFCOs', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Associated CO/CA</label>
              <input type="text" value={formData.fcoDraft?.associatedInfo.associatedCOCAs || ''} onChange={(e) => handleDraftChange('associatedInfo', 'associatedCOCAs', e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Tech Alerts</label>
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
  );
};
