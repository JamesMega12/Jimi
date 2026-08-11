// Copy layer of the staleness "explain why" pattern (mirrors Technical Alert
// v2's staleReasonCopy.ts). Plain TS, no JSX, so it's importable by both React
// components (AnnouncementHelpers.tsx's StaleExplanation) and readiness logic
// (announcementReadiness.ts) without pulling React into the latter.

export interface AnnouncementStalenessDescribable {
  freshness: "fresh" | "stale";
}

export function describeStaleReasons(ws: AnnouncementStalenessDescribable): string[] {
  if (ws.freshness !== "stale") return [];
  return ["you edited this section after accepting it"];
}
