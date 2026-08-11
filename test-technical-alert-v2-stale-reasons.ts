// Unit tests for the structured stale-reason model: staleReasons() codes, the
// isStale()/staleReasons() parity that guards every existing caller, the state
// transitions that set/clear each cause and its provenance, and the concrete
// provenance-driven wording from describeStaleReasons.
// Run with: npx tsx test-technical-alert-v2-stale-reasons.ts
import {
  createEmptySectionWorkspace,
  editRaw,
  editComponents,
  markStaleDueToControlChange,
  markStaleDueToNeighborChange,
  acceptSuggestion,
  manualAccept,
  editAcceptedDirectly,
  staleReasons,
  isStale,
} from './src/components/technical-alert/v2/sectionWorkspace';
import { describeStaleReasons } from './src/components/technical-alert/v2/staleReasonCopy';
import { SectionWorkspace } from './src/components/technical-alert/v2/types';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}
function eqArr<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// A plain object satisfying the structural StalenessFlags input of staleReasons.
function flags(f: { self?: boolean; control?: boolean; neighbor?: boolean }) {
  return {
    freshness: (f.self ? 'stale' : 'fresh') as 'fresh' | 'stale',
    staleDueToControlChange: !!f.control,
    staleDueToNeighborChange: !!f.neighbor,
  };
}

// An accepted workspace with the three flags forced to a given combination, so
// isStale (which requires a full SectionWorkspace) can be checked for parity.
function acceptedWsWith(f: { self?: boolean; control?: boolean; neighbor?: boolean }): SectionWorkspace<string, string> {
  const ws = createEmptySectionWorkspace<string, string>();
  ws.accepted = { value: 'v', source: 'manual', basedOn: ws.currentRevision, acceptedAt: new Date().toISOString() };
  if (f.self) ws.freshness = 'stale';
  if (f.control) ws.staleDueToControlChange = true;
  if (f.neighbor) ws.staleDueToNeighborChange = true;
  return ws;
}

// ===== staleReasons() codes: none, each single cause, canonical order =====
assert(eqArr(staleReasons(flags({})), []), 'fresh -> no reasons');
assert(eqArr(staleReasons(flags({ self: true })), ['self-edit']), 'self-edit only');
assert(eqArr(staleReasons(flags({ control: true })), ['control-change']), 'control-change only');
assert(eqArr(staleReasons(flags({ neighbor: true })), ['neighbor-change']), 'neighbor-change only');
assert(
  eqArr(staleReasons(flags({ self: true, control: true, neighbor: true })), ['self-edit', 'control-change', 'neighbor-change']),
  'all three causes -> canonical order [self-edit, control-change, neighbor-change]',
);

// ===== isStale()/staleReasons() parity across all 8 flag combinations =====
// Guards every existing caller (checkmark gating, badge color, card styling):
// isStale must remain exactly (staleReasons().length > 0).
{
  let allParity = true;
  for (const self of [false, true]) {
    for (const control of [false, true]) {
      for (const neighbor of [false, true]) {
        const ws = acceptedWsWith({ self, control, neighbor });
        if (isStale(ws) !== (staleReasons(ws).length > 0)) allParity = false;
      }
    }
  }
  assert(allParity, 'isStale(ws) === (staleReasons(ws).length > 0) for all 8 flag combinations');
}

// ===== Transitions that SET each cause (and record provenance) =====
{
  const accepted = acceptedWsWith({});
  assert(staleReasons(editRaw(accepted, 'new raw')).includes('self-edit'), 'editRaw on accepted content sets self-edit');
  assert(staleReasons(editComponents(accepted, 'new comps')).includes('self-edit'), 'editComponents on accepted content sets self-edit');

  const ctrl = markStaleDueToControlChange(accepted, ['deadline']);
  assert(eqArr(staleReasons(ctrl), ['control-change']), 'markStaleDueToControlChange sets control-change');
  assert(eqArr(ctrl.staleControlFields ?? [], ['deadline']), 'markStaleDueToControlChange records which field changed');
  // A second control change unions the field list rather than replacing it.
  const ctrl2 = markStaleDueToControlChange(ctrl, ['effectiveTiming']);
  assert(eqArr(ctrl2.staleControlFields ?? [], ['deadline', 'effectiveTiming']), 'a second control change unions the changed fields');

  const nb = markStaleDueToNeighborChange(accepted, ['reasons']);
  assert(eqArr(staleReasons(nb), ['neighbor-change']), 'markStaleDueToNeighborChange sets neighbor-change');
  assert(eqArr(nb.staleNeighborSections ?? [], ['reasons']), 'markStaleDueToNeighborChange records which neighbor changed');
}

// ===== Transitions that CLEAR every cause + its provenance (re-acceptance) =====
{
  // Start from an accepted workspace with all three causes active (incl.
  // provenance) + a pending suggestion.
  const dirty = acceptedWsWith({ self: true, control: true, neighbor: true });
  dirty.staleControlFields = ['deadline'];
  dirty.staleNeighborSections = ['reasons'];
  dirty.suggestion = { value: 'newval', basedOn: dirty.currentRevision, requestId: 'r1' };

  for (const [label, next] of [
    ['acceptSuggestion', acceptSuggestion(dirty)],
    ['manualAccept', manualAccept(dirty, 'manual')],
    ['editAcceptedDirectly', editAcceptedDirectly(dirty, 'edited')],
  ] as const) {
    assert(eqArr(staleReasons(next), []), `${label} clears all stale causes`);
    assert(!next.staleControlFields?.length && !next.staleNeighborSections?.length, `${label} also clears stale provenance`);
  }
}

// ===== describeStaleReasons: concrete, provenance-driven wording =====
{
  // Names the exact control field(s).
  assert(
    eqArr(describeStaleReasons({ freshness: 'fresh', staleDueToControlChange: true, staleControlFields: ['deadline'], staleDueToNeighborChange: false }),
      ['the deadline changed after you accepted this section']),
    'control-change wording names the deadline',
  );
  assert(
    describeStaleReasons({ freshness: 'fresh', staleDueToControlChange: true, staleControlFields: ['deadline', 'effectiveTiming'], staleDueToNeighborChange: false })[0]
      === 'the deadline and the effective timing changed after you accepted this section',
    'control-change wording lists multiple fields',
  );
  // Names the exact neighbor section(s), with correct singular/plural.
  assert(
    describeStaleReasons({ freshness: 'fresh', staleDueToControlChange: false, staleDueToNeighborChange: true, staleNeighborSections: ['reasons'] })[0]
      === 'the Reasons section changed after this summary was written from it',
    'neighbor-change wording names the Reasons section (singular)',
  );
  assert(
    describeStaleReasons({ freshness: 'fresh', staleDueToControlChange: false, staleDueToNeighborChange: true, staleNeighborSections: ['reasons', 'immediateAction'] })[0]
      === 'the Reasons and Immediate Action sections changed after this summary was written from them',
    'neighbor-change wording names multiple sections (plural)',
  );
  // Graceful fallback when provenance is absent (e.g. an older persisted draft).
  assert(
    describeStaleReasons({ freshness: 'fresh', staleDueToControlChange: true, staleDueToNeighborChange: false })[0]
      === 'a Control Information field this section uses changed after you accepted it',
    'control-change falls back to a generic clause when no field is recorded',
  );
  // All three at once, in canonical order.
  assert(
    describeStaleReasons({ freshness: 'stale', staleDueToControlChange: true, staleControlFields: ['deadline'], staleDueToNeighborChange: true, staleNeighborSections: ['reasons'] }).length === 3,
    'describeStaleReasons returns one clause per active cause',
  );
}

console.log(failures === 0 ? '\nAll stale-reason tests passed.' : `\n${failures} stale-reason test(s) FAILED.`);
process.exit(failures ? 1 : 0);
