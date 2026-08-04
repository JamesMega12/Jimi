import { TechnicalAlertDraft } from './types';

export const technicalAlertSamplePreset: TechnicalAlertDraft = {
  documentType: "Technical Alert",
  metadata: {
    classification: "SLB-Private",
    documentNumber: "WCF TA 2026-03",
    inTouchId: "9002384",
    date: "07-Jul-2026",
    gemsNo: "N/A",
    title: "Creston Molded Wiper Plugs Not Approved for HPHT Cementing Applications"
  },
  controlInfo: {
    deadline: "31-Jul-2026",
    actionBy: ["PSD", "P&SC", "Operations"],
    informationFor: ["OI", "Engineering", "Field Service Managers"],
    effectiveTiming: "Effective Immediately",
    acknowledgementRequired: true,
    quizRequired: true
  },
  rawSections: {
    summaryInput: "Several recent jobs using Creston molded wiper plugs in high-pressure, high-temperature cementing applications reported inconsistent plug performance. The reported conditions include excessive rubber deformation, difficulty achieving a clear bump indication, and in two cases suspected bypass during displacement. Because of this concern, Creston molded top and bottom wiper plugs should not be used for HPHT cementing applications until further review is completed.",
    reasonInput: "Initial field feedback and inspection results indicate that the plug material may not be maintaining the expected profile after exposure to elevated temperature and pressure conditions. The root cause has not been confirmed.",
    actionInput: "Effective immediately, do not use Creston molded top or bottom wiper plugs for HPHT cementing applications. P&SC should stop new purchases. Operations and PSD should acknowledge this Technical Alert."
  },
  summaryMeta: {
    issueOrRestriction: "Inconsistent plug performance in HPHT conditions including rubber deformation and suspected bypass.",
    affectedScope: "Creston molded top and bottom wiper plugs for HPHT cementing applications.",
    exceptionOrQualification: "Only restricted for HPHT applications.",
    effectiveTiming: "Effective immediately until further review is completed."
  },
  summary: {
    issueOrRestriction: "Inconsistent plug performance in HPHT conditions including rubber deformation and suspected bypass.",
    affectedScope: "Creston molded top and bottom wiper plugs for HPHT cementing applications.",
    exceptionOrQualification: "Only restricted for HPHT applications.",
    effectiveTiming: "Effective immediately until further review is completed."
  },
  affectedScope: {
    components: ["Creston molded top wiper plug", "Creston molded bottom wiper plug"],
    products: [],
    suppliers: ["Creston"],
    partNumbers: ["CWP-5500-T", "CWP-5500-B", "CWP-7000-T", "CWP-7000-B"],
    equipmentTypes: [],
    applications: ["HPHT cementing", "Casing displacement"],
    locations: [],
    usersOrAudience: [],
    operationalImpact: "Potential uncertainty during bump indication and pressure confirmation."
  },
  componentTable: [
    {
      id: "comp-1",
      component: "Creston top molded wiper plug, 5.500-in",
      concern: "Possible deformation and inconsistent bump indication",
      example: "Field reports from two recent jobs",
      requiredAction: "Do not use for HPHT applications"
    },
    {
      id: "comp-2",
      component: "Creston bottom molded wiper plug, 5.500-in",
      concern: "Possible bypass during displacement",
      example: "Volume discrepancies during displacement",
      requiredAction: "Do not use for HPHT applications"
    }
  ],
  reasonMeta: {
    technicalBasis: "Material deformation at elevated temperature and pressure.",
    complianceBasis: "",
    consequence: "Loss of pressure integrity during bumping.",
    evidence: "Field feedback and initial inspection results.",
    certainty: "Under Investigation",
    sourceReferences: []
  },
  reasons: "Initial field feedback and inspection results indicate that the plug material may not be maintaining the expected profile after exposure to elevated temperature and pressure conditions. The root cause has not been confirmed.",
  actions: {
    immediate: [
      {
        id: "act-1",
        category: "immediate",
        instruction: "Do not use Creston molded top or bottom wiper plugs for HPHT cementing applications.",
        owner: ["Operations", "PSD"],
        timingOrDeadline: "Immediately",
        mandatory: true,
        prohibited: true,
        affectedScope: ["HPHT Cementing"],
        exemptionApplicability: "Exemption required for planned jobs",
        sourceEvidence: ""
      },
      {
        id: "act-2",
        category: "immediate",
        instruction: "Stop new purchases of affected plug types.",
        owner: ["P&SC"],
        timingOrDeadline: "Immediately",
        mandatory: true,
        prohibited: true,
        affectedScope: ["Purchasing"],
        exemptionApplicability: "None",
        sourceEvidence: ""
      }
    ],
    followUp: []
  },
  exemption: {
    allowed: true,
    required: true,
    submissionSystem: "Exemption Management System (EMS)",
    requiredApprovers: ["Technical Director", "Quality Manager"],
    requiredRiskAssessment: true,
    requiredRequestInformation: ["Plug size", "Job conditions", "Inspection results"],
    conditionsOfTemporaryUse: "Only for non-HPHT with prior product line confirmation.",
    relatedStandard: "Tech Standard 102",
    supportingChecks: [],
    replacementPlanRequired: false
  },
  acknowledgement: {
    completionMethod: "Online Quiz",
    applicationOrSystem: "TechAlert Portal",
    completionDeadline: "31-Jul-2026",
    targetAudience: ["Operations", "PSD"],
    completionInstructions: "Log in to the TechAlert Portal, read the alert, and complete the 5-question quiz."
  },
  figures: [],
  tables: [],
  references: [],
  review: {
    readiness: "Ready",
    missingFields: [],
    warnings: [],
    blockingIssues: [],
    suggestions: []
  }
};