// Plain-data field guidance for the Technical Alert v2 drafting UI. No logic,
// no AI calls -- just short hints and realistic example placeholders so a
// first-time user knows what belongs in each field before ever touching the
// AI-assist buttons. See plans/role-you-are-working-delightful-cupcake.md
// ("UX/Clarity Improvements") for the rationale.

export interface FieldGuidance {
  hint: string;
  placeholder?: string;
}

export const SUMMARY_FIELD_GUIDANCE: Record<string, FieldGuidance> = {
  subject: {
    hint: 'One line naming the topic of this alert.',
    placeholder: 'e.g. Inconsistent Creston wiper plug performance in HPHT cementing',
  },
  affectedScope: {
    hint: 'What equipment, product, or process is affected -- be specific.',
    placeholder: 'e.g. Creston molded top and bottom wiper plugs used in HPHT cementing applications',
  },
  riskOrIssue: {
    hint: 'The concern in plain language, even if there is no formal requirement yet.',
    placeholder: 'e.g. Several recent jobs reported excessive rubber deformation and difficulty achieving a clear bump indication.',
  },
  centralRequirement: {
    hint: 'The core "must" statement, only if this alert states one directly.',
    placeholder: 'e.g. All affected units must be inspected before next use.',
  },
  centralProhibition: {
    hint: 'The core "must not / prohibited" statement, only if this alert states one directly.',
    placeholder: 'e.g. Creston molded wiper plugs must not be used for HPHT cementing applications.',
  },
  revocation: {
    hint: 'State here if this alert revokes a previously approved exemption or prior guidance.',
    placeholder: 'e.g. The exemption granted under TA 2024-11 is hereby revoked.',
  },
  effectiveTiming: {
    hint: 'When this takes effect -- required if a requirement, prohibition, or revocation is stated above.',
    placeholder: 'e.g. Effective immediately',
  },
  exceptionNote: {
    hint: 'A short restatement only -- the full exception details belong in Immediate Action.',
    placeholder: 'e.g. See exception for non-HPHT use in Immediate Action.',
  },
};

export const REASONS_FIELD_GUIDANCE: Record<string, FieldGuidance> = {
  technicalBasis: {
    hint: 'The engineering/technical explanation for why this alert is needed.',
    placeholder: 'e.g. Field feedback and inspection results indicate the plug material may not maintain its expected profile under HPHT conditions.',
  },
  complianceBasis: {
    hint: 'Any standard, procedure, or policy this issue relates to (optional).',
    placeholder: 'e.g. Tech Standard 102',
  },
  consequence: {
    hint: 'What could go wrong if this issue is not addressed.',
    placeholder: 'e.g. Loss of pressure integrity during bumping and uncertainty during pressure confirmation.',
  },
  causeStatus: {
    hint: 'How certain is the root cause? Be honest -- "suspected" is fine if it is not confirmed yet.',
  },
  evidenceComponent: {
    hint: 'The specific part, product, or item this evidence is about.',
    placeholder: 'e.g. Creston top molded wiper plug, 5.500-in',
  },
  evidenceConcern: {
    hint: 'What was observed or is suspected about it.',
    placeholder: 'e.g. Possible deformation and inconsistent bump indication',
  },
  evidenceEvidence: {
    hint: 'What backs this up -- a report, photo, measurement, job number (optional).',
    placeholder: 'e.g. Field reports from two recent jobs',
  },
};

export const ACTION_FIELD_GUIDANCE: Record<string, FieldGuidance> = {
  requiredAction: {
    hint: 'What must be done, stated as a clear instruction.',
    placeholder: 'e.g. Do not use Creston molded top or bottom wiper plugs for HPHT cementing applications.',
  },
  actor: {
    hint: 'Who is responsible for carrying this out (comma-separated roles/teams).',
    placeholder: 'e.g. Operations, PSD',
  },
  obligationStrength: {
    hint: 'How strict is this? "Mandatory" for a required action, "Prohibited" for a ban, "Conditional" if it depends on circumstances, "Advisory" for a recommendation only.',
  },
  target: {
    hint: 'What/where this action applies to, if not already obvious from the action text (optional).',
    placeholder: 'e.g. Creston molded wiper plugs, HPHT cementing',
  },
  timing: {
    hint: 'When this must happen (optional -- falls back to the deadline in Control Info if left blank).',
    placeholder: 'e.g. Immediately',
  },
  controlType: {
    hint: 'Tag this action if it involves removing equipment from service, red-tagging, quarantine, or escalation.',
  },
  exceptionRef: {
    hint: 'Link this action to an exception below if one applies to it.',
  },
  condition: {
    hint: 'The "if X, then..." qualifier for this action, distinct from a linked exception (optional).',
    placeholder: 'e.g. Only if the unit has already been dispatched to a job site',
  },
  exceptionCondition: {
    hint: 'What must be true for this exception to apply.',
    placeholder: 'e.g. Only for non-HPHT applications with prior product line confirmation.',
  },
  exceptionLimitations: {
    hint: 'The specific conditions/requirements attached to this exception, one per line.',
    placeholder: 'Requires a completed risk assessment.\nRequires sign-off from the Technical Director.',
  },
  exceptionApprovers: {
    hint: 'Who must approve use of this exception (comma-separated).',
    placeholder: 'e.g. Technical Director, Quality Manager',
  },
};

export const FOLLOW_UP_FIELD_GUIDANCE: Record<string, FieldGuidance> = {
  requiredAction: {
    hint: 'What longer-term action will happen -- write engineering changes in future tense (they are not done yet).',
    placeholder: 'e.g. Engineering will complete a root-cause investigation and issue qualification evidence before this restriction is lifted.',
  },
  followUpCategory: {
    hint: 'A rough grouping for readability -- monitoring, reporting, a procedural update, replacement, an engineering change, or the general way forward.',
  },
};
