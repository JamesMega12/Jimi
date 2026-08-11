import React from "react";
import { ChevronDown } from "lucide-react";
import { AnnouncementStalenessDescribable, describeStaleReasons } from "./announcementStaleReasonCopy";

// Small, domain-neutral presentational primitives for the Announcement section
// workspaces. Module-local copies (teal-themed) rather than imports from the
// Technical Alert module, keeping Announcement decoupled (plan §18).

export function FieldHint({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs text-slate-500 mt-0.5">{text}</p>;
}

// Explains *why* an accepted section went stale, shared by all three accepted
// cards. Renders nothing when fresh. Mirrors
// technical-alert/v2/SectionHelpers.tsx's StaleExplanation: the specific
// reason(s), what to do, and a reassurance that this is a normal re-confirm,
// not an error -- re-accepting clears staleness unconditionally.
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function StaleExplanation({ ws }: { ws: AnnouncementStalenessDescribable }) {
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
            {reasons.map((r, i) => (
              <li key={i}>{capitalize(r)}.</li>
            ))}
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

interface CollapsibleProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Collapsible({ label, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {label}
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </div>
  );
}
