import React from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { AdministrativeMetadata, AcknowledgementBlock, Figure, TableRef, Reference, ControlInformation, SupportingContent } from './types';
import { Collapsible } from './SectionHelpers';

// Stage 3 of the journey: administrative metadata (zero content impact --
// safely deferred here per the refactor plan's metadata categorization),
// acknowledgement/quiz configuration, and figures/tables/references
// management with the types formalized (replacing Phase D's ad hoc `any[]`
// shapes in the v1 workflow). Exemption/exception data deliberately does NOT
// live here -- it's authored inside Immediate Action's own workspace,
// alongside the actions it modifies (locked decision #6).

interface Props {
  administrativeMetadata: AdministrativeMetadata;
  onMetadataChange: (next: AdministrativeMetadata) => void;
  controlInformation: ControlInformation;
  supportingContent: SupportingContent;
  onSupportingContentChange: (next: SupportingContent) => void;
}

const METADATA_FIELDS: { key: keyof AdministrativeMetadata; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'documentNumber', label: 'Document Number' },
  { key: 'inTouchId', label: 'InTouch ID' },
  { key: 'date', label: 'Date' },
  { key: 'gemsNo', label: 'GEMS No' },
  { key: 'classification', label: 'Classification' },
];

function newFigure(figures: Figure[]): Figure {
  return { id: crypto.randomUUID(), number: figures.length + 1, caption: '' };
}
function newTable(tables: TableRef[]): TableRef {
  return { id: crypto.randomUUID(), number: tables.length + 1, caption: '', columns: [] };
}
function newReference(): Reference {
  return { id: crypto.randomUUID(), label: '' };
}
const emptyAck: AcknowledgementBlock = { completionMethod: '', applicationOrSystem: '', completionDeadline: '', targetAudience: [], completionInstructions: '' };

export default function MetadataStage({ administrativeMetadata, onMetadataChange, controlInformation, supportingContent, onSupportingContentChange }: Props) {
  const setMetaField = (key: keyof AdministrativeMetadata, value: string) => onMetadataChange({ ...administrativeMetadata, [key]: value });

  const ack = supportingContent.acknowledgement ?? emptyAck;
  const setAckField = (key: keyof AcknowledgementBlock, value: any) =>
    onSupportingContentChange({ ...supportingContent, acknowledgement: { ...ack, [key]: value } });

  const setFigures = (figures: Figure[]) => onSupportingContentChange({ ...supportingContent, figures });
  const setTables = (tables: TableRef[]) => onSupportingContentChange({ ...supportingContent, tables });
  const setReferences = (references: Reference[]) => onSupportingContentChange({ ...supportingContent, references });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Administrative Metadata</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {METADATA_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {label} {key === 'title' && <span className="text-red-500">*</span>}
              </label>
              <input type="text" value={administrativeMetadata[key]} onChange={e => setMetaField(key, e.target.value)} className="w-full p-2 border border-slate-300 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {controlInformation.acknowledgementRequired && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Acknowledgement Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Completion Method</label>
              <input type="text" value={ack.completionMethod} onChange={e => setAckField('completionMethod', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md" placeholder="e.g. Online Quiz" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Application / System</label>
              <input type="text" value={ack.applicationOrSystem} onChange={e => setAckField('applicationOrSystem', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Completion Deadline</label>
              <input type="date" value={ack.completionDeadline} onChange={e => setAckField('completionDeadline', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Target Audience</label>
              <input type="text" value={ack.targetAudience.join(', ')} onChange={e => setAckField('targetAudience', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="w-full p-2 border border-slate-300 rounded-md" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Completion Instructions</label>
              <textarea value={ack.completionInstructions} onChange={e => setAckField('completionInstructions', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md" rows={2} />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <Collapsible
          label={`Advanced: Figures & Tables (optional)${supportingContent.figures.length + supportingContent.tables.length > 0 ? ` -- ${supportingContent.figures.length + supportingContent.tables.length} added` : ''}`}
          defaultOpen={supportingContent.figures.length > 0 || supportingContent.tables.length > 0}
        >
          <div className="space-y-6 pt-2">
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
                <span>Figures</span>
                <button onClick={() => setFigures([...supportingContent.figures, newFigure(supportingContent.figures)])} className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md text-sm font-medium flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Figure
                </button>
              </h3>
              {supportingContent.figures.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No figures added.</p>
              ) : (
                <div className="space-y-2">
                  {supportingContent.figures.map((f, idx) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-500 w-20 flex-shrink-0">Figure {f.number ?? idx + 1}</span>
                      <input type="text" value={f.caption} onChange={e => setFigures(supportingContent.figures.map(x => (x.id === f.id ? { ...x, caption: e.target.value } : x)))} placeholder="Caption" className="flex-1 p-2 border border-slate-300 rounded-md text-sm" />
                      <button onClick={() => setFigures(supportingContent.figures.filter(x => x.id !== f.id))} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
                <span>Tables</span>
                <button onClick={() => setTables([...supportingContent.tables, newTable(supportingContent.tables)])} className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md text-sm font-medium flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Table
                </button>
              </h3>
              {supportingContent.tables.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No tables added.</p>
              ) : (
                <div className="space-y-3">
                  {supportingContent.tables.map((t, idx) => (
                    <div key={t.id} className="p-3 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-500 w-20 flex-shrink-0">Table {t.number ?? idx + 1}</span>
                        <input type="text" value={t.caption} onChange={e => setTables(supportingContent.tables.map(x => (x.id === t.id ? { ...x, caption: e.target.value } : x)))} placeholder="Caption" className="flex-1 p-2 border border-slate-300 rounded-md text-sm" />
                        <button onClick={() => setTables(supportingContent.tables.filter(x => x.id !== t.id))} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <input type="text" value={t.columns.join(', ')} onChange={e => setTables(supportingContent.tables.map(x => (x.id === t.id ? { ...x, columns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : x)))} placeholder="Column headers, comma separated" className="w-full p-2 border border-slate-200 rounded-md text-sm text-slate-600" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Collapsible>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center justify-between">
          <span>References</span>
          <button onClick={() => setReferences([...supportingContent.references, newReference()])} className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Reference
          </button>
        </h2>
        <p className="text-xs text-slate-500 mb-4 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
          If a standard or document is also cited by label inside Reasons or an Immediate/Follow-Up Action item, use the same
          label here to give it full detail (URL, notes) -- readers can then match the two.
        </p>
        {supportingContent.references.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No references added.</p>
        ) : (
          <div className="space-y-2">
            {supportingContent.references.map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <input type="text" value={r.label} onChange={e => setReferences(supportingContent.references.map(x => (x.id === r.id ? { ...x, label: e.target.value } : x)))} placeholder="Label (e.g. WEC-SQ-S10A)" className="flex-1 p-2 border border-slate-300 rounded-md text-sm" />
                <input type="text" value={r.url || ''} onChange={e => setReferences(supportingContent.references.map(x => (x.id === r.id ? { ...x, url: e.target.value || undefined } : x)))} placeholder="URL (optional)" className="flex-1 p-2 border border-slate-300 rounded-md text-sm" />
                <button onClick={() => setReferences(supportingContent.references.filter(x => x.id !== r.id))} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
