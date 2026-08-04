import type { Request, Response } from "express";
import { logEvent } from "./logger";

// Shared reliability helpers for the AI-backed routes (Technical Alert v2 +
// Announcement). Audit Phase A: the section Gemini calls had no wall-clock
// bound, so a hung provider request could hang the HTTP handler indefinitely
// (the FCO path already had a 120s race; the priority workflows did not).

// 100s budget (product decision) -- comfortably below the typical Cloud
// Run / AI Studio request timeout, so we return a clean 504 before the
// platform kills the request.
export const AI_TIMEOUT_MS = 100_000;

export class ProviderTimeoutError extends Error {
  readonly code = "provider_timeout";
  constructor(ms: number = AI_TIMEOUT_MS) {
    super(`AI request timed out after ${Math.round(ms / 1000)}s.`);
    this.name = "ProviderTimeoutError";
  }
}

/**
 * Races `promise` against a timeout. If the timeout wins, `onTimeout` fires
 * (used to abort the underlying provider request) and the returned promise
 * rejects with a ProviderTimeoutError. Framework-free and pure so it can be
 * unit-tested with real timers. A `.catch` is attached to the racing promise
 * so its eventual (post-timeout) rejection can never surface as an
 * unhandledRejection once it has lost the race.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number = AI_TIMEOUT_MS, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        /* ignore abort errors */
      }
      reject(new ProviderTimeoutError(ms));
    }, ms);
  });
  promise.catch(() => {
    /* handled by the race; swallow a late rejection to avoid unhandledRejection */
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * Consistent failure responder for the AI-backed routes. Distinguishes a
 * provider timeout (504) from other pipeline failures (502), logs a single
 * structured, body-free line for diagnosis (no prompts, no user content, no
 * key), and returns a JSON error. Replaces the previous bare
 * `res.status(502).json({error})` catches which (a) never logged and (b)
 * mislabeled a timeout/parse/logic error as a generic provider 502.
 */
export function sendPipelineError(res: Response, error: any, workflow: string, req?: Request): void {
  const isTimeout = error instanceof ProviderTimeoutError || error?.name === "ProviderTimeoutError";
  const status = isTimeout ? 504 : 502;
  const requestId = (req as any)?.requestId as string | undefined;
  logEvent("error", "request_failed", {
    workflow,
    path: req?.path,
    requestId,
    status,
    code: isTimeout ? "provider_timeout" : "provider_error",
    message: typeof error?.message === "string" ? error.message : "Unknown error",
  });
  const body: { error: string; code?: string; requestId?: string } = { error: error?.message || "Request failed" };
  if (isTimeout) body.code = "provider_timeout";
  if (requestId) body.requestId = requestId;
  res.status(status).json(body);
}
