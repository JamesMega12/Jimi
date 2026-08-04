const fs = require('fs');
let code = fs.readFileSync('src/components/Step1Context.tsx', 'utf8');

const importReplacement = `import React, { useState } from 'react';
import { FCORequestData, DocxAnalysisResponse, FCOApiResponse } from '../types';
import DocxUploadModal from './DocxUploadModal';
import { AlertCircle, FileText, Edit3, UploadCloud, ChevronRight, CheckCircle2, Beaker, ChevronDown, ChevronUp, X, Sparkles, ListChecks, ScanSearch, Lightbulb, Loader2 } from 'lucide-react';
import { PRESETS } from '../lib/testPresets';
import { FcoTablesEditor } from './FcoTablesEditor';
import { AdvancedMetadataPanel } from './AdvancedMetadataPanel';
import { VisualPlaceholdersEditor } from './VisualPlaceholdersEditor';
import { AiReviewStudio } from './AiReviewStudio';
import RewrittenDraft from './RewrittenDraft';
import ProcedureReadinessPanel from './ProcedureReadinessPanel';`;

code = code.replace(/^import React.*?\nimport \{ VisualPlaceholdersEditor \}.*?\n/m, importReplacement + '\n');
code = code.replace(/import \{ FCORequestData, DocxAnalysisResponse \} from '\.\.\/types';/, ''); // wait, better to just replace first 8 lines

// Let's do it safely
