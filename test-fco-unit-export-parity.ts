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
const RAW_PROCEDURE = 'RAWPROCEDURESENTINEL should never appear in the export.';

// The accepted procedure as it lives in fcoDraft.technicalContent.acceptedProcedure.
const acceptedProcedure = {
  changeType: 'Physical / Hardware Change',
  sections: [
    { title: 'C. Implementation', steps: [ACCEPTED_STEP, 'Verify [Figure 1: seal orientation] before closing.'], warnings: [], cautions: [], notes: [] },
  ],
};

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

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
