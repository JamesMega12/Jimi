// Runtime normalizers for Announcement AI responses. This project does not use
// zod (see techComSchemas.ts); all validation is manual, defensive shaping of
// whatever the model returned into a known-good structure. Unknown keys are
// dropped, non-strings coerced/ignored, empties normalized to absent.

import { randomUUID } from "crypto";
import { ActionItem, ActionKind, CauseStatus, ReasonFields, SummaryFields } from "../components/announcement/announcementTypes";

// Optional string fields the grounding backstop is allowed to strip if the
// model invents them. "renderedText" is excluded -- it is grounded separately.
export const SUMMARY_OPTIONAL_FIELDS: (keyof SummaryFields & string)[] = [
  "affectedScope",
  "impact",
  "implementationTiming",
];

function str(v: any): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

export interface NormalizedSummaryResult {
  centralMessage: string;
  affectedScope?: string;
  impact?: string;
  implementationTiming?: string;
  renderedText?: string;
}

export function normalizeSummaryResult(input: any): NormalizedSummaryResult {
  const src = input && typeof input === "object" ? input : {};
  return {
    centralMessage: str(src.centralMessage) ?? "",
    affectedScope: str(src.affectedScope),
    impact: str(src.impact),
    implementationTiming: str(src.implementationTiming),
    renderedText: str(src.renderedText),
  };
}

// --- Reason -------------------------------------------------------------------

// Only "triggeringObservation" is a strippable optional string field.
// "causeStatus" is handled separately (certainty preservation), and "rationale"
// is the core field (never stripped). "renderedText" is grounded separately.
export const REASON_OPTIONAL_FIELDS: (keyof ReasonFields & string)[] = ["triggeringObservation"];

const CAUSE_STATUSES: CauseStatus[] = ["confirmed", "preliminary", "suspected", "unknown"];

function causeStatus(v: any): CauseStatus | undefined {
  return typeof v === "string" && (CAUSE_STATUSES as string[]).includes(v) ? (v as CauseStatus) : undefined;
}

export interface NormalizedReasonResult {
  rationale: string;
  triggeringObservation?: string;
  causeStatus?: CauseStatus;
  renderedText?: string;
}

export function normalizeReasonResult(input: any): NormalizedReasonResult {
  const src = input && typeof input === "object" ? input : {};
  return {
    rationale: str(src.rationale) ?? "",
    triggeringObservation: str(src.triggeringObservation),
    causeStatus: causeStatus(src.causeStatus),
    renderedText: str(src.renderedText),
  };
}

// --- Action -------------------------------------------------------------------

const ACTION_KINDS: ActionKind[] = ["immediate", "restriction", "short-term", "long-term", "operator", "requirement", "condition"];

function actionKind(v: any): ActionKind {
  // Default to the neutral "requirement" when the model returns an unknown kind
  // -- never drop the item over a bad tag; the user can re-tag it.
  return typeof v === "string" && (ACTION_KINDS as string[]).includes(v) ? (v as ActionKind) : "requirement";
}

export interface NormalizedActionResult {
  lead?: string;
  items: ActionItem[];
}

export function normalizeActionResult(input: any): NormalizedActionResult {
  const src = input && typeof input === "object" ? input : {};
  const rawItems = Array.isArray(src.items) ? src.items : [];
  const items: ActionItem[] = rawItems
    .map((it: any) => {
      const text = str(it?.text);
      if (!text) return null; // drop empty items
      return {
        // Preserve a client-supplied id (so a rewrite keeps items aligned to
        // the reviewed components); otherwise mint one.
        id: (typeof it?.id === "string" && it.id) || randomUUID(),
        kind: actionKind(it?.kind),
        text,
        deadline: str(it?.deadline),
        responsibleRole: str(it?.responsibleRole),
        reference: str(it?.reference),
      } as ActionItem;
    })
    .filter((x: ActionItem | null): x is ActionItem => x !== null);
  return { lead: str(src.lead), items };
}
