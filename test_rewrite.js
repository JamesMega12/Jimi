const draft = {
  documentType: "Announcement",
  metadata: {
    title: "Test Announcement",
    date: "2023-10-01",
    inTouchId: "123456",
    gemsNo: "N/A"
  },
  controlInfo: {
    deadline: "",
    actionBy: [],
    informationFor: [],
    acknowledgementRequired: false,
    quizRequired: false
  },
  rawSections: {
    summaryInput: "Something happened and you must fix it now.",
    reasonInput: "Because it broke.",
    actionInput: "Fix it using a wrench."
  }
};

const analysis = {
  documentType: "Announcement",
  readiness: { status: "Ready to rewrite", summary: "Good", blockingIssues: [], warnings: [] },
  analysis: {
    summary: { status: "Complete", fourPartSupport: { whatHappenedOrChanged: "Something happened", whyItMatters: "Important", affectedScope: "All", requiredAction: "Fix it" } },
    reason: { status: "Complete", required: true, clarity: "Clear", rootCauseCertainty: "Certain", duplicationWarning: "None", moveToActionSuggestions: [], shortenRecommendation: "None" },
    action: { status: "Complete", clarity: "Clear", mandatoryActionFinding: "Mandatory", ownerDeadlineFinding: "None", acknowledgementQuizFinding: "None", suggestedCategories: { immediate: ["Fix it using a wrench"] } }
  }
};

fetch('http://localhost:3000/api/techcom/rewrite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ techComDraft: draft, analysisResult: analysis, rewriteTarget: "summary" })
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
