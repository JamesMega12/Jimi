import fs from 'fs';
import path from 'path';
import { InstructionPackDraft } from './types';
import crypto from 'crypto';

const DRAFTS_DIR = path.join(process.cwd(), 'data', 'instructionPacks', 'drafts');

function ensureDir() {
  if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  }
}

export async function getDrafts(): Promise<InstructionPackDraft[]> {
  ensureDir();
  const files = fs.readdirSync(DRAFTS_DIR);
  const drafts: InstructionPackDraft[] = [];
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = fs.readFileSync(path.join(DRAFTS_DIR, file), 'utf-8');
        drafts.push(JSON.parse(content));
      } catch (err) {
        console.error(`Error reading draft ${file}:`, err);
      }
    }
  }
  return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function saveDraft(draft: InstructionPackDraft): Promise<InstructionPackDraft> {
  ensureDir();
  
  if (!draft.id) {
    draft.id = crypto.randomUUID();
  }
  
  const now = new Date().toISOString();
  if (!draft.createdAt) {
    draft.createdAt = now;
  }
  draft.updatedAt = now;
  
  fs.writeFileSync(path.join(DRAFTS_DIR, `${draft.id}.json`), JSON.stringify(draft, null, 2));
  return draft;
}

export async function deleteDraft(id: string): Promise<boolean> {
  ensureDir();
  const filePath = path.join(DRAFTS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}
