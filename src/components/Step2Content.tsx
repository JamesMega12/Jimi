import React, { useState } from 'react';
import { FCORequestData } from '../types';
import { AdvancedMetadataPanel } from './AdvancedMetadataPanel';
import { FcoTablesEditor } from './FcoTablesEditor';
import { VisualPlaceholdersEditor } from './VisualPlaceholdersEditor';

interface Step2ContentProps {
  formData: FCORequestData;
  setFormData: React.Dispatch<React.SetStateAction<FCORequestData>>;
  onBack: () => void;
  onNext: () => void;
}

export default function Step2Content({ formData, setFormData, onBack, onNext }: Step2ContentProps) {
  const [showValidation, setShowValidation] = useState<boolean>(false);
  const [effectiveDateError, setEffectiveDateError] = useState<string | null>(null);

  const validateEffectiveDate = (date: string | undefined): string | null => {
    if (!date) return null;
    const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
    if (!regex.test(date)) return "Please enter date in format DD-MM-YYYY";
    
    const [, day, month, year] = regex.exec(date)!;
    const d = new Date(`${year}-${month}-${day}`);
    
    if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
      return "Invalid date";
    }
    return null;
  };

  const handleNextClick = () => {
    setShowValidation(true);
    // Surface the date-format issue inline, but don't block navigation — final
    // export readiness (Review & Export) is where incomplete/invalid
    // requirements are enforced, not mid-flow page navigation.
    const dateErr = validateEffectiveDate(formData.fcoDraft?.fcoMetadata.effectiveDate || formData.effectiveDate);
    setEffectiveDateError(dateErr);
    onNext();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 font-sans mb-1">Technical Content & Advanced Metadata</h2>
      <p className="text-sm text-slate-600 mb-6">
        Complete identifiers, advanced metadata, and table data for the accepted draft.
      </p>

      <div className="space-y-8">
        <section>
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Section A: Advanced Metadata</h3>
          <AdvancedMetadataPanel
            formData={formData}
            setFormData={setFormData}
            showValidation={showValidation}
            effectiveDateError={effectiveDateError}
            setEffectiveDateError={setEffectiveDateError}
            validateEffectiveDate={validateEffectiveDate}
          />
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Section B: FCO Tables & Placeholders</h3>
          <FcoTablesEditor formData={formData} setFormData={setFormData} />
          <div className="mt-4">
            <VisualPlaceholdersEditor formData={formData} setFormData={setFormData} />
          </div>
        </section>
      </div>

      <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
        <button onClick={onBack} className="px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm">
          Back: Parts & Procedure
        </button>
        <button onClick={handleNextClick} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
          Next: Review & Export
        </button>
      </div>
    </div>
  );
}
