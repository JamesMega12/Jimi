import React, { useEffect, useState } from 'react';
import AppWorkflow from './components/AppWorkflow';
import TechnicalAlertWorkflow from './components/technical-alert/v2/TechnicalAlertWorkflowV2';
import AnnouncementWorkflow from './components/announcement/AnnouncementWorkflow';
import { FileText, LayoutTemplate, Settings2 } from 'lucide-react';
import { AppMode, modeForPath, pathForMode } from './lib/appModeRouting';

export default function AppShell() {
  const [appMode, setAppModeState] = useState<AppMode>(() =>
    typeof window !== 'undefined' ? modeForPath(window.location.pathname) : 'home'
  );

  // Keep appMode in sync with browser back/forward navigation.
  useEffect(() => {
    const onPopState = () => setAppModeState(modeForPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setAppMode = (mode: AppMode) => {
    setAppModeState(mode);
    const path = pathForMode(mode);
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <div className="bg-slate-900 text-white py-3 px-6 flex items-center justify-between shadow-md">
        <div 
          className="flex items-center gap-3 cursor-pointer" 
          onClick={() => setAppMode('home')}
        >
          <div className="font-bold text-xl tracking-tight flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-indigo-400" />
            TechCom Document Workspace
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setAppMode('fco')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${appMode === 'fco' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            <FileText className="w-4 h-4" />
            FCO Agent
          </button>
          <button
            onClick={() => setAppMode('technical-alert')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${appMode === 'technical-alert' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            <LayoutTemplate className="w-4 h-4" />
            Technical Alert
          </button>
          <button
            onClick={() => setAppMode('announcement')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${appMode === 'announcement' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            <LayoutTemplate className="w-4 h-4" />
            Announcement
          </button>
        </div>
      </div>
      
      {appMode === 'home' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Select a Workflow</h1>
          <p className="text-slate-500 mb-10 max-w-lg text-center">Choose the document type you want to create. The assistant will guide you through the drafting, reviewing, and formatting process.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
            <div 
              onClick={() => setAppMode('fco')}
              className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">FCO Agent</h2>
              <p className="text-slate-600 text-sm">Create a Field Change Order from rough engineering content, including Summary, Title, Parts & Components, Procedure, technical metadata, review, and DOCX export.</p>
            </div>
            
            <div 
              onClick={() => setAppMode('technical-alert')}
              className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-6 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <LayoutTemplate className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Technical Alert</h2>
              <p className="text-slate-600 text-sm">Create a controlled Technical Alert with Summary, Reasons, required actions, restrictions, exemptions, acknowledgement requirements, supporting content, review, and export.</p>
            </div>

            <div 
              onClick={() => setAppMode('announcement')}
              className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center mb-6 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <LayoutTemplate className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Announcement</h2>
              <p className="text-slate-600 text-sm">Create an Announcement for design changes, operational updates, reasons, short-term and long-term actions, supporting content, review, and export.</p>
            </div>
          </div>
        </div>
      )}

      <div className={appMode === 'fco' ? 'flex-1 overflow-auto flex flex-col' : 'hidden'}>
        <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-2 text-indigo-800 text-sm font-medium">
            <FileText className="w-4 h-4" />
            Active Workflow: FCO Agent
          </div>
        </div>
        <AppWorkflow />
      </div>

      <div className={appMode === 'technical-alert' ? 'flex-1 overflow-auto flex flex-col' : 'hidden'}>
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-2 text-amber-800 text-sm font-medium">
            <LayoutTemplate className="w-4 h-4" />
            Active Workflow: Technical Alert
          </div>
        </div>
        <TechnicalAlertWorkflow />
      </div>

      <div className={appMode === 'announcement' ? 'flex-1 overflow-auto flex flex-col' : 'hidden'}>
        <div className="bg-teal-50 border-b border-teal-100 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-2 text-teal-800 text-sm font-medium">
            <LayoutTemplate className="w-4 h-4" />
            Active Workflow: Announcement
          </div>
        </div>
        <AnnouncementWorkflow />
      </div>

    </div>
  );
}
