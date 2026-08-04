import express from 'express';
import multer from 'multer';
import { parseDocx } from '../docx/docxParserService';
import { DocxAnalysisResponse } from '../../types';

export const docxRoutes = express.Router();
export const docxCache = new Map<string, DocxAnalysisResponse>();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const isDocx =
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.toLowerCase().endsWith(".docx");

    if (!isDocx) {
      return cb(new Error("Only .docx files are supported."));
    }

    cb(null, true);
  }
});

docxRoutes.post('/analyze', upload.single('file'), (req, res) => {
  try {
    console.log("[DOCX] Analyze route hit");
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded', code: 'NO_FILE' });
    }
    
    console.log("[DOCX] File received:", req.file.originalname, req.file.size);

    const documentId = `doc-${Date.now()}`;
    const result = parseDocx(req.file.buffer, req.file.originalname, documentId);
    
    docxCache.set(documentId, result);
    return res.json(result);
  } catch (error) {
    console.error("[DOCX] Error analyzing file:", error);
    return res.status(500).json({
      error: "Failed to analyze DOCX.",
      code: "DOCX_ANALYZE_FAILED",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

docxRoutes.get('/:documentId/extraction', (req, res) => {
  const docId = req.params.documentId;
  if (docxCache.has(docId)) {
    return res.json(docxCache.get(docId));
  } else {
    return res.status(404).json({ error: 'Document not found' });
  }
});

docxRoutes.delete('/:documentId', (req, res) => {
  docxCache.delete(req.params.documentId);
  return res.json({ success: true });
});
