import React, { useState } from 'react';
import { ProcedureReadinessSuggestion } from '../types';
import { AlertCircle, CheckCircle2, XCircle, FileEdit, Check, X } from 'lucide-react';

interface ProcedureReadinessPanelProps {
  suggestions: ProcedureReadinessSuggestion[];
  onUpdateSuggestions: (suggestions: ProcedureReadinessSuggestion[]) => void;
  developerMode?: boolean;
}

export default function ProcedureReadinessPanel({
  suggestions,
  onUpdateSuggestions,
  developerMode
}: ProcedureReadinessPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!suggestions || suggestions.length === 0) return null;

  const handleAccept = (id: string) => {
    const next = suggestions.map(s => s.id === id ? { ...s, status: 'accepted' as const } : s);
    onUpdateSuggestions(next);
  };

  const handleDismiss = (id: string) => {
    const next = suggestions.map(s => s.id === id ? { ...s, status: 'dismissed' as const } : s);
    onUpdateSuggestions(next);
  };

  const handleStartEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditValue(text);
  };

  const handleSaveEdit = (id: string) => {
    if (!editValue.trim()) return;
    const next = suggestions.map(s => 
      s.id === id ? { ...s, editedText: editValue, status: 'edited' as const } : s
    );
    onUpdateSuggestions(next);
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;

  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 shadow-sm font-sans mb-6">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-indigo-500" />
          Procedure Readiness Suggestions
        </h3>
        <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
          {pendingCount} Pending Review
        </span>
      </div>

      <div className="space-y-4">
        {suggestions.map(s => {
          const isPending = s.status === 'pending';
          const isAccepted = s.status === 'accepted' || s.status === 'edited';
          const isDismissed = s.status === 'dismissed';
          const isEditing = editingId === s.id;

          const displayText = s.editedText || s.suggestedText;

          return (
            <div 
              key={s.id} 
              className={`border rounded-md p-3 transition-colors ${
                isAccepted ? 'bg-green-50/50 border-green-200' : 
                isDismissed ? 'bg-slate-50/50 border-slate-200 opacity-60' : 
                'bg-white border-indigo-100 hover:border-indigo-300'
              }`}
            >
              <div className="flex justify-between items-start gap-4 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xxs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {s.category.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xxs text-slate-500">
                      Target: {s.targetSection}
                    </span>
                    {isAccepted && (
                      <span className="text-xxs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Accepted
                      </span>
                    )}
                    {isDismissed && (
                      <span className="text-xxs font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Dismissed
                      </span>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <div className="mt-2">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full text-sm p-2 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y min-h-[80px]"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleSaveEdit(s.id)}
                          className="text-xs font-semibold px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Save & Accept
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-sm ${isDismissed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {displayText}
                    </p>
                  )}

                  {developerMode && s.reason && (
                    <p className="mt-2 text-xs text-slate-500 italic">
                      AI Reason: {s.reason}
                    </p>
                  )}
                </div>

                {!isEditing && isPending && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(s.id)}
                      className="text-xs font-semibold px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border border-green-200 rounded flex items-center justify-center transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleStartEdit(s.id, displayText)}
                      className="text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-200 rounded flex items-center justify-center transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDismiss(s.id)}
                      className="text-xs font-semibold px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 border border-slate-200 rounded flex items-center justify-center transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                
                {!isEditing && !isPending && (
                   <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        const next = suggestions.map(su => su.id === s.id ? { ...su, status: 'pending' as const } : su);
                        onUpdateSuggestions(next);
                      }}
                      className="text-xs font-semibold px-3 py-1 hover:underline text-slate-500 hover:text-slate-700"
                    >
                      Undo
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
