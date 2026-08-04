// Migrates a v1 TechnicalAlertDraft (the currently-live schema) into the v2
// draft shape. See plans/role-you-are-working-delightful-cupcake.md
// "Migration and Compatibility" for the strategy this implements: mechanical,
// high-confidence mappings apply directly; anything ambiguous is migrated with
// a safe default AND a Finding prompting the user to review it -- never a
// silent guess.
//
// Note: v1's `draft.summary`/`reasons`/`actions` are only ever written by the
// accept handlers (a Phase C invariant of the live app), so any non-empty
// value there is already-accepted content by construction -- this function
// does not need the old uiState to know what was "accepted".

import { TechnicalAlertAction, TechnicalAlertDraft } from '../components/technical-alert/types';
import {
  ActionItem,
  AdministrativeMetadata,
  ControlInformation,
  EvidenceItem,
  ExceptionRecord,
  Finding,
  FollowUpActionContent,
  ImmediateActionContent,
  ReasonsAccepted,
  SummaryAccepted,
  TechnicalAlertDraftV2,
} from '../components/technical-alert/v2/types';
import { createEmptySectionWorkspace } from '../components/technical-alert/v2/sectionWorkspace';

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`;
}

function finding(message: string, severity: Finding['severity'] = 'review_recommended', field?: string): Finding {
  return { id: newId(), field, severity, message };
}

function deriveObligationStrength(a: TechnicalAlertAction): ActionItem['obligationStrength'] {
  if (a.prohibited) return 'prohibited';
  if (a.mandatory) return 'mandatory';
  return 'unclear';
}

function inferControlType(instruction: string): ActionItem['controlType'] {
  const text = (instruction || '').toLowerCase();
  const tags: NonNullable<ActionItem['controlType']> = [];
  if (text.includes('red tag') || text.includes('red-tag')) tags.push('red_tag');
  if (text.includes('quarantine')) tags.push('quarantine');
  if (text.includes('remove from service') || text.includes('removed from service') || text.includes('removal from service')) tags.push('removal_from_service');
  if (text.includes('escalat')) tags.push('escalation');
  return tags.length > 0 ? tags : undefined;
}

function migrateAction(a: TechnicalAlertAction): ActionItem {
  return {
    id: a.id || newId(),
    actor: a.owner || [],
    requiredAction: a.instruction || '',
    target: a.affectedScope && a.affectedScope.length > 0 ? a.affectedScope.join(', ') : undefined,
    timing: a.timingOrDeadline || undefined,
    obligationStrength: deriveObligationStrength(a),
    controlType: inferControlType(a.instruction),
    requiredEvidence: a.sourceEvidence || undefined,
  };
}

function hasExemptionHint(a: TechnicalAlertAction): boolean {
  const t = (a.exemptionApplicability || '').trim().toLowerCase();
  return t.length > 0 && t !== 'none' && t !== 'n/a';
}

function migrateImmediateActionContent(
  old: TechnicalAlertDraft,
  draftFindings: Finding[]
): ImmediateActionContent {
  const oldActions = old.actions?.immediate || [];
  const items = oldActions.map(migrateAction);
  const exceptions: ExceptionRecord[] = [];

  const hintedActionIds = oldActions.filter(hasExemptionHint).map(a => a.id);

  if (old.exemption?.allowed) {
    const record: ExceptionRecord = {
      id: newId(),
      appliesTo: hintedActionIds,
      condition: old.exemption.conditionsOfTemporaryUse || '',
      limitations: old.exemption.supportingChecks || [],
      requiredApprovers: old.exemption.requiredApprovers || [],
      requiredEvidence: old.exemption.requiredRequestInformation || [],
      submissionSystem: old.exemption.submissionSystem || undefined,
      relatedStandard: old.exemption.relatedStandard || undefined,
    };
    exceptions.push(record);
    for (const item of items) {
      if (hintedActionIds.includes(item.id)) item.exceptionRef = record.id;
    }
    draftFindings.push(
      finding(
        hintedActionIds.length > 0
          ? `An exception record was migrated from the old exemption block and auto-linked to ${hintedActionIds.length} action(s) based on their "exemption applicability" notes. Please review the linkage.`
          : 'An exception record was migrated from the old exemption block but could not be linked to a specific action automatically. Please review and link it to the relevant action(s).',
        'review_recommended',
        'immediateAction.exceptions'
      )
    );
  } else {
    // No draft-level exemption, but an individual action still carried free-text
    // exemption notes -- preserve it as its own unlinked-context record rather
    // than dropping the information.
    for (const a of oldActions) {
      if (hasExemptionHint(a)) {
        const record: ExceptionRecord = {
          id: newId(),
          appliesTo: [a.id],
          condition: a.exemptionApplicability || '',
          limitations: [],
          requiredApprovers: [],
          requiredEvidence: [],
        };
        exceptions.push(record);
        const item = items.find(i => i.id === a.id);
        if (item) item.exceptionRef = record.id;
        draftFindings.push(
          finding(
            `An exception record was migrated from action "${a.instruction.slice(0, 60)}"'s free-text exemption note. Please review and complete its details (approvers, evidence, submission system).`,
            'resolution_required',
            'immediateAction.exceptions'
          )
        );
      }
    }
  }

  return { items, exceptions };
}

// 2026-07-28 fix: previously returned a non-null (accepted-worthy) result if
// EITHER field was present, so a v1 draft with only one of the two set
// produced `.accepted` with the other field as '' -- contradicting
// readiness.ts's rule that both are required, and showing a green "Accepted"
// badge in Drafting for content that readiness simultaneously blocked export
// on. Now requires BOTH non-empty; partial content is flagged for review
// instead of silently discarded or silently accepted.
function migrateSummary(old: TechnicalAlertDraft, draftFindings: Finding[]): SummaryAccepted | null {
  const s = old.summary;
  if (!s) return null;
  const subject = (s.issueOrRestriction || '').trim();
  const affectedScope = (s.affectedScope || '').trim();
  if (!subject || !affectedScope) {
    if (subject || affectedScope) {
      draftFindings.push(
        finding(
          'Summary had partial content in the old draft (missing subject or affected scope) -- it was not carried over as Accepted. Please review and complete it.',
          'resolution_required',
          'summary'
        )
      );
    }
    return null;
  }
  return {
    subject,
    affectedScope,
    effectiveTiming: s.effectiveTiming || undefined,
    exceptionNote: s.exceptionOrQualification || undefined,
  };
}

function migrateReasons(old: TechnicalAlertDraft, draftFindings: Finding[]): ReasonsAccepted | null {
  const hasNarrative = !!old.reasons?.trim();
  const hasEvidence = (old.componentTable || []).length > 0;
  if (!hasNarrative && !hasEvidence) return null;

  const evidenceItems: EvidenceItem[] = (old.componentTable || []).map(row => ({
    id: row.id || newId(),
    component: row.component || '',
    concern: row.concern || '',
    evidence: row.example || row.requiredAction || undefined,
  }));

  if (hasNarrative) {
    draftFindings.push(
      finding(
        'Reasons was migrated from free text with cause status defaulted to "unknown" -- please confirm whether the cause is confirmed, preliminary, suspected, or genuinely unknown.',
        'review_recommended',
        'reasons.narrative.causeStatus'
      )
    );
  }

  return {
    narrative: hasNarrative
      ? { technicalBasis: old.reasons, causeStatus: 'unknown' }
      : undefined,
    evidenceItems: evidenceItems.length > 0 ? evidenceItems : undefined,
  };
}

function migrateControlInformation(old: TechnicalAlertDraft): ControlInformation {
  return {
    deadline: old.controlInfo?.deadline || '',
    actionBy: old.controlInfo?.actionBy || [],
    informationFor: old.controlInfo?.informationFor || [],
    effectiveTiming: old.controlInfo?.effectiveTiming || '',
    acknowledgementRequired: !!old.controlInfo?.acknowledgementRequired,
    quizRequired: !!old.controlInfo?.quizRequired,
  };
}

function migrateAdministrativeMetadata(old: TechnicalAlertDraft): AdministrativeMetadata {
  return {
    title: old.metadata?.title || '',
    documentNumber: old.metadata?.documentNumber || '',
    inTouchId: old.metadata?.inTouchId || '',
    date: old.metadata?.date || '',
    gemsNo: old.metadata?.gemsNo || '',
    classification: old.metadata?.classification || '',
  };
}

export interface MigrationResult {
  draft: TechnicalAlertDraftV2;
  findings: Finding[];
}

export function migrateTechnicalAlertDraftV1ToV2(old: TechnicalAlertDraft): MigrationResult {
  const draftFindings: Finding[] = [];
  const now = new Date().toISOString();

  const summaryAccepted = migrateSummary(old, draftFindings);
  const reasonsAccepted = migrateReasons(old, draftFindings);
  const immediateContent = migrateImmediateActionContent(old, draftFindings);

  const summaryWs = createEmptySectionWorkspace<SummaryAccepted, SummaryAccepted>();
  summaryWs.raw = old.rawSections?.summaryInput || '';
  if (summaryAccepted) {
    summaryWs.accepted = { value: summaryAccepted, source: 'manual', basedOn: summaryWs.currentRevision, acceptedAt: now };
    draftFindings.push(
      finding(
        'Summary was migrated from the old flat issue/restriction and affected-scope fields. The new model distinguishes central requirement, central prohibition, and revocation -- please review and split these out if applicable.',
        'review_recommended',
        'summary'
      )
    );
  }

  const reasonsWs = createEmptySectionWorkspace<ReasonsAccepted, ReasonsAccepted>();
  reasonsWs.raw = old.rawSections?.reasonInput || '';
  if (reasonsAccepted) {
    reasonsWs.accepted = { value: reasonsAccepted, source: 'manual', basedOn: reasonsWs.currentRevision, acceptedAt: now };
  }

  const immediateWs = createEmptySectionWorkspace<ImmediateActionContent, ImmediateActionContent>();
  immediateWs.raw = old.rawSections?.actionInput || '';
  if (immediateContent.items.length > 0) {
    immediateWs.accepted = { value: immediateContent, source: 'manual', basedOn: immediateWs.currentRevision, acceptedAt: now };
  }

  // v1 has no concept of Follow-Up Action as an independent section (it's the
  // second array in the same shared `actions` bucket) -- migrate it as its own
  // section for the first time.
  const followUpWs = createEmptySectionWorkspace<FollowUpActionContent, FollowUpActionContent>();
  const followUpItems = (old.actions?.followUp || []).map(migrateAction);
  if (followUpItems.length > 0) {
    followUpWs.accepted = {
      value: { items: followUpItems, notApplicable: false },
      source: 'manual',
      basedOn: followUpWs.currentRevision,
      acceptedAt: now,
    };
  } else {
    draftFindings.push(
      finding(
        'Follow-Up Action had no content in the old draft. Please either add follow-up actions or explicitly mark this section "Not Applicable".',
        'review_recommended',
        'followUpAction'
      )
    );
  }

  const draft: TechnicalAlertDraftV2 = {
    documentType: 'Technical Alert',
    schemaVersion: 2,
    identity: { id: newId(), createdAt: now },
    sections: {
      summary: summaryWs,
      reasons: reasonsWs,
      immediateAction: immediateWs,
      followUpAction: followUpWs,
    },
    controlInformation: migrateControlInformation(old),
    supportingContent: {
      acknowledgement: old.controlInfo?.acknowledgementRequired
        ? {
            completionMethod: old.acknowledgement?.completionMethod || '',
            applicationOrSystem: old.acknowledgement?.applicationOrSystem || '',
            completionDeadline: old.acknowledgement?.completionDeadline || '',
            targetAudience: old.acknowledgement?.targetAudience || [],
            completionInstructions: old.acknowledgement?.completionInstructions || '',
          }
        : null,
      figures: Array.isArray(old.figures)
        ? old.figures.map((f: any, i: number) => ({ id: f?.id || newId(), number: f?.number ?? i + 1, caption: f?.caption || '' }))
        : [],
      tables: Array.isArray(old.tables)
        ? old.tables.map((t: any, i: number) => ({ id: t?.id || newId(), number: t?.number ?? i + 1, caption: t?.caption || '', columns: t?.columns || [] }))
        : [],
      references: Array.isArray(old.references)
        ? old.references.map((r: any) => ({ id: r?.id || newId(), label: typeof r === 'string' ? r : r?.label || '', url: r?.url, note: r?.note }))
        : [],
    },
    administrativeMetadata: migrateAdministrativeMetadata(old),
    workflow: { currentStage: 'drafting' },
  };

  return { draft, findings: draftFindings };
}
