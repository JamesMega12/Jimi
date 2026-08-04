---
name: run-techcom-workspace
description: Build, run, and drive TechCom Document Workspace (FCO Draft Assistant + TechCom Announcement App) — a Vite/React + Express/tsx app on port 3000 driven by Gemini. Use when asked to start the app, run it locally, take a screenshot of the FCO or TechCom workflow, or click-through-verify a UI change in either workflow.
---

TechCom Document Workspace is a single Express server (`server.ts`, run via `tsx`) that hosts Vite in middleware mode and serves one React SPA with two workflows: **FCO Draft Assistant** and **TechCom Announcement App**. There is no separate frontend/backend process — one `npm run dev` starts everything on `http://localhost:3000`. Drive it via `.claude/skills/run-techcom-workspace/driver.mjs`, a small Playwright-backed REPL (this project has no `chromium-cli` binary available, so this driver fills that role).

All paths below are relative to the repo root (`<unit>/`).

## Prerequisites

No OS packages beyond Node.js were needed — this was run and verified on Windows (Node v24.18.0, npm 11.16.0), no Docker/Linux container required. No `engines` constraint in `package.json`; any reasonably recent Node 20+ should work.

## Setup

```bash
npm install                                   # app dependencies (repo root)
cp .env.example .env                          # if .env doesn't already exist
# then set a real key in .env:
#   GEMINI_API_KEY="<your key>"
```

The app degrades gracefully without a working key (a local heuristic fallback kicks in on Gemini failures — see `src/server/fallbackEngine.ts`), but AI-dependent flows (Summary/Procedure rewrite, Title suggestions, readiness) need a valid `GEMINI_API_KEY` to actually exercise the AI path rather than the fallback.

Driver dependencies (separate from the app, isolated in this skill directory so nothing touches the app's own `package.json`/`node_modules`):

```bash
cd .claude/skills/run-techcom-workspace
npm install                                   # installs playwright into this skill dir only
npx playwright install chromium               # downloads the browser binary (~115MB, one-time)
cd ../../..                                   # back to repo root
```

## Build

No separate build step needed to run locally — `npm run dev` runs the TypeScript server directly via `tsx`. (A production build exists — `npm run build` / `npm start` — but was not needed or exercised for local driving/screenshots.)

## Run (agent path)

1. Start the dev server in the background and wait for it to actually serve:

```bash
npm run dev &
echo $! > /tmp/techcom-dev.pid
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
```

Confirmed startup log (from `tsx server.ts`):
```
◇ injected env (1) from .env
Server running on port 3000
```

2. Pipe commands to the driver. Screenshots land in `.claude/skills/run-techcom-workspace/screenshots/`.

```bash
cd .claude/skills/run-techcom-workspace
node driver.mjs <<'EOF'
nav http://localhost:3000
wait-for text=Select a Workflow
screenshot 01-landing
click text=FCO Draft Assistant
wait-for text=Start Draft
click role=button:Load FCO Sample
wait-for role=button:Suggest Title
screenshot 02-sample-loaded
click role=button:Suggest Title
wait-for text=Suggested Titles
screenshot 03-title-suggestions
console
quit
EOF
cd ../../..
```

Verified output of exactly this script, this session:
```
[driver] navigated to http://localhost:3000
[driver] found: text=Select a Workflow
[driver] screenshot -> .../screenshots/01-landing.png
[driver] clicked: text=FCO Draft Assistant
[driver] found: text=Start Draft
[driver] clicked: role=button:Load FCO Sample
[driver] found: role=button:Suggest Title
[driver] screenshot -> .../screenshots/02-sample-loaded.png
[driver] clicked: role=button:Suggest Title
[driver] found: text=Suggested Titles
[driver] screenshot -> .../screenshots/03-title-suggestions.png
[driver] console errors (0):
[driver] dialogs seen (0): []
```

Stop the server when done — **on Windows/Git Bash, `kill $(cat /tmp/techcom-dev.pid)` does NOT work** (verified: the backgrounded `$!` is the `npm` wrapper PID, not the actual `tsx`/node process holding the port, so `kill` on it is a silent no-op and the server keeps running). Find and kill the real listener instead:

```bash
netstat -ano | grep ":3000" | grep LISTENING     # last column is the PID
taskkill //PID <that-pid> //F
```

Otherwise the next `npm run dev` hits `EADDRINUSE` on port 3000. (On Linux/macOS, `pkill -f "tsx server.ts"` should work directly — not verified in this session, which ran on Windows.)

### Driver commands

| command | what it does |
|---|---|
| `nav <url>` | navigate |
| `wait-for <target> [timeoutMs]` | wait for an element (default 20000ms timeout) |
| `click <target>` | click an element |
| `check <target>` | check a radio/checkbox (`.check()`) |
| `fill <target> <text...>` | fill a text input |
| `press <key>` | keyboard press (e.g. `Enter`) on the focused element |
| `screenshot [name]` | full-page screenshot → `screenshots/<name>.png` |
| `sleep <ms>` | pause |
| `console` | print captured console **errors** + any JS `alert`/`confirm` dialogs seen so far |
| `quit` | close the browser and exit |

**Target syntax** (used by `wait-for`/`click`/`check`/`fill`): `text=<substring>` (partial text match), `role=<role>:<name>` (accessible role + name regex, case-insensitive — e.g. `role=button:Suggest Title`), `css=<selector>`, or a bare string is treated as a raw CSS selector.

## Run (human path)

```bash
npm run dev   # → serves http://localhost:3000. Ctrl-C to stop.
```

Open `http://localhost:3000` in a browser; you land on a "Select a Workflow" screen — pick **FCO Draft Assistant** or **TechCom Announcement App**.

## Test

No automated test runner is wired into `package.json` (no `test` script). The repo has many standalone root-level `test-*.ts`/`test_*.ts` scripts (e.g. `test-fco-split-routes.ts`, `run_tests.ts`) that are run directly with `tsx <file>.ts` against a running dev server — not exercised as part of this skill; see those files individually if a task needs them.

---

## Gotchas

- **The app is not the FCO/TechCom workflow directly.** Navigating to `http://localhost:3000` lands on a "Select a Workflow" chooser page first (`TechCom Document Workspace` header, two cards). You must `click text=FCO Draft Assistant` (or `TechCom Announcement App`) before any workflow-specific selector will exist. Waiting for `text=Start Draft` (FCO) or the TechCom equivalent right after `nav` will just time out.
- **No `chromium-cli` binary exists in this environment/project** — `driver.mjs` + a scoped Playwright install is the substitute. Keep Playwright installed *inside this skill directory* (`.claude/skills/run-techcom-workspace/node_modules`), not the repo root, so driving the app never touches the app's own dependency tree.
- **Suggest/Generate Title button (`Step1Context.tsx`) previously threw silently.** Historically `onClick={handleSuggestTitle}` passed the raw React click event into a function expecting a string, which crashed `JSON.stringify` on the circular event object and surfaced only as a swallowed `alert()` — invisible to anything not watching dialogs. The `console` driver command's dialog tracking exists specifically to catch this class of bug: if a click silently pops a JS `alert`, `console` will show it in the `dialogs seen` list even though nothing crashes the page.
- **`Load FCO Sample` can trigger a `window.confirm`** if the draft already has content (`Step1Context.tsx` `handleLoadSampleClick`). On a fresh page load this doesn't fire (no existing content), which is what the verified script above relies on — the driver auto-accepts any dialog that does appear, so this is safe either way, but don't be surprised if `console` reports a dialog on a second `Load FCO Sample` click in the same session.

## Troubleshooting

- **`Error: browserType.launch: Executable doesn't exist ...`**: Playwright's browser binary wasn't downloaded for this Playwright version. Run `npx playwright install chromium` from inside `.claude/skills/run-techcom-workspace/`.
- **Driver hangs on `nav`**: dev server isn't up yet. Confirm with `curl -sf http://localhost:3000` before running the driver; `npm run dev` prints `Server running on port 3000` when ready.
- **`wait-for` times out immediately after `nav`**: you're waiting for a workflow-specific element before selecting the workflow — see the first Gotcha above.
- **`kill $(cat pidfile)` doesn't stop the dev server / next `npm run dev` fails with `EADDRINUSE`**: on Windows/Git Bash, backgrounding `npm run dev &` captures the `npm` wrapper's PID in `$!`, not the actual `tsx`/node process that binds port 3000 — killing the wrapper PID is a silent no-op. Find the real PID and kill that instead: `netstat -ano | grep ":3000" | grep LISTENING` then `taskkill //PID <pid> //F`.
