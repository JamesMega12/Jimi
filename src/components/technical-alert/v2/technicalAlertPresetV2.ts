import { createEmptySectionWorkspace } from './sectionWorkspace';
import {
  TechnicalAlertSections,
  SummaryAccepted,
  ReasonsAccepted,
  ImmediateActionContent,
  FollowUpActionContent,
  AdministrativeMetadata,
  ControlInformation,
  SupportingContent,
} from './types';

// Fictional sample (same "Creston Molded Wiper Plugs" scenario as the v1
// sample, for continuity). Intentionally rough/imperfect prose in the raw
// fields, matching the existing convention that samples should be suitable
// for AI testing, not pre-polished. No AI is invoked, nothing is rewritten,
// and nothing is exported automatically by loading it.
//
// UX fix (2026-07-23): sections load with ONLY their raw notes pre-filled --
// analysis.components stays null, exactly like a brand-new draft. Two earlier
// UX passes tried to get this right and each left a gap:
//   1. Originally the sample pre-filled `accepted` directly, which made every
//      section show "Accepted (manually authored)" the instant it loaded --
//      confusing, since nobody had actually reviewed anything.
//   2. That was fixed by pre-filling `analysis.components` instead of
//      `accepted`, but that still bypassed the four workspaces' empty-state
//      gate (`hasComponents = analysis.components !== null`), so structured
//      Summary/Reasons/Action fields appeared instantly on load too -- before
//      Analyze was ever clicked. For a live demo to first-time users this
//      looked like the AI step had been silently faked.
// Now: only `raw` is pre-filled (the rough notes a real user would have
// pasted in). Every section starts in the same empty-state UI a brand-new
// user sees ("Ask AI to help" / "Fill in manually"), so a presenter clicks
// Analyze -> Rewrite -> Accept live and every AI step is genuinely shown.
export function createTechnicalAlertSampleV2(): {
  administrativeMetadata: AdministrativeMetadata;
  controlInformation: ControlInformation;
  supportingContent: SupportingContent;
  sections: TechnicalAlertSections;
} {
  const administrativeMetadata: AdministrativeMetadata = {
    title: 'Creston Molded Wiper Plugs Not Approved for HPHT Cementing Applications',
    documentNumber: 'WCF TA 2026-03',
    inTouchId: '9002384',
    date: '2026-07-07',
    gemsNo: 'N/A',
    classification: 'SLB-Private',
  };

  const controlInformation: ControlInformation = {
    deadline: '2026-07-31',
    actionBy: ['PSD', 'P&SC', 'Operations'],
    informationFor: ['OI', 'Engineering', 'Field Service Managers'],
    effectiveTiming: 'Effective immediately',
    acknowledgementRequired: true,
    quizRequired: true,
  };

  const supportingContent: SupportingContent = {
    acknowledgement: {
      completionMethod: 'Online Quiz',
      applicationOrSystem: 'TechAlert Portal',
      completionDeadline: '2026-07-31',
      targetAudience: ['Operations', 'PSD'],
      completionInstructions: 'Log in to the TechAlert Portal, read the alert, and complete the 5-question quiz.',
    },
    figures: [],
    tables: [],
    references: [],
  };

  const sections: TechnicalAlertSections = {
    summary: (() => {
      const ws = createEmptySectionWorkspace<SummaryAccepted, SummaryAccepted>();
      ws.raw =
        'Several recent jobs using Creston molded wiper plugs in HPHT cementing applications reported inconsistent plug performance, including excessive rubber deformation and difficulty achieving a clear bump indication. Creston molded top and bottom wiper plugs should not be used for HPHT cementing applications until further review is completed.';
      return ws;
    })(),
    reasons: (() => {
      const ws = createEmptySectionWorkspace<ReasonsAccepted, ReasonsAccepted>();
      ws.raw =
        'Initial field feedback and inspection results indicate the plug material may not be maintaining the expected profile after exposure to elevated temperature and pressure. The root cause has not been confirmed. Two recent jobs reported possible deformation and inconsistent bump indication on the top plug, and volume discrepancies during displacement possibly linked to bypass on the bottom plug.';
      return ws;
    })(),
    immediateAction: (() => {
      const ws = createEmptySectionWorkspace<ImmediateActionContent, ImmediateActionContent>();
      ws.raw =
        // Uses "prohibited" rather than "do not"/"must not" -- the
        // mandatory-term safety gate (technicalAlertSemanticSafety.ts
        // MANDATORY_TERM_CLASSES) treats "do not" as its own standalone class
        // with no synonym fallback, and "must not" ambiguously straddles TWO
        // classes at once (["must","shall","required"] via the substring
        // "must", and ["prohibited","must not","shall not"] via "must not") --
        // a rewrite that preserves the prohibition via "prohibited" alone
        // still fails the first class since no literal "must"/"shall"/
        // "required" survives. "prohibited" alone belongs only to the second
        // class, with no such overlap. Confirmed live, 2026-08-06 -- two
        // earlier phrasings of this sample both still failed the gate.
        'Effective immediately, use of Creston molded top or bottom wiper plugs for HPHT cementing applications is prohibited. P&SC should stop new purchases. An exemption is available for non-HPHT use with Technical Director and Quality Manager sign-off through the Exemption Management System, provided a risk assessment is completed.';
      return ws;
    })(),
    followUpAction: (() => {
      const ws = createEmptySectionWorkspace<FollowUpActionContent, FollowUpActionContent>();
      ws.raw = 'Engineering to investigate root cause and provide qualification evidence next quarter before this restriction can be lifted.';
      return ws;
    })(),
  };

  return { administrativeMetadata, controlInformation, supportingContent, sections };
}
