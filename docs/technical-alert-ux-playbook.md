# Technical Alert UX & flow — what we built, and how to bring Announcement to parity

This is a **handoff / playbook**. It records the full set of Technical Alert (v2) UX and user-flow
improvements and gives a fresh session the concrete files, patterns, skills, and commands to apply
the same treatment to the **Announcement** module.

> Scope note / attribution:
> - **Part A** (drafting UX + flow) landed in a **prior** session, merged in commit `58a2f06`
>   ("streamline drafting UX and fix rewrite safety-gate bug", PR #4).
> - **Part B** (staleness "explain why" + neighbor-change fix) landed in **PR #5**, branch
>   `feat/technical-alert-staleness-ux`.
> Together they are "what we did to Technical Alert." The Announcement module should mirror **both**.
>
> Design-system + philosophy reference (applies to all of this): `USER_FLOW_UX_REFERENCE.md`
> ("AI proposes, human disposes"; emerald=accepted, amber=AI/warning, rose=critical; progressive
> disclosure). Original UI phase plans: `PHASE_UI1_PLAN.md`, `PHASE_UI1A1_PLAN.md`.

All paths below are under `src/components/technical-alert/v2/` unless noted.

---

## Part A — Drafting UX & user flow (prior work, merged in `58a2f06` / PR #4)

The core user flow: each section (Summary / Reasons / Immediate Action / Follow-Up Action) is drafted
independently, AI assists but never auto-commits, and the user explicitly **Accepts** to make content
canonical. Specific improvements:

1. **Default-collapsed accordion.** Sections start collapsed so the drafting page reads as a checklist,
   not a wall of forms. `common/Accordion.tsx` (`useDisclosure` / `AccordionSection`, children only
   render when open) + `TechnicalAlertWorkflowV2.tsx`.
2. **Analyze → Rewrite reveals the panel (FCO pattern).** A section's structured components panel stays
   hidden until Analyze/Rewrite has run or real content already exists (`showComponents` gate in each
   workspace). An explicit empty-state entry (`SectionHelpers.EmptySectionStart`: "Ask AI to help" /
   "Fill in manually") replaces the old dead-end blank textarea.
3. **Accept → read-only card with "Edit / Redraft".** On accept, the editing UI is hidden and a
   read-only "Accepted (AI-assisted | manually authored)" card is shown; "Edit / Redraft" re-enters
   edit mode without touching the accepted value until a new accept completes
   (`workspace.accepted && !editMode` blocks in each `*Workspace.tsx`; `editAcceptedDirectly` /
   `manualAccept` / `acceptSuggestion` in `sectionWorkspace.ts`).
4. **Drafting-stage readiness strip.** The deterministic readiness result ("Readiness: Blocked (N
   items)") is surfaced at the top of the Drafting stage, not deferred to Final Review, so blockers
   are visible while drafting (`readiness.ts` + the readiness strip in `TechnicalAlertWorkflowV2.tsx`).
5. **Amber-color cleanup / semantic color discipline.** AI actions use amber + `Sparkles`; accepted
   state uses emerald; nav/secondary uses slate; critical uses rose. This separates "AI action" vs
   "navigation" vs "export" visually (matches `USER_FLOW_UX_REFERENCE.md` feedback colors).
6. **Content-authoring cleanups.** Removed the "Optional rewrite instructions" input; the section's
   green check is gated on *real* required content (`hasRequiredContent`), not mere presence;
   sections pre-seed a default entry so there's something to fill immediately
   (`technicalAlertPresetV2.ts`, `EMPTY` defaults in workspaces).
7. **Rewrite-before-Analyze safety-gate fix.** "Rewrite with AI" used before Analyze no longer trips
   the safety gates.
8. **Flow correctness fixes:** cross-section (neighbor) staleness detection (RC7); and a
   setState-during-render fix — async handlers read a `wsRef` and call side-effecting `setState`
   outside the `onChange` updater, avoiding React's "update a component while rendering another"
   warning (RC9).

---

## Part B — Staleness "explain *why*" + neighbor-change fix (PR #5)

Before: an accepted section that went stale showed a generic "accepted but stale -- re-accept before
export" with no cause and no action.

After: the accepted card and readiness name the **specific cause**, say **what to do**, and reassure
the user it's a normal re-confirm (not an error, no content change required). Causes:
- `self-edit` (`freshness==='stale'`) — **blocks** export.
- `control-change` — a Control-Info field it prints changed; provenance retained (which field) →
  "the deadline changed". **Blocks** export.
- `neighbor-change` — a section the Summary was AI-synthesized from changed; provenance retained
  (which section). **Warning only** — never gates export.

**Pattern (reuse this exactly for Announcement):**

| Layer | File | Responsibility |
|---|---|---|
| Domain (framework-free) | `sectionWorkspace.ts` | `type StaleReasonCode`, `staleReasons(ws)`, `isStale = staleReasons(ws).length>0`. **Codes, never prose.** |
| Copy (plain TS, no JSX) | `staleReasonCopy.ts` | `describeStaleReasons(ws)` builds concrete clauses naming the exact field/section; label maps; `StalenessDescribable`. Importable by React **and** readiness/export. |
| Presentation | `SectionHelpers.tsx` | `StaleExplanation({ ws })` — one shared component: reason(s) + "What to do" + reassurance. Used by all workspace cards. |
| Readiness | `readiness.ts` | Reuses `staleReasons` + `describeStaleReasons`; reason-specific messages; **block vs. warn** split. |
| Provenance state | `types.ts` (`staleControlFields`, `staleNeighborSections`), `controlInfoDependency.ts` (`computeControlChangeImpact`), `summaryGrounding.ts` (`computeChangedGroundedNeighbors`), wired in `TechnicalAlertWorkflowV2.tsx`, cleared on re-accept. |

**Neighbor-change fix:** `computeChangedGroundedNeighbors` only counts neighbors that were *actually*
grounded (non-null snapshot) and then changed — stopping the false fire when a neighbor goes
unaccepted→accepted after the Summary was drafted. And neighbor-change is a **warning**, so it no
longer hard-blocks export while Cross-Section Review (`crossSectionReview.ts`) reports "no issues".

**Tests:** `test-technical-alert-v2-stale-reasons.ts`, `test-technical-alert-v2-summary-grounding.ts`,
updated `test-technical-alert-v2-readiness.ts`.

---

## Part C — Bring Announcement to parity

### Current state (the "before")
The Announcement module (`src/components/announcement/`) has the same section-lifecycle shape but is
earlier in the journey. Notably `announcementReadiness.ts` tracks **only** `freshness === "stale"`
(self-edit) with a **generic** message ("… was edited after acceptance and is stale -- re-accept
before export.", ~lines 43-69). Verify how much of Part A it already has vs. needs.

### File map (Technical Alert → Announcement equivalent)

| Technical Alert | Announcement equivalent |
|---|---|
| `technical-alert/v2/sectionWorkspace.ts` | `announcement/lib/sectionLifecycle.ts` |
| `technical-alert/v2/types.ts` | `announcement/announcementTypes.ts` |
| `technical-alert/v2/readiness.ts` | `announcement/announcementReadiness.ts` |
| `technical-alert/v2/SectionHelpers.tsx` | `announcement/AnnouncementHelpers.tsx` |
| `technical-alert/v2/TechnicalAlertWorkflowV2.tsx` | `announcement/AnnouncementWorkflow.tsx` |
| Summary/Reasons/ImmediateAction/FollowUp `*Workspace.tsx` | `announcement/{Summary,Reason,Action}Workspace.tsx` |
| `crossSectionReview.ts` | (check whether an equivalent exists) |
| `snapshot.ts` / `FinalReviewPanel.tsx` | `announcement/announcementSnapshot.ts` / `AnnouncementReview.tsx` |
| server routes / grounding | `server/routes/announcementRoutes.ts`, `server/announcementGrounding.ts` |
| `test-technical-alert-v2-*.ts` | `test-announcement-*.ts` |

### Steps (mirror Parts A + B)
1. **Explore first.** Read `sectionLifecycle.ts`, `announcementReadiness.ts`, `announcementTypes.ts`,
   the three workspaces, `AnnouncementHelpers.tsx`, `AnnouncementWorkflow.tsx`. **Enumerate what Part A
   behavior already exists** (accordion default-collapsed, Analyze→reveal, accept→read-only card,
   drafting readiness strip, color discipline, checkmark gating) and what's missing — don't assume.
2. **Flow/UX parity (Part A):** bring any missing item to parity — same accordion default-collapsed,
   same empty-state entry, same accept→read-only "Edit / Redraft" card, same drafting-stage readiness
   strip, same semantic colors, same content-authoring gating.
3. **Staleness parity (Part B):** add domain reason **codes** to `sectionLifecycle.ts`; a plain-TS
   `announcementStaleReasonCopy.ts` `describeStaleReasons(ws)` (retain provenance where a cause needs
   it); a shared `StaleExplanation`-equivalent in `AnnouncementHelpers.tsx` wired into the three
   accepted cards; reason-specific `announcementReadiness.ts` messages with a **block-vs-warn** split.
   If a neighbor/grounding staleness exists, apply the `computeChangedGroundedNeighbors` lesson
   (only fire for genuinely-grounded, non-null neighbors that changed).
4. **Tests:** add `test-announcement-stale-reasons.ts` (+ grounding test if relevant); update existing
   `test-announcement-*.ts` for any wording/severity changes. Assert on **codes**, not English.

---

## Part D — Skills, commands, and gotchas (same for both modules)

### Build / lint / test
- **Lint after every logical edit:** `npm run lint` (`tsc --noEmit`). Resolve, don't bypass.
- **Unit tests:** `npm test` (`test-runner.mjs`; glob includes `test-announcement-.*` and
  `test-technical-alert-v2-.*`). Each `test-*.ts` also runs standalone: `npx tsx <file>.ts`.
- **Known-failing baseline:** `test-technical-alert-v2-cutover-migration.ts` fails on a clean checkout
  too (a localStorage-key assertion) — **unrelated**, don't chase it.

### Live-driving the app (skill: `run-techcom-workspace`)
- Skill dir `.claude/skills/run-techcom-workspace/` (`SKILL.md` + Playwright `driver.mjs`).
- `npm run dev` → `http://localhost:3000` (Vite middleware; **HMR applies edits on the next page
  load** — usually no restart needed).
- Drive: pipe commands to `node driver.mjs` (`nav`, `wait-for <target> [ms]`, `click`, `check`,
  `fill`, `screenshot`, `console`, `quit`). Targets: `text=…`, `role=button:Name`, `css=…`.
  Screenshots → `.claude/skills/run-techcom-workspace/screenshots/`.
- **Reach a workflow:** top nav has **FCO Agent / Technical Alert / Announcement**. For Announcement:
  `click text=Announcement`.
- **Stop server (Windows):** `netstat -ano | grep ":3000" | grep LISTENING` then
  `taskkill //PID <pid> //F` (`kill $(cat pidfile)` is a no-op on Git Bash here).

### Driver gotchas learned
- Prefer `role=button:Name` over `text=` for headers/buttons (`text=Summary` can match a **hidden**
  progress label and hang).
- Regex-special names break: use `role=button:Mark Ready`, not `role=button:Mark Ready (No AI)`.
- **AI steps (Analyze/Rewrite) are slow** (~up to 100s, can time out) — run the driver in the
  **background** and read its output file; don't block a 2-min foreground call.
- Collapsed accordions **don't render children**, so a collapsed section's buttons don't exist —
  expand first (also removes selector ambiguity).
- Fastest state setup uses no-AI accepts (TA's "Mark Ready (No AI)" / Follow-Up "Accept as Not
  Applicable"); Announcement likely has equivalents.

### Repo hygiene
- **Never commit `src/server/data/kb_chunks.json` / `kb_documents.json`** — large pre-existing
  knowledge-ingest diffs, unrelated to UX work. Stage files explicitly, never `git add -A`.
- `.env*` is gitignored. `main` is the default branch; PRs target `main`.

---

## Reference PRs
- Part A: commit `58a2f06` (PR #4, merged).
- Part B: PR #5, branch `feat/technical-alert-staleness-ux`.
