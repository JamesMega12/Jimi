// FCO review == export parity + DOCX content inspection (the gap the audit
// flagged: FCO had NO DOCX-content test, only Announcement did). Pure — no
// server, no API key: builds the accepted canonical draft exactly as
// ExportPanel sends it, generates the real .docx via generateDocxExport, unzips
// word/document.xml, and asserts the ACCEPTED content is rendered and raw/draft
// content never leaks. Also proves export cannot invoke AI (runs with no key).
//
// Run: npx tsx test-fco-unit-export-parity.ts

import AdmZip from 'adm-zip';
import { generateDocxExport } from './src/server/docxExportService';

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

// Sentinels: distinct strings for ACCEPTED vs RAW so we can prove export reads
// the accepted canonical fields, never the raw draft.
const TITLE = 'SLB-400 Viton O-ring Upgrade';
const ACCEPTED_SUMMARY = 'ACCEPTEDSUMMARYSENTINEL the nitrile O-ring is replaced with a Viton O-ring.';
const RAW_SUMMARY = 'RAWSUMMARYSENTINEL should never appear in the export.';
const ACCEPTED_STEP = 'ACCEPTEDSTEPSENTINEL install the Viton O-ring and torque to spec.';
const COMPLETION_STEP = 'COMPLETIONSTEPSENTINEL confirm the mixer runs without vibration.';
const RAW_PROCEDURE = 'RAWPROCEDURESENTINEL should never appear in the export.';

const STEP_GROUP_ID = 'sg-install-oring';

// The accepted procedure as it lives in fcoDraft.technicalContent.acceptedProcedure.
// "C. Implementation" bucket into the Installation band; "D. Verification"
// (no safety/prep or implementation/install keyword in its title) falls into
// the Completion / Functional Check catch-all band — this is what gives the
// fallback-ordering assertions below something real to anchor around in both
// non-safety bands.
const acceptedProcedure = {
  changeType: 'Physical / Hardware Change',
  partsInvolved: [{ id: 'part-oring', name: 'Viton O-ring', identifier: '', role: 'installed', relatedTo: [] }],
  sections: [
    {
      title: 'C. Implementation',
      stepGroups: [
        { id: STEP_GROUP_ID, title: 'Install Viton O-ring', steps: [ACCEPTED_STEP, 'Verify [Figure 1: seal orientation] before closing.'] },
      ],
      warnings: [], cautions: [], notes: [],
    },
    {
      title: 'D. Verification',
      steps: [COMPLETION_STEP],
      warnings: [], cautions: [], notes: [],
    },
  ],
};

// Checks exercise the three-band, before/after-fallback model decided via
// discussion: post_installation_check no longer gets its own band — it's
// item-specific, so it lives in Installation alongside pre_installation/
// parts_check. functional_check and completion_verification share the final
// Completion/Functional-Check band, distinguished by which end of that band
// they fall back to (functional_check first, completion_verification last).
// safety_preparation is the sole preamble category — always top-of-band,
// anchor only resolves which band, never position.
const ANCHORED_CHECK_TEXT = 'ANCHOREDCHECKSENTINEL torque the O-ring retaining bolts to 12 Nm.';
const PARTS_CHECK_TEXT = 'PARTSCHECKSENTINEL confirm the Viton O-ring kit revision matches the FCO.';
const PRE_INSTALL_TEXT = 'PREINSTALLSENTINEL stage the alignment tool before starting.';
const FUNCTIONAL_CHECK_TEXT = 'FUNCTIONALCHECKSENTINEL perform a leak test at operating pressure.';
const COMPLETION_CHECK_TEXT = 'COMPLETIONCHECKSENTINEL confirm no leaks after 24 hours of operation.';
// Anchored to the Installation Steps stepGroup with position:'before' — proves
// the anchor still resolves WHICH band table a preamble check lands in
// (installation, not its default safetyAndPrep home), while position is
// ignored (it renders as a preamble, not interleaved before that step).
const SAFETY_PREP_ANCHORED_TEXT = 'SAFETYPREPANCHOREDSENTINEL confirm LOTO is applied before opening the manifold.';
const checks = [
  {
    id: 'check-anchored', category: 'post_installation_check', text: ANCHORED_CHECK_TEXT,
    targetPartIds: [], anchor: { stepGroupId: STEP_GROUP_ID, position: 'after' as const },
    source: 'ai_suggestion' as const, status: 'accepted' as const, createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'check-parts', category: 'parts_check', text: PARTS_CHECK_TEXT,
    targetPartIds: ['part-oring'], source: 'manual' as const, status: 'accepted' as const, createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'check-pre-install', category: 'pre_installation', text: PRE_INSTALL_TEXT,
    targetPartIds: [], source: 'manual' as const, status: 'accepted' as const, createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'check-functional', category: 'functional_check', text: FUNCTIONAL_CHECK_TEXT,
    targetPartIds: [], source: 'ai_suggestion' as const, status: 'accepted' as const, createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'check-completion', category: 'completion_verification', text: COMPLETION_CHECK_TEXT,
    targetPartIds: [], source: 'ai_suggestion' as const, status: 'accepted' as const, createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'check-safety-prep-anchored', category: 'safety_preparation', text: SAFETY_PREP_ANCHORED_TEXT,
    targetPartIds: [], anchor: { stepGroupId: STEP_GROUP_ID, position: 'before' as const },
    source: 'ai_suggestion' as const, status: 'accepted' as const, createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const emptyTable = () => ({ status: 'active', rows: [] });

// Canonical draft — mirrors AppWorkflow's fcoDraft shape. acceptedSummary /
// acceptedProcedure are what Step3Review reads and what ExportPanel sends.
const formData: any = {
  title: TITLE,
  fcoDraft: {
    fcoMetadata: { baseProductCode: 'SLB', fcoNumber: '400', fcoTitle: TITLE, priority: 'Required', appliesTo: 'All mixers', effectiveDate: '', productionStart: '', application: '', affectedEquipmentModel: 'SLB-400' },
    associatedInfo: {}, costSchedule: {}, additionalFcoInfo: {}, approvalRoles: {},
    technicalContent: {
      draftSummary: RAW_SUMMARY,        // raw — must NOT be exported
      draftProcedure: RAW_PROCEDURE,    // raw — must NOT be exported
      acceptedSummary: ACCEPTED_SUMMARY,
      acceptedProcedure,
      procedureCallouts: [],
      checks,
    },
    fcoTables: {
      fcoHistory: emptyTable(), partsOrKitsRequired: emptyTable(), specialEquipmentRequired: emptyTable(),
      partsRequiringRework: emptyTable(), partsToScrap: emptyTable(),
    },
    visualPlaceholders: [],
  },
};

// The exact payload ExportPanel.handleDownloadDocx builds from accepted content.
const acceptedWordCount = ACCEPTED_SUMMARY.split(/\s+/).filter(Boolean).length;
const rewrittenSummary = {
  paragraph: ACCEPTED_SUMMARY,
  components: { problem: '', cause: '', solution: '', benefit: '' },
  wordCount: acceptedWordCount,
  withinWordLimit: acceptedWordCount <= 150,
};

(async () => {
  const buffer = await generateDocxExport(formData, rewrittenSummary, acceptedProcedure, undefined, false);
  assert(Buffer.isBuffer(buffer) && buffer.length > 0, 'generateDocxExport returns a non-empty Buffer (no AI, no server)');

  const xml = new AdmZip(buffer).readAsText('word/document.xml');
  const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  console.log('\nExport renders ACCEPTED canonical content (== what Step 3 review shows):');
  assert(text.includes(TITLE), 'title (fcoMetadata.fcoTitle) present');
  assert(text.includes('ACCEPTEDSUMMARYSENTINEL'), 'accepted Summary paragraph present');
  assert(text.includes('ACCEPTEDSTEPSENTINEL'), 'accepted Procedure step present');
  assert(/Summary:/.test(text) && /Procedure:/.test(text), 'Summary and Procedure sections present');

  console.log('\nNo raw/draft leakage (export must not fall back to raw content):');
  assert(!text.includes('RAWSUMMARYSENTINEL'), 'raw draftSummary does NOT appear');
  assert(!text.includes('RAWPROCEDURESENTINEL'), 'raw draftProcedure does NOT appear');

  console.log('\nPlaceholder integrity (inline figure token rendered as a placeholder):');
  assert(/FIGURE\s*1\s*PLACEHOLDER/i.test(text), 'inline [Figure 1: …] rendered as a visible PLACEHOLDER');

  console.log('\nChecks render distinctly from ordinary steps:');
  assert(text.includes('ANCHOREDCHECKSENTINEL'), 'anchored check text present');
  assert(text.includes('PARTSCHECKSENTINEL'), 'unanchored parts_check text present');
  assert(text.includes('PREINSTALLSENTINEL'), 'unanchored pre_installation check text present');
  assert(text.includes('FUNCTIONALCHECKSENTINEL'), 'unanchored functional_check text present');
  assert(text.includes('COMPLETIONCHECKSENTINEL'), 'unanchored completion_verification text present');
  assert(text.includes('SAFETYPREPANCHOREDSENTINEL'), 'preamble check anchored into a different band\'s stepGroup is present');

  const checkboxCount = (xml.match(/☐/g) || []).length;
  assert(checkboxCount === 6, `all 6 checks render with the distinct checkbox glyph, not a step number (got ${checkboxCount})`);

  const idx = (needle: string, from = 0) => text.indexOf(needle, from);
  const safetyBandStart = idx('Safety and Preparation');
  const installBandStart = idx('Installation Steps');
  const completionBandStart = idx('Completion / Functional Check');
  assert(
    safetyBandStart < installBandStart && installBandStart < completionBandStart,
    'all three bands render in the expected order — Safety and Preparation, Installation Steps, Completion / Functional Check (sanity check for the slice-based assertions below)'
  );
  const safetyBandText = text.slice(safetyBandStart, installBandStart);
  const installBandText = text.slice(installBandStart, completionBandStart);
  const completionBandText = text.slice(completionBandStart);

  console.log('\npost_installation_check has no band of its own — it lives in Installation, alongside pre_installation/parts_check:');
  assert(
    installBandText.indexOf('ACCEPTEDSTEPSENTINEL') < installBandText.indexOf('ANCHOREDCHECKSENTINEL'),
    'anchored post_installation_check (position: after) renders immediately after its stepGroup, inside Installation Steps — not a separate band'
  );
  assert(
    !completionBandText.includes('ANCHOREDCHECKSENTINEL') && !safetyBandText.includes('ANCHOREDCHECKSENTINEL'),
    'post_installation_check does not leak into either of the other two bands'
  );

  console.log('\nFallback ordering: "start work" categories render before the first step row, "finish work" categories render after the last:');
  const installHeaderIdx = installBandText.indexOf('Description / Action');
  assert(
    installHeaderIdx < installBandText.indexOf('PARTSCHECKSENTINEL') && installBandText.indexOf('PARTSCHECKSENTINEL') < installBandText.indexOf('ACCEPTEDSTEPSENTINEL'),
    'unanchored parts_check (start-work) falls back to Installation, before the first step row'
  );
  assert(
    installHeaderIdx < installBandText.indexOf('PREINSTALLSENTINEL') && installBandText.indexOf('PREINSTALLSENTINEL') < installBandText.indexOf('ACCEPTEDSTEPSENTINEL'),
    'unanchored pre_installation (start-work) also falls back to Installation, before the first step row — not Safety and Preparation, and not appended at the end'
  );
  assert(!safetyBandText.includes('PARTSCHECKSENTINEL') && !safetyBandText.includes('PREINSTALLSENTINEL'), 'neither leaks into Safety and Preparation');

  const completionHeaderIdx = completionBandText.indexOf('Description / Action');
  assert(
    completionHeaderIdx < completionBandText.indexOf('FUNCTIONALCHECKSENTINEL') && completionBandText.indexOf('FUNCTIONALCHECKSENTINEL') < completionBandText.indexOf('COMPLETIONSTEPSENTINEL'),
    'unanchored functional_check (start-work: test before paperwork) falls back before the first step row in the Completion / Functional Check band'
  );
  assert(
    completionBandText.indexOf('COMPLETIONSTEPSENTINEL') < completionBandText.indexOf('COMPLETIONCHECKSENTINEL'),
    'unanchored completion_verification (finish-work: closeout is last) falls back after the last step row in that same band'
  );

  console.log('\nsafety_preparation is the sole preamble category — top of band, anchor resolves band only, not position:');
  assert(
    installBandText.indexOf('SAFETYPREPANCHOREDSENTINEL') > 0 &&
    installBandText.indexOf('SAFETYPREPANCHOREDSENTINEL') < installHeaderIdx,
    'safety_preparation anchored to an Installation Steps stepGroup renders as a preamble ABOVE the column header, not interleaved with steps'
  );
  assert(
    installBandText.indexOf('SAFETYPREPANCHOREDSENTINEL') < installBandText.indexOf('ACCEPTEDSTEPSENTINEL'),
    'the preamble check renders before the numbered steps begin, regardless of its anchor position:\'before\' referring to one specific step'
  );
  assert(
    !safetyBandText.includes('SAFETYPREPANCHOREDSENTINEL'),
    'the anchor moves the preamble check OUT of its category\'s default band (Safety and Preparation) into the anchored band (Installation Steps)'
  );

  console.log('\nOrdinary step numbering is unaffected by interleaved checks:');
  assert(/\b1\b[\s\S]{0,400}ACCEPTEDSTEPSENTINEL/.test(text), 'the numbered step retains step "1" despite an anchored check rendering right after it');

  console.log('\nStepGroup sub-steps are numbered, not bulleted or unmarked:');
  assert(!xml.includes('•'), 'no "•" bullet glyph appears anywhere in the exported document');
  assert(text.includes(`1. ${ACCEPTED_STEP}`), 'the first sub-step is prefixed "1. " (numbering restarts at 1 for this stepGroup)');
  assert(/2\.\s*Verify/.test(text), 'the second sub-step in the same stepGroup is prefixed "2. "');

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
