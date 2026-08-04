import React from "react";
import { ChevronDown, Sparkles, PenLine } from "lucide-react";

// Small, domain-neutral presentational primitives for the Announcement section
// workspaces. Module-local copies (teal-themed) rather than imports from the
// Technical Alert module, keeping Announcement decoupled (plan §18).

export function FieldHint({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs text-slate-500 mt-0.5">{text}</p>;
}

interface EmptySectionStartProps {
  sectionLabel: string;
  hasRawContent: boolean;
  loading: boolean;
  onAskAi: () => void;
  onFillManually: () => void;
}

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
          title={hasRawContent ? undefined : "Add a few rough notes above first"}
          className="px-4 py-2 flex items-center gap-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
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
