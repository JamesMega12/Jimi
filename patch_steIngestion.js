const fs = require('fs');
let content = fs.readFileSync('src/server/steIngestionService.ts', 'utf-8');
content = content.replace(/export async function reindexSteDocument[\s\S]*$/, `export async function reindexSteDocument(id: string): Promise<void> {
    const docs = getDocuments();
    const doc = docs.find(d => d.id === id);
    if (!doc) throw new Error('Document not found.');

    doc.status = 'indexing';
    saveDocument(doc);
    
    try {
        const sourcePath = require('path').join(process.cwd(), 'src', 'server', 'data', 'uploads', 'ste_source.pdf');
        if (!require('fs').existsSync(sourcePath)) throw new Error('Source file not found.');
        
        const extractedText = await extractTextFromFile(sourcePath, doc.name);
        if (!extractedText.trim()) throw new Error("Text extraction returned completely empty document.");
        
        const chunksWithoutEmbed = await chunkExtractedText(extractedText, id, doc.name, doc.type as string, doc.version);
        const chunksWithEmptyEmbed = chunksWithoutEmbed.map(c => ({ ...c, embedding: [] }));
        
        replaceDocumentChunks(id, chunksWithEmptyEmbed as KBChunk[]);
        
        doc.status = 'indexed';
        doc.chunkCount = chunksWithEmptyEmbed.length;
        doc.indexedAt = new Date().toISOString();
        doc.errorMessage = undefined;
        saveDocument(doc);
    } catch (err: any) {
        doc.status = 'failed';
        doc.errorMessage = err.message || String(err);
        saveDocument(doc);
        throw err;
    }
}`);
fs.writeFileSync('src/server/steIngestionService.ts', content);
