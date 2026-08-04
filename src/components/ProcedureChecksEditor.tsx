import React from 'react';
import { ProcedureCheck, ProcedureCheckCategory, FCOPartInvolved, FCOProcedure } from '../types';
import { Plus, Trash2 } from 'lucide-react';
import { collectAnchorIdOptions as collectAnchorOptions, collectPartIdOptions as collectPartOptions } from './procedureTargetOptions';

const CATEGORY_OPTIONS: { value: ProcedureCheckCategory; label: string }[] = [
  { value: 'pre_installation', label: 'Pre-Installation' },
  { value: 'safety_preparation', label: 'Safety / Preparation' },
  { value: 'parts_check', label: 'Parts Check' },
  { value: 'post_installation_check', label: 'Post-Installation Check' },
  { value: 'functional_check', label: 'Functional Check' },
  { value: 'completion_verification', label: 'Completion Verification' },
];

interface ProcedureChecksEditorProps {
  checks: ProcedureCheck[];
  onUpdateChecks: (checks: ProcedureCheck[]) => void;
  declaredParts: FCOPartInvolved[];
  procedure?: FCOProcedure | null;
}

// Manual authoring surface for ProcedureCheck — the human-authorable
// counterpart to AI-suggested checks (ProcedureReadinessPanel), so checks
// don't depend on AI being available. Rendered post-accept, once the
// procedure's parts/stepGroups have stable ids (see stampProcedureIdentity)
// for "applies to" and "placement" to reference.
export default function ProcedureChecksEditor({ checks, onUpdateChecks, declaredParts, procedure }: ProcedureChecksEditorProps) {
  const partOptions = collectPartOptions(declaredParts, procedure);
  const anchorOptions = collectAnchorOptions(procedure);

  const addCheck = () => {
    const newCheck: ProcedureCheck = {
      id: `check-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      category: 'post_installation_check',
      text: '',
      targetPartIds: [],
      source: 'manual',
      status: 'accepted',
      createdAt: new Date().toISOString(),
    };
    onUpdateChecks([...checks, newCheck]);
  };

  const updateCheck = (id: string, patch: Partial<ProcedureCheck>) => {
    onUpdateChecks(checks.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCheck = (id: string) => {
    onUpdateChecks(checks.filter(c => c.id !== id));
  };

  const toggleTargetPart = (check: ProcedureCheck, partId: string) => {
    const has = check.targetPartIds.includes(partId);
    updateCheck(check.id, {
      targetPartIds: has ? check.targetPartIds.filter(id => id !== partId) : [...check.targetPartIds, partId],
    });
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Checks</h4>
          <p className="text-[11px] text-slate-500 italic">
            Pre-installation, post-installation, and verification checks — global, part-scoped, or placed next to a specific step.
          </p>
        </div>
        <button
          onClick={addCheck}
          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Check
        </button>
      </div>

      {checks.length === 0 ? (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500 text-xs">
          No checks yet.
        </div>
      ) : (
        <div className="space-y-3">
          {checks.map(check => (
            <div key={check.id} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm flex gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2 items-center">
                  <select
                    value={check.category}
                    onChange={e => updateCheck(check.id, { category: e.target.value as ProcedureCheckCategory })}
                    className="flex-1 text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-1 rounded flex-shrink-0 ${
                      check.source === 'manual' ? 'text-slate-500 bg-slate-100' : 'text-indigo-600 bg-indigo-50'
                    }`}
                  >
                    {check.source === 'manual' ? 'Manual' : 'AI-Suggested'}
                  </span>
                </div>

                <textarea
                  value={check.text}
                  onChange={e => updateCheck(check.id, { text: e.target.value })}
                  placeholder="Enter the check text..."
                  className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 min-h-[52px]"
                />
                {!check.text.trim() && <p className="text-red-500 text-[10px]">Text cannot be blank.</p>}

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">Applies to</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateCheck(check.id, { targetPartIds: [] })}
                      className={`text-[10px] font-semibold px-2 py-1 rounded border ${
                        check.targetPartIds.length === 0
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      Global (all parts)
                    </button>
                    {partOptions.map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => toggleTargetPart(check, p.id)}
                        className={`text-[10px] font-semibold px-2 py-1 rounded border ${
                          check.targetPartIds.includes(p.id)
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-white border-slate-300 text-slate-600'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">Placement</label>
                  <select
                    value={check.anchor ? `${check.anchor.stepGroupId}:${check.anchor.position}` : ''}
                    onChange={e => {
                      const v = e.target.value;
                      if (!v) {
                        updateCheck(check.id, { anchor: undefined });
                        return;
                      }
                      const [stepGroupId, position] = v.split(':');
                      updateCheck(check.id, { anchor: { stepGroupId, position: position as 'before' | 'after' } });
                    }}
                    className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">No specific step (end of category's band)</option>
                    {anchorOptions.flatMap(opt => [
                      <option key={`${opt.stepGroupId}:before`} value={`${opt.stepGroupId}:before`}>
                        Before — {opt.label}
                      </option>,
                      <option key={`${opt.stepGroupId}:after`} value={`${opt.stepGroupId}:after`}>
                        After — {opt.label}
                      </option>,
                    ])}
                  </select>
                </div>
              </div>
              <button
                onClick={() => removeCheck(check.id)}
                className="self-start p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="Delete check"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
