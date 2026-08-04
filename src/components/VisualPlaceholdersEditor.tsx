import React from 'react';
import { Plus, Trash2, Copy, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { FCORequestData } from '../types';
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
};

interface VisualPlaceholdersEditorProps {
  formData: FCORequestData;
  setFormData: React.Dispatch<React.SetStateAction<FCORequestData>>;
}

export const VisualPlaceholdersEditor: React.FC<VisualPlaceholdersEditorProps> = ({ formData, setFormData }) => {
  const placeholders = formData.fcoDraft?.visualPlaceholders || [];

  const updatePlaceholders = (newPlaceholders: typeof placeholders) => {
    setFormData((prev) => {
      const draft = prev.fcoDraft || ({} as any);
      return {
        ...prev,
        fcoDraft: {
          ...draft,
          visualPlaceholders: newPlaceholders,
        },
      };
    });
  };

  const addPlaceholder = () => {
    updatePlaceholders([
      ...placeholders,
      {
        id: generateId(),
        type: 'figure',
        number: '',
        caption: '',
        linkedSection: '',
        status: 'placeholder_only',
        notes: '',
      },
    ]);
  };

  const deletePlaceholder = (index: number) => {
    updatePlaceholders(placeholders.filter((_, i) => i !== index));
  };

  const duplicatePlaceholder = (index: number) => {
    const item = placeholders[index];
    if (!item) return;
    const newItems = [...placeholders];
    newItems.splice(index + 1, 0, { ...item, id: generateId() });
    updatePlaceholders(newItems);
  };

  const movePlaceholder = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === placeholders.length - 1) return;
    
    const newItems = [...placeholders];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    updatePlaceholders(newItems);
  };

  const updatePlaceholder = (index: number, field: string, value: string) => {
    const newItems = [...placeholders];
    newItems[index] = { ...newItems[index], [field]: value };
    updatePlaceholders(newItems);
  };

  const clearAllPlaceholders = () => {
    updatePlaceholders([]);
  };

  const getDuplicateWarning = (item: typeof placeholders[0], index: number) => {
    if (!item.type || !item.number) return null;
    const isDuplicate = placeholders.findIndex(p => p.type === item.type && p.number === item.number && p.id !== item.id) !== -1;
    if (isDuplicate) {
      return `Duplicate ${item.type === 'figure' ? 'Figure' : 'Table'} ${item.number} detected.`;
    }
    return null;
  };

  const getMissingCaptionWarning = (item: typeof placeholders[0]) => {
    if (item.number && !item.caption) {
      return `${item.type === 'figure' ? 'Figure' : 'Table'} ${item.number} is missing a caption.`;
    }
    return null;
  };

  const formatPlaceholderDisplay = (item: typeof placeholders[0]) => {
    const cap = item.caption ? item.caption : 'caption required';
    const num = item.number ? item.number : '{number}';
    return `[Insert ${item.type === 'figure' ? 'Figure' : 'Table'} ${num}: ${cap}]`;
  };

  return (
    <details className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm group mb-4">
      <summary className="bg-slate-50 px-4 py-3 font-bold text-slate-800 text-sm cursor-pointer hover:bg-slate-100 flex items-center justify-between list-none">
        Reference Figures and Table Placeholders
      </summary>
      
      <div className="p-4 bg-slate-50 space-y-4">
        {placeholders.length === 0 ? (
          <div className="text-sm text-gray-500 italic">No placeholders added.</div>
        ) : (
          <div className="space-y-4">
            {placeholders.map((item, index) => {
              const duplicateWarning = getDuplicateWarning(item, index);
              const missingCaptionWarning = getMissingCaptionWarning(item);
              
              return (
                <div key={item.id} className="bg-white border rounded-md shadow-sm p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="font-mono text-xs font-semibold bg-gray-100 px-2 py-1 rounded">
                      {formatPlaceholderDisplay(item)}
                    </div>
                    <div className="flex gap-2 text-gray-500">
                      <button type="button" onClick={() => movePlaceholder(index, 'up')} disabled={index === 0} className="hover:text-blue-600 disabled:opacity-50 disabled:hover:text-gray-500">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => movePlaceholder(index, 'down')} disabled={index === placeholders.length - 1} className="hover:text-blue-600 disabled:opacity-50 disabled:hover:text-gray-500">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => duplicatePlaceholder(index)} className="hover:text-blue-600" title="Duplicate">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => deletePlaceholder(index)} className="hover:text-red-600" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {(duplicateWarning || missingCaptionWarning) && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-700 p-2 rounded flex flex-col gap-1 text-xs mb-3">
                      {duplicateWarning && <div className="flex items-center"><AlertTriangle className="h-3 w-3 mr-1" /> {duplicateWarning}</div>}
                      {missingCaptionWarning && <div className="flex items-center"><AlertTriangle className="h-3 w-3 mr-1" /> {missingCaptionWarning}</div>}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                      <select 
                        value={item.type} 
                        onChange={(e) => updatePlaceholder(index, 'type', e.target.value)}
                        className="w-full border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5"
                      >
                        <option value="figure">Figure</option>
                        <option value="table">Table</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Number *</label>
                      <input 
                        type="text" 
                        value={item.number} 
                        onChange={(e) => updatePlaceholder(index, 'number', e.target.value)}
                        placeholder="e.g. 1, 1A"
                        className="w-full border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Caption</label>
                      <input 
                        type="text" 
                        value={item.caption} 
                        onChange={(e) => updatePlaceholder(index, 'caption', e.target.value)}
                        placeholder="e.g. Actual fabrication with Tag Weld"
                        className="w-full border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Linked Section</label>
                      <select 
                        value={item.linkedSection} 
                        onChange={(e) => updatePlaceholder(index, 'linkedSection', e.target.value)}
                        className="w-full border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5"
                      >
                        <option value="">Select a section...</option>
                        <option value="Summary">Summary</option>
                        <option value="Procedure">Procedure</option>
                        <option value="Parts or Kits Required">Parts or Kits Required</option>
                        <option value="Special Equipment Required">Special Equipment Required</option>
                        <option value="Parts Requiring Rework">Parts Requiring Rework</option>
                        <option value="Parts to Scrap">Parts to Scrap</option>
                        <option value="Reference Figures">Reference Figures</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <input 
                        type="text" 
                        value={item.notes} 
                        onChange={(e) => updatePlaceholder(index, 'notes', e.target.value)}
                        placeholder="Optional notes"
                        className="w-full border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-4 items-center">
          <button type="button" onClick={addPlaceholder} className="flex items-center text-sm text-blue-600 font-medium hover:text-blue-700">
            <Plus className="h-4 w-4 mr-1" /> Add Placeholder
          </button>
          {placeholders.length > 0 && (
            <button type="button" onClick={clearAllPlaceholders} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
              Clear All Placeholders
            </button>
          )}
        </div>
      </div>
    </details>
  );
};
