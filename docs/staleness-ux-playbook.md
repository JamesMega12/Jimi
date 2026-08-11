# Staleness "explain *why*" UX — what we shipped on Technical Alert, and how to repeat it for Announcement

This doc is a **handoff / playbook**. It records the staleness-UX work done on the Technical Alert
module and gives a fresh session the concrete files, patterns, skills, and commands to apply the
same treatment to the **Announcement** module.

---

## Part 1 — What we shipped on Technical Alert

Two related changes to how an *accepted* section communicates that it may be out of date.

### 1a. Explain *why* a section is stale (not just *that* it is)

Before: an accepted section that went stale showed one generic heading and readiness showed one
generic blocker (`… is accepted but stale -- re-accept before export`) — no cause, no action.

After: the accepted card and the readiness blocker name the **specific cause**, tell the user
**what to do**, and reassure them it's a normal re-confirm (not an error, no content change
required). Three causes are tracked and differentiated:

- `self-edit` — you edited the accepted content (`freshness === 'stale'`). Blocks export.
- `control-change` — a Control-Info field it prints changed (deadline/timing/Action By). Blocks
  export. **Provenance retained**: which field(s) changed, so copy says "the deadline changed".
- `neighbor-change` — a section the Summary was AI-synthesized from changed. **Warning only**
  (see 1b). **Provenance retained**: which section(s) changed.

**Architecture (the reusable pattern):**

| Layer | File | Responsibility |
|---|---|---|
| Domain (framework-free) | `src/components/technical-alert/v2/sectionWorkspace.ts` | `type StaleReasonCode`, `staleReasons(ws): StaleReasonCode[]`, `isStale = staleReasons(ws).length>0`. Returns **codes, never prose**. |
| Copy (plain TS, no JSX) | `src/components/technical-alert/v2/staleReasonCopy.ts` | `describeStaleReasons(ws)` builds concrete clauses naming the exact field/section; label maps; `StalenessDescribable` structural type. Importable by both React and the readiness/export module. |
| Presentation | `src/components/technical-alert/v2/SectionHelpers.tsx` | `StaleExplanation({ ws })` — one shared component: reason(s) + "What to do" + reassurance footer. Used by all workspace cards. |
| Readiness | `src/components/technical-alert/v2/readiness.ts` | Reuses `staleReasons` + `describeStaleReasons`; reason-specific messages; block vs. warn split. |
| Provenance state | `types.ts` (`staleControlFields`, `staleNeighborSections`), `controlInfoDependency.ts` (`computeControlChangeImpact`), `TechnicalAlertWorkflowV2.tsx` (wiring), cleared on re-accept in `sectionWorkspace.ts` accept fns. |

**Key principle:** domain returns *codes*; a single plain-TS copy map owns *wording*; one component
owns *layout*. This keeps UI copy out of the framework-free domain module and gives readiness and the
cards a single wording source.

### 1b. Fix neighbor-change: false firing + wrong severity

- **Bug fixed** (`src/components/technical-alert/v2/summaryGrounding.ts` →
  `computeChangedGroundedNeighbors`): neighbor-change used to fire when a neighbor went from
  *unaccepted → accepted* **after** the Summary was drafted (natural Summary-first workflow) — even
  though the Summary was never written from it. Now only neighbors that were **actually grounded**
  (non-null snapshot) and then changed count.
- **Severity fixed** (`readiness.ts`): a legitimate neighbor-change is a **non-blocking warning**
  (it's a re-confirm nudge, and cross-section review — `crossSectionReview.ts` — already owns actual
  contradiction checks). `self-edit` and `control-change` still **block** export. This removed a
  confusing "Readiness: Blocked" that contradicted Cross-Section Review's "no consistency issues".

### Tests added/updated
- `test-technical-alert-v2-stale-reasons.ts` — codes, `isStale` parity, set/clear + provenance, wording.
- `test-technical-alert-v2-summary-grounding.ts` — the null→value fix + all grounding transitions.
- `test-technical-alert-v2-readiness.ts` — neighbor→warning, blocking-cause masking, per-cause messages.

---

## Part 2 — Apply the same to the Announcement module

### Current state (the "before")
The Announcement module has a parallel structure but is where Technical Alert started:
`src/components/announcement/announcementReadiness.ts` tracks **only** `freshness === "stale"`
(self-edit) and emits a **generic** message, e.g.
`"Summary was edited after acceptance and is stale -- re-accept before export."` (lines ~43-69).
There is no reason differentiation and no shared explanation component.

### File map (Technical Alert → Announcement equivalent)

| Technical Alert | Announcement equivalent |
|---|---|
| `technical-alert/v2/sectionWorkspace.ts` | `announcement/lib/sectionLifecycle.ts` |
| `technical-alert/v2/types.ts` | `announcement/announcementTypes.ts` |
| `technical-alert/v2/readiness.ts` | `announcement/announcementReadiness.ts` |
| `technical-alert/v2/SectionHelpers.tsx` | `announcement/AnnouncementHelpers.tsx` |
| Summary/Reasons/ImmediateAction/FollowUp `*Workspace.tsx` | `announcement/{Summary,Reason,Action}Workspace.tsx` |
| `crossSectionReview.ts` | (check if an Announcement equivalent exists) |
| server `technicalAlertRoutesV2.ts` / grounding | `server/announcementGrounding.ts`, `server/routes/announcementRoutes.ts` |
| `test-technical-alert-v2-*.ts` | `test-announcement-*.ts` |

### Suggested steps (mirror Part 1)
1. **Explore first.** Read `sectionLifecycle.ts`, `announcementReadiness.ts`, `announcementTypes.ts`,
   the three workspaces, and `AnnouncementHelpers.tsx`. Enumerate **every** stale cause actually
   tracked — do not assume it matches TA. (TA's control-change/neighbor-change may or may not have
   Announcement analogues; `announcementGrounding.ts` suggests grounding exists.)
2. **Domain codes** — add `AnnouncementStaleReasonCode` + `announcementStaleReasons(ws)` to
   `sectionLifecycle.ts`; redefine any `isStale` in terms of it. Codes, not prose.
3. **Copy map** — new plain-TS `announcementStaleReasonCopy.ts` with `describeStaleReasons(ws)`
   producing concrete, provenance-named clauses (retain provenance the way TA does if a cause needs it).
4. **Shared component** — add a `StaleExplanation`-equivalent to `AnnouncementHelpers.tsx`
   (reason + what-to-do + reassurance). Wire it into the three workspace accepted cards.
5. **Readiness** — make `announcementReadiness.ts` messages reason-specific; decide **block vs. warn**
   per cause (self-edit/field-print-change → block; soft "a source section changed" → warn, never
   gate export).
6. **If a neighbor/grounding staleness exists**, apply the `computeChangedGroundedNeighbors` lesson:
   only fire for neighbors that were genuinely grounded (non-null at draft time) and then changed.
7. **Tests** — add `test-announcement-stale-reasons.ts` (+ grounding test if relevant); update the
   existing `test-announcement-*.ts` if wording/severity changes. Keep the domain codes vs. copy
   split so tests assert on codes, not English.

---

## Part 3 — Skills, commands, and gotchas (same for both modules)

### Build / lint / test
- **Lint after every logical edit:** `npm run lint` (runs `tsc --noEmit`). Resolve, don't bypass.
- **Unit tests:** `npm test` (runner `test-runner.mjs`, glob includes `test-announcement-.*` and
  `test-technical-alert-v2-.*`). Each `test-*.ts` is a standalone `tsx` script (`npx tsx <file>.ts`).
- **Known-failing baseline:** `test-technical-alert-v2-cutover-migration.ts` fails on a clean
  checkout too (a localStorage-key assertion) — **unrelated**; don't chase it. Baseline is N-1/N.

### Live-driving the app (skill: `run-techcom-workspace`)
- Skill dir: `.claude/skills/run-techcom-workspace/` (has `SKILL.md` + Playwright `driver.mjs`).
- Start dev server: `npm run dev` → `http://localhost:3000` (Vite middleware; **HMR applies your
  edits on the next page load**, so you usually don't need to restart).
- Drive: pipe commands to `node driver.mjs` (commands: `nav`, `wait-for <target> [ms]`, `click`,
  `check`, `fill`, `screenshot`, `console`, `quit`). Targets: `text=…`, `role=button:Name`,
  `css=…`. Screenshots land in `.claude/skills/run-techcom-workspace/screenshots/`.
- **Reach a workflow:** `nav http://localhost:3000` → the top nav has **FCO Agent / Technical Alert /
  Announcement** buttons. For Announcement: `click text=Announcement`. (Older `SKILL.md` prose calls
  it "TechCom Announcement App".)
- **Stop the server (Windows):** `netstat -ano | grep ":3000" | grep LISTENING` then
  `taskkill //PID <pid> //F` — `kill $(cat pidfile)` is a no-op on Git Bash here.

### Driver gotchas learned
- Prefer `role=button:Name` for accordion headers / action buttons. Plain `text=Summary` can match a
  **hidden** progress label ("Summary & Title") and hang.
- Regex-special names: `role=button:Mark Ready (No AI)` breaks (parens = regex group) — use
  `role=button:Mark Ready`.
- **AI steps (Analyze / Rewrite) are slow** (up to ~100s, can time out). Run the driver in the
  **background** and watch the output file; don't block on a 2-min foreground call.
- Collapsed accordions **don't render their children**, so buttons inside a collapsed section don't
  exist — expand the section first, and this also avoids ambiguous selectors.
- A no-AI accept path is fastest for state setup (e.g. TA's "Mark Ready (No AI)" / Follow-Up
  "Accept as Not Applicable"); Announcement likely has equivalents.

### Repo hygiene
- **Never commit `src/server/data/kb_chunks.json` / `kb_documents.json`** — they carry large,
  pre-existing knowledge-ingest diffs unrelated to UX work. Stage files explicitly, not `git add -A`.
- `.env*` is gitignored (keep it that way).
- `main` is the default branch; PRs target `main`.

---

## Reference: the Technical Alert staleness PR
See the PR that introduced Part 1 + Part 2 (branch `feat/technical-alert-staleness-ux`) for the exact
diffs to mirror.
