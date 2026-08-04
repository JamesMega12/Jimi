import React, { useState, useEffect } from 'react';
import { KBDocument } from '../types';
import { 
  X, UploadCloud, Trash2, BookOpen, AlertCircle, CheckCircle, 
  HelpCircle, Calendar, RefreshCw, FileText, Settings, Badge, AlertTriangle, Layers
} from 'lucide-react';
import { parseJsonResponse } from '../utils/apiResponse';

interface SourceTruthAdminPageProps {
  onClose: () => void;
}

export default function SourceTruthAdminPage({ onClose }: SourceTruthAdminPageProps) {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [retrievalMode, setRetrievalMode] = useState<'uploaded_only' | 'demo_allowed' | 'mixed_debug'>('uploaded_only');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Upload states
  const [uploadName, setUploadName] = useState<string>('');
  const [docType, setDocType] = useState<string>('SLB Communications Handbook');
  const [docVersion, setDocVersion] = useState<string>('1.0.0');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [ingestionResult, setIngestionResult] = useState<{
    success: boolean;
    extractedWordCount: number;
    chunkCount: number;
    elapsedTimeMs: number;
  } | null>(null);

  // View state
  const [activeTab, setActiveTab] = useState<'manage' | 'test'>('manage');
  
  // Test states
  const [testQueries] = useState([
    "temperature degC unit symbols"
  ]);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testRunning, setTestRunning] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/kb/settings');
      const data = await parseJsonResponse(response);
      setRetrievalMode(data.retrievalMode);
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  const updateSettings = async (mode: 'uploaded_only' | 'demo_allowed' | 'mixed_debug') => {
    try {
      setLoading(true);
      const response = await fetch('/api/kb/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retrievalMode: mode })
      });
      const data = await parseJsonResponse(response);
      setRetrievalMode(data.retrievalMode);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update mode.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSeed = async () => {
    try {
      setLoading(true);
      await fetch('/api/kb/load-seed', { method: 'POST' });
      await fetchDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load seed data.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSeed = async () => {
    try {
      setLoading(true);
      await fetch('/api/kb/clear-seed', { method: 'POST' });
      await fetchDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to clear seed data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/kb/documents');
      const data = await parseJsonResponse(response);
      setDocuments(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to communicate with KB database server.');
    } finally {
      setLoading(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await fetch(`/api/kb/documents/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const data = await parseJsonResponse(res);
      setIngestionResult(null);
      await fetchDocuments();
      setDeletingId(null);
      setSuccessMsg(`Source-truth document deleted successfully! Removed ${data.deletedChunkCount} chunks.`);
    } catch (err: any) {
      setErrorMsg(`Could not delete source-truth document: ${err.message}`);
      setDeletingId(null);
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelection(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.txt' && ext !== '.md' && ext !== '.pdf' && ext !== '.docx') {
      setErrorMsg('Unsupported format. Please select a valid .txt, .md, .pdf, or .docx file.');
      setSelectedFile(null);
      setUploadName('');
      return;
    }
    setSelectedFile(file);
    setUploadName(file.name);
    setErrorMsg(null);
  };

  const runTests = async () => {
    setTestRunning(true);
    setTestResults([]);
    try {
      const response = await fetch('/api/kb/test-retrieval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: testQueries })
      });
      const data = await parseJsonResponse(response);
      if (data.results) {
        setTestResults(data.results);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Retrieval test failed');
    } finally {
      setTestRunning(false);
    }
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select or drop a guideline file to ingest first.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setIngestionResult(null);

    try {
      const reader = new FileReader();
      
      // Promisified reader trigger
      const readAsDataURLPromise = () => new Promise<string>((resolve, reject) => {
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(selectedFile);
      });

      const fileBase64Url = await readAsDataURLPromise();

      // Submit POST
      const res = await fetch('/api/kb/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: uploadName || selectedFile.name,
          type: docType,
          version: docVersion,
          content: fileBase64Url
        })
      });

      const uploadResult = await parseJsonResponse(res);

      if (uploadResult.success) {
        setIngestionResult({
           success: true,
           extractedWordCount: uploadResult.extractedWordCount,
           chunkCount: uploadResult.chunkCount,
           elapsedTimeMs: uploadResult.elapsedTimeMs
        });
        setSelectedFile(null);
        setUploadName('');
        await fetchDocuments();
      } else {
        throw new Error(uploadResult.error || 'Ingestion completed but chunking pipeline returned failed status.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ingestion workflow threw exception.');
    } finally {
      setLoading(false);
    }
  };

  const uploadedDocs = documents.filter(d => !d.isSeedData);
  const seededDocs = documents.filter(d => d.isSeedData);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans overflow-hidden" id="kb-admin-overlay">
      <div className="bg-slate-50 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col h-[90vh] md:h-[80vh] border border-slate-200" id="kb-admin-container">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white rounded-t-2xl flex items-center justify-between border-b border-slate-950">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5.5 h-5.5 text-indigo-400" />
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider">Approved Guidelines Knowledge Base</h1>
              <p className="text-xxs text-slate-400 leading-normal font-mono">Source-truth RAG and Linguistic Style Management</p>
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

        {/* Modal Body Grid */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left: Guideline Files Index (8 cols) */}
          <div className="lg:col-span-8 p-6 overflow-y-auto flex flex-col space-y-4 border-r border-slate-200 bg-[#f8fafc]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveTab('manage')}
                  className={`text-xs font-extrabold uppercase tracking-widest pb-1 transition-all ${activeTab === 'manage' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Manage Sources ({documents.length})
                </button>
                <button 
                  onClick={() => setActiveTab('test')}
                  className={`text-xs font-extrabold uppercase tracking-widest pb-1 transition-all ${activeTab === 'test' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Retrieval Test
                </button>
              </div>
              <div className="flex items-center gap-3">
                 <button 
                   onClick={async () => {
                     if (!window.confirm("Are you sure you want to completely re-index all uploaded (non-seed) documents?")) return;
                     try {
                        setLoading(true);
                        setErrorMsg(null);
                        const res = await fetch('/api/kb/documents/reindex-all', { method: 'POST' });
                        const json = await res.json();
                        if (json.success) {
                           setSuccessMsg(`Successfully re-indexed all source truth documents.`);
                           await fetchDocuments();
                        } else {
                           throw new Error(json.error || 'Re-index all failed');
                        }
                     } catch(err: any) {
                        setErrorMsg(err.message);
                     } finally {
                        setLoading(false);
                     }
                   }}
                   className="text-xxs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer border border-slate-200 px-2 py-1 flex-shrink-0 bg-white rounded"
                 >
                   <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />
                   Re-index All
                 </button>
                 <button 
                   onClick={fetchDocuments}
                   className="text-xxs font-bold text-indigo-650 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                 >
                   <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                   Refresh DB
                 </button>
              </div>
            </div>

            {/* Source Truth Settings Bar */}
            {activeTab === 'manage' && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-xxs">
                 <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <div>
                       <span className="text-xxs font-bold text-slate-800 block">Operating Mode</span>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => updateSettings('uploaded_only')} className={`px-2 py-1 text-xxxs font-bold rounded ${retrievalMode === 'uploaded_only' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                       Uploaded Only
                    </button>
                    <button onClick={() => updateSettings('demo_allowed')} className={`px-2 py-1 text-xxxs font-bold rounded ${retrievalMode === 'demo_allowed' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                       Demo Allowed
                    </button>
                    <button onClick={() => updateSettings('mixed_debug')} className={`px-2 py-1 text-xxxs font-bold rounded ${retrievalMode === 'mixed_debug' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                       Mixed Debug
                    </button>
                 </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xxs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xxs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
                <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:bg-emerald-100 p-1 rounded">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {activeTab === 'manage' ? (
              <div className="flex-1 overflow-y-auto pr-1 pb-4 space-y-6">
                
                {/* Uploaded Documents Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2">Uploaded Source Truths</h3>
                  {uploadedDocs.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xxs flex flex-col items-center">
                       <FileText className="w-8 h-8 mb-2 opacity-50" />
                       No uploaded source-truth documents active. Default embedded app rules will be used.
                    </div>
                  ) : (
                    uploadedDocs.map(doc => (
                      <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} deletingId={deletingId} setDeletingId={setDeletingId} setIngestionResult={setIngestionResult} fetchDocuments={fetchDocuments} setLoading={setLoading} loading={loading} setErrorMsg={setErrorMsg} />
                    ))
                  )}
                </div>

                {/* Seeded Documents Section */}
                {retrievalMode !== 'uploaded_only' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                       <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest opacity-80">Seeded Demo Guides</h3>
                       <div className="flex gap-2">
                         {seededDocs.length > 0 ? (
                           <button onClick={handleClearSeed} disabled={loading} className="text-xxxs font-bold text-rose-500 px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded">Clear Demo Records</button>
                         ) : (
                           <button onClick={handleLoadSeed} disabled={loading} className="text-xxxs font-bold text-indigo-500 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded">Load Demo Seed Guides</button>
                         )}
                       </div>
                    </div>
                    {seededDocs.length === 0 ? (
                       <div className="text-xxs text-slate-400 italic">No seeded records. Default seed data is hidden.</div>
                    ) : (
                      seededDocs.map(doc => (
                        <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} deletingId={deletingId} setDeletingId={setDeletingId} setIngestionResult={setIngestionResult} fetchDocuments={fetchDocuments} setLoading={setLoading} loading={loading} setErrorMsg={setErrorMsg} />
                      ))
                    )}
                  </div>
                )}
                {retrievalMode === 'uploaded_only' && seededDocs.length > 0 && (
                   <div className="text-xxs text-slate-400 italic border-t border-slate-200 pt-4">
                      {seededDocs.length} seeded demo guides are hidden as per "Uploaded Only" mode.
                   </div>
                )}
                {retrievalMode === 'uploaded_only' && seededDocs.length === 0 && (
                   <div className="flex gap-2 border-t border-slate-200 pt-4">
                     <button onClick={handleLoadSeed} disabled={loading} className="text-xxxs font-bold text-slate-500 px-2 py-1 border border-slate-200 hover:bg-slate-100 rounded">Restore Demo Seed Guides</button>
                   </div>
                )}

              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-4">
                <div className="flex items-center justify-between bg-indigo-50 p-4 border border-indigo-100 rounded-xl">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-indigo-900">Health Check Suite</h3>
                    <p className="text-xxs text-indigo-700">Test RAG semantic weighting and exact-match keyword boosting.</p>
                  </div>
                  <button 
                    onClick={runTests}
                    disabled={testRunning}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                  >
                    {testRunning ? 'Running...' : 'Execute Checks'}
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1">
                  {testResults.map((res, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xxs font-sans space-y-2">
                       <h4 className="text-xs font-bold text-slate-800">Query: <span className="text-indigo-600">"{res.query}"</span></h4>
                       <div className="text-xxxs font-mono font-bold text-slate-500 uppercase">ROUTING MODE: {res.routingMode || 'N/A'}</div>
                       {res.results && res.results.length > 0 ? (
                         <div className="space-y-3 mt-2">
                           {res.results.map((r: any, idx: number) => (
                             <div key={idx} className="space-y-1 pb-3 mb-3 border-b border-slate-100 last:border-b-0 last:mb-0 last:pb-0">
                               <div className="flex items-center gap-2">
                                 <span className="text-xxs font-mono font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-sm">{r.documentName}</span>
                                 <span className={`text-xxxs font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${r.sourceType === 'seed_data' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                   {r.sourceType === 'seed_data' ? 'SEED' : 'UPLOADED'}
                                 </span>
                               </div>
                               {r.ruleCategory && <div className="text-xxxs font-mono text-slate-400">Rule: {r.ruleCategory}</div>}
                               {r.sectionTitle && <div className="text-xxxs font-mono text-slate-400">Section: {r.sectionTitle}</div>}
                               <p className="text-xxs text-slate-500 italic bg-slate-50 line-clamp-2 leading-relaxed p-2 rounded">
                                 {r.chunkTextPreview}
                               </p>
                               <div className="flex justify-between items-center pt-2">
                                 <span className="text-xxxs font-bold text-slate-400">Score: {r.finalScore}</span>
                                 <span className={`text-xxxs font-bold uppercase ${r.finalScore > 0.4 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                   {r.finalScore > 0.4 ? 'Relevant' : 'Low Relevance'}
                                 </span>
                               </div>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <span className="text-xxs text-slate-400">No match. Only seeded demo data was retrieved. This result is not based on uploaded source-truth documents.</span>
                       )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Ingest Form Fileuploader (4 cols) */}
          <div className="lg:col-span-4 p-6 bg-slate-100 overflow-y-auto flex flex-col space-y-6">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-1">Add Approved Standards</h2>
              <p className="text-xxs text-slate-400 leading-normal">
                Files are chunked, tokenized, and embedded to construct guidelines contexts safely on Gemini query executions.
              </p>
            </div>

            <form onSubmit={handleIngestSubmit} className="space-y-4 flex flex-col flex-1">
              
              {/* Document Type Dropdown */}
              <div className="space-y-1">
                <label className="text-xxs font-bold text-slate-700 uppercase tracking-wider font-sans">
                  Approved Standard Type
                </label>
                <select 
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-sans focus:ring-1 focus:ring-indigo-500 outline-none shadow-xxs"
                >
                  <option value="FCO Template">FCO Template Standard</option>
                  <option value="SLB Communications Handbook">SLB Communications Handbook</option>
                  <option value="STE / Language Guide">STE / Language Guide</option>
                  <option value="TechCom Standard">TechCom Standard</option>
                  <option value="SWI / Procedure Standard">SWI / Procedure Standard</option>
                  <option value="Other Approved Source Truth">Other Approved Source Truth</option>
                </select>
              </div>

              {/* Version & Custom File Title */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xxs font-bold text-slate-700 uppercase tracking-wider">
                    Doc Version
                  </label>
                  <input
                    type="text"
                    required
                    value={docVersion}
                    onChange={(e) => setDocVersion(e.target.value)}
                    placeholder="e.g., v3.5"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500 shadow-xxs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xxs font-bold text-slate-700 uppercase tracking-wider">
                    Override Name
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="Optional title"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-sans outline-none focus:ring-1 focus:ring-indigo-500 shadow-xxs"
                  />
                </div>
              </div>

              {/* Drag n Drop Uploader area */}
              <div className="flex-1 flex flex-col min-h-[160px]">
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl flex-1 flex flex-col items-center justify-center p-5 text-center transition-all ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-50/55' 
                      : selectedFile 
                        ? 'border-emerald-400 bg-emerald-50/20' 
                        : 'border-slate-300 bg-white hover:border-slate-400'
                  }`}
                >
                  <input
                    type="file"
                    id="kb-file-ref"
                    className="hidden"
                    accept=".txt,.md,.pdf,.docx"
                    onChange={handleFileInput}
                  />
                  
                  <label htmlFor="kb-file-ref" className="cursor-pointer space-y-2.5 flex flex-col items-center justify-center w-full h-full">
                    <UploadCloud className={`w-8 h-8 ${selectedFile ? 'text-emerald-500' : 'text-slate-400'}`} />
                    
                    <div className="space-y-1">
                      {selectedFile ? (
                        <>
                          <p className="text-xs font-bold text-emerald-800 break-all px-2">
                            {selectedFile.name}
                          </p>
                          <p className="text-xxs text-emerald-600 font-mono">
                            {(selectedFile.size / 1024).toFixed(1)} KB • Click to swap
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-slate-700">
                            Drag & drop or <span className="text-indigo-600 hover:underline">browse</span>
                          </p>
                          <p className="text-xxxs text-slate-400 max-w-[200px] leading-normal mx-auto">
                            Only approved formatted guidelines (.txt, .md, .pdf, .docx). Max 10MB.
                          </p>
                        </>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit trigger button */}
              <button
                type="submit"
                disabled={loading || !selectedFile}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-all ${
                  loading 
                    ? 'bg-slate-400 text-slate-100 cursor-not-allowed' 
                    : selectedFile 
                      ? 'bg-indigo-650 hover:bg-indigo-800 text-white shadow-md active:translate-y-[1px] cursor-pointer' 
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Ingesting...
                  </>
                ) : (
                  'Ingest & Segment'
                )}
              </button>

            </form>

          </div>

        </div>

      </div>
    </div>
  );
}

// Subcomponent for Document Display
function DocumentCard({ doc, onDelete, deletingId, setDeletingId, setIngestionResult, fetchDocuments, setLoading, loading, setErrorMsg }: any) {
  const isDeleting = deletingId === doc.id;
  
  let mappedStatus = "Diagnostics Missing";
  let statusColor = "text-slate-500";
  let statusDotColor = "text-slate-400";
  
  if (doc.status === 'indexed_clean') {
     mappedStatus = "INDEXED CLEAN";
     statusColor = "text-emerald-600";
     statusDotColor = "text-emerald-600";
  } else if (doc.status === 'indexed_warning') {
     mappedStatus = "INDEXED WITH WARNINGS";
     statusColor = "text-amber-600";
     statusDotColor = "text-amber-600";
  } else if (doc.status === 'failed') {
     mappedStatus = "INDEX FAILED";
     statusColor = "text-rose-600";
     statusDotColor = "text-rose-600";
  } else if (doc.status === 'processing') {
     mappedStatus = "INDEXING IN PROGRESS";
     statusColor = "text-indigo-600 animate-pulse";
     statusDotColor = "text-indigo-600 animate-pulse";
  }
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xxs font-sans relative hover:border-slate-300 transition-all opacity-100">
      <div className="flex justify-between items-start">
        <div className="space-y-1 max-w-[85%]">
          <h4 className="text-xs font-bold text-slate-900 leading-snug">{doc.name}</h4>
          <div className="flex items-center gap-2 flex-wrap">
            {doc.sourceType === 'seed_data' || doc.isSeedData ? (
              <span className="text-xxxs font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-sm">
                SEEDED DEMO GUIDE
              </span>
            ) : (
              <span className="text-xxxs font-mono font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-sm">
                UPLOADED SOURCE TRUTH
              </span>
            )}
            {doc.type && (
               <span className="text-xxxs font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm">
                 {doc.type}
               </span>
            )}
            {doc.version && (
               <span className="text-xxxs font-mono text-slate-500">
                 v{doc.version}
               </span>
            )}
            {doc.uploadedAt && (
              <span className="text-xxxs font-mono text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(doc.uploadedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isDeleting && (
            <button
               onClick={() => setDeletingId(null)}
               className="text-xs font-bold text-slate-500 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
            >
              Cancel
            </button>
          )}
          <button 
            onClick={() => onDelete(doc.id)}
            disabled={loading || doc.isSeedData || doc.id.startsWith('seal-') || doc.sourceType === 'seed_data'}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              (doc.isSeedData || doc.id.startsWith('seal-') || doc.sourceType === 'seed_data')
                ? 'text-slate-300 cursor-not-allowed opacity-50' 
                : isDeleting 
                  ? 'bg-rose-600 text-white hover:bg-rose-700 px-3 py-1 flex items-center gap-1 font-bold text-xs'
                  : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
            }`}
            title={(doc.isSeedData || doc.id.startsWith('seal-') || doc.sourceType === 'seed_data') ? "Seeded demo guides cannot be deleted via the trash icon (Use Clear Demo Records button)" : "Delete Guideline Document"}
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
               isDeleting ? <>Confirm Delete</> : <Trash2 className="w-4.5 h-4.5" />
            }
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 mt-3 pt-2.5">
        <span className="text-xxs font-mono text-slate-400 flex flex-col gap-1">
          <div>
              Status:{' '} 
              <span className={`font-bold uppercase tracking-wider text-xxxs ${statusColor}`}>
                ● {mappedStatus}
              </span>
          </div>
          {mappedStatus === "Diagnostics Missing" && (
             <div className="text-amber-600 italic mt-0.5">Note: Document status field missing from backend response.</div>
          )}
        </span>

        <div className="flex items-center gap-2">
          <span className="text-xxs font-mono text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            {doc.chunkCount ?? 0} active chunks
          </span>
          {!doc.id.startsWith('seal-') && !doc.isSeedData && doc.sourceType !== 'seed_data' && (
            <button 
              onClick={async () => {
                 try {
                    setLoading(true);
                    const res = await fetch(`/api/kb/documents/${doc.id}/reindex`, { method: 'POST' });
                    const json = await res.json();
                    if (json.success) {
                       setIngestionResult({
                          success: true,
                          extractedWordCount: 0,
                          chunkCount: json.chunkCount,
                          elapsedTimeMs: 0
                       });
                       await fetchDocuments();
                    } else { throw new Error(json.error || 'Re-index failed'); }
                 } catch (e: any) {
                    setErrorMsg(e.message || 'Re-index failed');
                 } finally { setLoading(false); }
              }}
              disabled={loading}
              className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 text-xxxs font-bold px-2 py-0.5 rounded transition-all cursor-pointer"
            >
              RE-INDEX
            </button>
          )}
        </div>
      </div>
      
      {doc.status === 'indexed_warning' && doc.chunkCount > 0 && (
        <div className={`mt-3 p-2 border flex items-start gap-2 rounded-lg bg-amber-50 border-amber-100`}>
           <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600`} />
           <span className={`text-xxs font-bold leading-tight text-amber-800`}>
             This document was indexed with warnings. There may be empty chunks, corrupted chunks, or under-chunked content. Retrieval quality may be affected.
           </span>
        </div>
      )}
      
      {doc.avgChunkWords !== undefined && doc.avgChunkWords >= 0 && (
         <div className="mt-2 bg-slate-50 border border-slate-100 rounded p-2 grid grid-cols-5 gap-2 text-xxxs font-mono text-slate-500">
           <div><span className="block font-bold">STATUS</span><span className={statusColor}>{mappedStatus.toUpperCase()}</span></div>
           <div><span className="block font-bold">AVG W.</span>{Math.round(doc.avgChunkWords || 0)}</div>
           <div><span className="block font-bold">MAX W.</span>{doc.maxChunkWords || 0}</div>
           <div><span className="block font-bold">EMPTY</span>{doc.emptyChunkCount || 0}</div>
           <div><span className="block font-bold">CORRUPT</span><span className={doc.corruptChunkCount && doc.corruptChunkCount > 0 ? "text-rose-600 font-black" : ""}>{doc.corruptChunkCount || 0}</span></div>
         </div>
      )}
    </div>
  );
}