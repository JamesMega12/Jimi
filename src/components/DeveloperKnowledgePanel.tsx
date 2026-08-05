import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Layers, TerminalSquare, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { InstructionTrace } from '../server/instructionPacks/types';
import { parseJsonResponse } from '../utils/apiResponse';
import GroundingPanel from './GroundingPanel';

interface DeveloperKnowledgePanelProps {
  onClose: () => void;
  latestTrace?: any;
  latestGrounding?: any;
  latestCorrections?: any[];
}

export default function DeveloperKnowledgePanel({ onClose, latestTrace, latestGrounding, latestCorrections }: DeveloperKnowledgePanelProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'drafts' | 'test' | 'summary' | 'procedure' | 'prompt' | 'trace' | 'grounding' | 'ste'>('config');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [editingDraft, setEditingDraft] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [testMode, setTestMode] = useState<'summary' | 'procedure'>('summary');
  const [testPackSource, setTestPackSource] = useState<'active' | 'draft'>('active');
  const [testDraftId, setTestDraftId] = useState<string>('');
  const [testInput, setTestInput] = useState<string>('');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const [uploadingSte, setUploadingSte] = useState(false);

  const handleSteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // We can enforce PDF if feasible, though the requirement says "if feasible".
    if (!file.name.toLowerCase().endsWith('.pdf')) {
       setError("Only PDF files are supported for STE Guidance.");
       return;
    }
    
    setUploadingSte(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const content = reader.result as string;
          const res = await fetch('/api/fco/ste-guidance/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, name: file.name })
          });
          const result = await parseJsonResponse(res);
          await fetchData();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setUploadingSte(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message);
      setUploadingSte(false);
    }
  };

  const handleSteRemove = async () => {
    if (!confirm("Are you sure you want to remove the STE Guidance Document?")) return;
    setLoading(true);
    try {
       const res = await fetch('/api/fco/ste-guidance', { method: 'DELETE' });
       await parseJsonResponse(res);
       await fetchData();
    } catch (err: any) {
       setError(err.message);
    } finally {
       setLoading(false);
    }
  };

  const handleSteReindex = async () => {
    setLoading(true);
    try {
       const res = await fetch('/api/fco/ste-guidance/reindex', { method: 'POST' });
       await parseJsonResponse(res);
       await fetchData();
    } catch (err: any) {
       setError(err.message);
    } finally {
       setLoading(false);
    }
  };

  const tabsRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tabsRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tabsRef.current.offsetLeft);
    setScrollLeft(tabsRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tabsRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    tabsRef.current.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    fetchData();
    fetchDrafts();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fco/instruction-packs/status');
      const json = await parseJsonResponse(res);
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrafts = async () => {
    try {
      const res = await fetch('/api/fco/instruction-packs/drafts');
      const json = await parseJsonResponse(res);
      setDrafts(json);
    } catch (err: any) {
      console.error("Failed to load drafts:", err);
    }
  };

  const handleCreateDraft = async (scope: 'summary' | 'procedure') => {
    if (!data) return;
    const basePack = scope === 'summary' ? data.summaryPack : data.procedurePack;
    const newDraft = {
      basePackId: basePack.id,
      name: `Draft: ${basePack.name}`,
      scope,
      version: '1.0.0-draft',
      status: 'draft',
      content: basePack.content,
      description: '',
      changelog: ''
    };
    try {
      const res = await fetch('/api/fco/instruction-packs/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDraft)
      });
      const savedDraft = await parseJsonResponse(res);
      setDrafts([...drafts, savedDraft]);
      setEditingDraft(savedDraft);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveDraft = async () => {
    if (!editingDraft) return;
    try {
      const res = await fetch(`/api/fco/instruction-packs/drafts/${editingDraft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDraft)
      });
      const savedDraft = await parseJsonResponse(res);
      setDrafts(drafts.map(d => d.id === savedDraft.id ? savedDraft : d));
      setEditingDraft(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm("Are you sure you want to discard this draft?")) return;
    try {
      await fetch(`/api/fco/instruction-packs/drafts/${id}`, { method: 'DELETE' });
      setDrafts(drafts.filter(d => d.id !== id));
      if (editingDraft?.id === id) setEditingDraft(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleActivateDraft = async (id: string) => {
    if (!confirm("Activating this pack changes live AI rewrite behavior. Locked validation and schema rules still apply.")) return;
    try {
      await fetch(`/api/fco/instruction-packs/drafts/${id}/activate`, { method: 'POST' });
      await fetchData(); // refresh status
      setActiveTab('config');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRollback = async (scope: 'summary' | 'procedure') => {
    if (!confirm("Rollback changes the active instruction pack used by future rewrites.")) return;
    try {
      await fetch(`/api/fco/instruction-packs/${scope}/rollback`, { method: 'POST' });
      await fetchData(); // refresh status
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRunTest = async () => {
    if (testPackSource === 'draft' && !testDraftId) {
      setError("Please select a draft pack to test.");
      return;
    }
    if (!testInput.trim()) {
      setError("Please provide input text for the test.");
      return;
    }
    
    setTestRunning(true);
    setTestResult(null);
    setError(null);
    
    try {
      const endpoint = testMode === 'summary' ? '/api/fco/instruction-packs/test-summary' : '/api/fco/instruction-packs/test-procedure';
      const inputPayload = testMode === 'summary' ? { rawSummary: testInput } : { rawProcedure: testInput };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packSource: testPackSource,
          draftPackId: testPackSource === 'draft' ? testDraftId : undefined,
          input: inputPayload
        })
      });
      
      const json = await parseJsonResponse(res);
      setTestResult(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTestRunning(false);
    }
  };

  const tabClasses = (tab: string) => {
    const base = "px-4 py-3 text-xs font-bold transition-all border-b-2 font-sans cursor-pointer whitespace-nowrap";
    const active = "border-indigo-600 text-indigo-700 bg-indigo-50/50";
    const inactive = "border-transparent text-slate-500 hover:text-indigo-600 hover:border-slate-200";
    return `${base} ${activeTab === tab ? active : inactive}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans overflow-hidden" id="dev-knowledge-overlay">
      <div className="bg-slate-50 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col h-[90vh] md:h-[80vh] border border-slate-200" id="dev-knowledge-container">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white rounded-t-2xl flex items-center justify-between border-b border-slate-950">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5.5 h-5.5 text-indigo-400" />
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider">Knowledge & Instructions</h1>
              <p className="text-xxs text-slate-400 leading-normal font-mono">Developer Visibility Layer</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Close Panel (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div 
          ref={tabsRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`border-b border-slate-200 bg-white overflow-x-auto flex scrollbar-none scroll-smooth shrink-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <button onClick={() => setActiveTab('config')} className={tabClasses('config')}>
            Active Configuration
          </button>
          <button onClick={() => { setActiveTab('drafts'); setEditingDraft(null); }} className={tabClasses('drafts')}>
            Draft Packs
          </button>
          <button onClick={() => { setActiveTab('test'); }} className={tabClasses('test')}>
            Pack Test Runner
          </button>
          <button onClick={() => setActiveTab('summary')} className={tabClasses('summary')}>
            Summary Pack Preview
          </button>
          <button onClick={() => setActiveTab('procedure')} className={tabClasses('procedure')}>
            Procedure Pack Preview
          </button>
          <button onClick={() => setActiveTab('prompt')} className={tabClasses('prompt')}>
            Compiled Prompt Preview
          </button>
          <button onClick={() => setActiveTab('trace')} className={tabClasses('trace')}>
            Instruction Trace
          </button>
          <button onClick={() => setActiveTab('grounding')} className={tabClasses('grounding')}>
            Grounding & Corrections
          </button>
          <button onClick={() => setActiveTab('ste')} className={tabClasses('ste')}>
            STE Guidance
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
          {loading && !data && (
            <div className="flex justify-center items-center h-full text-slate-500 font-bold text-sm">
              Loading visibility layer...
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm mb-4">
              Error: {error}
            </div>
          )}
          
          {data && activeTab === 'config' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Active Pack Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-800">Summary Pack</h3>
                    {data.activeRegistry?.summary?.history?.length > 0 && (
                      <button onClick={() => handleRollback('summary')} className="ml-auto text-xs text-rose-600 font-bold hover:text-rose-800">
                        Rollback
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 text-sm font-mono text-slate-600">
                    <div><span className="font-bold text-slate-800">ID:</span> {data.summaryPack.id}</div>
                    <div><span className="font-bold text-slate-800">Name:</span> {data.summaryPack.name}</div>
                    <div><span className="font-bold text-slate-800">Version:</span> {data.summaryPack.version}</div>
                    <div><span className="font-bold text-slate-800">Source:</span> {data.activeRegistry?.summary?.source || 'bundled_default'}</div>
                    <div><span className="font-bold text-slate-800">Status:</span> ACTIVE</div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-800">Procedure Pack</h3>
                    {data.activeRegistry?.procedure?.history?.length > 0 && (
                      <button onClick={() => handleRollback('procedure')} className="ml-auto text-xs text-rose-600 font-bold hover:text-rose-800">
                        Rollback
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 text-sm font-mono text-slate-600">
                    <div><span className="font-bold text-slate-800">ID:</span> {data.procedurePack.id}</div>
                    <div><span className="font-bold text-slate-800">Name:</span> {data.procedurePack.name}</div>
                    <div><span className="font-bold text-slate-800">Version:</span> {data.procedurePack.version}</div>
                    <div><span className="font-bold text-slate-800">Source:</span> {data.activeRegistry?.procedure?.source || 'bundled_default'}</div>
                    <div><span className="font-bold text-slate-800">Status:</span> ACTIVE</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 shadow-sm">
                <p><strong>Loader Status:</strong> Online</p>
                <p><strong>Configured Packs Available:</strong> {data.activeRegistry?.summary?.source === 'configured' || data.activeRegistry?.procedure?.source === 'configured' ? 'Yes' : 'No (using bundled defaults)'}</p>
              </div>
            </div>
          )}

          {activeTab === 'drafts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                <h2 className="text-lg font-bold text-slate-800">Draft Packs</h2>
                {!editingDraft && (
                  <div className="flex gap-2">
                    <button onClick={() => handleCreateDraft('summary')} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors">
                      + Summary Draft
                    </button>
                    <button onClick={() => handleCreateDraft('procedure')} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors">
                      + Procedure Draft
                    </button>
                  </div>
                )}
              </div>

              {!editingDraft && (
                <>
                  <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs rounded-xl flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Activating a draft will immediately apply it to the live AI rewrite behavior.</span>
                  </div>

                  {drafts.length === 0 ? (
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 font-medium">
                      <TerminalSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No draft packs exist. Create one from an active pack.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {drafts.map(draft => (
                        <div key={draft.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{draft.scope}</span>
                              <h3 className="font-bold text-slate-800 mt-1">{draft.name}</h3>
                            </div>
                            <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">{draft.version}</span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2">{draft.description || 'No description.'}</p>
                          <div className="flex gap-2 pt-2 border-t border-slate-100">
                            <button onClick={() => setEditingDraft(draft)} className="text-xs font-bold text-slate-600 hover:text-slate-800">Edit Draft</button>
                            <button onClick={() => handleActivateDraft(draft.id)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Activate Draft</button>
                            <button onClick={() => handleDeleteDraft(draft.id)} className="text-xs font-bold text-rose-600 hover:text-rose-800 ml-auto">Discard</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {editingDraft && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Editing Draft: {editingDraft.name}</h3>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingDraft(null)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleSaveDraft} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors">
                        Save Draft
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-red-50 border-b border-red-100 text-red-800 text-xs flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <div>
                      <strong>Locked Contract Warning:</strong><br/>
                      Do not put JSON schemas, response keys, repair prompts, export rules, or deterministic validation logic into instruction pack content. Instruction packs control writing behavior only.
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-2 gap-4 border-b border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Name</label>
                      <input type="text" value={editingDraft.name} onChange={e => setEditingDraft({...editingDraft, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Version</label>
                      <input type="text" value={editingDraft.version} onChange={e => setEditingDraft({...editingDraft, version: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                      <input type="text" value={editingDraft.description} onChange={e => setEditingDraft({...editingDraft, description: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="E.g., Added better tone guidance..." />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Changelog</label>
                      <input type="text" value={editingDraft.changelog} onChange={e => setEditingDraft({...editingDraft, changelog: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Describe what changed in this version..." />
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col h-[400px]">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Content</label>
                    <textarea 
                      value={editingDraft.content} 
                      onChange={e => setEditingDraft({...editingDraft, content: e.target.value})} 
                      className="w-full flex-1 p-3 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 font-mono whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'test' && (
            <div className="space-y-6 flex flex-col h-full">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>This is a test run only. It does not activate the selected pack and does not change live FCO output.</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 border-b border-slate-200 pb-4 shrink-0">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Test Scope</label>
                  <select value={testMode} onChange={e => { setTestMode(e.target.value as any); setTestDraftId(''); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="summary">Summary Test</option>
                    <option value="procedure">Procedure Test</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pack Source</label>
                  <select value={testPackSource} onChange={e => setTestPackSource(e.target.value as any)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="active">Active Configured Pack</option>
                    <option value="draft">Draft Pack</option>
                  </select>
                </div>
                {testPackSource === 'draft' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Draft</label>
                    <select value={testDraftId} onChange={e => setTestDraftId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                      <option value="">-- Choose Draft --</option>
                      {drafts.filter(d => d.scope === testMode).map(d => (
                        <option key={d.id} value={d.id}>{d.name} (v{d.version})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[400px]">
                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Input Text (Raw {testMode === 'summary' ? 'Summary' : 'Procedure'})</label>
                  <textarea 
                    value={testInput} 
                    onChange={e => setTestInput(e.target.value)} 
                    className="w-full flex-1 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 font-mono whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter raw text here to simulate user input..."
                  />
                  <button 
                    onClick={handleRunTest} 
                    disabled={testRunning}
                    className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {testRunning ? "Running Test..." : "Run Test"}
                  </button>
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Test Result</label>
                  <div className="w-full flex-1 p-3 bg-slate-900 border border-slate-800 rounded-lg overflow-y-auto text-sm text-slate-300 font-mono whitespace-pre-wrap">
                    {testResult ? (
                      <>
                        <div className="mb-4 pb-4 border-b border-slate-800">
                          <span className="font-bold text-indigo-400">Tested Pack: </span>
                          {testResult.testedPack.name} ({testResult.testedPack.source})
                        </div>
                        <div className="mb-4 pb-4 border-b border-slate-800">
                          <span className="font-bold text-emerald-400">Validation Passed: </span>
                          {testResult.validation.passed ? "Yes" : "No"}
                          {testResult.validation.errors?.length > 0 && (
                            <div className="text-rose-400 mt-2 whitespace-pre-wrap">
                              Errors:
                              {testResult.validation.errors.map((e: string, i: number) => <div key={i}>- {e}</div>)}
                            </div>
                          )}
                        </div>
                        <div className="mb-2">
                          <span className="font-bold text-indigo-400">Output JSON:</span>
                        </div>
                        {JSON.stringify(testResult.output, null, 2)}
                      </>
                    ) : (
                      <span className="text-slate-600 italic">No result yet. Run a test to see output.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {data && activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-sm text-indigo-800">
                <h3 className="font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> Summary Pack Preview</h3>
                <p className="mt-2 text-xs">
                  This pack applies to: Summary evaluation, Summary rewrite, PCSB analysis, Summary legal-safe wording, Missing Summary information suggestions.<br/>
                  It does not apply to: Procedure step structure, Procedure sectioning, DOCX export layout.
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">{JSON.stringify(data.summaryPack, null, 2)}</pre>
              </div>
            </div>
          )}

          {data && activeTab === 'procedure' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-sm text-indigo-800">
                <h3 className="font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> Procedure Pack Preview</h3>
                <p className="mt-2 text-xs">
                  This pack applies to: Procedure rewrite, Procedure sectioning, Imperative voice, Active voice, One action per step, Placeholder preservation guidance, Note/Caution/Warning guidance.<br/>
                  It does not apply to: Final Summary wording, PCSB analysis, DOCX export layout.
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">{JSON.stringify(data.procedurePack, null, 2)}</pre>
              </div>
            </div>
          )}

          {data && activeTab === 'prompt' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2">Full Rewrite Prompt Preview</h3>
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>This prompt is used by /api/fco/rewrite. It includes both Summary Pack and Procedure Pack because the rewrite route generates both outputs. Notice the clear scoping of SUMMARY INSTRUCTIONS and PROCEDURE INSTRUCTIONS.</span>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl overflow-x-auto shadow-inner relative">
                   <div className="absolute top-2 right-2 flex gap-2 flex-col items-end opacity-60 pointer-events-none">
                      <span className="text-[10px] bg-slate-800 text-white px-2 py-1 rounded font-bold border border-slate-700">SUMMARY PACK CONTENT</span>
                      <span className="text-[10px] bg-slate-800 text-white px-2 py-1 rounded font-bold border border-slate-700">PROCEDURE PACK CONTENT</span>
                      <span className="text-[10px] bg-red-900/50 text-red-200 px-2 py-1 rounded font-bold border border-red-800">LOCKED SCHEMA — not editable</span>
                   </div>
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{data.compiledPromptPreview}</pre>
                </div>
              </div>

              <div className="space-y-3 mt-8">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2">Summary Evaluation Prompt Preview</h3>
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl">
                  This prompt is used by /api/fco/evaluate-summary. It includes the Summary Pack only.
                </div>
                <div className="bg-slate-900 p-4 rounded-xl overflow-x-auto shadow-inner relative">
                   <div className="absolute top-2 right-2 flex gap-2 flex-col items-end opacity-60 pointer-events-none">
                      <span className="text-[10px] bg-slate-800 text-white px-2 py-1 rounded font-bold border border-slate-700">SUMMARY PACK CONTENT</span>
                      <span className="text-[10px] bg-red-900/50 text-red-200 px-2 py-1 rounded font-bold border border-red-800">LOCKED SCHEMA — not editable</span>
                   </div>
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{data.summaryEvaluationPromptPreview}</pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800 mb-2">Instruction Trace</h2>
              {latestTrace ? (
                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm font-mono text-slate-700">
                    <div>
                      <strong className="block text-slate-800 mb-1">Summary Pack Trace:</strong>
                      ID: {latestTrace.summaryPack?.id}<br/>
                      Version: {latestTrace.summaryPack?.version}<br/>
                      Source: {latestTrace.summaryPack?.source}
                    </div>
                    <div>
                      <strong className="block text-slate-800 mb-1">Procedure Pack Trace:</strong>
                      ID: {latestTrace.procedurePack?.id}<br/>
                      Version: {latestTrace.procedurePack?.version}<br/>
                      Source: {latestTrace.procedurePack?.source}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 font-medium">
                  <TerminalSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No instruction trace available yet. Run a rewrite or evaluate-summary first.
                </div>
              )}
            </div>
          )}

          {activeTab === 'grounding' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800 mb-2">Grounding &amp; Deterministic Corrections</h2>
              {(latestGrounding || (latestCorrections && latestCorrections.length)) ? (
                <GroundingPanel grounding={latestGrounding} corrections={latestCorrections} />
              ) : (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 font-medium">
                  <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No grounding diagnostics yet. Run a rewrite first — retrieval provenance and deterministic corrections are attached to the rewrite response.
                </div>
              )}
            </div>
          )}

          {data && activeTab === 'ste' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-slate-800">STE Guidance</h2>
                <div className="flex gap-2">
                   <button onClick={fetchData} disabled={loading} className="px-3 py-1 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded hover:bg-slate-50 transition-colors disabled:opacity-50">Refresh Status</button>
                   {data.steGuidanceStatus.status === 'available' && (
                      <button onClick={handleSteReindex} disabled={loading} className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded hover:bg-indigo-100 transition-colors disabled:opacity-50">Re-index STE Document</button>
                   )}
                   {data.steGuidanceStatus.status === 'available' && (
                      <button onClick={handleSteRemove} disabled={loading} className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded hover:bg-rose-100 transition-colors disabled:opacity-50">Remove STE Guidance Document</button>
                   )}
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  {data.steGuidanceStatus.status === 'available' ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Available</span>
                  ) : (
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Unknown</span>
                  )}
                </div>
                
                <div className="text-sm text-slate-700 space-y-2 font-mono">
                  <p><strong className="text-slate-900">Document Name:</strong> {data.steGuidanceStatus.documentName || "None"}</p>
                  <p><strong className="text-slate-900">Purpose:</strong> {data.steGuidanceStatus.purpose}</p>
                  <p><strong className="text-slate-900">Mode:</strong> {data.steGuidanceStatus.mode}</p>
                  <p><strong className="text-slate-900">Indexed:</strong> {data.steGuidanceStatus.indexed ? 'Yes' : 'No'}</p>
                  <p><strong className="text-slate-900">Chunk Count:</strong> {data.steGuidanceStatus.chunkCount || 0}</p>
                  {data.steGuidanceStatus.lastIndexedAt && (
                    <p><strong className="text-slate-900">Last Indexed:</strong> {new Date(data.steGuidanceStatus.lastIndexedAt).toLocaleString()}</p>
                  )}
                </div>
                
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex gap-2 mt-4">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span><strong>Policy Warning:</strong> Only the approved STE document may be used for guidance. Other internal/private documents must not be used as RAG/source-truth inputs.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 border-t border-slate-100 pt-6">
                  <div>
                    <h3 className="font-bold text-sm text-emerald-800 mb-2 uppercase tracking-wide">Used for:</h3>
                    <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                      <li>approved wording guidance</li>
                      <li>active voice guidance</li>
                      <li>imperative procedure style</li>
                      <li>one instruction per sentence</li>
                      <li>Note/Caution/Warning writing conventions</li>
                      <li>short sentence guidance</li>
                      <li>noun cluster and terminology consistency guidance</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-rose-800 mb-2 uppercase tracking-wide">Not used for:</h3>
                    <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                      <li>SWI IDs</li>
                      <li>InTouch IDs</li>
                      <li>part numbers</li>
                      <li>torque values</li>
                      <li>pressure values</li>
                      <li>serial ranges</li>
                      <li>software versions</li>
                      <li>figure/table numbers</li>
                      <li>equipment-specific facts</li>
                      <li>DOCX export</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <label className="block mb-2 text-sm font-bold text-slate-800">
                    Upload or replace approved STE Quick Reference Guide
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    Only the approved STE Quick Reference Guide may be uploaded here. Do not upload legal, private, customer, handbook, template, or equipment-specific documents.
                  </p>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      accept=".pdf" 
                      onChange={handleSteUpload} 
                      disabled={uploadingSte || loading}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {uploadingSte && <span className="text-xs text-indigo-600 font-bold whitespace-nowrap animate-pulse">Uploading...</span>}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
