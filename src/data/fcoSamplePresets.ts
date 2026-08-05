import { FcoDraft, FCORequestData } from '../types';

/**
 * Fictional FCO sample preset used for demoing the FCO Draft Assistant.
 *
 * The Summary and Procedure are intentionally rough, slightly wordy, and
 * repetitive so the AI Summary rewrite, Title generation, Procedure rewrite,
 * and Procedure readiness features have meaningful content to improve.
 *
 * They also deliberately contain a few SLB Communications Handbook style
 * violations so a "Load Sample -> Rewrite" run visibly demonstrates the
 * handbook grounding and the deterministic writing-convention layer:
 *   - "Schlumberger" (the old company name) -> corrected to "SLB"
 *     (handbook §1.1.7; deterministic rule abbr-slb-not-schlumberger)
 *   - "degrees Celsius" / "degrees Fahrenheit" -> "degC" / "degF"
 *     (handbook unit-symbol guidance; deterministic rules unit-degC/unit-degF)
 * Open the developer "Grounding & Corrections" panel after a rewrite to see the
 * retrieved handbook chunks and the applied corrections.
 *
 * acceptedSummary and acceptedProcedure are intentionally omitted (empty) so
 * the user starts by clicking "Generate AI Summary" first.
 */
export const fcoSamplePreset: FcoDraft = {
  fcoMetadata: {
    baseProductCode: '',
    fcoNumber: 'WCF FCO 6107',
    fcoTitle: 'CPF-412 High-Wear Discharge Manifold Clamp Upgrade',
    priority: 'Required',
    appliesTo: 'CPF-412 cementing pumper units with DM-500 discharge manifold clamp assembly',
    effectiveDate: '01-Aug-2026',
    productionStart: 'All active CPF-412 units built before 2026',
    application: 'All active CPF-412 units using current DM-500 discharge manifold clamp assembly',
    affectedEquipmentModel: 'CPF-412'
  },
  associatedInfo: {
    associatedRFI: 'N/A',
    supersededFCOs: 'N/A',
    associatedFCOs: 'N/A',
    associatedCOCAs: 'CA-13988421',
    associatedTechAlerts: 'N/A',
    qCheckServiceLevel: 'Yes',
    codingChanges: 'N/A',
    capitalize: 'No',
    commentsByOperations:
      'This required FCO applies to CPF-412 units with repeated clamp loosening or excessive clamp wear during high-rate cementing operation.'
  },
  costSchedule: {
    estimatedFcoCostUsd: '$2,850 per unit',
    estimatedSpecialEquipmentCostUsd: '$420 per district',
    estimatedTimeHours: '6 hours',
    dueDate: '31-Dec-2026'
  },
  additionalFcoInfo: {
    maintenanceProcedureChanges: '',
    markingInformation: ''
  },
  approvalRoles: {
    designEngineer: '',
    inTouchEngineer: '',
    fieldDecisionMaker: ''
  },
  technicalContent: {
    draftSummary:
      'During recent field maintenance and post-job inspection of Schlumberger CPF-412 cementing pumper units, several locations reported that the current DM-500 discharge manifold clamp assembly shows accelerated wear on the clamp contact faces and in some cases the clamp requires repeated tightening checks after high-rate cementing jobs where the discharge manifold can reach temperatures of approximately 50 degrees Celsius. The problem has not resulted in a confirmed pressure containment event, but it has increased maintenance time and created concern because the clamp is part of the discharge manifold connection that operators inspect frequently. The current clamp design uses the older contact profile and standard plated fasteners, and field feedback indicates that the contact face can wear unevenly when the manifold is assembled and disassembled repeatedly. The required change is to replace the current clamp assembly with the revised Schlumberger high-wear clamp kit, including the updated clamp halves, coated fasteners, and revised inspection washer. The revised clamp kit is rated for continuous operation up to 150 degrees Celsius [302 degrees Fahrenheit]. This update is expected to reduce clamp wear, improve inspection consistency, and reduce repeated rework during maintenance.',
    draftProcedure:
      'Do the following steps to replace the current DM-500 discharge manifold clamp assembly on Schlumberger CPF-412 cementing pumper units. Before starting, turn off the unit, isolate pressure, drain the discharge manifold, and follow the local Lockout/Tagout process. Confirm that there is no trapped pressure and that the manifold surface has cooled below 40 degrees Celsius before loosening clamp fasteners. Remove the existing clamp assembly from the discharge manifold connection and inspect the manifold hub faces for scoring, dents, corrosion, or material transfer. If the hub face is damaged, stop the work and contact Engineering before installing the new clamp. Clean the hub faces and remove old debris. Install the revised clamp halves from the Schlumberger high-wear clamp kit PN 109884210. Install coated fasteners PN 109884211 and inspection washers PN 109884212. Tighten the fasteners evenly in an alternating pattern. After assembly, mark the fastener position and perform a visual check after the first job. Record the clamp kit part number in the local maintenance record. If movement of the fastener marks is seen after operation, stop use and escalate before the next pumping job. [Figure 1: DM-500 discharge manifold clamp location] [Table 1: Old and new clamp components]',
    knownSafetyRisks: '',
    existingReferences: '',
    optionalRewriteInstructions: '',
    declaredParts: [
      { id: 'fco-sample-part-clamp-assembly', name: 'DM-500 discharge manifold clamp assembly', identifier: '105771900', role: 'replaced', relatedTo: [] },
      { id: 'fco-sample-part-clamp-kit', name: 'High-wear clamp kit', identifier: '109884210', role: 'installed', relatedTo: ['DM-500 discharge manifold clamp assembly'] },
      { id: 'fco-sample-part-fasteners', name: 'Coated fasteners', identifier: '109884211', role: 'installed', relatedTo: ['High-wear clamp kit'] },
      { id: 'fco-sample-part-washers', name: 'Inspection washers', identifier: '109884212', role: 'installed', relatedTo: ['High-wear clamp kit'] },
      { id: 'fco-sample-part-alignment-tool', name: 'Alignment guide tool', identifier: '109884213', role: 'tool', relatedTo: ['High-wear clamp kit'] },
      { id: 'fco-sample-part-hub', name: 'DM-500 discharge manifold hub', identifier: '105771902', role: 'inspected', relatedTo: [] }
    ],
    procedureCallouts: [],
    procedureReadinessSuggestions: []
  },
  fcoTables: {
    fcoHistory: {
      status: 'active',
      rows: []
    },
    partsOrKitsRequired: {
      status: 'active',
      rows: [
        {
          quantity: '01',
          partKitNumber: '109884210',
          description: 'KIT, HIGH-WEAR DISCHARGE MANIFOLD CLAMP, DM-500',
          cost: '$1,850.00',
          comments: 'One kit required per CPF-412 unit.'
        },
        {
          quantity: '04',
          partKitNumber: '109884211',
          description: 'FASTENER, COATED, DISCHARGE MANIFOLD CLAMP',
          cost: '$85.00 each',
          comments: 'Included in clamp kit; listed for service replacement.'
        },
        {
          quantity: '04',
          partKitNumber: '109884212',
          description: 'WASHER, INSPECTION, CLAMP FASTENER POSITION',
          cost: '$12.00',
          comments: 'Used to support visual movement checks.'
        }
      ]
    },
    specialEquipmentRequired: {
      status: 'active',
      rows: [
        {
          quantity: '01',
          partNumber: '109884213',
          description: 'TOOL, ALIGNMENT GUIDE, DM-500 CLAMP',
          cost: '$420.00',
          comments: 'One tool required per district or maintenance location.'
        }
      ]
    },
    partsRequiringRework: {
      status: 'active',
      rows: [
        {
          quantity: '01',
          partNumber: '105771902',
          description: 'HUB, DISCHARGE MANIFOLD, DM-500',
          reworkCost: '$0.00',
          comments: 'Inspect only. Rework is not authorized without Engineering approval.'
        }
      ]
    },
    partsToScrap: {
      status: 'active',
      rows: []
    }
  },
  visualPlaceholders: [
    {
      id: 'fco-sample-fig-1',
      type: 'figure',
      number: '1',
      caption: 'DM-500 discharge manifold clamp location',
      linkedSection: 'Procedure',
      status: 'placeholder_only',
      notes: 'Sample preset placeholder'
    },
    {
      id: 'fco-sample-table-1',
      type: 'table',
      number: '1',
      caption: 'Old and new clamp components',
      linkedSection: 'Procedure',
      status: 'placeholder_only',
      notes: 'Sample preset placeholder'
    }
  ]
};

/**
 * Builds a fresh FCORequestData object seeded with the FCO sample preset.
 *
 * Returns a deep clone each call so loading the sample repeatedly (or editing
 * the loaded draft) never mutates the shared module-level preset object. The
 * legacy flat fields are kept in sync with fcoDraft so the Step 1 inputs,
 * Step 2 metadata, and Step 3 export all read consistent values.
 */
export function createFcoSampleFormData(): FCORequestData {
  const draft: FcoDraft = JSON.parse(JSON.stringify(fcoSamplePreset));
  return {
    title: draft.fcoMetadata.fcoTitle,
    priority: draft.fcoMetadata.priority,
    changeType: '',
    detectedChangeType: '',
    confirmedChangeType: false,
    affectedEquipment: draft.fcoMetadata.affectedEquipmentModel,
    appliesTo: draft.fcoMetadata.appliesTo,
    effectiveDate: draft.fcoMetadata.effectiveDate,
    productionStart: draft.fcoMetadata.productionStart,
    knownSafetyRisks: draft.technicalContent.knownSafetyRisks,
    customDirectives: draft.technicalContent.optionalRewriteInstructions,
    rawSummary: draft.technicalContent.draftSummary,
    rawProcedure: draft.technicalContent.draftProcedure,
    originalProcedure: '',
    suggestedProcedure: '',
    confirmedProcedure: '',
    inputSource: 'manual',
    fcoDraft: draft
  };
}
