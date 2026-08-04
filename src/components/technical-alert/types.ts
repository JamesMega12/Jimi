export interface TechnicalAlertDraft {
  documentType: "Technical Alert";
  metadata: {
    classification: string;
    documentNumber: string;
    inTouchId: string;
    date: string;
    gemsNo: string;
    title: string;
  };
  controlInfo: {
    deadline: string;
    actionBy: string[];
    informationFor: string[];
    effectiveTiming: string;
    acknowledgementRequired: boolean;
    quizRequired: boolean;
  };
  rawSections: {
    summaryInput: string;
    reasonInput: string;
    actionInput: string;
  };
  summaryMeta: {
    issueOrRestriction: string;
    affectedScope: string;
    exceptionOrQualification: string;
    effectiveTiming: string;
  };
  summary: {
    issueOrRestriction: string;
    affectedScope: string;
    exceptionOrQualification: string;
    effectiveTiming: string;
  };
  affectedScope: {
    components: string[];
    products: string[];
    suppliers: string[];
    partNumbers: string[];
    equipmentTypes: string[];
    applications: string[];
    locations: string[];
    usersOrAudience: string[];
    operationalImpact: string;
  };
  componentTable: {
    id: string;
    component: string;
    concern: string;
    example: string;
    requiredAction?: string;
  }[];
  reasonMeta: {
    technicalBasis: string;
    complianceBasis: string;
    consequence: string;
    evidence: string;
    certainty: string;
    sourceReferences: string[];
  };
  reasons: string;
  actions: {
    immediate: TechnicalAlertAction[];
    followUp: TechnicalAlertAction[];
  };
  exemption: {
    allowed: boolean;
    required: boolean;
    submissionSystem: string;
    requiredApprovers: string[];
    requiredRiskAssessment: boolean;
    requiredRequestInformation: string[];
    conditionsOfTemporaryUse: string;
    relatedStandard: string;
    supportingChecks: string[];
    replacementPlanRequired: boolean;
  };
  acknowledgement: {
    completionMethod: string;
    applicationOrSystem: string;
    completionDeadline: string;
    targetAudience: string[];
    completionInstructions: string;
  };
  figures: any[];
  tables: any[];
  references: any[];
  review: any;
}

export interface TechnicalAlertAction {
  id: string;
  category: string;
  instruction: string;
  owner: string[];
  timingOrDeadline: string;
  mandatory: boolean;
  prohibited: boolean;
  affectedScope: string[];
  exemptionApplicability: string;
  sourceEvidence: string;
}
