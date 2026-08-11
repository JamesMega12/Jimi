import express from "express";
import { GoogleGenAI } from "@google/genai";
import { ANNOUNCEMENT_SUMMARY_ANALYZE_PROMPT, ANNOUNCEMENT_SUMMARY_REWRITE_PROMPT } from "../announcementPrompts/summaryPrompt";
import { ANNOUNCEMENT_REASON_ANALYZE_PROMPT, ANNOUNCEMENT_REASON_REWRITE_PROMPT } from "../announcementPrompts/reasonPrompt";
import { ANNOUNCEMENT_ACTION_ANALYZE_PROMPT, ANNOUNCEMENT_ACTION_REWRITE_PROMPT } from "../announcementPrompts/actionPrompt";
import { normalizeSummaryResult, NormalizedSummaryResult, SUMMARY_OPTIONAL_FIELDS, normalizeReasonResult, NormalizedReasonResult, REASON_OPTIONAL_FIELDS, normalizeActionResult } from "../announcementNormalizer";
import { stripUnsupportedAdditions, groundRenderedText, identifierInventionWarnings, resolveCauseStatus, uncertaintyPreservationWarnings, actionStructureWarnings, GroundingWarning } from "../announcementGrounding";
import { buildAnnouncementSnapshot, isAnnouncementSnapshotExportable } from "../../components/announcement/announcementSnapshot";
import { generateAnnouncementDocx } from "../announcementDocxExportService";
import { AI_TIMEOUT_MS, withTimeout, sendPipelineError } from "../aiCall";
import { logEvent } from "../logger";

// Dedicated Announcement routes: per-section, per-operation split (analyze !=
// rewrite) for Summary / Reason / Action, with deterministic grounding backstops
// and no Technical Alert semantics, plus review/export.
export const announcementRoutes = express.Router();

async function callGeminiForSection(userPrompt: string, systemInstruction: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  const ai = new GoogleGenAI({ apiKey });
  // Bound the call: abort the request and reject with ProviderTimeoutError if it
  // exceeds AI_TIMEOUT_MS, so a hung provider can never hang the HTTP handler.
  const controller = new AbortController();
  const started = Date.now();
  const response = await withTimeout(
    ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: { responseMimeType: "application/json", temperature: 0.15, systemInstruction, abortSignal: controller.signal },
    }),
    AI_TIMEOUT_MS,
    () => controller.abort()
  );
  logEvent("info", "ai_request", { workflow: "Announcement", ms: Date.now() - started });
  return response.text?.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim() || "{}";
}

// --- Summary -----------------------------------------------------------------

announcementRoutes.post("/summary/analyze", async (req, res) => {
  try {
    const { rawText, documentType } = req.body;
    if (documentType !== "Announcement") return res.status(400).json({ error: "Invalid document type" });
    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return res.status(400).json({ error: "rawText is required." });
    }

    const prompt = `Extract structured Summary content from the following raw source text.\n\nRaw Source:\n${JSON.stringify(rawText)}\n\nReturn JSON matching the schema described in the system instructions.`;
    const raw = await callGeminiForSection(prompt, ANNOUNCEMENT_SUMMARY_ANALYZE_PROMPT);
    const result = normalizeSummaryResult(JSON.parse(raw));
    res.json(result);
  } catch (error: any) {
    sendPipelineError(res, error, "Announcement", req);
  }
});

// Send optional fields the user left absent to the model as explicit `null`,
// not omitted keys -- JSON.stringify drops `undefined`, so without this the
// model couldn't tell "reviewed and confirmed absent" from "never asked."
function withExplicitNulls(pre: NormalizedSummaryResult): Record<string, string | null> {
  const out: Record<string, string | null> = { centralMessage: pre.centralMessage };
  for (const field of SUMMARY_OPTIONAL_FIELDS) {
    out[field] = pre[field] ?? null;
  }
  return out;
}

announcementRoutes.post("/summary/rewrite", async (req, res) => {
  try {
    const { rawText, components, documentType, instructions } = req.body;
    if (documentType !== "Announcement") return res.status(400).json({ error: "Invalid document type" });
    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return res.status(400).json({ error: "rawText is required." });
    }
    if (!components) return res.status(400).json({ error: "components is required -- rewrite must be grounded on reviewed analysis output." });

    const pre: NormalizedSummaryResult = normalizeSummaryResult(components);
    const preForModel = withExplicitNulls(pre);

    const prompt = `Rewrite Announcement Summary content per the SUMMARY REWRITE task above.\n\nInstructions: ${instructions || "None"}\n\nOriginal Raw Source (context only -- do not extract new facts beyond what's in Reviewed Fields): ${JSON.stringify(rawText)}\n\nReviewed Fields (null means confirmed absent by the user -- do not fill it in): ${JSON.stringify(preForModel)}\n\nReturn JSON matching the schema described in the system instructions.`;

    const raw = await callGeminiForSection(prompt, ANNOUNCEMENT_SUMMARY_REWRITE_PROMPT);
    const modelPost = normalizeSummaryResult(JSON.parse(raw));

    // Deterministic backstop: strip any optional field the model populated
    // without support in the grounding text, then ground the paragraph itself.
    const { cleaned, warnings: additionWarnings } = stripUnsupportedAdditions(
      pre,
      modelPost,
      [rawText, pre],
      SUMMARY_OPTIONAL_FIELDS
    );

    const grounded = groundRenderedText(
      cleaned.renderedText,
      [cleaned.affectedScope, cleaned.impact, cleaned.implementationTiming],
      rawText
    );
    const post: NormalizedSummaryResult = { ...cleaned, renderedText: grounded.text };

    const warnings: GroundingWarning[] = [...additionWarnings];
    if (grounded.warning) warnings.push(grounded.warning);
    warnings.push(...identifierInventionWarnings([rawText, pre], [post]));

    res.json({ result: post, warnings });
  } catch (error: any) {
    sendPipelineError(res, error, "Announcement", req);
  }
});

// --- Reason -------------------------------------------------------------------

announcementRoutes.post("/reason/analyze", async (req, res) => {
  try {
    const { rawText, documentType } = req.body;
    if (documentType !== "Announcement") return res.status(400).json({ error: "Invalid document type" });
    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return res.status(400).json({ error: "rawText is required." });
    }
    const prompt = `Extract structured Reason content from the following raw source text.\n\nRaw Source:\n${JSON.stringify(rawText)}\n\nReturn JSON matching the schema described in the system instructions.`;
    const raw = await callGeminiForSection(prompt, ANNOUNCEMENT_REASON_ANALYZE_PROMPT);
    const result = normalizeReasonResult(JSON.parse(raw));
    res.json(result);
  } catch (error: any) {
    sendPipelineError(res, error, "Announcement", req);
  }
});

// Explicit-null for the reason's optional string fields (see summary's
// withExplicitNulls). causeStatus is included as-is (or null) so the model is
// told "no cause was asserted" rather than being free to introduce one.
function reasonWithExplicitNulls(pre: NormalizedReasonResult): Record<string, string | null> {
  const out: Record<string, string | null> = { rationale: pre.rationale };
  for (const field of REASON_OPTIONAL_FIELDS) out[field] = pre[field] ?? null;
  out.causeStatus = pre.causeStatus ?? null;
  return out;
}

announcementRoutes.post("/reason/rewrite", async (req, res) => {
  try {
    const { rawText, components, documentType, instructions, userEditedCauseStatus } = req.body;
    if (documentType !== "Announcement") return res.status(400).json({ error: "Invalid document type" });
    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return res.status(400).json({ error: "rawText is required." });
    }
    if (!components) return res.status(400).json({ error: "components is required -- rewrite must be grounded on reviewed analysis output." });

    const pre: NormalizedReasonResult = normalizeReasonResult(components);
    const preForModel = reasonWithExplicitNulls(pre);

    const prompt = `Rewrite Announcement Reason content per the REASON REWRITE task above.\n\nInstructions: ${instructions || "None"}\n\nOriginal Raw Source (context only -- do not extract new facts beyond what's in Reviewed Fields): ${JSON.stringify(rawText)}\n\nReviewed Fields (null means confirmed absent by the user -- do not fill it in; a null causeStatus means NO cause is asserted, do not introduce one): ${JSON.stringify(preForModel)}\n\nReturn JSON matching the schema described in the system instructions.`;

    const raw = await callGeminiForSection(prompt, ANNOUNCEMENT_REASON_REWRITE_PROMPT);
    const modelPost = normalizeReasonResult(JSON.parse(raw));

    // Deterministic backstops: strip unsupported optional additions, enforce
    // certainty preservation, ground the paragraph, preserve hedging + identifiers.
    const { cleaned, warnings: additionWarnings } = stripUnsupportedAdditions(pre, modelPost, [rawText, pre], REASON_OPTIONAL_FIELDS);

    const causeResolved = resolveCauseStatus(pre.causeStatus, cleaned.causeStatus, userEditedCauseStatus === true);
    const grounded = groundRenderedText(cleaned.renderedText, [cleaned.rationale, cleaned.triggeringObservation], rawText);

    const post: NormalizedReasonResult = { ...cleaned, causeStatus: causeResolved.causeStatus as any, renderedText: grounded.text };

    const warnings: GroundingWarning[] = [...additionWarnings];
    if (causeResolved.warning) warnings.push(causeResolved.warning);
    if (grounded.warning) warnings.push(grounded.warning);
    warnings.push(...uncertaintyPreservationWarnings([rawText, pre], [post]));
    warnings.push(...identifierInventionWarnings([rawText, pre], [post]));

    res.json({ result: post, warnings });
  } catch (error: any) {
    sendPipelineError(res, error, "Announcement", req);
  }
});

// --- Action -------------------------------------------------------------------

announcementRoutes.post("/action/analyze", async (req, res) => {
  try {
    const { rawText, documentType } = req.body;
    if (documentType !== "Announcement") return res.status(400).json({ error: "Invalid document type" });
    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return res.status(400).json({ error: "rawText is required." });
    }
    const prompt = `Extract structured Action content from the following raw source text.\n\nRaw Source:\n${JSON.stringify(rawText)}\n\nReturn JSON matching the schema described in the system instructions.`;
    const raw = await callGeminiForSection(prompt, ANNOUNCEMENT_ACTION_ANALYZE_PROMPT);
    const result = normalizeActionResult(JSON.parse(raw));
    res.json(result);
  } catch (error: any) {
    sendPipelineError(res, error, "Announcement", req);
  }
});

announcementRoutes.post("/action/rewrite", async (req, res) => {
  try {
    const { rawText, components, documentType, instructions } = req.body;
    if (documentType !== "Announcement") return res.status(400).json({ error: "Invalid document type" });
    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return res.status(400).json({ error: "rawText is required." });
    }
    if (!components || !Array.isArray(components.items)) {
      return res.status(400).json({ error: "components (with an items array) is required -- rewrite must be grounded on reviewed analysis output." });
    }

    // Normalize the caller-supplied reviewed items the same way analysis output
    // is normalized, so ids/kinds are stable and the structure gate compares
    // like-for-like.
    const pre = normalizeActionResult(components);
    const prompt = `Rewrite Announcement Action content per the ACTION REWRITE task above.\n\nInstructions: ${instructions || "None"}\n\nOriginal Raw Source (context only): ${JSON.stringify(rawText)}\n\nReviewed Items (keep the same count, order, ids, and kinds; only improve wording): ${JSON.stringify(pre)}\n\nReturn JSON matching the schema described in the system instructions.`;

    const raw = await callGeminiForSection(prompt, ANNOUNCEMENT_ACTION_REWRITE_PROMPT);
    const post = normalizeActionResult(JSON.parse(raw));

    const warnings: GroundingWarning[] = [];
    warnings.push(...actionStructureWarnings(pre.items, post.items));
    warnings.push(...identifierInventionWarnings([rawText, pre], [post]));

    res.json({ result: post, warnings });
  } catch (error: any) {
    sendPipelineError(res, error, "Announcement", req);
  }
});

// --- Canonical export --------------------------------------------------------
// (Review is built client-side via buildAnnouncementSnapshot; the export route
// rebuilds the same snapshot server-side, so there is no separate /snapshot
// endpoint.)

announcementRoutes.post("/export-docx", async (req, res) => {
  try {
    const { documentType, metadata, sections, supportingContent } = req.body;
    if (documentType !== "Announcement") return res.status(400).json({ error: "Invalid document type" });
    if (!metadata || !sections) return res.status(400).json({ error: "metadata and sections are required." });

    // Server rebuilds the snapshot itself from the submitted accepted-only
    // section state -- it never trusts a client-constructed snapshot object.
    const snapshot = buildAnnouncementSnapshot({ metadata, sections, supportingContent: supportingContent ?? { figures: [] } });
    if (!isAnnouncementSnapshotExportable(snapshot)) {
      return res.status(422).json({
        error: `Document is not ready for export: ${snapshot.readiness.blockingIssues.join(" ")}`,
        blockingIssues: snapshot.readiness.blockingIssues,
      });
    }

    const buffer = await generateAnnouncementDocx(snapshot);
    const safeTitle = (snapshot.metadata.title || "Announcement").replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "_") || "Announcement";
    res.setHeader("Content-Disposition", `attachment; filename="WCF-AN-${safeTitle}.docx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.send(buffer);
  } catch (error: any) {
    sendPipelineError(res, error, "Announcement", req);
  }
});
