import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Readiness } from "./announcementTypes";

// Shared readiness rendering used by both the drafting-stage strip
// (AnnouncementWorkflow.tsx) and Final Review (AnnouncementReview.tsx) so the
// two can never disagree -- mirrors technical-alert/v2/ReadinessPanel.tsx.

export default function AnnouncementReadinessPanel({ readiness }: { readiness: Readiness }) {
  return (
    <div
      className={`p-4 rounded-lg border flex items-start gap-2 ${
        readiness.status === "Ready"
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : readiness.status === "Blocked"
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-amber-50 border-amber-200 text-amber-800"
      }`}
    >
      {readiness.status === "Ready" ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
      <div>
        <strong>Readiness: {readiness.status}</strong>
        {readiness.blockingIssues.length > 0 && (
          <ul className="list-disc pl-5 mt-1 text-sm">
            {readiness.blockingIssues.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        {readiness.warnings.length > 0 && (
          <ul className="list-disc pl-5 mt-1 text-sm opacity-90">
            {readiness.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
