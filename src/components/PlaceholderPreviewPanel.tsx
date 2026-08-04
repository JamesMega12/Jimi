import React, { useState } from 'react';
import { Plus, Image as ImageIcon, Table as TableIcon, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DetectedPlaceholder } from '../lib/placeholderDetection';

interface InsertPlaceholderButtonProps {
  textAreaId: string;
  onInsert: (newText: string) => void;
}

export const InsertPlaceholderButton: React.FC<InsertPlaceholderButtonProps> = ({ textAreaId, onInsert }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleInsert = (type: 'Figure' | 'Table') => {
    const textToInsert = `\n[Insert ${type} 1: Caption]\n`;
    
    const el = document.getElementById(textAreaId) as HTMLTextAreaElement | null;
    if (el) {
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const val = el.value || '';
      const newText = val.substring(0, start) + textToInsert + val.substring(end);
      
      // Need to use the passed callback because just setting value doesn't trigger React state
      onInsert(newText);
      
      // Restore focus
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
      }, 0);
    } else {
      // Fallback
      onInsert(textToInsert);
    }
    setShowMenu(false);
  };

  return (
    <div className="relative inline-block text-left mt-2 mb-1">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors"
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> Insert Figure/Table Placeholder
      </button>

      {showMenu && (
        <div className="absolute z-10 mt-1 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <button
              onClick={() => handleInsert('Figure')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              role="menuitem"
            >
              <ImageIcon className="h-4 w-4 mr-2 text-gray-400" />
              Insert Figure Placeholder
            </button>
            <button
              onClick={() => handleInsert('Table')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              role="menuitem"
            >
              <TableIcon className="h-4 w-4 mr-2 text-gray-400" />
              Insert Table Placeholder
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface PlaceholderPreviewPanelProps {
  placeholders: DetectedPlaceholder[];
  developerMode?: boolean;
}

export const PlaceholderPreviewPanel: React.FC<PlaceholderPreviewPanelProps> = ({ placeholders, developerMode }) => {
  if (placeholders.length === 0) {
    return (
      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
         <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Detected Figures and Tables</h3>
         <p className="text-xs text-slate-500 italic">No figure or table placeholders detected.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center">
        Detected Figures and Tables
        <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">{placeholders.length}</span>
      </h3>
      
      <div className="space-y-3">
        {placeholders.map((ph, idx) => (
          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg gap-2">
            <div className="flex items-start sm:items-center gap-2">
              <div className="mt-0.5 sm:mt-0">
                {ph.type === 'Figure' ? <ImageIcon className="h-4 w-4 text-indigo-500" /> : <TableIcon className="h-4 w-4 text-emerald-500" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {ph.type} {ph.number} {ph.caption ? `— ${ph.caption}` : ''}
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wide mt-0.5">
                  Source: {ph.source}
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              {ph.warning ? (
                <div className="flex items-center text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 max-w-xs">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                  <span className="leading-tight">{ph.warning}</span>
                </div>
              ) : (
                <div className="flex items-center text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> OK
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {developerMode && (
        <details className="mt-4 text-xs">
           <summary className="text-slate-500 cursor-pointer font-mono">Developer: Raw Placeholder Data</summary>
           <pre className="mt-2 p-2 bg-slate-800 text-slate-200 rounded font-mono overflow-auto whitespace-pre-wrap">
             {JSON.stringify(placeholders, null, 2)}
           </pre>
        </details>
      )}
    </div>
  );
};
