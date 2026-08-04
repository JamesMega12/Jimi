import { ActionItem, ActionKind } from "./announcementTypes";

// Shared, framework-free rendering helpers for Action items so the review UI
// (React) and the DOCX exporter (server) produce the EXACT same text per item
// -- the review==export parity guarantee (plan §17) applied to Action, whose
// per-item metadata (deadline/role/reference) is exactly what drifted/dropped in
// the legacy exporter.

export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  immediate: "Immediate Action",
  restriction: "Restriction",
  "short-term": "Short-Term Solution",
  "long-term": "Long-Term Solution",
  operator: "Operator Instruction",
  requirement: "Requirement",
  condition: "Condition",
};

export function actionItemMeta(item: ActionItem): string {
  const meta: string[] = [];
  if (item.deadline?.trim()) meta.push(`Deadline: ${item.deadline}`);
  if (item.responsibleRole?.trim()) meta.push(`Responsible: ${item.responsibleRole}`);
  if (item.reference?.trim()) meta.push(`Ref: ${item.reference}`);
  return meta.length ? ` (${meta.join("; ")})` : "";
}

/** One complete line for an action item: "<Label>: <text> (<metadata>)". */
export function actionItemLine(item: ActionItem): string {
  return `${ACTION_KIND_LABELS[item.kind]}: ${item.text}${actionItemMeta(item)}`;
}
