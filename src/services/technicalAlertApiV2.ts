import { parseJsonResponse } from '../utils/apiResponse';
import { ImmediateActionContent, FollowUpActionContent, ReasonsAccepted, SummaryAccepted, SummaryComponents } from '../components/technical-alert/v2/types';

// v2 API client. Unlike v1's technicalAlertApi.ts, this adopts parseJsonResponse
// (the HTML/non-JSON response guard already used elsewhere in the app, e.g. FCO
// and the knowledge-base panels) -- closing a Low-severity gap noted in the
// original audit where the v1 TA client used raw fetch with no such guard.

export async function analyzeImmediateAction(rawText: string): Promise<ImmediateActionContent> {
  const response = await fetch('/api/technical-alert/v2/immediate-action/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'Technical Alert', rawText }),
  });
  return parseJsonResponse(response);
}

export interface RewriteImmediateActionResponse {
  result: ImmediateActionContent;
  warnings: { gate: string; message: string }[];
}

export async function rewriteImmediateAction(
  rawText: string,
  components: ImmediateActionContent,
  instructions?: string
): Promise<RewriteImmediateActionResponse> {
  const response = await fetch('/api/technical-alert/v2/immediate-action/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'Technical Alert', rawText, components, instructions }),
  });
  return parseJsonResponse(response);
}

export interface RewriteResponse<T> {
  result: T;
  warnings: { gate: string; message: string }[];
}

export async function analyzeFollowUpAction(rawText: string): Promise<FollowUpActionContent> {
  const response = await fetch('/api/technical-alert/v2/follow-up-action/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'Technical Alert', rawText }),
  });
  return parseJsonResponse(response);
}

export async function rewriteFollowUpAction(
  rawText: string,
  components: FollowUpActionContent,
  instructions?: string
): Promise<RewriteResponse<FollowUpActionContent>> {
  const response = await fetch('/api/technical-alert/v2/follow-up-action/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'Technical Alert', rawText, components, instructions }),
  });
  return parseJsonResponse(response);
}

export async function analyzeReasons(rawText: string): Promise<ReasonsAccepted> {
  const response = await fetch('/api/technical-alert/v2/reasons/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'Technical Alert', rawText }),
  });
  return parseJsonResponse(response);
}

export async function rewriteReasons(
  rawText: string,
  components: ReasonsAccepted,
  instructions?: string,
  userEditedCauseStatus?: boolean
): Promise<RewriteResponse<ReasonsAccepted>> {
  const response = await fetch('/api/technical-alert/v2/reasons/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'Technical Alert', rawText, components, instructions, userEditedCauseStatus }),
  });
  return parseJsonResponse(response);
}

export async function analyzeSummary(rawText: string): Promise<SummaryComponents> {
  const response = await fetch('/api/technical-alert/v2/summary/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'Technical Alert', rawText }),
  });
  return parseJsonResponse(response);
}

export async function rewriteSummary(
  rawText: string,
  components: SummaryAccepted,
  instructions?: string,
  acceptedNeighbors?: Record<string, unknown>
): Promise<RewriteResponse<SummaryAccepted>> {
  const response = await fetch('/api/technical-alert/v2/summary/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'Technical Alert', rawText, components, instructions, acceptedNeighbors }),
  });
  return parseJsonResponse(response);
}

export interface DeepCheckFinding {
  message: string;
  relatedSections: string[];
}

export async function runCrossSectionDeepCheck(sections: Record<string, unknown>): Promise<{ findings: DeepCheckFinding[] }> {
  const response = await fetch('/api/technical-alert/v2/cross-section-review/deep-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'Technical Alert', sections }),
  });
  return parseJsonResponse(response);
}

export async function exportTechnicalAlertDocxV2(payload: Record<string, unknown>): Promise<void> {
  const response = await fetch('/api/technical-alert/v2/export-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'Technical Alert', ...payload }),
  });
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const errData = await response.json();
      throw new Error(errData.error || `Export failed with status ${response.status}`);
    }
    throw new Error(`Export failed with status ${response.status}`);
  }
  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = 'TechnicalAlert.docx';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1];
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
