import React, { useState } from 'react';
import { FCOProcedure } from '../types';
import { Pencil } from 'lucide-react';

interface Props {
  procedure: FCOProcedure;
  onChange: (updated: FCOProcedure) => void;
}

/**
 * Editable review view for a freshly generated (not yet accepted) procedure.
 * Click any step line (or group title) to edit it in place. Edits mutate a
 * cloned copy passed back via onChange, so the caller's state stays the
 * single source of truth.
 */
export default function EditableProcedureView({ procedure, onChange }: Props) {
  // Editing target encoded as "sectionIdx:flat:stepIdx", "sectionIdx:group:groupIdx:stepIdx"
  // or "sectionIdx:gtitle:groupIdx".
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (key: string, current: string) => {
    setEditingKey(key);
    setEditValue(current);
  };

  const commitEdit = () => {
    if (editingKey === null) return;
    const next: FCOProcedure = JSON.parse(JSON.stringify(procedure));
    const parts = editingKey.split(':');
    const sIdx = parseInt(parts[0], 10);
    const section = next.sections[sIdx];
    if (section) {
      const trimmed = editValue.trim();
      if (parts[1] === 'flat') {
        const i = parseInt(parts[2], 10);
        if (trimmed) section.steps[i] = trimmed;
        else section.steps.splice(i, 1); // clearing a line removes the step
      } else if (parts[1] === 'group' && section.stepGroups) {
        const g = parseInt(parts[2], 10);
        const i = parseInt(parts[3], 10);
        if (section.stepGroups[g]) {
          if (trimmed) section.stepGroups[g].steps[i] = trimmed;
          else section.stepGroups[g].steps.splice(i, 1);
        }
      } else if (parts[1] === 'gtitle' && section.stepGroups) {
        const g = parseInt(parts[2], 10);
        if (section.stepGroups[g] && trimmed) section.stepGroups[g].title = trimmed;
      }
    }
    onChange(next);
    setEditingKey(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const editorFor = (key: string) => (
    <textarea
      autoFocus
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      }}
      className="w-full px-2 py-1.5 text-sm bg-white border-2 border-indigo-400 rounded focus:outline-none resize-y min-h-[48px]"
    />
  );

  const editableLine = (key: string, text: string, className: string) => {
    if (editingKey === key) return editorFor(key);
    return (
      <span
        onClick={() => startEdit(key, text)}
        className={`${className} cursor-text hover:bg-indigo-50/70 rounded px-1 -mx-1 group/line inline-flex items-start gap-1.5 w-full`}
        title="Click to edit"
      >
        <span className="flex-1 leading-relaxed">{text}</span>
        <Pencil className="w-3 h-3 text-slate-300 group-hover/line:text-indigo-400 flex-shrink-0 mt-1" />
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-xxs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-semibold font-mono uppercase">
          Type: {procedure.changeType}
        </span>
        <span className="text-[11px] text-slate-400">Click any line to edit it. Clear a line to delete the step.</span>
      </div>

      {procedure.toolsMaterialsRequired && (
        (procedure.toolsMaterialsRequired.confirmedFromInput?.length > 0 || procedure.toolsMaterialsRequired.suggestedToConfirm?.length > 0) && (
        <div className="border border-slate-200 rounded-xl p-4 bg-indigo-50/10 text-sm space-y-2">
          <h4 className="text-sm font-bold text-slate-900 font-sans">Tools / Materials Required</h4>
          {procedure.toolsMaterialsRequired.confirmedFromInput?.length > 0 && (
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-sm">
              {procedure.toolsMaterialsRequired.confirmedFromInput.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          )}
          {procedure.toolsMaterialsRequired.suggestedToConfirm?.length > 0 && (
            <ul className="list-disc list-inside space-y-1 text-slate-500 italic text-sm">
              {procedure.toolsMaterialsRequired.suggestedToConfirm.map((item, idx) => <li key={idx}>{item} (confirm)</li>)}
            </ul>
          )}
        </div>
      ))}

      {procedure.sections.map((section, sIdx) => (
        <div key={sIdx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/20 text-sm space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 font-sans">
            {section.title}
          </h4>

          {section.stepGroups && section.stepGroups.length > 0 && (
            <div className="space-y-3">
              {section.stepGroups.map((group, gIdx) => (
                <div key={gIdx} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="w-5 h-5 flex items-center justify-center bg-indigo-100 rounded-full text-xs font-bold text-indigo-700 font-mono flex-shrink-0">
                      {gIdx + 1}
                    </span>
                    <div className="flex-1 text-sm font-bold text-slate-800">
                      {editableLine(`${sIdx}:gtitle:${gIdx}`, group.title, '')}
                    </div>
                    {group.forPart && (
                      <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        {group.forPart}
                      </span>
                    )}
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {group.steps.map((step, stepIdx) => (
                      <li key={stepIdx} className="flex gap-3 p-2.5 pl-5 text-slate-700 text-sm">
                        <span className="text-slate-400 flex-shrink-0">•</span>
                        <div className="flex-1">{editableLine(`${sIdx}:group:${gIdx}:${stepIdx}`, step, '')}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {section.steps && section.steps.length > 0 && (
            <ol className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg overflow-hidden">
              {section.steps.map((step, stepIdx) => (
                <li key={stepIdx} className="flex gap-3.5 p-3 text-slate-700">
                  <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-full text-xs font-bold text-slate-600 font-mono flex-shrink-0">
                    {(section.stepGroups?.length || 0) + stepIdx + 1}
                  </span>
                  <div className="flex-1">{editableLine(`${sIdx}:flat:${stepIdx}`, step, '')}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}
