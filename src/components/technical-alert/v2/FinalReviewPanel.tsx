import React from 'react';
import { Download } from 'lucide-react';
import { TechnicalAlertSnapshot, isSnapshotExportable } from './snapshot';

// Read-only. Renders the SAME snapshot object the backend export route builds
// (both call buildTechnicalAlertSnapshot with equivalent input) -- it does
// not invoke AI, accept pending suggestions, edit findings, or reconstruct
// content independently. See "Review and Export Contract" in the refactor
// plan: this is the frontend half of the single-source-of-truth guarantee.

interface Props {
  snapshot: TechnicalAlertSnapshot;
  onExport: () => void;
  exporting: boolean;
}

export default function FinalReviewPanel({ snapshot, onExport, exporting }: Props) {
  const exportable = isSnapshotExportable(snapshot);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Final Review</h2>
        <button
          onClick={onExport}
          disabled={!exportable || exporting}
          title={!exportable ? 'Resolve blocking readiness issues before exporting' : undefined}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export DOCX'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
        <div><strong>Title:</strong> {snapshot.administrativeMetadata.title}</div>
        <div><strong>Number:</strong> {snapshot.administrativeMetadata.documentNumber}</div>
        <div><strong>Deadline:</strong> {snapshot.controlInformation.deadline}</div>
        <div><strong>Action By:</strong> {snapshot.controlInformation.actionBy.join(', ')}</div>
      </div>

      {snapshot.summary && (
        <div>
          <h3 className="font-bold text-slate-800 text-lg border-b border-slate-200 pb-2 mb-2">Summary</h3>
          {snapshot.summary.renderedText ? (
            <p className="text-sm leading-relaxed">{snapshot.summary.renderedText}</p>
          ) : (
            <div className="text-sm space-y-1">
              <p><strong>Subject:</strong> {snapshot.summary.subject}</p>
              <p><strong>Affected Scope:</strong> {snapshot.summary.affectedScope}</p>
              {snapshot.summary.centralProhibition && <p><strong>Prohibition:</strong> {snapshot.summary.centralProhibition}</p>}
              {snapshot.summary.centralRequirement && <p><strong>Requirement:</strong> {snapshot.summary.centralRequirement}</p>}
              {snapshot.summary.revocation && <p><strong>Revocation:</strong> {snapshot.summary.revocation}</p>}
            </div>
          )}
        </div>
      )}

      {snapshot.reasons && (
        <div>
          <h3 className="font-bold text-slate-800 text-lg border-b border-slate-200 pb-2 mb-2">Reasons</h3>
          {snapshot.reasons.narrative && (
            snapshot.reasons.narrative.renderedText ? (
              <div className="text-sm">
                <p className="leading-relaxed">{snapshot.reasons.narrative.renderedText}</p>
                <p className="text-xs text-slate-500 mt-1">Cause status: {snapshot.reasons.narrative.causeStatus}</p>
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <p><strong>Cause status:</strong> {snapshot.reasons.narrative.causeStatus}</p>
                {snapshot.reasons.narrative.technicalBasis && <p><strong>Technical Basis:</strong> {snapshot.reasons.narrative.technicalBasis}</p>}
                {snapshot.reasons.narrative.complianceBasis && <p><strong>Compliance Basis:</strong> {snapshot.reasons.narrative.complianceBasis}</p>}
                {snapshot.reasons.narrative.consequence && <p><strong>Consequence:</strong> {snapshot.reasons.narrative.consequence}</p>}
              </div>
            )
          )}
          {(snapshot.reasons.evidenceItems || []).length > 0 && (
            <ul className="list-disc pl-5 text-sm mt-1">
              {snapshot.reasons.evidenceItems!.map(e => <li key={e.id}>{e.component}: {e.concern}</li>)}
            </ul>
          )}
        </div>
      )}

      {snapshot.immediateAction && (
        <div>
          <h3 className="font-bold text-slate-800 text-lg border-b border-slate-200 pb-2 mb-2">Immediate Action</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {snapshot.immediateAction.items.map(i => (
              <li key={i.id}>{i.instructionText || i.requiredAction} <span className="font-semibold">({i.obligationStrength})</span></li>
            ))}
          </ul>
        </div>
      )}

      {snapshot.followUpAction && !snapshot.followUpAction.notApplicable && snapshot.followUpAction.items.length > 0 && (
        <div>
          <h3 className="font-bold text-slate-800 text-lg border-b border-slate-200 pb-2 mb-2">Follow-Up Action</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {snapshot.followUpAction.items.map(i => (
              <li key={i.id}>{i.instructionText || i.requiredAction} <span className="font-semibold">({i.obligationStrength})</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
