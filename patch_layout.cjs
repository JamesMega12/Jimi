const fs = require('fs');
let code = fs.readFileSync('src/components/Step1Context.tsx', 'utf8');

// Update imports
code = code.replace(
  "import { AlertCircle, FileText, Edit3, UploadCloud, ChevronRight, CheckCircle2, Beaker, ChevronDown, ChevronUp, X } from 'lucide-react';",
  "import { AlertCircle, FileText, Edit3, UploadCloud, ChevronRight, CheckCircle2, Beaker, ChevronDown, ChevronUp, X, Sparkles, ListChecks, ScanSearch, Lightbulb } from 'lucide-react';"
);

// Add legacy sync
code = code.replace(
  "if (section === 'technicalContent' && field === 'optionalRewriteInstructions') legacySync.customDirectives = value;",
  "if (section === 'technicalContent' && field === 'optionalRewriteInstructions') legacySync.customDirectives = value;\n      if (section === 'technicalContent' && field === 'draftSummary') legacySync.rawSummary = value;\n      if (section === 'technicalContent' && field === 'draftProcedure') legacySync.rawProcedure = value;"
);

fs.writeFileSync('src/components/Step1Context.tsx', code);
