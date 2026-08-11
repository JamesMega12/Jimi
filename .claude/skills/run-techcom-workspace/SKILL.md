---
name: run-techcom-workspace
description: Build, run, and drive the Jimi app (formerly TechCom Document Workspace) — a Vite/React + Express/tsx SPA on port 3000, driven by Gemini, with three workflows: FCO Agent, Technical Alert, and Announcement. Use when asked to start or run the app locally, take a screenshot, or click-through-verify a UI change in the FCO, Technical Alert, or Announcement workflow.
---

The app is branded **Jimi** in the UI (formerly "TechCom Document Workspace"). It's a single Express server (`server.ts`, run via `tsx`) that hosts Vite in middleware mode and serves one React SPA with **three** workflows, shown as cards on a "Select a Workflow" landing page and in the top nav: **FCO Agent**, **Technical Alert**, and **Announcement**. There is no separate frontend/backend process — one `npm run dev` starts everything on `http://localhost:3000`. Drive it via `.claude/skills/run-techcom-workspace/driver.mjs`, a small Playwright-backed REPL (this project has no `chromium-cli` binary available, so this driver fills that role).

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

**Smoke (no AI — fast, deterministic).** Reach the Technical Alert workflow and screenshot it:

```bash
cd .claude/skills/run-techcom-workspace
node driver.mjs <<'EOF'
nav http://localhost:3000
wait-for text=Select a Workflow
screenshot 01-landing
click text=Technical Alert
wait-for role=button:Load Technical Alert Sample
screenshot 02-technical-alert
console
quit
EOF
cd ../../..
```

Verified output of exactly this script, this session (Windows; dev server already up):
```
[driver] navigated to http://localhost:3000
[driver] found: text=Select a Workflow
[driver] screenshot -> .../screenshots/01-landing.png
[driver] clicked: text=Technical Alert
[driver] found: role=button:Load Technical Alert Sample
[driver] screenshot -> .../screenshots/02-technical-alert.png
[driver] console errors (0):
[driver] dialogs seen (0): []
```

**Driving an AI step (Analyze / Rewrite / Suggest Title).** These call Gemini and are slow (~up to 100s, can 502/time out), so give the AI `wait-for` a high timeout and run the whole driver in the **background**, reading its output file — don't block a foreground call that may exceed a 2-minute cap. This exact flow (load sample → Analyze the Summary → accept it with **Mark Ready** (no AI) → change the deadline to flip it stale) produced this session's staleness screenshots:

```bash
cd .claude/skills/run-techcom-workspace
node driver.mjs <<'EOF'
nav http://localhost:3000
wait-for text=Select a Workflow
click text=Technical Alert
wait-for role=button:Load Technical Alert Sample
click role=button:Load Technical Alert Sample
wait-for role=button:Summary
click role=button:Summary
wait-for role=button:Analyze
click role=button:Analyze
wait-for text=Summary Components 150000
click role=button:Mark Ready
wait-for text=Accepted 30000
click role=button:Control Information
wait-for text=Deadline
fill css=input[type=date] 2027-03-15
wait-for text=needs another look 30000
screenshot 03-stale-control-change
console
quit
EOF
cd ../../..
```

Verified tail of this run, this session:
```
[driver] found: text=Summary Components
[driver] clicked: role=button:Mark Ready
[driver] found: text=Accepted
[driver] clicked: role=button:Control Information
[driver] found: text=Deadline
[driver] filled: css=input[type=date] = "2027-03-15"
[driver] found: text=needs another look
[driver] screenshot -> .../screenshots/03-stale-control-change.png
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

Open `http://localhost:3000` in a browser; you land on a "Select a Workflow" screen (branded **Jimi**) — pick **FCO Agent**, **Technical Alert**, or **Announcement**.

## Test

- **Type-check:** `npm run lint` (runs `tsc --noEmit`). Fast; run it after each logical edit.
- **Unit tests:** `npm test` (runs `test-runner.mjs`, which globs the pure `test-announcement-*.ts`, `test-technical-alert-v2-*.ts`, `test-fco-unit-*.ts`, and `test-ai-timeout.ts` scripts and runs each via `tsx`). No dev server needed for these. Any single one also runs standalone: `npx tsx <file>.ts`.
- **Known-failing baseline (this session):** `test-technical-alert-v2-cutover-migration.ts` fails on a clean checkout too (a localStorage-key assertion) — **unrelated to your change**; the suite is otherwise green.
- Other root-level `test-*.ts` (e.g. `test-fco-split-routes.ts`) run against a live dev server via `tsx <file>.ts` and are not part of `npm test`.

---

## Gotchas

- **The app does not open a workflow directly.** Navigating to `http://localhost:3000` lands on a "Select a Workflow" chooser first (branded **Jimi**, **three** cards: **FCO Agent / Technical Alert / Announcement**). You must `click text=<workflow>` (e.g. `click text=Technical Alert`) before any workflow-specific selector exists; waiting for a workflow-internal element right after `nav` just times out. **The names changed with the "Jimi" rename** — the cards are now "FCO Agent" (not "FCO Draft Assistant") and "Announcement" (not "TechCom Announcement App"), so older selectors like `text=FCO Draft Assistant` no longer match.
- **Use `role=button:<name>`, not `text=`, for section headers/buttons.** `text=Summary` matches a *hidden* progress label ("Summary & Title") and the driver hangs waiting for it to become visible; `role=button:Summary` hits the real accordion header. (Verified this session.)
- **Parentheses break `role=…:<name>` (the name is a regex).** Use `role=button:Mark Ready`, not `role=button:Mark Ready (No AI)`.
- **AI steps (Analyze / Rewrite / Suggest Title / Deep Check) are slow** — a Gemini round trip is ~up to 100s and can 502/time out. Give the AI `wait-for` a high timeout (e.g. `wait-for text=Summary Components 150000`) and run the whole driver in the **background**, reading its output file, rather than blocking a foreground call that may exceed a 2-minute cap.
- **Collapsed accordion sections don't render their children** (`{isOpen && …}` in `common/Accordion.tsx`). A button inside a collapsed section isn't in the DOM — expand the section first (this also keeps `role=button:Analyze` unambiguous when only one section is open).
- **Fast, no-AI state setup:** to get a Technical Alert section into an accepted state without a Gemini call, use **Mark Ready** (manual accept) or, for Follow-Up Action, **Accept as Not Applicable** — handy for quickly reaching downstream UI like staleness/readiness cards.
- **No `chromium-cli` binary exists in this environment/project** — `driver.mjs` + a scoped Playwright install is the substitute. Keep Playwright installed *inside this skill directory* (`.claude/skills/run-techcom-workspace/node_modules`), not the repo root, so driving the app never touches the app's own dependency tree.
- **Suggest/Generate Title button (`Step1Context.tsx`) previously threw silently.** Historically `onClick={handleSuggestTitle}` passed the raw React click event into a function expecting a string, which crashed `JSON.stringify` on the circular event object and surfaced only as a swallowed `alert()` — invisible to anything not watching dialogs. The `console` driver command's dialog tracking exists specifically to catch this class of bug: if a click silently pops a JS `alert`, `console` will show it in the `dialogs seen` list even though nothing crashes the page.
- **`Load FCO Sample` can trigger a `window.confirm`** if the draft already has content (`Step1Context.tsx` `handleLoadSampleClick`). On a fresh page load this doesn't fire (no existing content), which is what the verified script above relies on — the driver auto-accepts any dialog that does appear, so this is safe either way, but don't be surprised if `console` reports a dialog on a second `Load FCO Sample` click in the same session.

## Troubleshooting

- **`Error: browserType.launch: Executable doesn't exist ...`**: Playwright's browser binary wasn't downloaded for this Playwright version. Run `npx playwright install chromium` from inside `.claude/skills/run-techcom-workspace/`.
- **Driver hangs on `nav`**: dev server isn't up yet. Confirm with `curl -sf http://localhost:3000` before running the driver; `npm run dev` prints `Server running on port 3000` when ready.
- **`wait-for` times out immediately after `nav`**: you're waiting for a workflow-specific element before selecting the workflow — see the first Gotcha above.
- **`kill $(cat pidfile)` doesn't stop the dev server / next `npm run dev` fails with `EADDRINUSE`**: on Windows/Git Bash, backgrounding `npm run dev &` captures the `npm` wrapper's PID in `$!`, not the actual `tsx`/node process that binds port 3000 — killing the wrapper PID is a silent no-op. Find the real PID and kill that instead: `netstat -ano | grep ":3000" | grep LISTENING` then `taskkill //PID <pid> //F`.
