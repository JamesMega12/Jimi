// Pure unit test: accept-time identity stamping + check merging must preserve
// full ProcedureCheck fidelity (category/reason/id/source) instead of the
// retired buildDisplayProcedure behavior, which flattened accepted readiness
// suggestions into anonymous procedure step strings and discarded that
// metadata. Also guards the anchor/target-part validation and the
// documentation_impact retirement.
//
// Run directly: npx tsx test-fco-unit-procedure-checks-merge.ts

import { stampProcedureIdentity, mergeAcceptedChecks } from './src/utils/procedureMerge';
import type { FCOProcedure, FCOPartInvolved, ProcedureReadinessSuggestion } from './src/types';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
  else { console.log(`  ✓ ${msg}`); }
}

// ---------- stampProcedureIdentity ----------

const declaredParts: FCOPartInvolved[] = [
  { id: 'part-clamp-1', name: 'DM-500 Clamp', identifier: 'DM-500', role: 'installed', relatedTo: [] }
];

const generatedProcedure: FCOProcedure = {
  changeType: 'Physical / Hardware Change',
  partsInvolved: [
    { id: '', name: 'DM-500 Clamp', identifier: 'DM-500', role: 'installed', relatedTo: [] } as any,
    { id: '', name: 'Unlisted Bracket', identifier: '', role: 'affected', relatedTo: [] } as any
  ],
  sections: [
    {
      title: 'C. Implementation',
      stepGroups: [
        { id: '', title: 'DM-500 Clamp — Remove existing assembly', forPart: 'DM-500 Clamp', steps: ['Remove clamp.'] } as any,
        { id: '', title: 'General Setup', steps: ['Stage tools.'] } as any
      ]
    },
    { title: 'D. Verification', steps: ['Verify torque.'] }
  ]
};

const stamped = stampProcedureIdentity(generatedProcedure, declaredParts);

assert(
  stamped.partsInvolved![0].id === 'part-clamp-1',
  'stampProcedureIdentity matches a declared part by name (case-sensitive-exact) and carries its id through'
);
assert(
  typeof stamped.partsInvolved![1].id === 'string' && stamped.partsInvolved![1].id.length > 0 && stamped.partsInvolved![1].id !== stamped.partsInvolved![0].id,
  'stampProcedureIdentity mints a fresh id for an AI-detected part with no declaredParts match'
);
const implSection = stamped.sections.find(s => s.title === 'C. Implementation')!;
const groupIds = implSection.stepGroups!.map(g => g.id);
assert(
  groupIds.every(id => typeof id === 'string' && id.length > 0) && new Set(groupIds).size === groupIds.length,
  'stampProcedureIdentity mints unique ids for every stepGroup, part-scoped or general-phase'
);

const restamped = stampProcedureIdentity(stamped, declaredParts);
assert(
  restamped.partsInvolved![0].id === stamped.partsInvolved![0].id &&
  restamped.sections[0].stepGroups![0].id === stamped.sections[0].stepGroups![0].id,
  'stampProcedureIdentity preserves existing ids on a second call (idempotent)'
);

// ---------- mergeAcceptedChecks ----------

function suggestion(overrides: Partial<ProcedureReadinessSuggestion>): ProcedureReadinessSuggestion {
  return {
    id: 'sugg-1',
    category: 'post_installation_check',
    targetSection: 'Post-Installation / Functional Check',
    suggestedText: 'Verify clamp torque meets spec.',
    reason: 'No post-install torque check present in the drafted procedure.',
    status: 'accepted',
    source: 'ai_suggestion',
    requiresUserConfirmation: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

const partId = stamped.partsInvolved![0].id;
const partName = stamped.partsInvolved![0].name;
const stepGroupId = stamped.sections[0].stepGroups![0].id;
const stepGroupTitle = stamped.sections[0].stepGroups![0].title;

const accepted = mergeAcceptedChecks([], [suggestion({})], stamped);
assert(accepted.length === 1, 'an accepted suggestion produces exactly one check');
assert(
  accepted[0].category === 'post_installation_check' &&
  accepted[0].reason === 'No post-install torque check present in the drafted procedure.' &&
  accepted[0].id === 'sugg-1' &&
  accepted[0].source === 'ai_suggestion',
  'category/reason/id/source survive the merge intact (the bug being fixed — buildDisplayProcedure discarded all four)'
);
assert(accepted[0].status === 'accepted', 'check status mirrors the suggestion status');

const edited = mergeAcceptedChecks([], [suggestion({ id: 'sugg-2', status: 'edited', editedText: 'Verify clamp torque to 45 Nm.' })], stamped);
assert(edited[0].text === 'Verify clamp torque to 45 Nm.', 'an edited suggestion uses editedText, not suggestedText');

const ignored = mergeAcceptedChecks([], [
  suggestion({ id: 'sugg-pending', status: 'pending' }),
  suggestion({ id: 'sugg-dismissed', status: 'dismissed' })
], stamped);
assert(ignored.length === 0, 'pending and dismissed suggestions never produce a check');

const retired = mergeAcceptedChecks([], [suggestion({ id: 'sugg-doc', category: 'documentation_impact' as any })], stamped);
assert(retired.length === 0, 'a documentation_impact suggestion (retired category, may linger in old persisted drafts) is skipped, not turned into a check');

const validTarget = mergeAcceptedChecks([], [suggestion({ id: 'sugg-part', suggestedPartNames: [partName, 'Nonexistent Part'] })], stamped);
assert(
  validTarget[0].targetPartIds.length === 1 && validTarget[0].targetPartIds[0] === partId,
  'a suggested target part name is resolved to the real part id only when it matches a part on the stamped procedure; a non-matching name is dropped'
);

const globalCheck = mergeAcceptedChecks([], [suggestion({ id: 'sugg-global' })], stamped);
assert(globalCheck[0].targetPartIds.length === 0, 'no suggestedPartNames means the check is global (targetPartIds: [])');

const validAnchor = mergeAcceptedChecks([], [suggestion({ id: 'sugg-anchor', suggestedStepGroupTitle: stepGroupTitle, suggestedAnchorPosition: 'after' })], stamped);
assert(
  validAnchor[0].anchor?.stepGroupId === stepGroupId && validAnchor[0].anchor?.position === 'after',
  'a suggested stepGroup title is resolved to the real stepGroup id when it matches a stepGroup on the stamped procedure'
);

const caseInsensitiveAnchor = mergeAcceptedChecks([], [suggestion({ id: 'sugg-case', suggestedStepGroupTitle: stepGroupTitle.toUpperCase(), suggestedAnchorPosition: 'before' })], stamped);
assert(
  caseInsensitiveAnchor[0].anchor?.stepGroupId === stepGroupId,
  'stepGroup title resolution is case-insensitive (AI wording may not match the exact original casing)'
);

const danglingAnchor = mergeAcceptedChecks([], [suggestion({ id: 'sugg-dangling', suggestedStepGroupTitle: 'No Such Step', suggestedAnchorPosition: 'before' })], stamped);
assert(danglingAnchor[0].anchor === undefined, 'a stepGroup title with no match falls back to no anchor rather than pointing at nothing');

const humanOverridesPart = mergeAcceptedChecks([], [suggestion({
  id: 'sugg-override-part', suggestedPartNames: ['Nonexistent Part'], confirmedPartNames: [partName]
})], stamped);
assert(
  humanOverridesPart[0].targetPartIds.length === 1 && humanOverridesPart[0].targetPartIds[0] === partId,
  'confirmedPartNames overrides suggestedPartNames — a human correcting the AI\'s guess wins'
);

const humanClearsAnchor = mergeAcceptedChecks([], [suggestion({
  id: 'sugg-override-anchor', suggestedStepGroupTitle: stepGroupTitle, suggestedAnchorPosition: 'after', confirmedStepGroupTitle: ''
})], stamped);
assert(
  humanClearsAnchor[0].anchor === undefined,
  'a human explicitly clearing confirmedStepGroupTitle to \'\' overrides the AI\'s suggested anchor entirely, not falls back to it'
);

const existing = accepted; // [{ id: 'sugg-1', ... }]
const reAccepted = mergeAcceptedChecks(existing, [suggestion({ id: 'sugg-1', status: 'edited', editedText: 'Updated text.' })], stamped);
assert(
  reAccepted.length === 1 && reAccepted[0].text === 'Updated text.',
  're-accepting the same suggestion id replaces the existing check rather than duplicating it'
);

const preservesManual = mergeAcceptedChecks(
  [{ id: 'manual-1', category: 'parts_check', text: 'Confirm kit revision.', targetPartIds: [], source: 'manual', status: 'accepted', createdAt: '2026-01-01T00:00:00.000Z' }],
  [suggestion({ id: 'sugg-3' })],
  stamped
);
assert(
  preservesManual.length === 2 && preservesManual.some(c => c.id === 'manual-1' && c.source === 'manual'),
  'existing (e.g. manually-authored) checks are preserved alongside newly merged ones'
);

console.log(`\nfco procedure checks merge: ${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
process.exit(failures ? 1 : 0);
