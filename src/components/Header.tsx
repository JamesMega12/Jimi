import React, { useState } from 'react';
import { PenTool, Sparkles, AlertTriangle, ShieldCheck, Database, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { FCODiagnostics } from '../types';

const ENABLE_LEGACY_GROUNDING_KB_UI = false;

interface HeaderProps {
  diagnostics?: FCODiagnostics;
  loading?: boolean;
  onOpenKbAdmin?: () => void;
  onOpenDevKnowledge?: () => void;
  onClearDraft: () => void;
  ragStatus?: 'checked' | 'seed_only' | 'ready';
  developerMode: boolean;
  setDeveloperMode: (mode: boolean) => void;
}

export default function Header({ diagnostics, loading, onOpenKbAdmin, onOpenDevKnowledge, onClearDraft, ragStatus, developerMode, setDeveloperMode }: HeaderProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const getBadge = () => {
    if (loading) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
          Processing...
        </span>
      );
    }
    
    if (!diagnostics) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
          Ready to Draft
        </span>
      );
    }

    if (diagnostics.engineUsed === 'gemini') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          Engine: Gemini API
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        Engine: Local Heuristic Fallback
      </span>
    );
  };

  const getRagBadge = () => {
    if (!ragStatus || ragStatus === 'checked') return null;
    if (ragStatus === 'seed_only') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 font-mono tracking-tighter" title="Only seeded demo guides are active. Upload real source-truth documents before relying on RAG-grounded rewrites.">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          SEED DATA ONLY
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono tracking-tighter">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        SOURCE TRUTH READY
      </span>
    );
  };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40 transition-all duration-200 shadow-xs" id="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white flex-shrink-0">
               <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
                Jimi
              </h1>
              <p className="text-sm text-slate-500 font-sans mt-0.5 font-medium">
                AI-Powered FCO Drafting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-center">
            
            <button 
              onClick={() => setDeveloperMode(!developerMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border shadow-sm mr-2 ${
                developerMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Toggle Mode"
            >
              {developerMode ? <ToggleRight className="w-4 h-4 text-indigo-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
              <span>{developerMode ? 'Developer Mode' : 'User Mode'}</span>
            </button>

            {showClearConfirm ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 mr-2">
                <span className="text-red-700">Are you sure?</span>
                <button
                  onClick={() => { onClearDraft(); setShowClearConfirm(false); }}
                  className="px-2 py-0.5 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Yes
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border shadow-sm mr-2 bg-white border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                title="Clear the current draft and start over"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Draft</span>
              </button>
            )}

            {ENABLE_LEGACY_GROUNDING_KB_UI && developerMode && getRagBadge()}
            {developerMode && getBadge()}
            
            {ENABLE_LEGACY_GROUNDING_KB_UI && developerMode && onOpenKbAdmin && (
              <button 
                onClick={onOpenKbAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-all cursor-pointer shadow-sm"
                title="Manage Guidelines Base"
                id="btn-open-kb-admin"
              >
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>Grounding KB</span>
              </button>
            )}

            {developerMode && onOpenDevKnowledge && (
              <button 
                onClick={onOpenDevKnowledge}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-all cursor-pointer shadow-sm"
                title="Knowledge & Instructions"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Knowledge & Instructions</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="TechCom Compliance Active">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
              <span className="text-xs font-semibold text-slate-500 hidden md:inline">TechCom-V1 Compliant</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
