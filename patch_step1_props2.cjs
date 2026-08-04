const fs = require('fs');
let code = fs.readFileSync('src/components/Step1Context.tsx', 'utf8');

const newImports = `import React, { useState } from 'react';
import { FCORequestData, DocxAnalysisResponse, FCOApiResponse } from '../types';
import DocxUploadModal from './DocxUploadModal';
import { AlertCircle, FileText, Edit3, UploadCloud, ChevronRight, CheckCircle2, Beaker, ChevronDown, ChevronUp, X, Sparkles, ListChecks, ScanSearch, Lightbulb, Loader2 } from 'lucide-react';
import { PRESETS } from '../lib/testPresets';
import { FcoTablesEditor } from './FcoTablesEditor';
import { AdvancedMetadataPanel } from './AdvancedMetadataPanel';
import { VisualPlaceholdersEditor } from './VisualPlaceholdersEditor';
import { AiReviewStudio } from './AiReviewStudio';
import RewrittenDraft from './RewrittenDraft';
import ProcedureReadinessPanel from './ProcedureReadinessPanel';

interface Step1ContextProps {
  formData: FCORequestData;
  setFormData: React.Dispatch<React.SetStateAction<FCORequestData>>;
  inputMode: 'manual' | 'docx';
  setInputMode: (mode: 'manual' | 'docx') => void;
  docxAnalysis: DocxAnalysisResponse | null;
  setDocxAnalysis: (data: DocxAnalysisResponse | null) => void;
  onNext: () => void;
  onAutoRewrite: (data: DocxAnalysisResponse, latestFormData: FCORequestData) => void;
  onTestPresetAutoRun?: (data: FCORequestData) => void;
  developerMode: boolean;
  onClearPresetData: () => void;
  apiResponse?: FCOApiResponse | null;
  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  onSubmit?: () => void;
}

export default function Step1Context({
  formData, setFormData, inputMode, setInputMode, docxAnalysis, setDocxAnalysis, onNext, onAutoRewrite, onTestPresetAutoRun, developerMode, onClearPresetData,
  apiResponse, loading, loadingMessage, error, onSubmit
}: Step1ContextProps) {`;

code = code.replace(/import React[\s\S]*?}: Step1ContextProps\) \{/, newImports);
fs.writeFileSync('src/components/Step1Context.tsx', code);
