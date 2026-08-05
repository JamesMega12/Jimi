export type GroundingDiagnostics = any;
export type FCODiagnostics = any;
export type FCORequestData = any;
export type ProcedureCallout = any;

/**
 * One deterministic writing-convention correction actually applied to the
 * model's rewrite output by the post-generation auto-correct pass
 * (src/server/deterministicRules/). Distinct from the model's own,
 * LLM-generated `whatWasEdited` log: this is a machine-verifiable audit
 * trail of notation/spelling normalizations enforced from the handbook's
 * deterministic rule set, never touching the numeric value itself.
 */
export interface CorrectionRecord {
  /** Dotted path of the corrected field, e.g. "rewrittenSummary.paragraph". */
  field: string;
  /** Text before the correction (the specific matched span's containing string). */
  before: string;
  /** Text after the correction. */
  after: string;
  /** Which rule class fired: 'unit' | 'abbreviation' | 'spelling'. */
  ruleType: string;
  /** Stable id of the specific rule, e.g. "unit-degC". */
  ruleId: string;
}

export interface FCOPartInvolved {
  id: string;
  name: string;
  identifier: string;
  role: 'replaced' | 'installed' | 'reworked' | 'inspected' | 'tool' | 'affected';
  relatedTo: string[];
}

export interface ProcedureStepGroup {
  id: string;
  title: string;
  forPart?: string;
  steps: string[];
}

export interface ProcedureSection {
  title: string;
  steps?: string[];
  stepGroups?: ProcedureStepGroup[];
  notes?: string[];
  cautions?: string[];
  warnings?: string[];
}

export interface FCOProcedure {
  changeType: string;
  toolsMaterialsRequired?: {
    confirmedFromInput: string[];
    suggestedToConfirm: string[];
  };
  partsInvolved?: FCOPartInvolved[];
  sections: ProcedureSection[];
}

export type ProcedureCheckCategory =
  | 'pre_installation'
  | 'safety_preparation'
  | 'parts_check'
  | 'post_installation_check'
  | 'functional_check'
  | 'completion_verification';

export interface ProcedureCheckAnchor {
  stepGroupId: string;
  position: 'before' | 'after';
}

export interface ProcedureCheck {
  id: string;
  category: ProcedureCheckCategory;
  text: string;
  targetPartIds: string[];
  anchor?: ProcedureCheckAnchor;
  source: 'ai_suggestion' | 'manual';
  status: 'pending' | 'accepted' | 'edited' | 'dismissed';
  reason?: string;
  createdAt: string;
}

export interface ProcedureReadinessSuggestion {
  id: string;
  category: ProcedureCheckCategory;
  targetSection: string;
  suggestedText: string;
  reason: string;
  status: 'pending' | 'accepted' | 'edited' | 'dismissed';
  source: 'ai_suggestion';
  requiresUserConfirmation: true;
  createdAt: string;
  editedText?: string;
  // AI-proposed target, by name/title — never by id. Ids don't exist yet at
  // suggestion-generation time (stampProcedureIdentity only runs at accept),
  // and generatedProcedure can still be hand-edited between generation and
  // accept, so a name is the only thing that can be proposed honestly here.
  suggestedPartNames?: string[];
  suggestedStepGroupTitle?: string;
  suggestedAnchorPosition?: 'before' | 'after';
  // Human override of the above, shown/editable in ProcedureReadinessPanel
  // before Accept — same "suggested vs confirmed" pattern as editedText.
  // Resolved to real ids only at accept time, against the stamped procedure.
  confirmedPartNames?: string[];
  confirmedStepGroupTitle?: string;
  confirmedAnchorPosition?: 'before' | 'after';
}

export type FCOSummary = any;
export type KBDocument = any;
export type FcoDraft = any;
export type FcoSummaryAnalysis = any;
export type KBChunk = any;
export type DocxBlock = any;
export type DocxFigure = any;
export type DocxAnalysisResponse = any;
export type DocxTableMetadata = any;
export type FCOApiResponse = any;
export type GroundingSource = any;
export type DiffTrace = any;
export type DiffToken = any;
export type FcoPcsbField = any;
export type FcoPcsbConfidence = any;
export type WhatWasEdited = any;
export type FCOValidation = any;
