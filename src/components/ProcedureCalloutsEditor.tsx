import React from 'react';
import { FCORequestData, ProcedureCallout } from '../types';
import { Plus, Trash2, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

interface ProcedureCalloutsEditorProps {
  formData: FCORequestData;
  setFormData: React.Dispatch<React.SetStateAction<FCORequestData>>;
}

export const ProcedureCalloutsEditor: React.FC<ProcedureCalloutsEditorProps> = ({ formData, setFormData }) => {
  const callouts = formData.fcoDraft?.technicalContent?.procedureCallouts || [];

  const addCallout = () => {
    setFormData(prev => {
      const draft = prev.fcoDraft ? { ...prev.fcoDraft } : {} as any;
      const techContent = draft.technicalContent ? { ...draft.technicalContent } : {};
      const existingCallouts = techContent.procedureCallouts || [];
      
      const newCallout: ProcedureCallout = {
        id: `callout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'note',
        section: 'Safety and Preparation',
        text: ''
      };
      
      techContent.procedureCallouts = [...existingCallouts, newCallout];
      draft.technicalContent = techContent;
      return { ...prev, fcoDraft: draft };
    });
  };

  const updateCallout = (id: string, field: keyof ProcedureCallout, value: string) => {
    setFormData(prev => {
      if (!prev.fcoDraft?.technicalContent?.procedureCallouts) return prev;
      const newCallouts = prev.fcoDraft.technicalContent.procedureCallouts.map(c => 
        c.id === id ? { ...c, [field]: value } : c
      );
      return {
        ...prev,
        fcoDraft: {
          ...prev.fcoDraft,
          technicalContent: {
            ...prev.fcoDraft.technicalContent,
            procedureCallouts: newCallouts
          }
        }
      };
    });
  };

  const removeCallout = (id: string) => {
    setFormData(prev => {
      if (!prev.fcoDraft?.technicalContent?.procedureCallouts) return prev;
      const newCallouts = prev.fcoDraft.technicalContent.procedureCallouts.filter(c => c.id !== id);
      return {
        ...prev,
        fcoDraft: {
          ...prev.fcoDraft,
          technicalContent: {
            ...prev.fcoDraft.technicalContent,
            procedureCallouts: newCallouts
          }
        }
      };
    });
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-700 font-sans">Procedure Callouts</h3>
          <p className="text-xs text-slate-500 italic">Add structural Notes, Cautions, and Warnings associated with procedure sections.</p>
        </div>
        <button
          onClick={addCallout}
          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Callout
        </button>
      </div>

      <div className="space-y-3">
        {callouts.length === 0 ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500 text-xs">
            No procedure callouts added yet.
          </div>
        ) : (
          callouts.map((callout) => (
            <div key={callout.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm flex gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
                    <select
                      value={callout.type}
                      onChange={e => updateCallout(callout.id, 'type', e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="note">Note</option>
                      <option value="caution">Caution</option>
                      <option value="warning">Warning</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
                    <select
                      value={callout.section}
                      onChange={e => updateCallout(callout.id, 'section', e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Safety and Preparation">Safety and Preparation</option>
                      <option value="Installation Steps">Installation Steps</option>
                      <option value="Post-Installation / Functional Check">Post-Installation / Functional Check</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Callout Text</label>
                  <textarea
                    value={callout.text}
                    onChange={e => updateCallout(callout.id, 'text', e.target.value)}
                    placeholder={`Enter ${callout.type} text...`}
                    className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 min-h-[60px]"
                  />
                  {!callout.text.trim() && <p className="text-red-500 text-[10px] mt-1">Text cannot be blank.</p>}
                </div>
              </div>
              <button
                onClick={() => removeCallout(callout.id)}
                className="self-start p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="Delete callout"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
