import React, { useEffect, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { ControlInformation } from './types';

// Collapsible strip, available from Stage 1 (not deferred to the metadata
// stage) -- deadline/actionBy/effectiveTiming are grounding the AI needs
// during drafting, not administrative trivia (refactor plan's explicit
// deviation from "all metadata belongs at the end").

interface Props {
  key?: string | number;
  controlInformation: ControlInformation;
  onChange: (next: ControlInformation) => void;
  // If Summary's accepted/pending effectiveTiming states a value and the
  // strip's own field is still empty, seed it -- but NEVER overwrite a value
  // the user already entered themselves.
  summaryEffectiveTimingHint?: string;
}

export default function ControlInfoStrip({ controlInformation, onChange, summaryEffectiveTimingHint }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [autoSeeded, setAutoSeeded] = useState(false);

  useEffect(() => {
    if (!autoSeeded && summaryEffectiveTimingHint && !controlInformation.effectiveTiming.trim()) {
      onChange({ ...controlInformation, effectiveTiming: summaryEffectiveTimingHint });
      setAutoSeeded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryEffectiveTimingHint]);

  const setField = <K extends keyof ControlInformation>(field: K, value: ControlInformation[K]) => onChange({ ...controlInformation, [field]: value });

  const hasContent = controlInformation.deadline || controlInformation.actionBy.length > 0 || controlInformation.effectiveTiming;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
      <button type="button" className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100" onClick={() => setExpanded(e => !e)}>
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Info className="w-4 h-4" /> Control Information {hasContent && <span className="text-xs font-normal text-emerald-600">(some fields set)</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Deadline</label>
            <input type="date" value={controlInformation.deadline} onChange={e => setField('deadline', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Effective Timing</label>
            <input type="text" value={controlInformation.effectiveTiming} onChange={e => setField('effectiveTiming', e.target.value)} placeholder="e.g. Effective Immediately" className="w-full p-2 border border-slate-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Action By</label>
            <input
              type="text"
              value={controlInformation.actionBy.join(', ')}
              onChange={e => setField('actionBy', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="e.g. Operations, PSD"
              className="w-full p-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Information For</label>
            <input
              type="text"
              value={controlInformation.informationFor.join(', ')}
              onChange={e => setField('informationFor', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="e.g. Engineering, Sales"
              className="w-full p-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div className="flex items-center gap-4 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={controlInformation.acknowledgementRequired} onChange={e => setField('acknowledgementRequired', e.target.checked)} />
              Acknowledgement Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={controlInformation.quizRequired} onChange={e => setField('quizRequired', e.target.checked)} />
              Quiz Required
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
