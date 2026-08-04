import { validateAndRepairResponse } from './src/server/validationService';
import { normalizeStyle } from './src/server/styleNormalizationService';

async function run() {
  console.log("=== TEST 1 ===");
  const reqData1: any = {
    title: "Replace Synthetic Pump Access Cover",
    priority: "Required",
    affectedEquipment: "Model X-100 Pump Assembly",
    appliesTo: "All Model X-100 Pump Assemblies in active field service",
    effectiveDate: "2026-07-01",
    productionStart: "All active units before 2026",
    knownSafetyRisks: "Lockout/Tagout, rotating equipment, pinch points",
    existingReferences: "Figure 1",
    rawSummary: "The current access cover on the Model X-100 pump assembly is difficult to secure during maintenance. This can lead to inconsistent installation after service. Replace the existing cover with access cover PN TEST-12345. The new cover improves installation consistency and helps reduce maintenance rework.",
    rawProcedure: "Turn off the pump and make sure it cannot start. Remove the existing access cover. Install the new access cover PN TEST-12345. Tighten the fasteners. Check that the cover is secure. Record the work in the maintenance system.",
    changeType: "Physical / Hardware Change",
    customDirectives: ""
  };
  
  const rawResponse1 = {
    rewrittenSummary: {
      components: {
        operationalFocus: "replace the existing cover with access cover PN TEST-12345",
        context: "the current access cover on the Model X-100 pump assembly is difficult to secure during maintenance",
        deploymentIntent: "field teams will replace it to ensure quality",
        expectedOutcome: "improves installation consistency and helps reduce maintenance rework"
      },
      paragraph: "", // intentionally empty to test assembly
      wordCount: 0,
      withinWordLimit: true
    },
    rewrittenProcedure: {
      changeType: "Physical / Hardware Change",
      sections: [
          {
              title: "A. Safety",
              steps: [],
              warnings: [],
              cautions: [],
              notes: []
          },
          {
              title: "C. Implementation",
              steps: ["Turn off the pump and make sure it cannot start.", "Remove the existing access cover.", "Install the new access cover PN TEST-12345.", "Tighten the fasteners.", "Check that the cover is secure.", "Record the work in the maintenance system."],
              warnings: [],
              cautions: [],
              notes: []
          }
      ]
    },
    whatWasEdited: {
      changeTypeIdentified: "Physical / Hardware Change",
      summaryWordingEdits: [],
      procedureWordingEdits: [],
      structuralEdits: [],
      preservedTechnicalInformation: ["PN TEST-12345", "Figure 1"]
    },
    techComReviewNotes: {
      missingInformation: [],
      safetyItemsToConfirm: [],
      referencesToConfirm: [],
      technicalItemsToConfirm: [],
      changeTypeConfirmation: [],
      sourceTruthConflicts: []
    }
  };
  
  const result1 = validateAndRepairResponse(rawResponse1, reqData1, "gemini", undefined, 1, { fallbackUsed: false }, []);
  console.log("Summary Paragraph Output:\n" + result1.rewrittenSummary?.paragraph);
  console.log("fallbackUsed boolean: " + (result1 as any).diagnostics?.fallbackUsed);
  console.log("Change Type Identified: " + result1.whatWasEdited?.changeTypeIdentified);
  console.log("Safety Warnings Injected: " + JSON.stringify(result1.rewrittenProcedure?.sections[0].warnings));
  console.log("Validation Result: " + JSON.stringify(result1.validation, null, 2));
  console.log("TechCom Notes: " + JSON.stringify(result1.techComReviewNotes, null, 2));

  console.log("\n=== TEST 2 ===");
  const reqData2: any = {
    title: "Test", rawSummary: "Test", rawProcedure: "Turn off the pump. Remove the cover. Install the new cover. Check the cover.",
    existingReferences: "SWI TEST-0001", priority: "Required", affectedEquipment: "None", appliesTo: "None", effectiveDate: "None", productionStart: "None", knownSafetyRisks: "", changeType: "Physical / Hardware Change", customDirectives: ""
  };
  
  const rawResponse2 = {
    rewrittenSummary: { components: { action: "a", cause: "b", benefit: "c" }, paragraph: "", wordCount: 0, withinWordLimit: true },
    rewrittenProcedure: {
      changeType: "Physical / Hardware Change",
      sections: [{ title: "Implementation", steps: ["Refer to SWI TEST-0001 in the manual.", "Turn off pump."], warnings: [], cautions: [], notes: [] }]
    },
    whatWasEdited: { changeTypeIdentified: "Physical / Hardware Change", summaryWordingEdits: [], procedureWordingEdits: [], structuralEdits: [], preservedTechnicalInformation: [] },
    techComReviewNotes: { missingInformation: [], safetyItemsToConfirm: [], referencesToConfirm: [], technicalItemsToConfirm: [], changeTypeConfirmation: [], sourceTruthConflicts: [] }
  };
  
  const result2 = validateAndRepairResponse(rawResponse2, reqData2, "gemini", undefined, 1, {}, []);
  console.log("Hallucination Notes generated: " + JSON.stringify(result2.techComReviewNotes?.referencesToConfirm));

  console.log("\n=== TEST 3 ===");
  const tempResult = normalizeStyle("Heat the component to 120 °C and hold for 10 minutes. Check that the measured temperature remains below 85 degrees Celsius after cooldown.", []);
  console.log("Normalized text: " + tempResult.normalizedText);
  console.log("Rules applied payload: " + JSON.stringify(tempResult.rulesApplied, null, 2));

  console.log("\n=== TEST 4 ===");
  console.log("DOCX steps count section: " + result1.rewrittenProcedure?.sections[1].steps.length);
  console.log("Export structure generated: " + (result1.rawFullOutput ? "TRUE" : "FALSE"));
}

run();
