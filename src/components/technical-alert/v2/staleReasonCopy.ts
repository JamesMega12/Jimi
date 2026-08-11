import { ControlInfoField, SectionId } from './types';

// The single source of user-facing wording for stale causes, kept as plain TS
// (no JSX) so both the accepted-card explanation (StaleExplanation) and
// readiness.ts (a backend-shared / export-contract module that must not import
// React) reuse the exact same phrasing. Each entry is a concrete clause naming
// *what specifically* changed -- driven by the provenance now retained on the
// workspace (staleControlFields / staleNeighborSections) so we can say "the
// deadline changed" instead of a vague "a field changed". Clauses are written
// to read after "...because " and inside readiness' "(...)" list. They never
// expose internal flag names and never imply the content must change -- re-
// acceptance is a trust-the-reviewer act.

// Human labels for the Control-Info fields that can drive a section stale.
const CONTROL_FIELD_LABELS: Record<ControlInfoField, string> = {
  deadline: 'the deadline',
  effectiveTiming: 'the effective timing',
  actionBy: 'the "Action By" audience',
  informationFor: 'the "Information For" audience',
};

const SECTION_LABELS: Record<SectionId, string> = {
  summary: 'Summary',
  reasons: 'Reasons',
  immediateAction: 'Immediate Action',
  followUpAction: 'Follow-Up Action',
};

// "a" | "a and b" | "a, b and c"
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// The staleness state describeStaleReasons reads. Both SectionWorkspace and
// SectionAcceptedView structurally satisfy this.
export interface StalenessDescribable {
  freshness: 'fresh' | 'stale';
  staleDueToControlChange: boolean;
  staleControlFields?: ControlInfoField[];
  staleDueToNeighborChange: boolean;
  staleNeighborSections?: SectionId[];
}

// One concrete clause per active cause, in canonical order.
export function describeStaleReasons(ws: StalenessDescribable): string[] {
  const out: string[] = [];

  if (ws.freshness === 'stale') {
    out.push('you edited this section after accepting it');
  }

  if (ws.staleDueToControlChange) {
    const fields = ws.staleControlFields ?? [];
    const named = joinList(fields.map(f => CONTROL_FIELD_LABELS[f]));
    out.push(
      named
        ? `${named} changed after you accepted this section`
        : 'a Control Information field this section uses changed after you accepted it'
    );
  }

  if (ws.staleDueToNeighborChange) {
    const sections = ws.staleNeighborSections ?? [];
    const named = joinList(sections.map(s => SECTION_LABELS[s]));
    out.push(
      named
        ? `the ${named} section${sections.length > 1 ? 's' : ''} changed after this summary was written from ${sections.length > 1 ? 'them' : 'it'}`
        : 'a section this summary was written from changed after it was accepted'
    );
  }

  return out;
}
