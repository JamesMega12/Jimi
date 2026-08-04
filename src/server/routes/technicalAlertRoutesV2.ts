import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { IMMEDIATE_ACTION_ANALYZE_PROMPT, IMMEDIATE_ACTION_REWRITE_PROMPT } from '../technicalAlertPrompts/immediateActionPrompt';
import { FOLLOW_UP_ACTION_ANALYZE_PROMPT, FOLLOW_UP_ACTION_REWRITE_PROMPT } from '../technicalAlertPrompts/followUpActionPrompt';
import { REASONS_ANALYZE_PROMPT, REASONS_REWRITE_PROMPT } from '../technicalAlertPrompts/reasonsPrompt';
import { SUMMARY_ANALYZE_PROMPT, SUMMARY_REWRITE_PROMPT } from '../technicalAlertPrompts/summaryPrompt';
import { CROSS_SECTION_DEEP_CHECK_PROMPT } from '../technicalAlertPrompts/crossSectionReviewPrompt';
import { buildTechnicalAlertSnapshot, isSnapshotExportable } from '../../components/technical-alert/v2/snapshot';
import { generateTechnicalAlertDocxV2 } from '../technicalAlertDocxExportServiceV2';
import {
  normalizeImmediateActionResult,
  NormalizedImmediateActionResult,
  normalizeFollowUpActionResult,
  NormalizedFollowUpActionResult,
  normalizeReasonsResult,
  NormalizedReasonsResult,
  REASONS_NARRATIVE_OPTIONAL_FIELDS,
  normalizeSummaryResultV2,
  NormalizedSummaryResult,
  SUMMARY_OPTIONAL_FIELDS,
} from '../technicalAlertNormalizerV2';
import {
  runImmediateActionGates,
  runFollowUpActionGates,
  runReasonsGates,
  runSummaryGates,
  stripUnsupportedAdditions,
  groundInstructionText,
  groundRenderedText,
} from '../technicalAlertObligationGates';
import { runSteChecks } from '../technicalAlertSteRules';
import { AI_TIMEOUT_MS, withTimeout, sendPipelineError } from '../aiCall';
import { logEvent } from '../logger';

// v2 vertical-slice routes: additive and parallel to the live v1
// /api/technical-alert/* routes, which remain completely untouched.
export const technicalAlertRoutesV2 = express.Router();

async function callGeminiForSection(userPrompt: string, systemInstruction: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  const ai = new GoogleGenAI({ apiKey });
  // Bound the call: abort and reject with ProviderTimeoutError past
  // AI_TIMEOUT_MS so a hung provider can never hang the HTTP handler.
  const controller = new AbortController();
  const started = Date.now();
  const response = await withTimeout(
    ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.15,
        systemInstruction,
        abortSignal: controller.signal,
      },
    }),
    AI_TIMEOUT_MS,
    () => controller.abort()
  );
  logEvent('info', 'ai_request', { workflow: 'Technical Alert', ms: Date.now() - started });
  return response.text?.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim() || '{}';
}

technicalAlertRoutesV2.post('/immediate-action/analyze', async (req, res) => {
  try {
    const { rawText, documentType } = req.body;
    if (documentType !== 'Technical Alert') {
      return res.status(400).json({ error: 'Invalid document type' });
    }
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ error: 'rawText is required.' });
    }

    const prompt = `Extract structured Immediate Action content from the following raw source text.\n\nRaw Source:\n${JSON.stringify(rawText)}\n\nReturn JSON matching the schema described in the system instructions.`;

    const raw = await callGeminiForSection(prompt, IMMEDIATE_ACTION_ANALYZE_PROMPT);
    const result = normalizeImmediateActionResult(JSON.parse(raw));
    res.json(result);
  } catch (error: any) {
    sendPipelineError(res, error, 'Technical Alert', req);
  }
});

technicalAlertRoutesV2.post('/immediate-action/rewrite', async (req, res) => {
  try {
    const { rawText, components, documentType, instructions } = req.body;
    if (documentType !== 'Technical Alert') {
      return res.status(400).json({ error: 'Invalid document type' });
    }
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ error: 'rawText is required.' });
    }
    if (!components || !Array.isArray(components.items)) {
      return res.status(400).json({ error: 'components (with an items array) is required -- rewrite must be grounded on reviewed analysis output, not raw text alone.' });
    }

    // Normalize the caller-supplied "pre" components the same way a fresh
    // analysis response would be normalized, so the gates below compare
    // like-for-like structures (and so a client can't smuggle unshaped data
    // in as "already trusted" pre-state).
    const pre: NormalizedImmediateActionResult = normalizeImmediateActionResult(components);

    const prompt = `Rewrite Immediate Action content per the IMMEDIATE ACTION REWRITE task above.\n\nInstructions: ${instructions || 'None'}\n\nOriginal Raw Source (context only): ${JSON.stringify(rawText)}\n\nReviewed Fields: ${JSON.stringify(pre)}\n\nReturn JSON matching the schema described in the system instructions.`;

    const raw = await callGeminiForSection(prompt, IMMEDIATE_ACTION_REWRITE_PROMPT);
    const modelPost = normalizeImmediateActionResult(JSON.parse(raw));

    // Strip any per-item instructionText that isn't well-supported by that
    // item's own fields + raw source (Problem 1's per-item backstop) before
    // running the structural gates.
    const { cleaned: cleanedItems, warnings: groundingWarnings } = groundInstructionText(modelPost.items, rawText);
    const post: NormalizedImmediateActionResult = { items: cleanedItems, exceptions: modelPost.exceptions };

    const { blocking, warnings: gateWarnings } = runImmediateActionGates([rawText, pre], pre, post);
    if (blocking.length > 0) {
      return res.status(422).json({
        error: `Rewrite failed safety validation: ${blocking.map(v => v.message).join(' ')}`,
        violations: blocking,
      });
    }

    const steWarnings = post.items.flatMap((item, i) =>
      runSteChecks(item.instructionText, 'instructional').map(f => ({ gate: `ste:${f.rule}`, message: `Item ${i + 1}: ${f.message}` }))
    );

    res.json({ result: post, warnings: [...groundingWarnings, ...gateWarnings, ...steWarnings] });
  } catch (error: any) {
    sendPipelineError(res, error, 'Technical Alert', req);
  }
});

// --- Follow-Up Action ---------------------------------------------------------

technicalAlertRoutesV2.post('/follow-up-action/analyze', async (req, res) => {
  try {
    const { rawText, documentType } = req.body;
    if (documentType !== 'Technical Alert') return res.status(400).json({ error: 'Invalid document type' });
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return res.status(400).json({ error: 'rawText is required.' });

    const prompt = `Extract structured Follow-Up Action content from the following raw source text.\n\nRaw Source:\n${JSON.stringify(rawText)}\n\nReturn JSON matching the schema described in the system instructions.`;
    const raw = await callGeminiForSection(prompt, FOLLOW_UP_ACTION_ANALYZE_PROMPT);
    const result = normalizeFollowUpActionResult(JSON.parse(raw));
    res.json(result);
  } catch (error: any) {
    sendPipelineError(res, error, 'Technical Alert', req);
  }
});

technicalAlertRoutesV2.post('/follow-up-action/rewrite', async (req, res) => {
  try {
    const { rawText, components, documentType, instructions } = req.body;
    if (documentType !== 'Technical Alert') return res.status(400).json({ error: 'Invalid document type' });
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return res.status(400).json({ error: 'rawText is required.' });
    if (!components || !Array.isArray(components.items)) {
      return res.status(400).json({ error: 'components (with an items array) is required.' });
    }

    const pre: NormalizedFollowUpActionResult = normalizeFollowUpActionResult(components);
    const prompt = `Rewrite Follow-Up Action content per the FOLLOW-UP ACTION REWRITE task above.\n\nInstructions: ${instructions || 'None'}\n\nOriginal Raw Source (context only): ${JSON.stringify(rawText)}\n\nReviewed Fields: ${JSON.stringify(pre)}\n\nReturn JSON matching the schema described in the system instructions.`;

    const raw = await callGeminiForSection(prompt, FOLLOW_UP_ACTION_REWRITE_PROMPT);
    const modelPost = normalizeFollowUpActionResult(JSON.parse(raw));

    const { cleaned: cleanedItems, warnings: groundingWarnings } = groundInstructionText(modelPost.items, rawText);
    const post: NormalizedFollowUpActionResult = { items: cleanedItems, notApplicable: modelPost.notApplicable };

    const { blocking, warnings: gateWarnings } = runFollowUpActionGates([rawText, pre], pre, post);
    if (blocking.length > 0) {
      return res.status(422).json({ error: `Rewrite failed safety validation: ${blocking.map(v => v.message).join(' ')}`, violations: blocking });
    }

    const steWarnings = post.items.flatMap((item, i) =>
      runSteChecks(item.instructionText, 'instructional').map(f => ({ gate: `ste:${f.rule}`, message: `Item ${i + 1}: ${f.message}` }))
    );

    res.json({ result: post, warnings: [...groundingWarnings, ...gateWarnings, ...steWarnings] });
  } catch (error: any) {
    sendPipelineError(res, error, 'Technical Alert', req);
  }
});

// --- Reasons -------------------------------------------------------------------

technicalAlertRoutesV2.post('/reasons/analyze', async (req, res) => {
  try {
    const { rawText, documentType } = req.body;
    if (documentType !== 'Technical Alert') return res.status(400).json({ error: 'Invalid document type' });
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return res.status(400).json({ error: 'rawText is required.' });

    const prompt = `Extract structured Reasons content from the following raw source text.\n\nRaw Source:\n${JSON.stringify(rawText)}\n\nReturn JSON matching the schema described in the system instructions.`;
    const raw = await callGeminiForSection(prompt, REASONS_ANALYZE_PROMPT);
    const result = normalizeReasonsResult(JSON.parse(raw));
    res.json(result);
  } catch (error: any) {
    sendPipelineError(res, error, 'Technical Alert', req);
  }
});

// Same explicit-null principle as Summary's withExplicitNulls -- narrative's
// optional string fields go to the model as null, not omitted keys, so it
// can distinguish "reviewed and confirmed absent" from "never asked."
function reasonsWithExplicitNulls(pre: NormalizedReasonsResult): Record<string, any> {
  if (!pre.narrative) return { narrative: null, evidenceItems: pre.evidenceItems ?? null };
  const narrative: Record<string, any> = { causeStatus: pre.narrative.causeStatus };
  for (const field of REASONS_NARRATIVE_OPTIONAL_FIELDS) {
    narrative[field] = pre.narrative[field] ?? null;
  }
  return { narrative, evidenceItems: pre.evidenceItems ?? null };
}

technicalAlertRoutesV2.post('/reasons/rewrite', async (req, res) => {
  try {
    const { rawText, components, documentType, instructions, userEditedCauseStatus } = req.body;
    if (documentType !== 'Technical Alert') return res.status(400).json({ error: 'Invalid document type' });
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return res.status(400).json({ error: 'rawText is required.' });
    if (!components) return res.status(400).json({ error: 'components is required.' });

    const pre: NormalizedReasonsResult = normalizeReasonsResult(components);
    const preForModel = reasonsWithExplicitNulls(pre);
    const prompt = `Rewrite Reasons content per the REASONS REWRITE task above.\n\nInstructions: ${instructions || 'None'}\n\nOriginal Raw Source (context only -- do not extract new facts from it beyond what's in Reviewed Fields): ${JSON.stringify(rawText)}\n\nReviewed Fields (null means confirmed absent by the user -- do not fill it in; a null "narrative" means this alert's reasons are evidence-table-shaped, do not invent one): ${JSON.stringify(preForModel)}\n\nReturn JSON matching the schema described in the system instructions.`;

    const raw = await callGeminiForSection(prompt, REASONS_REWRITE_PROMPT);
    const modelPost = normalizeReasonsResult(JSON.parse(raw));

    // Deterministic backstop (not just a prompt instruction): if the reviewed
    // components had no narrative at all, the rewrite is NEVER allowed to
    // invent one from nothing, regardless of what the model returned.
    let post: NormalizedReasonsResult = modelPost;
    const additionWarnings: { gate: string; message: string }[] = [];
    if (!pre.narrative) {
      if (post.narrative) {
        additionWarnings.push({
          gate: 'unsupportedAddition',
          message: 'The rewrite invented a narrative where the reviewed components had none -- it was removed. This alert\'s reasons appear to be evidence-table-shaped; add a narrative manually if one is genuinely needed.',
        });
      }
      post = { ...post, narrative: undefined };
    } else if (post.narrative) {
      const { cleaned, warnings: stripWarnings } = stripUnsupportedAdditions(
        pre.narrative,
        post.narrative,
        [rawText, pre],
        REASONS_NARRATIVE_OPTIONAL_FIELDS
      );
      post = { ...post, narrative: { ...cleaned, causeStatus: post.narrative.causeStatus } };
      additionWarnings.push(...stripWarnings);

      // Ground the synthesized paragraph itself, not just the re-derived
      // breakdown fields (2026-07-28 fix) -- if unsupported, drop it so the
      // renderer falls back to the (now grounding-checked) field list.
      const groundedResult = groundRenderedText(
        post.narrative.renderedText,
        [cleaned.technicalBasis, cleaned.complianceBasis, cleaned.consequence],
        rawText
      );
      post = { ...post, narrative: { ...post.narrative, renderedText: groundedResult.text } };
      if (groundedResult.warning) additionWarnings.push(groundedResult.warning);
    }

    const { blocking, warnings: gateWarnings } = runReasonsGates([rawText, pre], pre, post, userEditedCauseStatus === true);
    if (blocking.length > 0) {
      return res.status(422).json({ error: `Rewrite failed safety validation: ${blocking.map(v => v.message).join(' ')}`, violations: blocking });
    }

    const steFindings = runSteChecks(post.narrative?.renderedText, 'descriptive');
    const steWarnings = steFindings.map(f => ({ gate: `ste:${f.rule}`, message: f.message }));

    res.json({ result: post, warnings: [...additionWarnings, ...gateWarnings, ...steWarnings] });
  } catch (error: any) {
    sendPipelineError(res, error, 'Technical Alert', req);
  }
});

// --- Summary ---------------------------------------------------------------

technicalAlertRoutesV2.post('/summary/analyze', async (req, res) => {
  try {
    const { rawText, documentType } = req.body;
    if (documentType !== 'Technical Alert') return res.status(400).json({ error: 'Invalid document type' });
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return res.status(400).json({ error: 'rawText is required.' });

    const prompt = `Extract structured Summary content from the following raw source text.\n\nRaw Source:\n${JSON.stringify(rawText)}\n\nReturn JSON matching the schema described in the system instructions.`;
    const raw = await callGeminiForSection(prompt, SUMMARY_ANALYZE_PROMPT);
    const result = normalizeSummaryResultV2(JSON.parse(raw));
    res.json(result);
  } catch (error: any) {
    sendPipelineError(res, error, 'Technical Alert', req);
  }
});

// Returns a plain object matching NormalizedSummaryResult's optional fields,
// but with explicit `null` for any field the reviewed components left
// absent -- rather than an omitted key. JSON.stringify drops `undefined`
// keys silently, so a model reading `pre` couldn't otherwise tell "reviewed
// and confirmed absent" from "never asked about this field at all." See
// plans/role-you-are-working-delightful-cupcake.md §7.
function withExplicitNulls(pre: NormalizedSummaryResult): Record<string, string | null> {
  const out: Record<string, string | null> = { subject: pre.subject, affectedScope: pre.affectedScope };
  for (const field of SUMMARY_OPTIONAL_FIELDS) {
    if (field === 'renderedText') continue; // never part of the "reviewed fields" the model is given
    out[field] = pre[field] ?? null;
  }
  return out;
}

technicalAlertRoutesV2.post('/summary/rewrite', async (req, res) => {
  try {
    const { rawText, components, documentType, instructions, acceptedNeighbors } = req.body;
    if (documentType !== 'Technical Alert') return res.status(400).json({ error: 'Invalid document type' });
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return res.status(400).json({ error: 'rawText is required.' });
    if (!components) return res.status(400).json({ error: 'components is required.' });

    const pre: NormalizedSummaryResult = normalizeSummaryResultV2(components);
    const preForModel = withExplicitNulls(pre);

    // Locked decision #5: Summary's rewrite MAY optionally read already-
    // accepted neighbor sections as READ-ONLY synthesis grounding, because
    // Summary's job is synthesis -- unlike Reasons/Immediate/Follow-Up, which
    // never receive neighbor context (see AI Pipeline Design in the refactor
    // plan). This is provided by the client, not fetched server-side, and is
    // never written back to any other section.
    const neighborContext = acceptedNeighbors
      ? `\n\nFor synthesis context only (read-only -- do not restate verbatim, do not modify): ${JSON.stringify(acceptedNeighbors)}`
      : '';

    const prompt = `Rewrite Summary content per the SUMMARY REWRITE task above.\n\nInstructions: ${instructions || 'None'}\n\nOriginal Raw Source (context only -- do not extract new facts from it beyond what's in Reviewed Fields): ${JSON.stringify(rawText)}\n\nReviewed Fields (null means confirmed absent by the user -- do not fill it in): ${JSON.stringify(preForModel)}${neighborContext}\n\nReturn JSON matching the schema described in the system instructions.`;

    const raw = await callGeminiForSection(prompt, SUMMARY_REWRITE_PROMPT);
    const modelPost = normalizeSummaryResultV2(JSON.parse(raw));

    // Strip any optional field the model populated without support in the
    // grounding text (Problem 1's deterministic backstop) BEFORE running the
    // drop/weakening gates, so those gates see the cleaned, trustworthy post.
    const { cleaned, warnings: additionWarnings } = stripUnsupportedAdditions(
      pre,
      modelPost,
      [rawText, pre],
      SUMMARY_OPTIONAL_FIELDS.filter(f => f !== 'renderedText')
    );

    // Ground the synthesized paragraph itself, not just the re-derived
    // breakdown fields (2026-07-28 fix) -- if unsupported, drop it so the
    // renderer falls back to the (now grounding-checked) field list.
    const groundedResult = groundRenderedText(
      cleaned.renderedText,
      [cleaned.riskOrIssue, cleaned.centralRequirement, cleaned.centralProhibition, cleaned.revocation, cleaned.effectiveTiming, cleaned.exceptionNote],
      rawText
    );
    const post: NormalizedSummaryResult = { ...cleaned, renderedText: groundedResult.text };
    if (groundedResult.warning) additionWarnings.push(groundedResult.warning);

    const { blocking, warnings: gateWarnings } = runSummaryGates([rawText, pre], pre, post);
    if (blocking.length > 0) {
      return res.status(422).json({ error: `Rewrite failed safety validation: ${blocking.map(v => v.message).join(' ')}`, violations: blocking });
    }

    const steFindings = runSteChecks(post.renderedText, 'descriptive');
    const steWarnings = steFindings.map(f => ({ gate: `ste:${f.rule}`, message: f.message }));

    res.json({ result: post, warnings: [...additionWarnings, ...gateWarnings, ...steWarnings] });
  } catch (error: any) {
    sendPipelineError(res, error, 'Technical Alert', req);
  }
});

// --- Cross-Section Review (AI-assisted deep check) --------------------------

const SECTION_IDS = new Set(['summary', 'reasons', 'immediateAction', 'followUpAction']);

technicalAlertRoutesV2.post('/cross-section-review/deep-check', async (req, res) => {
  try {
    const { documentType, sections } = req.body;
    if (documentType !== 'Technical Alert') return res.status(400).json({ error: 'Invalid document type' });
    if (!sections || typeof sections !== 'object') return res.status(400).json({ error: 'sections is required.' });

    const prompt = `Accepted content to review for consistency:\n${JSON.stringify(sections)}\n\nReturn JSON matching the schema described in the system instructions.`;
    const raw = await callGeminiForSection(prompt, CROSS_SECTION_DEEP_CHECK_PROMPT);
    const parsed = JSON.parse(raw);
    const findings = Array.isArray(parsed?.findings)
      ? parsed.findings
          .filter((f: any) => typeof f?.message === 'string' && f.message.trim())
          .map((f: any) => ({
            message: f.message,
            relatedSections: Array.isArray(f.relatedSections) ? f.relatedSections.filter((s: any) => SECTION_IDS.has(s)) : [],
          }))
      : [];
    res.json({ findings });
  } catch (error: any) {
    sendPipelineError(res, error, 'Technical Alert', req);
  }
});

// --- Canonical export (Phase 8) ------------------------------------------
// (Review is built client-side via buildTechnicalAlertSnapshot; the export
// route rebuilds the same snapshot server-side -- no separate /snapshot route.)

technicalAlertRoutesV2.post('/export-docx', async (req, res) => {
  try {
    const { documentType, administrativeMetadata, controlInformation, supportingContent, sections } = req.body;
    if (documentType !== 'Technical Alert') return res.status(400).json({ error: 'Invalid document type' });

    // Server rebuilds the snapshot itself from the submitted accepted-only
    // section state -- it never trusts a client-constructed snapshot object,
    // closing the gap where a buggy or tampered client could request export
    // of content it doesn't actually hold as accepted.
    const snapshot = buildTechnicalAlertSnapshot({ administrativeMetadata, controlInformation, supportingContent, sections });
    if (!isSnapshotExportable(snapshot)) {
      return res.status(422).json({
        error: `Document is not ready for export: ${snapshot.readiness.blockingIssues.join(' ')}`,
        blockingIssues: snapshot.readiness.blockingIssues,
      });
    }

    const buffer = await generateTechnicalAlertDocxV2(snapshot);
    const safeTitle = (snapshot.administrativeMetadata.title || 'TechnicalAlert').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_') || 'TechnicalAlert';
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error: any) {
    sendPipelineError(res, error, 'Technical Alert', req);
  }
});
