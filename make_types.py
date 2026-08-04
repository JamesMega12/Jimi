types = [
    "GroundingDiagnostics", "FCODiagnostics", "FCORequestData", "ProcedureCallout",
    "ProcedureReadinessSuggestion", "FCOSummary", "FCOProcedure", "KBDocument",
    "TechComReviewNotes", "TechComDraft", "TechComRewriteResponse",
    "TechComFormatResponse", "TechComAnalyzeResponse", "FcoDraft",
    "FcoSummaryAnalysis", "FCOPartInvolved", "KBChunk", "DocxBlock",
    "DocxFigure", "DocxAnalysisResponse", "DocxTableMetadata", "FCOApiResponse",
    "ProcedureSection", "GroundingSource", "DiffTrace", "DiffToken",
    "FcoPcsbField", "FcoPcsbConfidence", "WhatWasEdited", "FCOValidation"
]

with open('src/types.ts', 'w') as f:
    for t in types:
        f.write(f"export type {t} = any;\n")

