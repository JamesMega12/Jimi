import React from 'react';
import { ChevronDown, Sparkles, PenLine } from 'lucide-react';
import { StalenessDescribable, describeStaleReasons } from './staleReasonCopy';

// Small, domain-neutral presentational primitives shared by the four section
// workspaces (Summary/Reasons/ImmediateAction/FollowUpAction). No AI calls or
// state transitions live here -- callers pass in handlers.

export function FieldHint({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs text-slate-500 mt-0.5">{text}</p>;
}

// Explains *why* an accepted section went stale, in one place shared by all four
// accepted cards (they otherwise duplicate the card verbatim). Renders nothing
// when fresh. Three parts: the specific reason(s) (naming the exact field/
// section that changed, via describeStaleReasons), what to do, and a
// reassurance that this is a normal re-confirm -- not an error, and not a
// requirement to change anything (re-acceptance clears staleness
// unconditionally under the trust-the-reviewer model).
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function StaleExplanation({ ws }: { ws: StalenessDescribable }) {
  const reasons = describeStaleReasons(ws);
  if (reasons.length === 0) return null;
  return (
    <div className="text-xs text-amber-800 mt-1 mb-2 space-y-1">
      {reasons.length === 1 ? (
        <p>This section needs another look because {reasons[0]}.</p>
      ) : (
        <>
          <p>This section needs another look because:</p>
          <ul className="list-disc pl-5">
            {reasons.map((r, i) => <li key={i}>{capitalize(r)}.</li>)}
          </ul>
        </>
      )}
      <p>
        <span className="font-semibold">What to do:</span> click &ldquo;Edit / Redraft&rdquo; below,
        check that the accepted content still matches, then re-accept it.
      </p>
      <p className="text-amber-700">
        This is normal whenever related details change after you accept &mdash; it&rsquo;s a prompt to
        re-confirm, not an error. If the content still reads correctly you can re-accept it as-is;
        nothing has to change.
      </p>
    </div>
  );
}

interface EmptySectionStartProps {
  sectionLabel: string;
  hasRawContent: boolean;
  loading: boolean;
  onAskAi: () => void;
  onFillManually: () => void;
}

// Shown when a section has no structured components yet. Replaces the old
// dead-end where an empty section offered no way in except pasting text and
// hoping to remember to click Analyze -- now the two real entry points
// (AI-assisted or fully manual) are explicit and visible from the start.
export function EmptySectionStart({ sectionLabel, hasRawContent, loading, onAskAi, onFillManually }: EmptySectionStartProps) {
  return (
    <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center space-y-3">
      <p className="text-sm text-slate-600">
        Not sure where to start? Paste some rough notes above and ask AI to help, or fill in {sectionLabel} yourself.
      </p>
      <div className="flex justify-center gap-2">
        <button
          onClick={onAskAi}
          disabled={loading || !hasRawContent}
          title={hasRawContent ? undefined : 'Add a few rough notes above first'}
          className="px-4 py-2 flex items-center gap-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          Ask AI to help
        </button>
        <button
          onClick={onFillManually}
          className="px-4 py-2 flex items-center gap-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50"
        >
          <PenLine className="w-4 h-4" />
          Fill in manually
        </button>
      </div>
    </div>
  );
}

interface CollapsibleProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

// Local (non-persisted) progressive-disclosure toggle for a group of optional
// fields within a single section -- distinct from the top-level Accordion
// primitive, which toggles whole sections.
export function Collapsible({ label, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        {label}
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </div>
  );
}
