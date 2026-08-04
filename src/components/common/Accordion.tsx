import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Generic, domain-neutral progressive-disclosure primitive. Modeled on the
// interaction pattern already proven in this codebase by Announcement's
// TechComStepDraftEditor.tsx (`openSections: Record<string, boolean>`), not on
// FCO's stepper -- FCO has no left-side/accordion navigator (confirmed during
// the refactor's FCO inspiration review). Zero domain coupling: takes only
// strings and a render prop.

export function useDisclosure(initialOpenIds: string[] = []) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(initialOpenIds));
  const isOpen = (id: string) => openIds.has(id);
  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const open = (id: string) => setOpenIds(prev => new Set(prev).add(id));
  const reset = () => setOpenIds(new Set(initialOpenIds));
  return { isOpen, toggle, open, reset };
}

interface AccordionSectionProps {
  id: string;
  title: string;
  statusBadge?: React.ReactNode;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

// The `ta-section-` prefix on the root id is a scroll-target contract with
// TechnicalAlertWorkflowV2.tsx's handleJumpToSection -- keep in sync if
// either side changes (2026-07-28: was previously nothing to scroll to at
// all, "Go to Section" links silently didn't scroll).
export function accordionSectionDomId(id: string): string {
  return `ta-section-${id}`;
}

export function AccordionSection({ id, title, statusBadge, isOpen, onToggle, children }: AccordionSectionProps) {
  return (
    <div id={accordionSectionDomId(id)} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
      >
        <span className="font-bold text-slate-800">{title}</span>
        <div className="flex items-center gap-3">
          {statusBadge}
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isOpen && <div className="p-4 border-t border-slate-100">{children}</div>}
    </div>
  );
}
