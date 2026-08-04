import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, AlertCircle, X, ChevronRight, Loader2 } from 'lucide-react';
import { DocxAnalysisResponse } from '../types';
import { parseJsonResponse } from '../utils/apiResponse';

interface DocxUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyzed: (result: DocxAnalysisResponse) => void;
}

export default function DocxUploadModal({ isOpen, onClose, onAnalyzed }: DocxUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle');
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragActive, setIsDragActive] = useState(false);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (status === 'uploading' || status === 'analyzing') return;

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelection(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelection(file);
  };

  const handleFileSelection = (file: File) => {
    if (!file.name.endsWith('.docx')) {
      setErrorMsg('Only .docx files are supported.');
      return;
    }
    // 50MB max file size check just in case
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File exceeds maximum upload size.');
      return;
    }

    setSelectedFile(file);
    setStatus('idle');
    setErrorMsg(null);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setStatus('idle');
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setStatus('uploading');
    setErrorMsg(null);
    setProgressMsg('Uploading document...');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setTimeout(() => setProgressMsg('Reading Word document...'), 500);
      setTimeout(() => setProgressMsg('Detecting first-page metadata...'), 1500);
      setTimeout(() => setProgressMsg('Detecting Summary section...'), 2500);
      setTimeout(() => setProgressMsg('Detecting Procedure section...'), 3500);
      setTimeout(() => setProgressMsg('Detecting figures and captions...'), 4500);
      setTimeout(() => setProgressMsg('Detecting procedure tables...'), 5500);
      
      const res = await fetch('/api/docx/analyze', {
        method: 'POST',
        body: formData
      });

      setProgressMsg('Preparing extraction preview...');
      
      const data: DocxAnalysisResponse = await parseJsonResponse(res);
      setStatus('success');
      
      setTimeout(() => {
         onAnalyzed(data);
         onClose(); // Automatically close on success
      }, 500);
      
    } catch (err: any) {
      setStatus('error');
      let msg = err.message || 'Unknown error occurred.';
      if (msg.includes('Expected JSON')) {
          msg = 'DOCX analyze endpoint returned HTML instead of JSON. Check backend route/proxy.';
      }
      setErrorMsg(msg);
    }
  };

  const handleCancelClick = () => {
     if (status === 'uploading' || status === 'analyzing') {
         if (!window.confirm('Analysis is running. Are you sure you want to cancel?')) {
            return;
         }
     }
     onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm"
         onClick={handleCancelClick}>
       
       <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}>
            
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
             <div>
               <h2 className="text-xl font-bold text-slate-800">Upload FCO Word Document</h2>
               <p className="text-sm text-slate-500 mt-1">Upload a .docx draft. The app will extract only the FCO metadata, Summary, Procedure, figures, and tables for review.</p>
             </div>
             <button onClick={handleCancelClick} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
             </button>
          </div>

          {/* Body */}
          <div className="p-8 overflow-y-auto">
             
             {!selectedFile ? (
                 <div className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`} 
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}>
                    <input type="file" ref={fileInputRef} onChange={handleFileInput} className="hidden" accept=".docx" />
                    <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <p className={`text-lg font-bold ${isDragActive ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {isDragActive ? 'Drop the FCO Word document to upload' : 'Drag and drop FCO Word document here'}
                    </p>
                    {!isDragActive && (
                        <>
                           <p className="text-sm text-indigo-600 font-semibold my-2">or browse file</p>
                           <p className="text-xs text-slate-500">Only .docx files are supported.</p>
                        </>
                    )}
                 </div>
             ) : (
                <div className="flex flex-col items-center justify-center p-10 border border-slate-200 rounded-xl bg-slate-50">
                   <FileText className="w-12 h-12 text-indigo-600 mb-4" />
                   <h3 className="text-lg font-bold text-slate-800">{selectedFile.name}</h3>
                   <p className="text-sm text-slate-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                   
                   {status === 'idle' && (
                       <div className="mt-8 flex flex-col items-center gap-4">
                           <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                               Ready to analyze
                           </span>
                           <div className="flex gap-3">
                               <button onClick={clearFile} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg transition-colors shadow-sm">
                                   Clear File
                               </button>
                               <button onClick={handleAnalyze} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-md flex items-center gap-2">
                                   Analyze Document
                                   <ChevronRight className="w-4 h-4" />
                               </button>
                           </div>
                       </div>
                   )}

                   {(status === 'uploading' || status === 'analyzing') && (
                       <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-sm">
                           <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                           <p className="text-sm font-mono font-bold text-indigo-700">{progressMsg}</p>
                           <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                               <div className="h-full bg-indigo-600 animate-pulse rounded-full" style={{ width: '100%' }}></div>
                           </div>
                       </div>
                   )}

                   {status === 'error' && (
                       <div className="mt-6 flex flex-col items-center gap-4 w-full">
                           <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-sm max-w-md w-full">
                               <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                               <div className="break-words w-full">{errorMsg}</div>
                           </div>
                           <button onClick={clearFile} className="px-5 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                               Try Another File
                           </button>
                       </div>
                   )}
                </div>
             )}

          </div>

       </div>
    </div>
  );
}
