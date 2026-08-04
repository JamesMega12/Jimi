# Technical Alert v2 — Bug & Logic Testing Report
**Date:** 2026-07-28

## Method (read this first)

**No browser-automation tool was available in this session**, so a literal click-through of the UI was not possible. Instead, this report combines two things:

1. **Live backend/API testing** — real HTTP requests against the running dev server's actual routes, including real Gemini round-trips, DOCX byte-level content inspection, and readiness/validation edge cases. Marked **[LIVE-TESTED]**.
2. **A full static code audit** (frontend + backend, every file in `src/components/technical-alert/v2/`, the persistence/migration/API-client libs, and every backend route/gate/normalizer/prompt file) looking for state bugs, logic errors, and frontend/backend contract mismatches. Marked **[CODE AUDIT]**. Items I re-verified myself by reading the exact lines are marked **[CODE AUDIT — CONFIRMED]**.

Nothing below was fixed — this is a findings-only pass per your request. A **manual browser click-through is still recommended** before considering the UI itself fully verified (checklist at the bottom) — this report cannot confirm actual rendering, CSS, click targets, or interaction feel.

**Update, 2026-07-28 (same day, follow-up pass):** all 7 confirmed findings (#1–#7) have been fixed, tested (`tsc`/build clean, full automated suite + new fixture tests for #3/#4/#5, live re-verification for #1/#4), and are on the dev server. Each is marked ✅ FIXED below with what changed. Finding #8 remains a deliberate, documented defer (see its own entry). See `plans/role-you-are-working-delightful-cupcake.md` for the full fix-design writeup.

---

## HIGH SEVERITY

### 1. ✅ FIXED — Reasons' synthesized `renderedText` paragraph is never shown in Final Review or the DOCX export [CODE AUDIT — CONFIRMED]
**Fix:** `FinalReviewPanel.tsx` and `technicalAlertDocxExportServiceV2.ts` now branch on `narrative.renderedText` first, same as Summary; fallback now also shows `complianceBasis`/`consequence`. Live-verified: a Reasons narrative with `renderedText` set exported a DOCX containing the paragraph, with the old field labels correctly absent.
**Files:** `src/components/technical-alert/v2/FinalReviewPanel.tsx:58-68`, `src/server/technicalAlertDocxExportServiceV2.ts:90-98`

Summary's Phase 1 fix correctly branches on `renderedText` in both files. The equivalent Phase 2 fix for Reasons was **never made** — both files still unconditionally render the old flat field list (`Cause status: {causeStatus} — {technicalBasis}` in review; `Technical Basis:`/`Compliance Basis:`/`Consequence:`/`Cause Status:` labels in DOCX), with no check for `narrative.renderedText` at all.

**Failure scenario:** user rewrites Reasons with AI, gets a polished paragraph (confirmed working in `ReasonsWorkspace.tsx`'s own accepted-panel display), accepts it — then Final Review and the exported .docx both silently ignore the paragraph and show the raw fields instead. This defeats the actual point of Phase 2 in the two places that matter most.

**Bonus bug in the same block:** `FinalReviewPanel.tsx`'s fallback branch only shows `technicalBasis`, never `complianceBasis`/`consequence` — under-representing what the DOCX export actually includes, a second review≠export mismatch.

**Fix direction:** mirror Summary's `renderedText`-first branch in both files (this is now a proven pattern, straightforward to replicate).

### 2. ✅ FIXED — All four workspace components keep stale local UI state across "Load Sample" / "Clear Draft" [CODE AUDIT — CONFIRMED]
**Fix:** `TechnicalAlertWorkflowV2.tsx` now has a `draftGeneration` counter, bumped in `loadSample()`/`clearDraft()`, wrapping each of the 4 workspace components in a `<div key={draftGeneration}>` to force a full remount (and clean local-state reset) exactly on load/clear. Verification of the actual UI behavior still needs a manual click (not automatable here) — see checklist item #2.
**Files:** `SummaryWorkspace.tsx`, `ReasonsWorkspace.tsx`, `ImmediateActionWorkspace.tsx`, `FollowUpActionWorkspace.tsx` (each owns local `opStatus`/`warnings`/`instructions` state; `ReasonsWorkspace.tsx` additionally `causeStatusEdited`)

None of the 4 workspace components reset or remount when `TechnicalAlertWorkflowV2.tsx` swaps `sections` wholesale via `loadSample()`/`clearDraft()`. Their local `useState` survives the prop swap untouched.

**Failure scenario:** a rewrite fails (red "Rewrite failed..." banner appears), then the user clicks "Load Sample" or "Clear Draft" — the stale failure banner, leftover warnings list, or typed rewrite instructions can still be showing against the brand-new sample/empty content, because nothing resets `opStatus`/`warnings`/`instructions` when the workspace changes out from under the component.

**Fix direction:** reset local state via a `useEffect` keyed on a workspace-identity signal (e.g. `workspace.currentRevision`, which resets to 0 on load/clear), or force remount with a `key` prop on the four `<XWorkspace>` elements tied to draft identity.

---

## MEDIUM SEVERITY

### 3. ✅ FIXED — `renderedText` itself is never grounding-checked — only the re-derived breakdown fields are [CODE AUDIT]
**Fix:** new `groundRenderedText()` in `technicalAlertObligationGates.ts`, wired into `/summary/rewrite` and `/reasons/rewrite` right after `stripUnsupportedAdditions`. Drops an insufficiently-grounded paragraph entirely (falls back to the field list) with a warning, never blocking. New fixture tests confirm a grounded paragraph survives and a substantially-invented one is dropped. **Known precision limit, documented in code and tests:** catches substantial invention, not a mostly-grounded paragraph with one small invented clause diluting the token-overlap ratio — same class of limitation as every other token-overlap check in this codebase (Insight I9/I9a).
**Files:** `src/server/routes/technicalAlertRoutesV2.ts` (`/summary/rewrite`, `/reasons/rewrite`), `stripUnsupportedAdditions` in `technicalAlertObligationGates.ts`

`stripUnsupportedAdditions` is called with the optional-field lists explicitly excluding `renderedText`. The paragraph is trusted because the model is instructed to "re-derive fields from the paragraph you just wrote" — but nothing deterministically verifies the breakdown fields actually reflect *everything* in the prose. A model could in principle write an embellished paragraph while still deriving a clean breakdown from the original reviewed fields, letting an invented detail live only in the prose, unchecked. Live testing this session (multiple thin-source runs) did not reproduce this, but the deterministic backstop for it doesn't exist.

**Fix direction:** run the same token-overlap check on `renderedText` against grounding, in addition to the breakdown fields.

### 4. ✅ FIXED — Readiness reports the same dangling-`exceptionRef` problem twice [LIVE-TESTED]
**Fix:** removed readiness.ts's own inline exceptionRef-validity loop; relies solely on the merged cross-section check. Live re-tested with the exact original reproduction payload — now returns exactly one message. New fixture test locks in the count.
**Files:** `src/components/technical-alert/v2/readiness.ts` (own inline check) + `crossSectionReview.ts`'s `checkExceptionRefValidity` (also blocking, merged in via `runDeterministicCrossSectionChecks`)

Confirmed live: submitting a draft with an action item referencing a nonexistent exception returns:
```json
"blockingIssues": [
  "An Immediate Action item references an exception that does not exist.",
  "Action item \"Stop.\" references an exception that no longer exists."
]
```
Both messages describe the exact same problem — readiness.ts's own loop and the cross-section check it separately merges in both fire for the identical condition. Not unsafe (both correctly block), but confusing/redundant in the Readiness panel UI.

**Fix direction:** remove readiness.ts's own inline exceptionRef-validity loop (lines checking `exceptionIds.has(item.exceptionRef)`) since `checkExceptionRefValidity` in the shared cross-section check already covers this exact case and is already merged into blockingIssues.

### 5. ✅ FIXED — Migrated Summary can be marked "Accepted" with an empty required field [CODE AUDIT]
**Fix:** `migrateSummary` now requires both `subject` and `affectedScope` non-empty to mark `.accepted`; partial content produces a `resolution_required` finding instead of a silent guess. New fixture tests confirm both the partial-content and fully-empty cases behave correctly and don't affect the existing realistic-sample migration test.
**Files:** `src/lib/technicalAlertMigration.ts` (`migrateSummary`) vs. `readiness.ts`'s blocking check on `subject.trim()`

`migrateSummary` proceeds (sets `.accepted`) if `issueOrRestriction` OR `affectedScope` is present — not both. A v1 draft with only `affectedScope` set produces a non-null `accepted` value with an empty `subject`, so the Drafting stage shows a green "Accepted" badge, while `readiness.ts` simultaneously blocks export for the same section ("Summary must be accepted with at least a subject and affected scope"). Confusing mixed signal, migration-only edge case.

**Fix direction:** don't set `.accepted` for Summary in migration unless both required fields are non-empty; downgrade to raw-only + a `resolution_required` finding instead.

---

## MINOR / LOGIC INCONSISTENCY

### 6. ✅ FIXED — `handleJumpToSection` doesn't scroll to the section it opens [CODE AUDIT — CONFIRMED]
**Fix:** `AccordionSection` now has a stable DOM id (`ta-section-{id}`); `handleJumpToSection` scrolls to it after a short delay (same pattern as the suggestion-panel auto-scroll). Manual click confirmation still recommended (checklist item #5).
**File:** `TechnicalAlertWorkflowV2.tsx:110-113`

Switches to Drafting and expands the right accordion section, but never scrolls the viewport there. On a long Drafting page, clicking "Go to Summary" from a Cross-Section finding could land the user back at the top with the target section expanded but off-screen.

**Fix direction:** `document.getElementById(...)?.scrollIntoView()` after `open(id)` (would need an `id` attribute added to each `AccordionSection`'s root element first).

### 7. ✅ FIXED — `ImmediateActionWorkspace.tsx`'s `EmptySectionStart` uses `workspace.loading` directly instead of the file's own `busy` alias [CODE AUDIT — CONFIRMED]
**Fix:** one-line change to `loading={busy}`.
**File:** `ImmediateActionWorkspace.tsx:207` vs. `:154`

Every other button in the file uses `busy` (`const busy = workspace.loading`); this one spot still uses `workspace.loading` directly. Functionally identical today, but a latent inconsistency — if `busy` is ever redefined, this call site silently falls out of sync.

**Fix direction:** change to `loading={busy}`.

### 8. ⏸ DEFERRED (not fixed) — No deterministic "invented evidence item" guard for Reasons [CODE AUDIT]
**Decision:** left open deliberately. Arrays don't fit the existing "absent→present" gate pattern cleanly, and there's no live evidence this has actually happened. Revisit if real usage ever shows a rewrite inventing an evidence item.
Noted for completeness, not a confirmed defect: `evidenceItems` has no equivalent to the new "narrative can't be invented from nothing" guard. A rewrite could in principle add a wholly new evidence item not grounded in the source; only the whole-output `mandatoryTermGate`/`uncertaintyPreservationGate` would have any (incidental) chance of catching it. Arrays don't fit the existing "absent → present" gate pattern used elsewhere, so this needs a deliberate design decision rather than a quick fix — flagging so it's a conscious "defer," not an oversight.

---

## Confirmed working correctly (live-tested this session, for confidence)

- **Validation edge cases**, all routes: wrong `documentType` → 400; missing/whitespace-only `rawText` → 400; missing `components` on rewrite → 400; malformed JSON body → 400 with a clean error message, server stays up afterward.
- **Immediate Action rewrite with a genuinely empty `items: []`** → handled cleanly, no false gate rejection (0 vs 0 item count).
- **`/snapshot`** — correct readiness computation, e.g. `"Needs minor fixes"` with the expected warning when Reasons is omitted.
- **`/export-docx`**: a ready draft returns a real, valid `.docx` (confirmed via `file` command: "Microsoft Word 2007+", correct Content-Type, non-trivial size) whose actual XML content (unzipped and grepped) matches every submitted field. An incomplete draft (no title, nothing accepted) correctly returns `422` with an itemized `blockingIssues` list, not a crash.
- **Stale accepted content correctly blocks export** (`"Summary is accepted but stale -- review and re-accept before export."`).
- **Acknowledgement-required-but-incomplete** and **exception-with-empty-condition** readiness checks both fire correctly, exactly once each (no duplication, unlike Finding #4).
- **Cross-section AI deep-check**: fed a deliberately contradictory Summary/Immediate-Action pair (a stated "loss of well control" risk vs. an action saying "continue normal operations") — correctly identified the exact contradiction, in both direction and content.
- **Reasons rewrite hedge-term handling** (from earlier in this session, re-confirmed still correct): synonym substitution across hedge words (`possibly` → `may`) no longer falsely rejected; genuine hedge removal is still caught.
- **STE "can vs may" scoping** (from earlier in this session): correctly silent on hedging `may` in descriptive content, correctly still fires on permission-sense `may` in instructional content.
- No React stale-closure bugs, no `useEffect` dependency-array bugs, and no frontend/backend request-shape mismatches were found anywhere in the 4 workspace components' async handlers — all correctly use the functional-updater pattern and check `isResponseCurrent` before applying a response.
- No corrupt-localStorage/persistence handling issues found.

---

## Manual browser checklist (still needed — this report can't verify these)

1. Load `/technical-alert`, click "Load Technical Alert Sample" → confirm every section shows raw notes only (no pre-filled structured fields), per this session's earlier presentation-readiness fix.
2. Trigger a rewrite failure deliberately (e.g. stop the dev server mid-request, or disconnect network) → confirm the failure banner clears correctly on "Load Sample"/"Clear Draft" (this is Finding #2 — expect it to currently **fail** this check).
3. Rewrite Reasons with AI, accept it, go to Final Review → confirm whether the paragraph or the field list is shown (Finding #1 — expect the field list, incorrectly).
4. Export a Reasons-containing alert to `.docx` and open it in Word → same check as #3 for the actual document.
5. Click "Go to Summary" from a Cross-Section Review finding in Final Review → confirm whether the page scrolls there or just expands off-screen (Finding #6).
6. General click-through of Analyze → Rewrite → accept/dismiss → manual "Mark Ready (No AI)" for all 4 sections, confirming visual polish, button states, and warnings display render as intended (this report verified the *logic* is correct via API testing; it can't confirm actual visual layout/CSS).
7. Confirm the bottom Back/Continue navigation and the 3-stage tab bar (Drafting / Metadata & Supporting Content / Final Review & Export) look and behave correctly after the Phase 4 stage removal.
8. Confirm Figures/Tables collapse behind "Advanced" in Controls & Metadata as expected, and that References remains visible with its new hint text.
