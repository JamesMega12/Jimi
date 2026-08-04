import fs from 'fs';
import path from 'path';
import { ActiveRegistry } from './types';

const REGISTRY_FILE = path.join(process.cwd(), 'data', 'instructionPacks', 'activeRegistry.json');
const DRAFTS_DIR = path.join(process.cwd(), 'data', 'instructionPacks', 'drafts');

function ensureRegistryExists() {
  const dir = path.dirname(REGISTRY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(REGISTRY_FILE)) {
    const defaultRegistry: ActiveRegistry = {
      summary: {
        activePackId: 'summary-pack-default',
        source: 'bundled_default',
        history: []
      },
      procedure: {
        activePackId: 'procedure-pack-default',
        source: 'bundled_default',
        history: []
      }
    };
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(defaultRegistry, null, 2));
  }
}

export function getActiveRegistry(): ActiveRegistry {
  ensureRegistryExists();
  const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
  return JSON.parse(data);
}

export function saveActiveRegistry(registry: ActiveRegistry) {
  ensureRegistryExists();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}
