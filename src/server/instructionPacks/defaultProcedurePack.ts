import { InstructionPack } from './types';

export const defaultProcedurePack: InstructionPack = {
  id: "procedure-pack-default",
  name: "Procedure Instruction Pack (Default)",
  scope: "procedure",
  version: "1.0.0",
  status: "bundled_default",
  isSystemDefault: true,
  locked: false,
  description: "Default instructions for FCO Procedure generation.",
  content: `
SECTION 2: REWRITTEN FCO PROCEDURE

Rewrite the procedure in an SWI-style format.
The procedure must be grouped by sections.
Restart numbering from 1 in each section.
Do not use one long continuous step list.

The user must select one of the supported change types:
- Physical / Hardware Change
- Software / Configuration Change
- Policy / Process Change

Do not auto-detect change type unless the selected change type is missing due to backend error.

Use the selected change type as the primary instruction.

If the selected change type appears inconsistent with the raw input, keep the selected change type and flag the inconsistency in TechCom Review Notes.

PROCEDURE STRUCTURE BY CHANGE TYPE

Each section listed for the identified change type must be generated as a separate section in the output. Do not omit, skip, or combine these sections under single headers. It is a critical validation failure if any required section is missing.

For Physical / Hardware Change (Requires exactly 5 standard sections):
Before the Safety section, generate a Tools / Materials Required block.
Classify tools/materials into:
- Confirmed from input
- Suggested to confirm

Confirmed tools/materials must come directly from the raw input.
Suggested tools/materials may be inferred only as generic categories and must be clearly marked for confirmation.
Do not invent exact tool part numbers, lubricant brands, pressure ratings, torque values, dimensions, or acceptance criteria.
If tools/materials are missing, add [Information required from submitter] and flag it in TechCom Review Notes.

- A. Safety
- B. Preparation
- C. Implementation
- D. Verification
- E. Completion

For Software / Configuration Change (Requires exactly 6 standard sections):
- A. Safety / Access Control
- B. Preparation
- C. Backup / Current State Check
- D. Software or Configuration Update
- E. Verification
- F. Completion

For Policy / Process Change (Requires exactly 5 standard sections):
- A. Applicability
- B. Communication
- C. Implementation
- D. Verification
- E. Completion

PROCEDURE WRITING RULES
- Use numbered steps.
- Restart numbering in each section (each section's steps should start at index 1).
- Use one main action per step.
- Use active voice.
- Use imperative verbs.
- Keep each step clear and action-oriented.
- Include safety before hazardous work.
- Include verification steps.
- Include completion or recording steps when applicable.
- No blank steps or "." steps.
- No malformed fragments.
- No warnings embedded inside normal steps (preserve structured Note/Caution/Warning callouts separately).
- Clean Note/Caution/Warning handling.
- Preserve inline placeholders exactly.
- Preserve real technical values exactly.
- Do not invent SWI IDs, InTouch IDs, part numbers, figure/table numbers, torque values, pressure values, serial ranges, software versions, or quantities.

REFERENCES MUST NOT BE USED TO GENERATE PROCEDURE STEPS.
- The presence of a reference (e.g. SWI TEST-0001) in the broader context does NOT mean it should be inserted into procedure.
- Only include a reference in the procedure IF it appears explicitly in the raw procedure input or confirmed DOCX extracted procedure.
- Do NOT pull references from "Existing References", preset templates, seed data, or fallback logic to write steps.
- If the system attempts to add a generic preparation step, use: "Prepare the work area and ensure safe working conditions." NOT: "Refer to [Reference]..."
- Preserve figure references ONLY if provided in the raw procedure.
- If a figure is needed but not provided, use [Figure reference required from submitter].

FIGURE HANDLING RULES:
If the input document text contains "[Figure X detected: ...]", "[figure detected: ...]", or "[Insert figure: ...]":
- Preserve all existing figure references in procedure steps (e.g. "see Figure X").
- Output the figure placeholder EXACTLY in the format: "[Insert Figure X: <Caption text>]" (replace <Caption text> with the actual caption provided).
- If the input says "[Figure X detected: caption required]", output EXACTLY: "[Insert Figure X: caption required]"
- If the input says "[figure detected: figure number and caption required]", output EXACTLY: "[Insert figure: figure number and caption required]"
- Keep figure placeholders near the related procedure steps (typically immediately after the step).
- Do not create new figure numbers.
- Do not remove figure references.
- Do not rewrite figure captions unless needed for grammar or clarity.
- Do not invent missing captions.
- Do not use markdown image links or base64 image data. Provide text-only figure placeholders.

TABLE HANDLING RULES:
If the input document text contains "[Table X detected: ...]", "[Table detected: ...]" or "[Insert Table X: ...]":
- Preserve all existing table references in procedure steps (e.g. "see Table X" or "using the table below").
- Output the table placeholder EXACTLY in the format: "[Insert Table X: <Table title or purpose>]" (replace <Table title or purpose> with the actual title provided).
- If the input says "[Table X detected: table title required]", output EXACTLY: "[Insert Table X: table title required]"
- If the table has no number/title, output EXACTLY: "[Insert procedure table: table title required]"
- Keep table placeholders near the related procedure steps.
- Do not create new table numbers.
- Do not remove table references.
- Do not invent missing table titles.
- Do not output markdown tables as replacements for original Word tables. Provide text-only table placeholders.
- Do not rewrite technical table values.

- If different equipment models, software versions, configurations, locations, crews, or process conditions require different steps, create conditional paths.
- If the input contains unclear steps, rewrite them clearly only if the technical meaning is preserved. If the technical meaning cannot be confirmed, flag it in TechCom Review Notes.
- Do not add technical sequence steps that are not supported by the input.

SAFETY AND PRESSURE REQUIREMENTS
Safety must be built into the procedure. Check whether the procedure involves safety-critical work (Lockout/Tagout (LOTO), electrical isolation, hydraulic/pneumatic pressure, high-pressure, hot surfaces, rotating parts, lifting, chemical exposure, hot work, etc.). Include a Safety or Safety / Access Control section.
Only include specific safety values, limits, PPE requirements, or procedures if they are provided in the user input. Do not invent safety limits.

If the raw input or other directives describe or involve high-pressure, fluid/gas pressure, pneumatic/hydraulic systems, fittings, valves, couplings, or leak risks, you MUST output these exact 4 specific safety steps in the Safety or Safety / Access Control section step list:
1. "Isolate the pressure source using LOTO (Lockout/Tagout), stop, shut off, or disconnect controls."
2. "Release, bleed, discharge, vent, or depressurize stored pressure prior to loosening fittings or connections."
3. "Keep hands and body away from leaks and protect yourself from injury."
4. "Do not loosen fittings or connections until pressure is zero and released."

Warning Injections (MUST be included in the 'warnings' list of the Safety section if mentioned in raw input):
- If "skin injection" or "penetrate skin" is mentioned or implied, you MUST include: "High-pressure fluid can penetrate skin. Keep hands and body away from leaks and pressurized connections." in a regular procedure step.
- If "high-pressure gas" or "gas pressure" is mentioned or implied, you MUST include: "High-pressure gas can cause serious injury. Isolate the gas supply and release stored pressure before loosening any connection." in a regular procedure step.
`
};
