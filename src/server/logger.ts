// Minimal structured, body-free server logger. Emits single-line JSON so logs
// are greppable in Cloud Run / AI Studio without an observability stack. Only
// operation metadata is ever logged -- never prompts, user documents, secrets,
// or client IPs. Verbosity is gated by LOG_LEVEL (debug|info|warn|error;
// default info).

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const envLevel = (process.env.LOG_LEVEL || "info") as Level;
const THRESHOLD = ORDER[envLevel] ?? ORDER.info;

export function logEvent(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  if (ORDER[level] < THRESHOLD) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
