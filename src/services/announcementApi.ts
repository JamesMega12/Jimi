import { parseJsonResponse } from "../utils/apiResponse";
import { SummaryComponents, SummaryAccepted, ReasonComponents, ReasonAccepted, ActionComponents, ActionAccepted, AnnouncementMetadata, AnnouncementAcceptedSectionsView, SupportingContent } from "../components/announcement/announcementTypes";

// Announcement API client. Uses parseJsonResponse (the HTML/non-JSON guard used
// across the app) and targets the dedicated /api/announcement/* routes.

export async function analyzeSummary(rawText: string): Promise<SummaryComponents> {
  const response = await fetch("/api/announcement/summary/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentType: "Announcement", rawText }),
  });
  return parseJsonResponse(response);
}

export interface RewriteWarning {
  gate: string;
  message: string;
}

export interface RewriteSummaryResponse {
  result: SummaryAccepted;
  warnings: RewriteWarning[];
}

export async function rewriteSummary(
  rawText: string,
  components: SummaryComponents,
  instructions?: string
): Promise<RewriteSummaryResponse> {
  const response = await fetch("/api/announcement/summary/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentType: "Announcement", rawText, components, instructions }),
  });
  return parseJsonResponse(response);
}

export async function analyzeReason(rawText: string): Promise<ReasonComponents> {
  const response = await fetch("/api/announcement/reason/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentType: "Announcement", rawText }),
  });
  return parseJsonResponse(response);
}

export async function rewriteReason(
  rawText: string,
  components: ReasonComponents,
  instructions?: string,
  userEditedCauseStatus?: boolean
): Promise<{ result: ReasonAccepted; warnings: RewriteWarning[] }> {
  const response = await fetch("/api/announcement/reason/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentType: "Announcement", rawText, components, instructions, userEditedCauseStatus }),
  });
  return parseJsonResponse(response);
}

export async function analyzeAction(rawText: string): Promise<ActionComponents> {
  const response = await fetch("/api/announcement/action/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentType: "Announcement", rawText }),
  });
  return parseJsonResponse(response);
}

export async function rewriteAction(
  rawText: string,
  components: ActionComponents,
  instructions?: string
): Promise<{ result: ActionAccepted; warnings: RewriteWarning[] }> {
  const response = await fetch("/api/announcement/action/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentType: "Announcement", rawText, components, instructions }),
  });
  return parseJsonResponse(response);
}

export async function exportAnnouncementDocx(
  metadata: AnnouncementMetadata,
  sections: AnnouncementAcceptedSectionsView,
  supportingContent: SupportingContent
): Promise<void> {
  const response = await fetch("/api/announcement/export-docx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentType: "Announcement", metadata, sections, supportingContent }),
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errData = await response.json();
      throw new Error(errData.error || `Export failed with status ${response.status}`);
    }
    throw new Error(`Export failed with status ${response.status}`);
  }
  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = "Announcement.docx";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1];
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
