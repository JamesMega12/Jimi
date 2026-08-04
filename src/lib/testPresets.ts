import { FCORequestData } from "../types";

export interface TestingPreset {
  name: string;
  description: string;
  data: Partial<FCORequestData>;
}

export const PRESETS: TestingPreset[] = [
  {
    name: "FCO 5023 — Kalsi Seal Upgrade",
    description: "Realistic FCO sample for CPF-377 Kalsi seal upgrade procedure authoring, rewrite, table handling, placeholder handling, callout handling, readiness suggestions, and DOCX export testing.",
    data: {
      title: "WCF FCO 5023 CPF-377 Kalsi Seal Upgrade for Serva 5x6 C-Pump in USL",
      priority: "Preferred",
      changeType: "Physical / Hardware Change",
      affectedEquipment: "CPF-377 / Serva 5x6 C-Pump",
      appliesTo: "CPF-377 (PN 100245635) in USL",
      effectiveDate: "01-01-2026",
      productionStart: "All Active CPF-377 Units in USL before 2026",
      knownSafetyRisks: "Lockout/Tagout must be followed before work starts. Pump disassembly, seal installation, lubrication, flushing, pressurized oil supply, and functional checks require appropriate safety controls.",
      customDirectives: "",
      rawSummary: "This preferred Field Change Order (FCO) recommends replacing the Parker packing seals with Kalsi K-Cartridge seals (PN 106039920) on Serva 5x6 C-pumps for CPF-377 units in USL.\n\nThe current Parker packing seals on Serva 5x6 C-pumps wear out rapidly and are prone to leakage during operation, making seal failure the most common issue reported for these pumps. This directly impacts the Mean Time Between Maintenance (MTBM) of cementing pumper units.\n\nField tests of the Kalsi K-Cartridge seals on CPF-377 units in USL demonstrated twice the service life compared to the Parker seals, provided they are properly installed and maintained. This extended reliability supports the initial investment by reducing the frequency of seal replacements and justifying the cost through improved operational uptime.\n\nTo enhance MTBM and increase unit availability, it is recommended to adopt the Kalsi K-Cartridge seal for all Serva 5x6 C-pumps on CPF-377 units in USL.",
      rawProcedure: "Do the following steps to upgrade 5x6 C-pumps with Kalsi K-Cartridge seals.\n\nA. Parts\n\nFor each CPF-377 unit, the location needs to order the following parts and installation tools from Serva Corporation:\n\n- QTY 2: Kalsi K-Cartridge seal assembly (SLB PN 106039920 / Kalsi MFG PN 557).\n- QTY 2: Modified Tungsten-Carbide Coated 5x6 C-pump shaft (SLB PN 104667668 / Serva MFG PN P06-01-932).\n\nB. Disassemble the stuffing box and shaft\n\n- Turn OFF all systems and power supply.\n- Remove the 5x6 C-pump from the unit.\n- Disassemble the pump to remove the stuffing box and shaft. Refer to the SWI for C-pump disassembly, InTouch 6750436.\n\nC. Preparation and inspection\n\n- Remove the spring-loaded latch and spring from the stuffing box. [Insert Figure 1: Spring-loaded latch on 5x6 C-pump]\n- Examine the seal running surface for damage and wear. [Insert Figure 2: Modified TC-Coated 5x6 C-pump Shaft]\n- Install the new shaft in the C-pump.\n- Examine the seal running areas of the installed shaft. Make sure that the areas are clean and free of dirt. [Insert Figure 3: Seal running areas on shaft]\n- Clean and deburr the recessed surfaces on the pump frame where the rim of the seal carrier is seated. [Insert Figure 4: Clean and polish recessed surfaces]\n\nD. Install Kalsi K-Cartridge seal\n\n- Temporarily position the pump vertically by securely clamping the pump frame in a vise. [Insert Figure 5: Position C-pump in vertical direction]\n- Insert the installation sleeve tool into the shaft.\n- Apply lubrication oil (15W-40) to the shaft and the installation sleeve tool.\n- Apply lubrication oil to the O-ring inside the fan/dust cover.\n- Slide the fan/dust cover onto the shaft. Position the flat surface toward the bearing box side and the contoured fan-blade surface toward the seal cartridge.\n- Examine the shaft. Make sure that it is clean and free of defects.\n- Apply lubrication oil to the shaft and the installation sleeve tool again.\n- Apply lubrication oil to the inner surfaces of the seals within the Kalsi K-Cartridge seal.\n- Do not use grease. Particles in some greases can cause abrasion and damage to the seals.\n- Carefully slide the Kalsi K-Cartridge seal onto the shaft and along its length.\n- Remove the installation sleeve tool and keep it for future use during the next seal installation.\n- Keep the pump in a vertical position to let the K-Cartridge self-center.\n- Install and fasten the rear wear plate to secure the Kalsi K-Cartridge seal onto the pump.\n- Apply a small amount of silicone gasket material to the retaining ring holes to prevent clogging.\n- Slide the dust/fan cover away from the rear end of the K-Cartridge to maintain a gap of approximately 1/16 in.\n- Tighten the set screw on the dust/fan cover to secure its connection to the shaft.\n- Complete the C-pump assembly according to InTouch 6750436.\n\nE. Installation of Kalsi Seal with Air-Over-Oil Lubrication System on CPF Unit\n\n- Examine the lubrication system for the C-pump packing seals. Make sure that the system is an air-over-oil lubrication system.\n- Install the 5x6 C-pump with Kalsi seal onto the CPF-377 unit.\n- Remove the needle valve from the C-pump lube system.\n- Use 5 to 10 psi of air pressure in the packing oil tank to overcome the crack pressure of the check valve and fill and flush the oil line with a continuous oil flow.\n- Collect the oil in a clean cup or container. Make sure that the lubrication oil is clean and free of contaminants and debris.\n- If contaminants or debris are detected, flush the lubrication system, replace oil lines, and refill with clean lubrication oil.\n- Connect the oil line to the bottom port of the Kalsi seal.\n- With the top port open, fill the Kalsi seal carrier with oil through the bottom port.\n- Continue flushing until all air is purged from the lube line and seal carrier housing through the top port.\n- After all air is purged, plug the top port of the Kalsi seal.\n- Complete the pump installation on the unit.\n- Set the lube oil packing tank pressure to 60 psi. Do not exceed 65 psi.\n- After installing the new seal, operate the pump with water at rated speed for 20 minutes to make sure that the pump and Kalsi seal operate correctly at normal discharge pressure.\n- Do not operate the Kalsi seal without lubrication oil or sufficient air pressure in the lube oil packing tank.\n- Do not operate the Kalsi seal without circulating fluid inside the pump volute.\n- After stopping the pump, examine the lubrication system for leaks and make sure that the Kalsi seal maintains static sealing.\n\nF. Rebuild Procedures for Kalsi K-Cartridge Seal\n\n- When seal rebuilding is required, prepare the seal repair kit, seal rebuilding tool, and modified TC-coated shaft.\n- Make sure that the seal carrier housing is in good condition. If it is severely worn or damaged, replace the housing.\n- During rebuilding, clean the seal carrier thoroughly and examine it for nicks and excessive wear.\n- Verify that the rebuild kit is appropriate for the specific Kalsi Cartridge seal.\n- Assemble the Kalsi seal as shown in the applicable assembly drawing. [Insert Figure 6: Kalsi K-Cartridge Seal Assembly]\n- Make sure that the lettering sides of both Kalsi seals face the lubricant.\n- Install the dry, unlubricated Kalsi seals into the clean, dry, unlubricated grooves of the seal carrier.\n- Do not lubricate the seal outside diameter or seal groove.\n- Install the two lip seals in the orientation shown in the applicable assembly drawing.\n- Never use grease for this purpose.\n- Install the steel ring.\n- Install the retaining ring using a properly sized retaining ring tool.\n- After rebuilding is complete, the Kalsi seal is ready for installation.",
      fcoDraft: {
        fcoMetadata: {
          baseProductCode: "WCF",
          fcoNumber: "5023",
          fcoTitle: "WCF FCO 5023 CPF-377 Kalsi Seal Upgrade for Serva 5x6 C-Pump in USL",
          priority: "Preferred",
          appliesTo: "CPF-377 (PN 100245635) in USL",
          effectiveDate: "01-01-2026",
          productionStart: "All Active CPF-377 Units in USL before 2026",
          application: "All active CPF-377 units in USL",
          affectedEquipmentModel: "CPF-377 / Serva 5x6 C-Pump"
        },
        associatedInfo: {
          associatedRFI: "N/A",
          supersededFCOs: "N/A",
          associatedFCOs: "N/A",
          associatedCOCAs: "CA-12480177",
          associatedTechAlerts: "N/A",
          qCheckServiceLevel: "Yes",
          codingChanges: "N/A",
          capitalize: "No",
          commentsByOperations: "This is a preferred FCO, only applicable to all active CPF-377 units (PN 100245635) in USL."
        },
        costSchedule: {
          estimatedFcoCostUsd: "Estimated $3,060 / CPF-377 (2x C-pumps)",
          estimatedSpecialEquipmentCostUsd: "Estimated $734",
          estimatedTimeHours: "8 hours",
          dueDate: "2026-12-31"
        },
        additionalFcoInfo: {
          maintenanceProcedureChanges: "SWI, Disassemble and Assemble Centrifugal Pumps, InTouch 6750436.",
          markingInformation: "N/A."
        },
        approvalRoles: {
          designEngineer: "Li Hailong",
          inTouchEngineer: "Mohamed Donia",
          fieldDecisionMaker: "Maheswar Gattupalli"
        },
        technicalContent: {
          draftSummary: "This preferred Field Change Order (FCO) recommends replacing the Parker packing seals with Kalsi K-Cartridge seals (PN 106039920) on Serva 5x6 C-pumps for CPF-377 units in USL.\n\nThe current Parker packing seals on Serva 5x6 C-pumps wear out rapidly and are prone to leakage during operation, making seal failure the most common issue reported for these pumps. This directly impacts the Mean Time Between Maintenance (MTBM) of cementing pumper units.\n\nField tests of the Kalsi K-Cartridge seals on CPF-377 units in USL demonstrated twice the service life compared to the Parker seals, provided they are properly installed and maintained. This extended reliability supports the initial investment by reducing the frequency of seal replacements and justifying the cost through improved operational uptime.\n\nTo enhance MTBM and increase unit availability, it is recommended to adopt the Kalsi K-Cartridge seal for all Serva 5x6 C-pumps on CPF-377 units in USL.",
          draftProcedure: "Do the following steps to upgrade 5x6 C-pumps with Kalsi K-Cartridge seals.\n\nA. Parts\n\nFor each CPF-377 unit, the location needs to order the following parts and installation tools from Serva Corporation:\n\n- QTY 2: Kalsi K-Cartridge seal assembly (SLB PN 106039920 / Kalsi MFG PN 557).\n- QTY 2: Modified Tungsten-Carbide Coated 5x6 C-pump shaft (SLB PN 104667668 / Serva MFG PN P06-01-932).\n\nB. Disassemble the stuffing box and shaft\n\n- Turn OFF all systems and power supply.\n- Remove the 5x6 C-pump from the unit.\n- Disassemble the pump to remove the stuffing box and shaft. Refer to the SWI for C-pump disassembly, InTouch 6750436.\n\nC. Preparation and inspection\n\n- Remove the spring-loaded latch and spring from the stuffing box. [Insert Figure 1: Spring-loaded latch on 5x6 C-pump]\n- Examine the seal running surface for damage and wear. [Insert Figure 2: Modified TC-Coated 5x6 C-pump Shaft]\n- Install the new shaft in the C-pump.\n- Examine the seal running areas of the installed shaft. Make sure that the areas are clean and free of dirt. [Insert Figure 3: Seal running areas on shaft]\n- Clean and deburr the recessed surfaces on the pump frame where the rim of the seal carrier is seated. [Insert Figure 4: Clean and polish recessed surfaces]\n\nD. Install Kalsi K-Cartridge seal\n\n- Temporarily position the pump vertically by securely clamping the pump frame in a vise. [Insert Figure 5: Position C-pump in vertical direction]\n- Insert the installation sleeve tool into the shaft.\n- Apply lubrication oil (15W-40) to the shaft and the installation sleeve tool.\n- Apply lubrication oil to the O-ring inside the fan/dust cover.\n- Slide the fan/dust cover onto the shaft. Position the flat surface toward the bearing box side and the contoured fan-blade surface toward the seal cartridge.\n- Examine the shaft. Make sure that it is clean and free of defects.\n- Apply lubrication oil to the shaft and the installation sleeve tool again.\n- Apply lubrication oil to the inner surfaces of the seals within the Kalsi K-Cartridge seal.\n- Do not use grease. Particles in some greases can cause abrasion and damage to the seals.\n- Carefully slide the Kalsi K-Cartridge seal onto the shaft and along its length.\n- Remove the installation sleeve tool and keep it for future use during the next seal installation.\n- Keep the pump in a vertical position to let the K-Cartridge self-center.\n- Install and fasten the rear wear plate to secure the Kalsi K-Cartridge seal onto the pump.\n- Apply a small amount of silicone gasket material to the retaining ring holes to prevent clogging.\n- Slide the dust/fan cover away from the rear end of the K-Cartridge to maintain a gap of approximately 1/16 in.\n- Tighten the set screw on the dust/fan cover to secure its connection to the shaft.\n- Complete the C-pump assembly according to InTouch 6750436.\n\nE. Installation of Kalsi Seal with Air-Over-Oil Lubrication System on CPF Unit\n\n- Examine the lubrication system for the C-pump packing seals. Make sure that the system is an air-over-oil lubrication system.\n- Install the 5x6 C-pump with Kalsi seal onto the CPF-377 unit.\n- Remove the needle valve from the C-pump lube system.\n- Use 5 to 10 psi of air pressure in the packing oil tank to overcome the crack pressure of the check valve and fill and flush the oil line with a continuous oil flow.\n- Collect the oil in a clean cup or container. Make sure that the lubrication oil is clean and free of contaminants and debris.\n- If contaminants or debris are detected, flush the lubrication system, replace oil lines, and refill with clean lubrication oil.\n- Connect the oil line to the bottom port of the Kalsi seal.\n- With the top port open, fill the Kalsi seal carrier with oil through the bottom port.\n- Continue flushing until all air is purged from the lube line and seal carrier housing through the top port.\n- After all air is purged, plug the top port of the Kalsi seal.\n- Complete the pump installation on the unit.\n- Set the lube oil packing tank pressure to 60 psi. Do not exceed 65 psi.\n- After installing the new seal, operate the pump with water at rated speed for 20 minutes to make sure that the pump and Kalsi seal operate correctly at normal discharge pressure.\n- Do not operate the Kalsi seal without lubrication oil or sufficient air pressure in the lube oil packing tank.\n- Do not operate the Kalsi seal without circulating fluid inside the pump volute.\n- After stopping the pump, examine the lubrication system for leaks and make sure that the Kalsi seal maintains static sealing.\n\nF. Rebuild Procedures for Kalsi K-Cartridge Seal\n\n- When seal rebuilding is required, prepare the seal repair kit, seal rebuilding tool, and modified TC-coated shaft.\n- Make sure that the seal carrier housing is in good condition. If it is severely worn or damaged, replace the housing.\n- During rebuilding, clean the seal carrier thoroughly and examine it for nicks and excessive wear.\n- Verify that the rebuild kit is appropriate for the specific Kalsi Cartridge seal.\n- Assemble the Kalsi seal as shown in the applicable assembly drawing. [Insert Figure 6: Kalsi K-Cartridge Seal Assembly]\n- Make sure that the lettering sides of both Kalsi seals face the lubricant.\n- Install the dry, unlubricated Kalsi seals into the clean, dry, unlubricated grooves of the seal carrier.\n- Do not lubricate the seal outside diameter or seal groove.\n- Install the two lip seals in the orientation shown in the applicable assembly drawing.\n- Never use grease for this purpose.\n- Install the steel ring.\n- Install the retaining ring using a properly sized retaining ring tool.\n- After rebuilding is complete, the Kalsi seal is ready for installation.",
          knownSafetyRisks: "Lockout/Tagout must be followed before work starts. Pump disassembly, seal installation, lubrication, flushing, pressurized oil supply, and functional checks require appropriate safety controls.",
          existingReferences: "SWI, Disassemble and Assemble Centrifugal Pumps, InTouch 6750436.",
          optionalRewriteInstructions: "",
          procedureCallouts: [
            {
              id: "callout-1",
              type: "warning",
              section: "Safety and Preparation",
              text: "Before starting work, follow the applicable Lockout/Tagout procedure and make sure the equipment is in the required safe state."
            },
            {
              id: "callout-2",
              type: "note",
              section: "Installation Steps",
              text: "The installation sleeve tool is used during Kalsi seal installation to prevent damage from the shaft chamfer."
            }
          ],
          procedureReadinessSuggestions: []
        },
        fcoTables: {
          fcoHistory: {
            status: "not_applicable",
            rows: []
          },
          partsOrKitsRequired: {
            status: "active",
            rows: [
              {
                quantity: "01",
                partKitNumber: "106039920",
                description: "SEAL, ASSEMBLY, KALSI K-CARTRIDGE, 557, BIDIRECTIONAL, SERVA, RA56 C-PUMP, WITH FAN AND DUST COVER",
                cost: "$1,040.00 / pc",
                comments: "A complete set—to be used only during the initial upgrade."
              }
            ]
          },
          specialEquipmentRequired: {
            status: "active",
            rows: [
              {
                quantity: "01",
                partNumber: "106039922",
                description: "TOOL, INSTALLATION SLEEVE, KALSI K-CARTRIDGE, 557, BIDIRECTIONAL",
                cost: "$30.00",
                comments: "Installation tool for Kalsi seal on C-pump. One is required per location."
              },
              {
                quantity: "02",
                partNumber: "100291788",
                description: "TOOL, KALSI LIP SEAL INSTALLATION FOR C PUMPS",
                cost: "$190.00",
                comments: "Installation tool for reassembling the Kalsi seal. One is required per location."
              },
              {
                quantity: "03",
                partNumber: "106039921",
                description: "SEAL, REBUILD KIT, Kalsi K-CARTRIDGE, 557, BIDIRECTIONAL, SERVA 5X6 C-PUMP",
                cost: "$514.00",
                comments: "Kalsi seal repair kit—for seal repacking following a seal failure."
              }
            ]
          },
          partsRequiringRework: {
            status: "active",
            rows: [
              {
                quantity: "01",
                partNumber: "104667668",
                description: "SHAFT, CENTRIFUGAL EXTENDED 5X6, TUNGSTEN CARBIDE, KALSI K-CARTRIDGE",
                reworkCost: "$490.00",
                comments: "Tungsten-Carbide coated shaft—modified with reduced coating length for compatibility Kalsi seal."
              }
            ]
          },
          partsToScrap: {
            status: "not_applicable",
            rows: []
          }
        },
        visualPlaceholders: [
          {
            id: "preset-5023-ph-1",
            type: "figure",
            number: "1",
            caption: "Spring-loaded latch on 5x6 C-pump",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: ""
          },
          {
            id: "preset-5023-ph-2",
            type: "figure",
            number: "2",
            caption: "Modified TC-Coated 5x6 C-pump Shaft",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: ""
          },
          {
            id: "preset-5023-ph-3",
            type: "figure",
            number: "3",
            caption: "Seal running areas on shaft",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: ""
          },
          {
            id: "preset-5023-ph-4",
            type: "figure",
            number: "4",
            caption: "Clean and polish recessed surfaces",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: ""
          },
          {
            id: "preset-5023-ph-5",
            type: "figure",
            number: "5",
            caption: "Position C-pump in vertical direction",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: ""
          },
          {
            id: "preset-5023-ph-6",
            type: "figure",
            number: "6",
            caption: "Kalsi K-Cartridge Seal Assembly",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: ""
          }
        ]
      }
    }
  },
  {
    name: "Physical Hardware FCO",
    description: "Hardware replacement with standard procedure.",
    data: {
      title: "Replace Synthetic Pump Access Cover",
      priority: "Required",
      changeType: "Physical / Hardware Change",
      affectedEquipment: "Model X-100 Pump Assembly",
      appliesTo: "All Model X-100 Pump Assemblies in active field service",
      effectiveDate: "01-07-2026",
      productionStart: "All active units before 2026",
      knownSafetyRisks: "Lockout/Tagout, rotating equipment, pinch points",
      customDirectives: "Keep part number PN TEST-12345 unchanged. Use operator-friendly wording.",
      rawSummary: "The current access cover on the Model X-100 pump assembly is difficult to secure during maintenance. This can lead to inconsistent installation after service.\n\n[Insert Figure 1: Old access cover issues]\n\nReplace the existing cover with access cover PN TEST-12345. The new cover improves installation consistency and helps reduce maintenance rework.",
      rawProcedure: "Turn off the pump and make sure it cannot start. Remove the existing access cover, see Figure 1.\n\n[Insert Figure 1: Old Access Cover Removal]\n\nInstall the new access cover PN TEST-12345, see Figure 2.\n\n[Insert Figure 2: New Cover PN TEST-12345 Installation]\n\nTighten the fasteners. Check that the cover is secure. Record the work in the maintenance system.\n\n[Insert Table 1: Parts or Kits Required]",
      fcoDraft: {
        fcoMetadata: {
          baseProductCode: "SYN-PMP",
          fcoNumber: "8001010",
          fcoTitle: "Replace Synthetic Pump Access Cover",
          priority: "Required",
          appliesTo: "All Model X-100 Pump Assemblies in active field service",
          effectiveDate: "01-07-2026",
          productionStart: "All active units before 2026",
          application: "Pumping Services",
          affectedEquipmentModel: "Model X-100 Pump Assembly"
        },
        associatedInfo: {
          associatedRFI: "RFI-2026-041",
          supersededFCOs: "None",
          associatedFCOs: "7005990",
          associatedCOCAs: "None",
          associatedTechAlerts: "TA-2026-009",
          qCheckServiceLevel: "Level 2",
          codingChanges: "N/A",
          capitalize: "Yes",
          commentsByOperations: "Field teams request kit availability before Q3."
        },
        costSchedule: {
          estimatedFcoCostUsd: "$1,200",
          estimatedSpecialEquipmentCostUsd: "$0",
          estimatedTimeHours: "4.0",
          dueDate: "30-12-2026"
        },
        additionalFcoInfo: {
          maintenanceProcedureChanges: "Update SWI-PMP-105 with new access cover details.",
          markingInformation: "Mark with FCO 8001010 near data plate."
        },
        approvalRoles: {
          designEngineer: "Jane Doe",
          inTouchEngineer: "John Smith",
          fieldDecisionMaker: "Alice Johnson"
        },
        technicalContent: {
          draftSummary: "The current access cover on the Model X-100 pump assembly is difficult to secure during maintenance. This can lead to inconsistent installation after service.\n\n[Insert Figure 1: Old access cover issues]\n\nReplace the existing cover with access cover PN TEST-12345. The new cover improves installation consistency and helps reduce maintenance rework.",
          draftProcedure: "Turn off the pump and make sure it cannot start. Remove the existing access cover, see Figure 1.\n\n[Insert Figure 1: Old Access Cover Removal]\n\nInstall the new access cover PN TEST-12345, see Figure 2.\n\n[Insert Figure 2: New Cover PN TEST-12345 Installation]\n\nTighten the fasteners. Check that the cover is secure. Record the work in the maintenance system.\n\n[Insert Table 1: Parts or Kits Required]",
          knownSafetyRisks: "Lockout/Tagout, rotating equipment, pinch points",
          existingReferences: "InTouch 8029999",
          optionalRewriteInstructions: "Keep part number PN TEST-12345 unchanged. Use operator-friendly wording.",
          procedureReadinessSuggestions: [
            {
              id: "preset-suggest-1",
              category: "safety_preparation",
              targetSection: "Safety and Preparation",
              suggestedText: "Verify that all electrical power sources to the pump assembly are isolated and locked out in accordance with LOTO procedures before removing the access cover.",
              reason: "Ensure field technicians' safety by adding explicit LOTO validation steps before exposure to rotating parts.",
              status: "pending",
              source: "ai_suggestion",
              requiresUserConfirmation: true,
              createdAt: "2026-06-30T00:00:00Z"
            },
            {
              id: "preset-suggest-2",
              category: "post_installation_check",
              targetSection: "Post-Installation / Functional Check",
              suggestedText: "Verify the new access cover fasteners are torqued to [To be confirmed by submitter] to prevent vibration loosening.",
              reason: "Ensure the new cover is securely installed to prevent fluid leakage or safety hazards.",
              status: "pending",
              source: "ai_suggestion",
              requiresUserConfirmation: true,
              createdAt: "2026-06-30T00:00:00Z"
            },
            {
              id: "preset-suggest-3",
              category: "functional_check",
              targetSection: "Post-Installation / Functional Check",
              suggestedText: "Perform a short functional test run of the pump to inspect for normal operation and ensure no abnormal noise or vibration from the new access cover area.",
              reason: "Verify that the replacement part does not interfere with the pump's normal operation.",
              status: "pending",
              source: "ai_suggestion",
              requiresUserConfirmation: true,
              createdAt: "2026-06-30T00:00:00Z"
            }
          ]
        },
        fcoTables: {
          fcoHistory: {
            status: "active",
            rows: [
              { fcoNumber: "7005990", priority: "Required", application: "Pumping Services", description: "Initial release of base pump assembly." }
            ]
          },
          partsOrKitsRequired: {
            status: "active",
            rows: [
              { quantity: "1", partKitNumber: "PN TEST-12345", description: "Access Cover Kit", cost: "$1,200", comments: "Includes updated fasteners." }
            ]
          },
          specialEquipmentRequired: {
            status: "not_applicable",
            rows: []
          },
          partsRequiringRework: {
            status: "not_applicable",
            rows: []
          },
          partsToScrap: {
            status: "active",
            rows: [
              { quantity: "1", partNumber: "PN OLD-999", description: "Old Access Cover", cost: "$0", comments: "Scrap locally according to site policy." }
            ]
          }
        },
        visualPlaceholders: [
          {
            id: "preset-ph-1",
            type: "figure",
            number: "1",
            caption: "Old Access Cover Removal",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: "Show screw locations"
          },
          {
            id: "preset-ph-2",
            type: "figure",
            number: "2",
            caption: "New Cover PN TEST-12345 Installation",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: ""
          },
          {
            id: "preset-ph-3",
            type: "table",
            number: "1",
            caption: "Parts or Kits Required",
            linkedSection: "Parts or Kits Required",
            status: "placeholder_only",
            notes: "Auto-generated from table data"
          }
        ]
      }
    }
  },
  {
    name: "High-Pressure Safety FCO",
    description: "Safety risk with skin injection warnings.",
    data: {
      title: "Install Synthetic High-Pressure Guard",
      priority: "Urgent",
      changeType: "Physical / Hardware Change",
      affectedEquipment: "Synthetic HP Skid Assembly",
      appliesTo: "Synthetic HP Skid Assemblies with exposed pressure fittings",
      effectiveDate: "01-07-2026",
      productionStart: "All active units before 2026",
      knownSafetyRisks: "High-pressure fluid, skin injection, stored pressure, Lockout/Tagout",
      customDirectives: "Emphasize skin injection risk. Do not invent pressure values.",
      rawSummary: "High-pressure fittings on the Synthetic HP Skid may be accessible during maintenance. Install the approved guard kit to reduce exposure to pressurized connections. This change improves safety during service work.",
      rawProcedure: "Isolate the skid. Release pressure. Remove the existing cover. Install the guard bracket. Attach the warning label, see Figure 1. Check the guard position, see Figure 2. Record completion."
    }
  },
  {
    name: "Software Configuration FCO",
    description: "Software update procedure.",
    data: {
      title: "Update Synthetic Controller Configuration",
      priority: "Required",
      changeType: "Software / Configuration Change",
      affectedEquipment: "Synthetic Controller SC-200",
      appliesTo: "SC-200 controllers with configuration version 1.0",
      effectiveDate: "01-07-2026",
      productionStart: "Controllers commissioned before 2026",
      knownSafetyRisks: "Software access control, configuration change affecting operation",
      customDirectives: "Preserve configuration version 2.0 exactly.",
      rawSummary: "The current SC-200 controller configuration does not apply the latest approved alarm delay setting. Update the configuration to version 2.0. This improves alarm consistency and reduces nuisance alarms.",
      rawProcedure: "Confirm current version. Back up the current configuration. Upload TEST-CONFIG-2.0. Restart the controller. Confirm version 2.0 is installed. Check for active alarms. Record the update."
    }
  },
  {
    name: "Policy / Process FCO",
    description: "Procedural compliance checklist.",
    data: {
      title: "Update Synthetic Inspection Process",
      priority: "Preferred",
      changeType: "Policy / Process Change",
      affectedEquipment: "Synthetic Field Inspection Process",
      appliesTo: "All field teams performing synthetic equipment inspections",
      effectiveDate: "01-07-2026",
      productionStart: "[Information required from submitter]",
      knownSafetyRisks: "Process compliance, inspection consistency",
      customDirectives: "Focus on communication and verification steps.",
      rawSummary: "Field teams are not using a consistent inspection checklist for synthetic equipment. Update the inspection process to require Checklist TEST-CL-001 before job closeout. This improves inspection consistency and record quality.",
      rawProcedure: "Tell field teams about the new checklist requirement. Use Checklist TEST-CL-001 for future inspections. Supervisors verify checklist completion. Record implementation date."
    }
  },
  {
    name: "Missing Information FCO",
    description: "Incomplete details for TechCom to catch.",
    data: {
      title: "Replace Synthetic Seal",
      priority: "Required",
      changeType: "Physical / Hardware Change",
      affectedEquipment: "[Information required from submitter]",
      appliesTo: "[Information required from submitter]",
      effectiveDate: "01-07-2026",
      productionStart: "[Information required from submitter]",
      knownSafetyRisks: "Hydraulic pressure",
      customDirectives: "Flag all missing technical information.",
      rawSummary: "The seal leaks during operation. Replace the seal with the new part. This should improve reliability.",
      rawProcedure: "Stop the unit. Remove the old seal. Install the new seal. Test the unit."
    }
  },
  {
    name: "Figure Placeholder Test",
    description: "Checks figure placeholder preservation.",
    data: {
      title: "Install Synthetic Access Bracket",
      priority: "Required",
      changeType: "Physical / Hardware Change",
      affectedEquipment: "Synthetic Mixer Unit",
      appliesTo: "Synthetic Mixer Units with rectangular hatch design",
      effectiveDate: "01-07-2026",
      productionStart: "All active units before 2026",
      knownSafetyRisks: "Confined space, Lockout/Tagout",
      customDirectives: "Preserve all figure references and placeholders.",
      rawSummary: "The current hatch area requires improved access control. Install a synthetic access bracket and warning label. This improves access control and field visibility.",
      rawProcedure: "Attach the synthetic access bracket to the hatch frame, see Figure 1.\n\n[Insert Figure 1: Synthetic Access Bracket Position]\n\nPut the warning label on the bracket, see Figure 2.\n\n[Insert Figure 2: Warning Label Position]\n\nCheck that the label is visible.",
      fcoDraft: {
        visualPlaceholders: [
          {
            id: "ph-test-1",
            type: "figure",
            number: "1",
            caption: "Synthetic Access Bracket Position",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: ""
          },
          {
            id: "ph-test-2",
            type: "figure",
            number: "2",
            caption: "Warning Label Position",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: ""
          }
        ]
      } as any
    }
  },
  {
    name: "Procedure Table Placeholder Test",
    description: "Checks table placeholder preservation.",
    data: {
      title: "Select Synthetic Kit by Model",
      priority: "Required",
      changeType: "Physical / Hardware Change",
      affectedEquipment: "Synthetic Equipment Model Family",
      appliesTo: "Synthetic Models A, B, and C",
      effectiveDate: "01-07-2026",
      productionStart: "All active units before 2026",
      knownSafetyRisks: "Lockout/Tagout",
      customDirectives: "Preserve table reference and placeholder.",
      rawSummary: "Different synthetic equipment models require different installation kits. Use the model selection table to identify the correct kit before installation. This improves kit selection accuracy.",
      rawProcedure: "Identify the equipment model. Select the correct kit using Table 1.\n\n[Insert Table 1: Synthetic model and kit selection table]\n\nInstall the selected kit. Verify installation. Record completion.",
      fcoDraft: {
        visualPlaceholders: [
          {
            id: "ph-table-test-1",
            type: "table",
            number: "1",
            caption: "Synthetic model and kit selection table",
            linkedSection: "Procedure",
            status: "placeholder_only",
            notes: ""
          }
        ]
      } as any
    }
  },
  {
    name: "Temperature Unit Style Test",
    description: "Checks style normalization for temperatures.",
    data: {
      title: "Normalize Synthetic Temperature Wording",
      priority: "Preferred",
      changeType: "Physical / Hardware Change",
      affectedEquipment: "Synthetic Thermal Test Fixture",
      appliesTo: "Synthetic Thermal Test Fixtures used for validation checks",
      effectiveDate: "01-07-2026",
      productionStart: "All active units before 2026",
      knownSafetyRisks: "Hot surfaces, thermal exposure",
      customDirectives: "Apply SLB unit style. Preserve numeric values exactly.",
      rawSummary: "The current procedure uses inconsistent temperature unit formatting. Update the wording so temperature values are written in the approved format. This improves consistency in technical documentation.",
      rawProcedure: "Heat the component to 120 °C and hold for 10 minutes. Check that the measured temperature remains below 85 degrees Celsius after cooldown. Record the final temperature."
    }
  },
  {
    name: "Abbreviation First-Use Test",
    description: "Checks acronym expansion.",
    data: {
      title: "Define Synthetic Safety Abbreviations",
      priority: "Required",
      changeType: "Physical / Hardware Change",
      affectedEquipment: "Synthetic Service Skid",
      appliesTo: "Synthetic Service Skids used in field maintenance",
      effectiveDate: "01-07-2026",
      productionStart: "All active units before 2026",
      knownSafetyRisks: "LOTO, stored energy",
      customDirectives: "Define abbreviations on first use where required. Preserve LOTO.",
      rawSummary: "LOTO is not consistently stated in the current service instructions. Update the wording so the safety requirement is clear before work starts.",
      rawProcedure: "Do LOTO before work. Check that HMI status is safe. Record LOTO completion in the job file."
    }
  },
  {
    name: "Shallow Rewrite Detection Test",
    description: "Checks detection of poor rewrites.",
    data: {
      title: "Improve Synthetic Procedure Clarity",
      priority: "Required",
      changeType: "Physical / Hardware Change",
      affectedEquipment: "Synthetic Valve Assembly",
      appliesTo: "Synthetic Valve Assemblies in active field service",
      effectiveDate: "01-07-2026",
      productionStart: "All active units before 2026",
      knownSafetyRisks: "Hydraulic pressure",
      customDirectives: "Rewrite clearly. Do not simply copy the raw procedure.",
      rawSummary: "The valve can leak because the old seal wears out. Replace the seal to reduce leakage.",
      rawProcedure: "The technician should make sure that the valve is isolated and then the technician should remove the old seal and then the technician should install the new seal and then the technician should check the valve and then the technician should record the work."
    }
  }
];
